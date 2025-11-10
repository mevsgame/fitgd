# Bridge API - Quick Usage Guide

**Status:** ✅ All critical antipatterns eliminated. Bridge API is integrated and ready to use.

---

## TL;DR - The Only Pattern You Need

```javascript
// ✅ CORRECT - Single Redux action
await game.fitgd.bridge.execute(
  { type: 'action', payload: {...} }
);

// ✅ CORRECT - Multiple related actions (prevents race conditions)
await game.fitgd.bridge.executeBatch([
  { type: 'action1', payload: {...} },
  { type: 'action2', payload: {...} }
]);
```

**That's it.** The Bridge automatically:
- Dispatches to Redux
- Broadcasts to all clients (GM + Players)
- Refreshes affected character/crew sheets

---

## ⚠️ NEVER DO THIS ⚠️

```javascript
// ❌ WRONG - Direct dispatch (state won't propagate to other clients)
game.fitgd.store.dispatch({ type: 'action', payload: {...} });

// ❌ WRONG - Manual broadcast/refresh (error-prone, causes race conditions)
game.fitgd.store.dispatch({ type: 'action', payload: {...} });
await game.fitgd.saveImmediate();
refreshSheetsByReduxId([id], false);
```

**Rule:** If you see `store.dispatch` or `saveImmediate` in your code, you're doing it wrong.

**Exception:** Socket handlers in `receiveCommandsFromSocket()` (lines 984-1050 in fitgd.mjs) intentionally use bare dispatch to prevent infinite loops. DO NOT refactor these!

---

## Common Patterns

### 1. Single State Change

**Example: Player selects action**

```javascript
async _onActionChange(event) {
  const action = event.currentTarget.value;

  await game.fitgd.bridge.execute({
    type: 'playerRoundState/setAction',
    payload: { characterId: this.characterId, action }
  });
  // That's it! UI updates automatically via subscription
}
```

### 2. Multiple Related Changes (Batch)

**Example: Committing a roll with multiple state updates**

```javascript
async _onCommitRoll() {
  // Batch all related changes together
  await game.fitgd.bridge.executeBatch([
    { type: 'playerRoundState/setRollResult', payload: {...} },
    { type: 'playerRoundState/setGmApproved', payload: {...} },
    { type: 'playerRoundState/transitionState', payload: {...} }
  ], { affectedReduxIds: [this.characterId] });

  // Single broadcast, single refresh - no race conditions!
}
```

**Why batch?** Prevents render race conditions when making multiple state changes. Always batch related operations.

### 3. Creating New Entities (Clocks, Traits)

**Example: Adding a harm clock**

```javascript
async _onCreate(event) {
  const clockId = uuidv4();

  await game.fitgd.bridge.execute({
    type: 'clocks/createClock',
    payload: {
      clockId,
      entityId: this.characterId,
      clockType: 'harm',
      subtype: 'Physical Harm',
      maxSegments: 6
    }
  }, {
    affectedReduxIds: [this.characterId],
    force: true  // Force full re-render for new elements
  });

  ui.notifications.info('Harm clock created');
}
```

**Note:** Use `force: true` when creating new visual elements to ensure template re-renders.

### 4. Complex Transactions (Traits, Equipment)

**Example: Flashback trait consolidation**

```javascript
async _applyTransaction(transaction) {
  const actions = [];

  // Queue removals
  for (const traitId of transaction.traitsToRemove) {
    actions.push({
      type: 'characters/removeTrait',
      payload: { characterId: this.characterId, traitId }
    });
  }

  // Queue new trait
  actions.push({
    type: 'characters/addTrait',
    payload: { characterId: this.characterId, trait: transaction.newTrait }
  });

  // Single batch operation
  await game.fitgd.bridge.executeBatch(actions, {
    affectedReduxIds: [this.characterId],
    force: true
  });
}
```

---

## Query Methods (Read-Only)

The Bridge also provides safe query methods:

