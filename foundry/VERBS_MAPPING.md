# FitGD Game Verbs → API/Macro Mapping

This document maps all player and GM actions from the rules primer to the Redux API and macro availability.

## Status Legend

- ✅ **Fully Implemented** - API method exists and is macro-ready
- ⚠️ **Partially Implemented** - Redux action exists but not exposed in API
- 🔧 **Dialog Only** - Available through dialog, not direct API
- ❌ **Not Implemented** - Needs implementation
- 📝 **Narrative** - Handled narratively, not through code

---

## Player Verbs

### Core Actions

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Action Roll** | 🔧 | `ActionRollDialog` | ✅ Yes | Full dice rolling with Position/Effect |
| **Push Yourself** | ✅ | `game.fitgd.api.action.push()` | ✅ Yes | Spend 1 Momentum for advantage |
| **Flashback** | ✅ | `game.fitgd.api.action.flashback()` | ✅ Yes | Spend 1 Momentum, add trait |
| **Lean into Trait** | ✅ | `game.fitgd.api.character.leanIntoTrait()` | ✅ Yes | Disable trait, gain 2 Momentum |
| **Rally** | ✅ | `game.fitgd.api.character.useRally()` | ✅ Yes | Re-enable trait at 0-3 Momentum |
| **Take Harm** | ✅ | `game.fitgd.api.harm.take()` | ✅ Yes | Fill harm clock based on Position/Effect |
| **Use Stims** | ✅ | `game.fitgd.api.resource.useStim()` | ✅ Yes | Reroll, advance Addiction clock |
| **Use Consumable** | ✅ | `game.fitgd.api.resource.useConsumable()` | ✅ Yes | Use grenade/stim, roll depletion |

### Teamwork Actions

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Assist** | 📝 | N/A | ❌ No | Narrative + bonus dice in Action Roll dialog |
| **Protect** | 📝 | N/A | ❌ No | Narrative + manually apply consequence |
| **Lead Group Action** | 📝 | N/A | ❌ No | Narrative + multiple Action Rolls |

### Character Management

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Create Character** | ✅ | `game.fitgd.api.character.create()` | ✅ Yes | Name, 2 traits, 12 action dots |
| **Add Trait** | ⚠️ | Redux: `addTrait` | ❌ No | Exists in Redux, not exposed in API |
| **Set Action Dots** | ⚠️ | Redux: `setActionDots` | ❌ No | Exists in Redux, not exposed in API |
| **Advance Action Dots** | ✅ | `game.fitgd.api.character.advanceActionDots()` | ✅ Yes | Add 1 dot (milestone reward) |
| **Group Traits** | ✅ | `game.fitgd.api.character.groupTraits()` | ✅ Yes | Combine 3 traits into 1 |
| **Add Equipment** | ✅ | `game.fitgd.api.character.addEquipment()` | ✅ Yes | Add item to character |
| **Remove Equipment** | ✅ | `game.fitgd.api.character.removeEquipment()` | ✅ Yes | Remove item from character |

### Recovery

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Recover from Harm** | ✅ | `game.fitgd.api.harm.recover()` | ✅ Yes | Clear harm clock segments |
| **Convert Harm to Scar** | ✅ | `game.fitgd.api.harm.convertToScar()` | ✅ Yes | Turn filled clock into permanent trait |

---

## GM Verbs

### Consequences & Momentum

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Apply Consequences** | ✅ | `game.fitgd.api.action.applyConsequences()` | ✅ Yes | Generate Momentum based on Position/Effect |
| **Add Momentum** | ✅ | `game.fitgd.api.crew.addMomentum()` | ✅ Yes | Direct Momentum increase |
| **Set Momentum** | ✅ | `game.fitgd.api.crew.setMomentum()` | ✅ Yes | Set to specific value |
| **Perform Reset** | ✅ | `game.fitgd.api.crew.performReset()` | ✅ Yes | Reset Momentum to 5, restore Rally, reduce Addiction |

### Clocks

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Create Progress Clock** | ✅ | `game.fitgd.api.clock.createProgress()` | ✅ Yes | 4/6/8/12 segments |
| **Advance Clock** | ✅ | `game.fitgd.api.clock.advance()` | ✅ Yes | Add segments |
| **Reduce Clock** | ✅ | `game.fitgd.api.clock.reduce()` | ✅ Yes | Remove segments |
| **Delete Clock** | ✅ | `game.fitgd.api.clock.delete()` | ✅ Yes | Remove clock |

### Crew Management

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Create Crew** | ✅ | `game.fitgd.api.crew.create()` | ✅ Yes | Create new crew |
| **Add Character to Crew** | ✅ | `game.fitgd.api.crew.addCharacter()` | ✅ Yes | Assign character to crew |
| **Remove Character from Crew** | ✅ | `game.fitgd.api.crew.removeCharacter()` | ✅ Yes | Unassign character |

---

## Query Verbs (Read-Only)

| Verb | Status | API Method | Macro Ready | Notes |
|------|--------|------------|-------------|-------|
| **Get Character** | ✅ | `game.fitgd.api.character.getCharacter()` | ✅ Yes | Full character state |
| **Get Crew** | ✅ | `game.fitgd.api.crew.getCrew()` | ✅ Yes | Full crew state |
| **Get Momentum** | ✅ | `game.fitgd.api.query.getMomentum()` | ✅ Yes | Current Momentum value |
| **Get Harm Clocks** | ✅ | `game.fitgd.api.query.getHarmClocks()` | ✅ Yes | All harm clocks for character |
| **Get Progress Clocks** | ✅ | `game.fitgd.api.query.getProgressClocks()` | ✅ Yes | All progress clocks for entity |
| **Get Available Traits** | ✅ | `game.fitgd.api.query.getAvailableTraits()` | ✅ Yes | Non-disabled traits |
| **Can Use Rally** | ✅ | `game.fitgd.api.query.canUseRally()` | ✅ Yes | Check if Rally available |
| **Can Use Stim** | ✅ | `game.fitgd.api.query.canUseStim()` | ✅ Yes | Check if Addiction locked |
| **Can Use Consumable** | ✅ | `game.fitgd.api.query.canUseConsumable()` | ✅ Yes | Check if consumable frozen |
| **Is Dying** | ✅ | `game.fitgd.api.query.isDying()` | ✅ Yes | Check if 6/6 harm clock |

