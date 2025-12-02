# Fix: Stims Re-roll Async Race Condition

**Status**: Planned
**Priority**: High (affects core mechanic - stims reroll)
**Related Issues**: Stims re-rolling rolls both addiction clock and action dice inconsistently

---

## Problem Statement

When a player uses Stims to resist a consequence, the re-roll sometimes includes the addiction roll in the dice chat output, and sometimes doesn't. This is a **timing/async race condition** where the dice pool calculation and roll happen before the state transition completes.

### Current Behavior (Buggy)

1. Player uses stims → Addiction clock advances (1d6 posted to chat)
2. State transitions: `GM_RESOLVING_CONSEQUENCE` → `STIMS_ROLLING` → `ROLLING`
3. **Race condition**: Dice pool calculated and rolled **before `ROLLING` state propagates**
4. **Result**: Sometimes the reroll appears correct, sometimes it includes the addiction roll

### Symptom

- Two dice rolls in chat (addiction + action reroll) appearing in rapid succession
- Dice pool calculation is inconsistent/random between runs
- No clear pattern - timing dependent

---

## Root Cause Analysis

**File**: `foundry/module/services/playerActionEventCoordinator.ts:859-983`
**Method**: `handleUseStims()`

### The Race Condition

```typescript
// Line 945-951: Transition to ROLLING state
const rollingAction = diceRollingHandler.createTransitionToRollingAction();
await game.fitgd.bridge.execute(rollingAction as any, {
  affectedReduxIds: [asReduxId(this.context.getCharacterId())],
  silent: true,
});

// ❌ CRITICAL BUG (Lines 954-955): Rolls IMMEDIATELY without waiting
// The state transition is async but returns immediately
// Dice calculation uses stale state from line 917
const dicePool = diceRollingHandler.calculateDicePool(updatedState);  // ← Uses 40-line-old state!
const rollResult = await this.context.getDiceService().roll(dicePool);
```

### Why It's a Problem

1. **Bridge.execute() is async but doesn't block on Redux state propagation**
   - Dispatch happens, but Redux subscribers haven't processed the state change yet
   - Widget doesn't know we're in `ROLLING` state

2. **`updatedState` is stale** (captured at line 917, before final state transitions)
   - Doesn't reflect `STIMS_ROLLING` → `ROLLING` transitions
   - Dice pool calculated from wrong state

3. **Redux subscriptions race with dice rolling**
   - Sometimes subscription catches state change before reroll completes
   - Sometimes after
   - Results in inconsistent behavior

---

## Solution

### Phase 1: Fix Async Sequencing (Primary Fix)

**Location**: `playerActionEventCoordinator.ts:945-955`

Add proper wait between state transition and dice rolling:

```typescript
// After transitioning to ROLLING state
const rollingAction = diceRollingHandler.createTransitionToRollingAction();
await game.fitgd.bridge.execute(rollingAction as any, {
  affectedReduxIds: [asReduxId(this.context.getCharacterId())],
  silent: true,
});

// ✅ NEW: Wait for state transition to propagate (100-200ms buffer)
await new Promise(resolve => setTimeout(resolve, 200));

// ✅ NEW: Recalculate dice pool with fresh state (not stale 'updatedState')
const freshState = game.fitgd.store.getState();
const dicePool = diceRollingHandler.calculateDicePool(freshState);
const rollResult = await this.context.getDiceService().roll(dicePool);
```

### Phase 2: Remove Stale State Capture (Cleanup)

**Location**: `playerActionEventCoordinator.ts:917-920`

Currently used only to check if addiction filled. After Phase 1, replace with fresh state fetch:

```typescript
// ❌ OLD: Stale state captured 40 lines earlier
const updatedState = game.fitgd.store.getState();  // Line 917
const updatedClock = updatedState.clocks.byId[addictionClockId!];

// ✅ NEW: Fetch fresh state right where it's needed
const stateAfterClockAdvance = game.fitgd.store.getState();
const updatedClock = stateAfterClockAdvance.clocks.byId[addictionClockId!];
```

---

## Implementation Plan

### Step 1: Write TDD Tests (BEFORE implementation)

Create `tests/unit/stims-async-timing.test.ts` with:

