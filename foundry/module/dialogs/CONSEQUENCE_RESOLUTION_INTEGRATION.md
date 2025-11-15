# ConsequenceResolutionDialog Integration Guide

## Overview

The `ConsequenceResolutionDialog` is a new GM-facing dialog that uses the typed clock system and context-based interaction calculations. It provides a streamlined UI for selecting which clock to affect after a roll.

**Status**: ✅ Created, not yet integrated into player action widget

## Current State vs New Dialog

### Current Implementation (Player Action Widget)

**Location**: `foundry/module/widgets/player-action-widget.ts` + template
**State**: `GM_RESOLVING_CONSEQUENCE`
**Data Model**: `ConsequenceTransaction`

The existing flow:
1. Player rolls and gets partial/failure
2. GM sees `GM_RESOLVING_CONSEQUENCE` state in widget
3. GM selects consequence type (harm vs crew-clock)
4. GM selects target character (for harm)
5. GM selects specific clock via ClockSelectionDialog
6. GM clicks "Apply" to dispatch actions

**Pros:**
- Integrated into widget (no separate dialog)
- Shows live preview of consequence
- Visible to all players

**Cons:**
- Two separate code paths (harm vs crew-clock)
- Doesn't use typed clock categories (harm, threat, progress)
- Doesn't suggest contextual interactions
- Manual selection of direction (advance vs reduce)

### New Implementation (ConsequenceResolutionDialog)

**Location**: `foundry/module/dialogs/ConsequenceResolutionDialog.ts`
**Action**: `applyInteraction`
**Data Model**: `InteractionContext`, `ClockInteraction`

The new flow:
1. GM invokes dialog with `InteractionContext` (outcome, position, effect, etc.)
2. Dialog calls `suggestClockInteractions()` to get smart suggestions
3. Dialog renders clocks grouped by category (harm, threat, progress)
4. Dialog suggests direction (advance/reduce) and amount for each clock
5. GM selects ONE clock via radio button
6. GM can override direction and amount
7. GM clicks "Apply" to dispatch `applyInteraction` action

**Pros:**
- Uses typed clock categories
- Context-aware suggestions (Rally reduces harm, defuse reduces threat)
- Distinguishes threat clocks from progress clocks
- Single code path for all clock types
- Auto-deletes clocks that reach 0

**Cons:**
- Separate dialog window (not integrated into widget)
- Requires converting playerRoundState data to InteractionContext

## Integration Approaches

### Approach 1: Replace GM_RESOLVING_CONSEQUENCE UI (Major Refactoring)

**Replace the existing widget UI with a button that opens ConsequenceResolutionDialog:**

```typescript
// In player-action-widget.ts

/**
 * Handle Configure Consequence button (GM_RESOLVING_CONSEQUENCE state)
 */
private async _onConfigureConsequence(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  const state = game.fitgd.store.getState();
  const playerState = state.playerRoundState.byCharacterId[this.characterId];

  if (!playerState || !this.crewId) return;

  // Build InteractionContext from playerRoundState
  const context: InteractionContext = {
    outcome: playerState.outcome || 'failure',
    position: selectEffectivePosition(state, this.characterId),
    effect: selectEffectiveEffect(state, this.characterId),
    actionType: 'normal', // TODO: Detect Rally/medical/defuse
    actionDescription: playerState.actionDescription,
    characterId: this.characterId,
    crewId: this.crewId,
    dicePool: playerState.dicePool,
    rollResult: playerState.rollResult,
  };

  // Get all available clocks
  const allClocks = Object.values(state.clocks.byId);

  // Open ConsequenceResolutionDialog
  const dialog = new ConsequenceResolutionDialog(context, allClocks, {
    onApply: async (interaction: ClockInteraction) => {
      // Dispatch applyInteraction action
      await game.fitgd.bridge.execute(
        { type: 'clocks/applyInteraction', payload: { interaction, context } },
        { affectedReduxIds: [asReduxId(this.characterId)] }
      );

      // Add momentum gain for consequences
      const momentumGain = selectMomentumGain(state, this.characterId);
      if (momentumGain > 0 && this.crewId) {
        await game.fitgd.bridge.execute(
          {
            type: 'crews/addMomentum',
            payload: { crewId: this.crewId, amount: momentumGain },
          },
          { affectedReduxIds: [asReduxId(this.crewId)] }
        );
      }

      // Transition to next state
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/transitionState',
          payload: { characterId: this.characterId, newState: 'DECISION_PHASE' },
        },
        { affectedReduxIds: [asReduxId(this.characterId)] }
      );

      ui.notifications?.info('Consequence applied');
    },
    onSkip: async () => {
      // Skip consequence, just add momentum and end turn
      const momentumGain = selectMomentumGain(state, this.characterId);
      if (momentumGain > 0 && this.crewId) {
        await game.fitgd.bridge.execute(
          {
            type: 'crews/addMomentum',
            payload: { crewId: this.crewId, amount: momentumGain },
          },
          { affectedReduxIds: [asReduxId(this.crewId)] }
        );
      }

      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/transitionState',
          payload: { characterId: this.characterId, newState: 'DECISION_PHASE' },
        },
        { affectedReduxIds: [asReduxId(this.characterId)] }
      );

      ui.notifications?.info('Consequence skipped');
    },
  });

  dialog.render(true);
}
```

