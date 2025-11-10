# Bridge API Integration Example

## Before: Direct Dispatch (Bug Pattern)

### combatStart Hook
```javascript
// Initialize player states for all combatants
for (const combatant of combat.combatants) {
  const actor = combatant.actor;
  if (!actor) continue;

  const characterId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
  if (characterId) {
    game.fitgd.store.dispatch({
      type: 'playerRoundState/initializePlayerState',
      payload: { characterId },
    });
  }
}
```

**Problems:**
- Multiple dispatch calls in a loop
- No broadcast → State doesn't propagate to other clients
- Potential render race conditions if sheets were refreshed

### updateCombat Hook
```javascript
// Update Redux state to mark this player as active
game.fitgd.store.dispatch({
  type: 'playerRoundState/setActivePlayer',
  payload: { characterId },
});
```

**Problems:**
- No broadcast → GM doesn't see active player changes
- No refresh → UI doesn't update

---

## After: Bridge API (Safe Pattern)

### combatStart Hook
```javascript
// Initialize player states for all combatants
const characterIds = [];
for (const combatant of combat.combatants) {
  const actor = combatant.actor;
  if (!actor) continue;

  const characterId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
  if (characterId) {
    characterIds.push(characterId);
  }
}

// Use Bridge API to batch all initializations and broadcast once
if (characterIds.length > 0) {
  const actions = characterIds.map(characterId => ({
    type: 'playerRoundState/initializePlayerState',
    payload: { characterId },
  }));

  await game.fitgd.bridge.executeBatch(actions, {
    affectedReduxIds: characterIds,
    silent: true // Silent: no sheets to refresh for player round state
  });
}
```

**Benefits:**
- Single broadcast for all player state initializations
- No render race conditions (batched)
- Automatically propagates to all clients

### updateCombat Hook
```javascript
// Update Redux state to mark this player as active
// Use Bridge API to ensure state propagates to all clients
await game.fitgd.bridge.execute(
  {
    type: 'playerRoundState/setActivePlayer',
    payload: { characterId },
  },
  { affectedReduxIds: [characterId], silent: true } // Silent: we'll show widget manually below
);
```

**Benefits:**
- Automatic broadcast to all clients
- GM sees active player changes immediately
- Impossible to forget broadcast step

---

## Key Takeaways

1. **`executeBatch()` prevents render race conditions** - Use it when making multiple related state changes
2. **`silent: true` gives you control** - Use when you need to manually handle UI updates
3. **Automatic broadcast is the default** - You can't forget to broadcast anymore
4. **Code is simpler** - Less boilerplate, clearer intent

These two examples demonstrate the core Bridge API patterns that prevent all the recurring bugs documented in CLAUDE.md.