```javascript
// Get character state (auto-detects Redux vs Foundry ID)
const character = game.fitgd.bridge.getCharacter(characterId);
console.log(character.actionDots.shoot);

// Get crew state
const crew = game.fitgd.bridge.getCrew(crewId);
console.log(crew.currentMomentum);

// Get clocks by type
const harmClocks = game.fitgd.bridge.getClocks(characterId, 'harm');
console.log(`Character has ${harmClocks.length} harm clocks`);

// Get player round state (combat widget)
const playerState = game.fitgd.bridge.getPlayerRoundState(characterId);
console.log(playerState.state); // 'DECISION_PHASE', 'ROLLING', etc.
```

---

## Options Reference

### `execute(action, options)`

```javascript
await game.fitgd.bridge.execute(action, {
  affectedReduxIds: [characterId, crewId],  // Optional: explicit IDs to refresh
  force: true,                              // Optional: force full re-render
  silent: true                              // Optional: skip sheet refresh
});
```

**When to use options:**

- **`affectedReduxIds`**: When Bridge can't auto-detect (e.g., cross-entity operations)
- **`force: true`**: When creating new DOM elements (clocks, traits, equipment)
- **`silent: true`**: When you need to manually control UI updates (rare)

### `executeBatch(actions, options)`

Same options as `execute()`, but applies to entire batch.

---

## Testing Checklist

When implementing new features:

- [ ] Used `bridge.execute()` or `bridge.executeBatch()` (not direct dispatch)
- [ ] Batched all related state changes together
- [ ] No manual `this.render()` calls in event handlers
- [ ] Tested with **GM + Player clients** (both see changes immediately)
- [ ] Verified UI updates correctly without manual refresh

---

## Migration Checklist

If refactoring old code:

1. **Find the pattern:**
   ```bash
   grep -rn "store.dispatch\|saveImmediate\|refreshSheetsByReduxId" foundry/module/
   ```

2. **Replace with Bridge API:**
   - Single dispatch → `bridge.execute()`
   - Multiple dispatches → `bridge.executeBatch()`
   - Remove `saveImmediate()` and `refreshSheetsByReduxId()` calls

3. **Test with multiple clients**

---

## FAQ

### Q: Can I still use `game.fitgd.api.character.*` methods?

**A:** Yes, but they won't handle broadcast/refresh. Example:

```javascript
// Old pattern (still works but verbose)
game.fitgd.api.character.setActionDots({ characterId, action: 'shoot', dots: 3 });
await game.fitgd.saveImmediate();
refreshSheetsByReduxId([characterId], false);

// Better pattern (Bridge handles everything)
await game.fitgd.bridge.execute({
  type: 'characters/setActionDots',
  payload: { characterId, action: 'shoot', dots: 3 }
});
```

### Q: When should I use `force: true`?

**A:** When creating new visual elements that add DOM nodes:
- Adding clocks
- Adding traits
- Adding equipment
- Major state transitions that restructure the UI

For value updates (Momentum, clock segments, toggles), use default `force: false`.

### Q: What if I need to do something between dispatch and broadcast?

**A:** Use `silent` mode (but this should be rare):

```javascript
await game.fitgd.bridge.execute(action, { silent: true });
// Do custom work here
await game.fitgd.saveImmediate();  // Manual broadcast
refreshSheetsByReduxId([id], false);  // Manual refresh
```

### Q: Why can't I see changes on other clients?

**A:** You probably forgot to use the Bridge API. Check for:
- Direct `store.dispatch()` calls
- Missing `await` on `bridge.execute()`
- Socket handlers (these intentionally don't broadcast)

---

## Where the Bridge is Already Integrated

✅ **fitgd.mjs** - 3 combat hooks (combatStart, updateCombat, combatEnd)
✅ **dialogs.mjs** - 4 dialog patterns (AddTrait, FlashbackTraits)
✅ **player-action-widget.mjs** - 14 handler patterns (complete widget refactored)

All critical antipatterns eliminated. New code should follow these established patterns.

---

## Key Principle

**Make the correct pattern the easy pattern.**

The Bridge API makes it easier to do the right thing than to make mistakes. If you find yourself writing complex dispatch/broadcast/refresh logic, you're probably overthinking it - just use `bridge.execute()`.
