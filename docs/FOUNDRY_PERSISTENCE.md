# Foundry VTT Persistence & Socket Replication Guide

## Overview

This guide explains how to implement:
1. **State Persistence** - Save/load game state across F5 refreshes
2. **Socket Replication** - Sync state changes across all players in real-time

## How It Works

### The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Player makes change → Redux action → Socket broadcast       │
│                                                               │
│ ┌──────────┐      ┌──────────┐      ┌──────────────────┐   │
│ │ Player 1 │ ───→ │  Redux   │ ───→ │ Foundry Settings │   │
│ └──────────┘      │  Store   │      │   (auto-sync)     │   │
│                   └──────────┘      └──────────────────┘   │
│                        │                      │              │
│                        │ Socket               │ Socket       │
│                        ↓                      ↓              │
│                   ┌──────────┐         ┌──────────┐         │
│                   │ Player 2 │         │ Player 3 │         │
│                   │  Redux   │         │  Redux   │         │
│                   └──────────┘         └──────────┘         │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: `exportState()` exports the **current snapshot** (NOT history), so:
- ✅ After pruning → save snapshot → reload works perfectly
- ✅ No command history needed for persistence
- ✅ Smaller save files, faster load times

## Implementation

### Step 1: Initialize Redux Store with Foundry Adapter

```typescript
// In your Foundry module's main.js/ts
import { configureStore } from '@fitgd/core';
import { createFoundryAdapter } from '@fitgd/core/adapters/foundry';

Hooks.once('init', () => {
  console.log('FitGD | Initializing Redux store');

  // Create Redux store
  const store = configureStore();

  // Create Foundry adapter
  const adapter = createFoundryAdapter(store);

  // Store globally for easy access
  game.fitgd = {
    store,
    adapter,
  };

  // Register world setting to store game state
  game.settings.register('fitgd', 'gameState', {
    scope: 'world',
    config: false,
    type: Object,
    default: {
      characters: {},
      crews: {},
      clocks: {},
      timestamp: Date.now(),
      version: '1.0.0',
    },
  });
});
```

### Step 2: Load State on Game Ready

```typescript
Hooks.once('ready', async () => {
  console.log('FitGD | Loading saved state');

  const adapter = game.fitgd.adapter;
  const savedState = game.settings.get('fitgd', 'gameState');

  // Check if we have saved state
  if (savedState && savedState.timestamp) {
    try {
      // Hydrate Redux store from saved snapshot
      adapter.importState(savedState);

      ui.notifications.info('FitGD | Game state loaded successfully');
    } catch (error) {
      console.error('FitGD | Error loading state:', error);
      ui.notifications.error('Failed to load game state - see console');
    }
  } else {
    console.log('FitGD | No saved state found - starting fresh');
  }
});
```

### Step 3: Auto-Save on State Changes

```typescript
import debounce from 'lodash.debounce'; // Or implement your own debounce

Hooks.once('ready', () => {
  const adapter = game.fitgd.adapter;
  const store = game.fitgd.store;

  // Subscribe to Redux changes
  const debouncedSave = debounce(async () => {
    try {
      // Export current state
      const state = adapter.exportState();

      // Save to Foundry world settings
      // This automatically syncs to all connected players!
      await game.settings.set('fitgd', 'gameState', state);

      console.log('FitGD | State auto-saved');
    } catch (error) {
      console.error('FitGD | Error saving state:', error);
    }
  }, 2000); // Save at most once every 2 seconds

  // Subscribe to store changes
  store.subscribe(() => {
    debouncedSave();
  });

  console.log('FitGD | Auto-save enabled (2s debounce)');
});
```

### Step 4: Socket Replication for Real-Time Sync

Using **socketlib** (recommended):