**Template changes (player-action-widget.html):**

```handlebars
{{#if isGMResolvingConsequence}}
<div class="widget-content gm-resolving-consequence">
  <div class="roll-outcome">
    {{#if (eq playerState.outcome "partial")}}
    <h2 class="outcome-partial">⚠️ PARTIAL SUCCESS</h2>
    {{else}}
    <h2 class="outcome-failure">❌ FAILURE</h2>
    {{/if}}
    <div class="dice-display">
      <div class="dice-result">Highest: {{max playerState.rollResult}}</div>
      <div class="dice-rolled">Rolled: {{join playerState.rollResult ", "}}</div>
    </div>
  </div>

  {{#if isGM}}
  <div class="actions">
    <button type="button" data-action="configure-consequence" class="primary-btn">
      ⚙️ Configure Consequence
    </button>
  </div>
  {{else}}
  <p class="waiting">⏳ Waiting for GM to configure consequence...</p>
  {{/if}}
</div>
{{/if}}
```

**Pros:**
- Leverages new typed clock system
- Single code path for all clocks
- Context-aware suggestions

**Cons:**
- Major refactoring
- Breaks existing workflow
- Loses live preview integration

### Approach 2: Add as Alternative Flow (Incremental)

**Keep existing GM_RESOLVING_CONSEQUENCE UI, add new dialog as optional enhancement:**

1. Add a "Use Smart Suggestions" button alongside existing controls
2. Clicking it opens ConsequenceResolutionDialog
3. GM can choose either workflow

**Pros:**
- Non-breaking change
- GM can test new flow without losing old flow
- Gradual migration path

**Cons:**
- Two code paths to maintain
- UI clutter

### Approach 3: Use for Specific Action Types Only

**Use ConsequenceResolutionDialog for Rally/medical/defuse actions only:**

Detect when action type is Rally, medical, or defuse, and automatically open the new dialog (which suggests reduction instead of advancement).

**Pros:**
- Leverages context-aware suggestions where they matter most
- Existing harm/crew-clock flow unchanged

**Cons:**
- Inconsistent UX (different flows for different actions)

## Recommended Approach

**Recommendation: Approach 1 (Replace) with gradual rollout**

1. **Phase 1** (Current session): Commit ConsequenceResolutionDialog as infrastructure
2. **Phase 2** (Next session): Add feature flag to enable new dialog
3. **Phase 3**: Test with playtesters, gather feedback
4. **Phase 4**: Make default, remove old UI

## Migration Checklist

- [ ] Export ConsequenceResolutionDialog from dialogs/index.ts ✅
- [ ] Add feature flag to gameConfig: `useNewConsequenceDialog: boolean`
- [ ] Implement `_onConfigureConsequence` handler in player-action-widget.ts
- [ ] Update template to show "Configure Consequence" button when flag enabled
- [ ] Test with GM + Player clients
- [ ] Add actionType detection (Rally, medical, defuse) to InteractionContext builder
- [ ] Remove ConsequenceTransaction system after migration
- [ ] Remove old GM_RESOLVING_CONSEQUENCE template sections

## Testing Plan

1. **Unit Tests** (already passing):
   - suggestClockInteractions() - 32 tests ✅
   - calculateConsequenceSegments() ✅
   - calculateProgressSegments() ✅
   - calculateReductionSegments() ✅

2. **Integration Tests**:
   - Open dialog with partial success context
   - Verify harm clocks shown with "advance" suggestion
   - Open dialog with Rally action type
   - Verify harm clocks shown with "reduce" suggestion
   - Apply interaction, verify applyInteraction dispatched
   - Verify clock auto-deleted when reduced to 0

3. **Foundry Tests** (manual):
   - Roll partial success, open dialog
   - Verify suggestions match position/effect
   - Select harm clock, verify preview updates
   - Apply, verify clock advances
   - Roll with Rally, verify harm clocks suggest reduction
   - Apply reduction, verify clock decreases
   - Reduce clock to 0, verify deletion

## Open Questions

1. **Momentum gain**: Where should momentum be awarded - in dialog or in widget after dialog closes?
   - **Recommendation**: In widget after dialog closes (keeps dialog focused on clocks only)

2. **Transition state**: Should dialog handle state transition or widget?
   - **Recommendation**: Widget handles it (dialog is reusable, state machine is widget-specific)

3. **Action type detection**: How to detect Rally/medical/defuse?
   - **Recommendation**: Add to playerRoundState when action is initiated, read from context

4. **Crew clocks**: Should threat clocks and progress clocks be visually distinct?
   - **Recommendation**: Yes - use icons and CSS classes (⚠️ threat, ✓ progress)

## Next Steps

**Immediate (Session 4)**:
1. ✅ Export ConsequenceResolutionDialog from dialogs/index.ts
2. ✅ Commit new dialog as infrastructure
3. Create this integration guide

**Future (Session 5+)**:
1. Add feature flag to gameConfig
2. Implement Approach 1 behind feature flag
3. Test with playtesters
4. Gather feedback and iterate
5. Make default after validation

---

**Created**: 2025-11-15 (Session 4)
**Status**: Ready for integration