1. **Test: Stims reroll uses correct dice pool**
   - Mock: State transitions complete before dice rolling
   - Assert: Dice pool matches fresh state calculation
   - Verify: No stale state used

2. **Test: State transition propagates before reroll**
   - Mock: Redux state subscription updates
   - Setup: `ROLLING` state transition
   - Assert: `getDiceService().roll()` called after state change visible
   - Verify: Timing of async operations

3. **Test: Fresh state is used for dice calculation**
   - Setup: Modify character approaches mid-flow
   - Execute: Stims workflow
   - Assert: Reroll uses modified approaches (proves fresh state)
   - Verify: Not using cached state

4. **Test: Addiction lockout still works (no regression)**
   - Setup: Addiction clock at 7/8 segments
   - Advance: Add 2 segments via stims roll
   - Assert: Lockout action triggers (state 8/8)
   - Verify: No reroll attempted

### Step 2: Implement Fix

1. Add 200ms wait after state transition (lines 951-952)
2. Fetch fresh state before dice calculation (line 954)
3. Remove stale state capture or update to use fresh state (line 917)

### Step 3: Verify No Regressions

- Run existing stims tests (46 tests in `stimsHandler.test.ts`)
- Run new async timing tests
- Manual test: Player uses stims, verify only one reroll appears in chat

---

## Testing Strategy

### Unit Tests (Pure Functions)

```typescript
// In handleUseStims, state calculations are pure
// Test: Fresh state is used for dice pool calculation
describe('Stims Async Timing', () => {
  it('should use fresh state for dice pool after transition', () => {
    const initialState = createMockState({
      character: { approaches: { force: 2 } }
    });

    // Execute stims workflow
    // Modify state during flow
    const modifiedState = createMockState({
      character: { approaches: { force: 3 } }
    });

    // Assert: Dice pool reflects modified state (3d, not 2d)
    expect(dicePool).toBe(3);
  });
});
```

### Integration Tests (With Async)

```typescript
// Test that state transitions complete before dice rolling
it('should wait for state transition before calculating dice pool', async () => {
  const stateSpy = jest.spyOn(store, 'getState');

  await handleUseStims();

  // Verify getState was called AFTER transition (not before)
  const transitionCall = stateSpy.mock.results.findIndex(r => r.value.state === 'ROLLING');
  const dicePoolCall = stateSpy.mock.results.findIndex(r => /* dice pool calculation */);

  expect(dicePoolCall).toBeGreaterThan(transitionCall);
});
```

---

## Documentation Updates

After implementation, update:

1. **docs/player-action-widget.md**
   - Add section: "Stims Interrupt Async Flow"
   - Document: Why 200ms wait is needed
   - Link: To relevant async patterns in codebase

2. **docs/mechanics-stims.md**
   - Update: "Implementation Details" section
   - Add: Note about state transition timing
   - Clarify: When reroll actually executes

---

## Risk Assessment

### Low Risk ✅

- **Isolated change**: Only affects stims reroll flow
- **Testable**: Pure function with clear inputs/outputs
- **Observable**: Chat messages show if fix works
- **Reversible**: Can easily adjust wait time if needed

### Edge Cases to Consider

1. **Very fast clients**: 200ms might be overkill
   - Mitigation: Can reduce to 100ms after testing
   - Validation: Multiple test runs confirm consistency

2. **Slow network**: 200ms might not be enough
   - Mitigation: Listen for Redux subscription instead of timeout
   - Future: Replace setTimeout with subscription-aware pattern

3. **Multiple stims in rapid succession**: Not possible per rules
   - Rule: "Once per action" (documented in vault/rules_primer.md)
   - Validation: `stimsUsedThisAction` flag prevents this

---

## Acceptance Criteria

- [ ] All new async timing tests pass
- [ ] All existing stims tests pass (no regression)
- [ ] Manual test: Stims reroll shows only ONE roll in chat
- [ ] Manual test: Lockout still works when addiction fills
- [ ] Type check: `npm run type-check:all` passes
- [ ] Build: `npm run build` succeeds

---

## Related Documentation

- `docs/player-action-widget.md` - State machine and transitions
- `docs/mechanics-stims.md` - Stims mechanics and rules
- `vault/rules_primer.md:290` - "Once per action, you may use Stims"