```typescript
// Install: npm install socketlib
import socketlib from 'socketlib';

Hooks.once('socketlib.ready', () => {
  console.log('FitGD | Setting up socket replication');

  // Register socket for this system
  game.fitgd.socket = socketlib.registerSystem('fitgd');

  // Register handler for receiving commands from other players
  game.fitgd.socket.register('replicateCommand', (command) => {
    console.log('FitGD | Received command from network:', command.type);

    const store = game.fitgd.store;

    // Dispatch command to local Redux store
    // Mark as replicated to prevent infinite loop
    store.dispatch({
      type: command.type,
      payload: command.payload,
      meta: {
        ...command.meta,
        replicated: true, // Important!
      },
    });
  });

  // Intercept Redux dispatch to broadcast commands
  const store = game.fitgd.store;
  const originalDispatch = store.dispatch;

  store.dispatch = (action) => {
    // Execute action locally first
    const result = originalDispatch(action);

    // Broadcast to other players (but not if this is already a replicated command)
    if (!action.meta?.replicated && game.fitgd.socket) {
      // Extract command from action meta
      const command = action.meta?.command;

      if (command) {
        game.fitgd.socket.executeForEveryone('replicateCommand', command);
      }
    }

    return result;
  };

  console.log('FitGD | Socket replication enabled');
});
```

### Alternative: Foundry Native Sockets

Without socketlib (more manual):

```typescript
Hooks.once('ready', () => {
  // Listen for socket messages
  game.socket.on('system.fitgd', (data) => {
    if (data.action === 'replicateCommand') {
      const store = game.fitgd.store;

      store.dispatch({
        type: data.command.type,
        payload: data.command.payload,
        meta: {
          ...data.command.meta,
          replicated: true,
        },
      });
    }
  });

  // Intercept dispatch
  const store = game.fitgd.store;
  const originalDispatch = store.dispatch;

  store.dispatch = (action) => {
    const result = originalDispatch(action);

    if (!action.meta?.replicated && action.meta?.command) {
      game.socket.emit('system.fitgd', {
        action: 'replicateCommand',
        command: action.meta.command,
      });
    }

    return result;
  };
});
```

## Testing Persistence & Replication

### Test 1: Persistence (F5 Refresh)

1. Open Foundry as GM
2. Create a character via the API:
   ```javascript
   const api = game.fitgd.adapter;
   // Character creation triggers auto-save
   ```
3. Wait 2-3 seconds for debounced save
4. Press **F5** to refresh
5. Open console and check:
   ```javascript
   game.fitgd.store.getState().characters.allIds
   // Should show your character!
   ```

✅ **Expected**: Character still exists after refresh

### Test 2: Socket Replication (Multi-Client)

1. Open Foundry as GM in Browser Window 1
2. Open Foundry as Player in Browser Window 2 (or incognito)
3. In Window 1 (GM), create a character
4. In Window 2 (Player), check state:
   ```javascript
   game.fitgd.store.getState().characters.allIds
   ```

✅ **Expected**: Player sees the character immediately (via socket)

### Test 3: History Pruning + Persistence

1. Create several characters (builds up command history)
2. Check history size:
   ```javascript
   const stats = game.fitgd.adapter.getHistoryStats();
   console.log(stats); // { totalCommands: 50, estimatedSizeKB: 8, ... }
   ```
3. Prune history:
   ```javascript
   game.fitgd.adapter.pruneAllHistory();
   ```
4. Verify history cleared:
   ```javascript
   const stats = game.fitgd.adapter.getHistoryStats();
   console.log(stats); // { totalCommands: 0, estimatedSizeKB: 0, ... }
   ```
5. Press **F5** to refresh
6. Characters should still exist (state persisted without history)

✅ **Expected**: All characters intact, no command history

## Performance Optimization

### 1. Debounce Auto-Save

Current implementation saves at most once every 2 seconds. Adjust based on needs:

```typescript
const debouncedSave = debounce(saveFunction, 5000); // 5 seconds
```

### 2. Selective Persistence

Only save when meaningful changes occur:

```typescript
let lastSavedState = null;

store.subscribe(() => {
  const currentState = adapter.exportState();

  // Only save if state actually changed
  if (JSON.stringify(currentState) !== JSON.stringify(lastSavedState)) {
    debouncedSave();
    lastSavedState = currentState;
  }
});
```

### 3. Compress Large States

For large campaigns with many entities:

```typescript
import LZString from 'lz-string'; // npm install lz-string

// When saving
const state = adapter.exportState();
const compressed = LZString.compressToUTF16(JSON.stringify(state));
await game.settings.set('fitgd', 'gameState', compressed);

// When loading
const compressed = game.settings.get('fitgd', 'gameState');
const state = JSON.parse(LZString.decompressFromUTF16(compressed));
adapter.importState(state);
```

## Conflict Resolution

### What Happens If Two Players Make Changes Simultaneously?

**With socket replication**: Last write wins (eventual consistency)

```
Player 1: Sets character name to "Alice" → broadcasts
Player 2: Sets character name to "Bob"   → broadcasts
Result:   Whichever broadcast arrives last wins
```

**Solutions**:

1. **GM-only writes** (simplest):
   ```typescript
   if (!game.user.isGM) {
     ui.notifications.warn('Only the GM can modify game state');
     return;
   }
   ```

2. **Optimistic locking**:
   ```typescript
   // Add version number to each entity
   character.version = 1;

   // Before update, check version
   if (character.version !== expectedVersion) {
     throw new Error('Conflict: entity was modified by another player');
   }
   ```

3. **Operational Transformation** (advanced):
   Use libraries like [ShareDB](https://github.com/share/sharedb) for real-time collaboration

## Troubleshooting

### State Not Persisting After F5

**Check**:
1. Is auto-save enabled? (Check console for "Auto-save enabled")
2. Is debounce waiting? (Wait 2+ seconds after changes)
3. Are there errors in console?
4. Verify setting exists:
   ```javascript
   game.settings.get('fitgd', 'gameState')
   ```

### Socket Replication Not Working

**Check**:
1. Is socketlib installed? (`npm install socketlib`)
2. Is the socket registered? (Check console for "Socket replication enabled")
3. Are commands being broadcast?
   ```javascript
   // Add logging to dispatch
   console.log('Broadcasting command:', command);
   ```
4. Are both clients logged in?

### State Corrupted After Load

**Possible causes**:
1. Version mismatch (old save format)
2. Incomplete save (interrupted network)
3. Migration needed

**Solution**:
```typescript
// Add version checking
if (savedState.version !== CURRENT_VERSION) {
  console.warn('FitGD | State version mismatch - running migration');
  savedState = migrateState(savedState, CURRENT_VERSION);
}
```

## Best Practices

### 1. Regular History Pruning

Prune history weekly or after major milestones:

```typescript
// In GM settings menu
async function pruneHistory() {
  const confirmed = await Dialog.confirm({
    title: 'Prune Command History',
    content: 'This will reduce save file size but remove undo capability.'
  });

  if (confirmed) {
    game.fitgd.adapter.pruneAllHistory();
    ui.notifications.info('History pruned - state saved');
  }
}
```

### 2. Backup Before Pruning

```typescript
async function exportBackup() {
  const state = game.fitgd.adapter.exportState();
  const history = game.fitgd.adapter.exportHistory();

  const backup = {
    state,
    history,
    timestamp: Date.now(),
    version: game.system.version,
  };

  // Download as JSON file
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  saveAs(blob, `fitgd-backup-${Date.now()}.json`);
}
```

### 3. Monitor State Size

Add to settings menu:

```typescript
const stats = game.fitgd.adapter.getHistoryStats();
ui.notifications.info(
  `Current state: ${stats.totalCommands} commands (~${stats.estimatedSizeKB}KB)`
);
```

## See Also

- [History Pruning Guide](./HISTORY_PRUNING.md)
- [Socket Replication Architecture](./SOCKETS.md)
- [Redux Store Architecture](./ARCHITECTURE.md)
