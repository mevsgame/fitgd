# Foundry-Redux Bridge API - Usage Guide

## The Problem This Solves

Before the Bridge API, every piece of Foundry code had to remember 3 steps:

```javascript
// ❌ WRONG: Easy to forget steps, causes bugs
game.fitgd.store.dispatch({ type: 'action', payload: {...} });
await game.fitgd.saveImmediate();  // ← Easy to forget! State won't propagate
refreshSheetsByReduxId([characterId], false);  // ← Easy to forget! UI won't update
```

**Consequences of forgetting:**
- Missing `saveImmediate()` → GM doesn't see changes
- Missing `refreshSheetsByReduxId()` → UI doesn't update
- Multiple `saveImmediate()` calls → render race conditions
- Using Foundry Actor IDs instead of Redux IDs → silent failures

## The Solution: Bridge API

The Bridge API encapsulates the entire pattern:

```javascript
// ✅ CORRECT: Single call, impossible to forget steps
await game.fitgd.bridge.execute(
  { type: 'action', payload: {...} }
);
// Automatically: dispatches → broadcasts → refreshes sheets
```

---

## Integration

### Step 1: Initialize the Bridge (in fitgd.mjs)

```javascript
// In Hooks.once('init')
import { createFoundryReduxBridge } from './foundry-redux-bridge.mjs';

// After creating store and saveImmediate function
game.fitgd.bridge = createFoundryReduxBridge(
  game.fitgd.store,
  game.fitgd.saveImmediate
);

console.log('FitGD | Bridge API initialized');
```

### Step 2: Use the Bridge Instead of Direct Dispatch

**Before (old pattern):**
```javascript
// Character sheet: Lean into trait
async _onLeanIntoTrait(event) {
  event.preventDefault();
  const characterId = this._getReduxId();
  const crewId = this._getCrewId(characterId);
  const traitId = event.currentTarget.dataset.traitId;

  try {
    // Direct API call
    const result = game.fitgd.api.action.leanIntoTrait({
      crewId,
      characterId,
      traitId
    });

    ui.notifications.info(`Leaned into trait. Gained ${result.momentumGenerated} Momentum.`);

    // Manual broadcast
    await game.fitgd.saveImmediate();  // ← Easy to forget!

    // Manual refresh
    this.render(false);  // ← Only refreshes this sheet
    refreshSheetsByReduxId([crewId], false);  // ← Have to manually refresh crew sheet
  } catch (error) {
    ui.notifications.error(`Error: ${error.message}`);
  }
}
```

**After (Bridge pattern):**
```javascript
// Character sheet: Lean into trait
async _onLeanIntoTrait(event) {
  event.preventDefault();
  const characterId = this._getReduxId();
  const crewId = this._getCrewId(characterId);
  const traitId = event.currentTarget.dataset.traitId;

  try {
    // Single Bridge call handles everything
    const result = await game.fitgd.bridge.execute(
      {
        type: 'action/leanIntoTrait',
        payload: { crewId, characterId, traitId }
      },
      { affectedReduxIds: [characterId, crewId] }
    );

    ui.notifications.info(`Leaned into trait. Gained 2 Momentum.`);
  } catch (error) {
    ui.notifications.error(`Error: ${error.message}`);
  }
}
// Bridge automatically:
// 1. Dispatches action
// 2. Broadcasts to all clients
// 3. Refreshes character AND crew sheets
```

---

## API Reference

### `bridge.execute(action, options)`

Execute a single Redux action with automatic broadcast and refresh.

**Parameters:**
- `action` (Object): Redux action with `type` and `payload`
- `options` (Object, optional):
  - `affectedReduxIds` (string[]): IDs to refresh (auto-detected if not provided)
  - `force` (boolean): Force full re-render (default: false)
  - `silent` (boolean): Skip sheet refresh (default: false)

**Returns:** `Promise<void>`

**Example:**
```javascript
await game.fitgd.bridge.execute(
  {
    type: 'clock/addSegments',
    payload: { clockId, amount: 3 }
  },
  { affectedReduxIds: [characterId] }
);
```

---

### `bridge.executeBatch(actions, options)`

Execute multiple Redux actions as a single batch. **Critical for avoiding render race conditions.**

**Parameters:**
- `actions` (Object[]): Array of Redux actions
- `options` (Object, optional): Same as `execute()`

**Returns:** `Promise<void>`

**Example:**
```javascript
// Widget: Commit roll (multiple state changes)
await game.fitgd.bridge.executeBatch([
  { type: 'playerRoundState/setRollResult', payload: { characterId, result } },
  { type: 'playerRoundState/setGmApproved', payload: { characterId, approved: false } },
  { type: 'playerRoundState/transitionState', payload: { characterId, state: 'CONSEQUENCE_CHOICE' } }
], { affectedReduxIds: [characterId] });
// Single broadcast, single refresh - no race conditions!
```

---

### `bridge.getCharacter(id)`

Query character state (auto-detects Redux vs Foundry ID).

**Parameters:**
- `id` (string): Redux UUID or Foundry Actor ID

**Returns:** `Object | null`

**Example:**
```javascript
const character = game.fitgd.bridge.getCharacter(characterId);
console.log(character.actionDots.shoot);
```

---

### `bridge.getCrew(id)`