---

## Missing/Recommended Additions

### High Priority

1. **character.addTrait()** - ⚠️ Exists in Redux, should be exposed in API
   - Use case: Manually adding traits (not via Flashback)
   - Currently: Dialogs use `store.dispatch` directly
   - Fix: Add wrapper in characterApi.ts

2. **character.setActionDots()** - ⚠️ Exists in Redux, should be exposed in API
   - Use case: Setting action dots to specific value (character creation/editing)
   - Currently: Only `advanceActionDots()` available (increments by 1)
   - Fix: Add wrapper in characterApi.ts

### Medium Priority

3. **Assist Macro** - 📝 Currently narrative
   - Could create a helper macro that:
     - Shows a dialog to select assisted character
     - Logs the assist to chat
     - Reminds player to add +1d to assisted roll

4. **Protect Macro** - 📝 Currently narrative
   - Could create a helper macro that:
     - Shows consequences to protect from
     - Transfers harm to protecting character
     - Logs protection to chat

5. **Group Action Macro** - 📝 Currently narrative
   - Could create a helper macro that:
     - Prompts for all participants
     - Rolls for each participant
     - Uses leader's result
     - Applies harm to leader for each failure

### Low Priority

6. **Bulk Import/Export** - For campaign backups
   - `game.fitgd.foundry.exportState()` exists
   - `game.fitgd.foundry.importState()` exists but needs implementation

7. **Command Replay** - For undo/time-travel
   - `game.fitgd.foundry.exportHistory()` exists
   - `game.fitgd.foundry.replayCommands()` exists but needs implementation

---

## Macro Categories

### Player Hotbar Macros (Recommended)

1. **Action Roll** - Opens action roll dialog
2. **Check Momentum** - Display current Momentum
3. **Lean into Trait** - Quick trait disable
4. **Rally** - Re-enable disabled trait
5. **Flashback** - Add new trait via flashback
6. **Take Harm** - Apply harm consequence

### GM Hotbar Macros (Recommended)

1. **Add Momentum** - Quick Momentum adjustment
2. **Apply Consequences** - Generate Momentum from result
3. **Advance Clock** - Quick clock progress
4. **Perform Reset** - Reset Momentum/Rally/Addiction
5. **Take Harm (NPC)** - Apply harm to NPCs/enemies
6. **Create Clock** - Quick progress clock creation

### Advanced Macros (For Power Users)

1. **Character Builder** - Full character creation wizard
2. **Crew Dashboard** - Display all crew stats
3. **State Inspector** - Debug Redux state
4. **History Viewer** - Browse command history
5. **Bulk Clock Manager** - Manage multiple clocks

---

## Implementation Status Summary

| Category | Implemented | Partially | Missing | Total |
|----------|-------------|-----------|---------|-------|
| Player Actions | 8 | 2 | 3 | 13 |
| GM Actions | 10 | 0 | 0 | 10 |
| Queries | 10 | 0 | 0 | 10 |
| **Total** | **28** | **2** | **3** | **33** |

**Coverage: 85% fully implemented, 6% partially implemented, 9% narrative/missing**

---

## Next Steps

1. **Expose Missing API Methods:**
   - Add `character.addTrait()` wrapper
   - Add `character.setActionDots()` wrapper

2. **Create Teamwork Macros:**
   - Assist macro with chat integration
   - Protect macro with harm transfer
   - Group Action macro with multi-roll

3. **Polish Existing Macros:**
   - Add error handling
   - Add visual feedback (chat messages, notifications)
   - Add keyboard shortcuts

4. **Documentation:**
   - Video tutorials for common macros
   - Macro library with copy-paste examples
   - Best practices guide

---

## Compatibility Notes

- All macros work with Foundry VTT v13+
- Redux API is stable and backwards-compatible
- Dialog classes can be imported dynamically
- State changes auto-update sheets via subscriptions
- No manual refresh needed

---

## Advanced Usage

### Creating Custom Verbs

You can extend the game with custom verbs by:

1. **Creating a custom reducer** in your module
2. **Dispatching Redux actions** directly
3. **Subscribing to state changes** for side effects
4. **Using middleware** for complex workflows

Example:

```javascript
// Custom verb: "Inspire Team" - Give all crew members +1d on next roll
function inspireTeam(crewId) {
  const state = game.fitgd.store.getState();
  const crew = state.crews.byId[crewId];

  // Custom state management (would need custom reducer)
  crew.characters.forEach(characterId => {
    // Add temporary bonus (would need bonus system)
    ui.notifications.info(`${characterId} is inspired! +1d on next roll`);
  });

  // Or use existing Momentum system
  game.fitgd.api.crew.addMomentum({ crewId, amount: 3 });
  ui.notifications.info("Team inspired! Gained 3 Momentum");
}
```

For complex custom verbs, consider:
- Creating a Foundry module that extends FitGD
- Adding custom Redux slices
- Registering custom middleware
- Creating custom dialog classes