Query crew state (auto-detects Redux vs Foundry ID).

---

### `bridge.getClocks(entityId, clockType)`

Query clocks for an entity.

**Parameters:**
- `entityId` (string): Redux ID of character/crew
- `clockType` (string, optional): Filter by 'harm', 'consumable', 'addiction'

**Returns:** `Object[]`

**Example:**
```javascript
const harmClocks = game.fitgd.bridge.getClocks(characterId, 'harm');
console.log(`Character has ${harmClocks.length} harm clocks`);
```

---

### `bridge.getPlayerRoundState(characterId)`

Get ephemeral player round state for combat widget.

---

## Common Patterns

### Pattern 1: Single State Change

```javascript
// Clock controls
async _onClickClockSVG(event) {
  if (!game.user.isGM) return;
  event.preventDefault();

  const clockId = event.currentTarget.dataset.clockId;
  const currentValue = parseInt(event.currentTarget.dataset.clockValue);
  const maxValue = parseInt(event.currentTarget.dataset.clockMax);

  const newValue = currentValue >= maxValue ? 0 : currentValue + 1;

  await game.fitgd.bridge.execute({
    type: 'clock/setSegments',
    payload: { clockId, segments: newValue }
  });
  // Bridge auto-detects entityId from clock and refreshes appropriate sheet
}
```

### Pattern 2: Multiple Related Changes (Batch)

```javascript
// Momentum Reset
async _onPerformReset(event) {
  event.preventDefault();
  const crewId = this._getReduxId();

  await game.fitgd.bridge.executeBatch([
    { type: 'crew/setMomentum', payload: { crewId, amount: 5 } },
    { type: 'clock/clearSegments', payload: { clockId: addictionClockId, segments: 2 } },
    { type: 'character/resetRallyForAll', payload: { crewId } }
  ], { affectedReduxIds: [crewId] });

  ui.notifications.info('Reset complete!');
}
```

### Pattern 3: Conditional Actions

```javascript
// Add Momentum with validation
async _onAddMomentum(event) {
  event.preventDefault();
  const crewId = this._getReduxId();
  const amount = parseInt(event.currentTarget.dataset.amount) || 1;

  try {
    await game.fitgd.bridge.execute({
      type: 'crew/addMomentum',
      payload: { crewId, amount }
    });

    ui.notifications.info(`Added ${amount} Momentum`);
  } catch (error) {
    // Validation errors from Redux caught here
    ui.notifications.error(`Error: ${error.message}`);
  }
}
```

---

## Migration Strategy

You don't need to refactor everything at once. Use the Bridge API for:

1. **All new code** - Start using it immediately
2. **Bug fixes** - When fixing a bug, refactor to Bridge pattern
3. **Gradual refactoring** - Convert one event handler at a time

### How to Find Code to Migrate

```bash
# Find all direct dispatch() calls
grep -rn "store.dispatch(" foundry/module/

# Find all saveImmediate() calls
grep -rn "saveImmediate()" foundry/module/

# Find all refreshSheetsByReduxId() calls
grep -rn "refreshSheetsByReduxId(" foundry/module/
```

Any place you see these patterns should be converted to Bridge API.

---

## Benefits

1. **Impossible to forget broadcast** - Single call does everything
2. **Impossible to forget refresh** - Sheets automatically update
3. **No render race conditions** - `executeBatch()` prevents concurrent renders
4. **ID confusion prevention** - Bridge handles Redux ↔ Foundry ID mapping
5. **Cleaner code** - Less boilerplate, clearer intent
6. **Easier testing** - Mock the Bridge, not Redux internals

---

## FAQ

### Q: Can I still use `game.fitgd.api.character.*` methods?

A: Yes, but they won't handle broadcast/refresh. The Bridge is for dispatch-level operations. The existing API methods are still useful for complex game logic that needs to be encapsulated.

### Q: What if I need to do something between dispatch and broadcast?

A: Use `silent` mode:
```javascript
await game.fitgd.bridge.execute(action, { silent: true });
// Do something here
await game.fitgd.saveImmediate();  // Manual broadcast
refreshSheetsByReduxId([id], false);  // Manual refresh
```

But this should be rare - most of the time you want the automatic flow.

### Q: How do I test code using the Bridge?

A: Mock the Bridge in your tests:
```javascript
const mockBridge = {
  execute: jest.fn(),
  executeBatch: jest.fn(),
  getCharacter: jest.fn(() => ({ ...mockCharacter }))
};

game.fitgd.bridge = mockBridge;
```

### Q: Does this replace the Game API (`game.fitgd.api`)?

A: No, they serve different purposes:
- **Game API** (`game.fitgd.api.character.*`) - High-level game operations with business logic validation
- **Bridge API** (`game.fitgd.bridge.execute()`) - Low-level dispatch with broadcast/refresh handling

Use Game API when you want encapsulated game logic. Use Bridge API when you need direct Redux actions with automatic propagation.

---

## Next Steps

1. Add Bridge initialization to `fitgd.mjs`
2. Start using it for all new event handlers
3. Gradually migrate existing code during bug fixes
4. Eventually deprecate direct `store.dispatch()` calls

The goal is to make the correct pattern the easy pattern, preventing the recurring bugs documented in CLAUDE.md.
