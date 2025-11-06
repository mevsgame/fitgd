# History Pruning Guide

## Overview

FITGD uses event sourcing to track all state changes through command history. While this enables powerful features like time-travel debugging and audit trails, the command history can grow large over time.

**History pruning** allows you to collapse the entire command history into just the current state snapshot, significantly reducing memory and storage usage while maintaining your current game state.

## What Gets Pruned?

When you prune history:
- ✅ **Kept**: All current game state (characters, crews, clocks, equipment, etc.)
- ❌ **Removed**: All command history (past actions, undo capability, audit trail)

## When to Prune

Consider pruning history when:
- Your world file is getting large
- You experience performance issues
- You want to "lock in" the current state
- You're starting a new campaign phase

**Warning**: After pruning, you cannot:
- Undo past actions
- Replay command history
- Reconstruct how you reached the current state

## Using History Pruning

### From Code (Foundry Module)

```typescript
import { createFoundryAdapter } from '@fitgd/core';

// Initialize adapter with your Redux store
const adapter = createFoundryAdapter(store);

// 1. Check history stats before pruning
const stats = adapter.getHistoryStats();
console.log(`Current history: ${stats.totalCommands} commands (~${stats.estimatedSizeKB}KB)`);
console.log(`Character commands: ${stats.characterCommands}`);
console.log(`Crew commands: ${stats.crewCommands}`);
console.log(`Clock commands: ${stats.clockCommands}`);

// 2. Prune all history
adapter.pruneAllHistory();

// 3. Verify pruning
const statsAfter = adapter.getHistoryStats();
console.log(`After pruning: ${statsAfter.totalCommands} commands (~${statsAfter.estimatedSizeKB}KB)`);
```

### Foundry VTT Settings Integration

Add a game settings menu with history information and a prune button:

```typescript
// In your Foundry module init hook
Hooks.once('init', () => {
  // Register a menu for history management
  game.settings.registerMenu('fitgd', 'historyManagement', {
    name: 'FITGD.Settings.HistoryManagement.Name',
    label: 'FITGD.Settings.HistoryManagement.Label',
    hint: 'FITGD.Settings.HistoryManagement.Hint',
    icon: 'fas fa-database',
    type: HistoryManagementConfig,
    restricted: true // GM only
  });
});

// Create a FormApplication for history management
class HistoryManagementConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: 'FITGD History Management',
      id: 'fitgd-history-management',
      template: 'modules/fitgd/templates/history-management.hbs',
      width: 500,
      height: 'auto',
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  getData() {
    // Get history stats from the adapter
    const adapter = game.fitgd.adapter; // Your adapter instance
    const stats = adapter.getHistoryStats();

    return {
      stats: {
        totalCommands: stats.totalCommands,
        characterCommands: stats.characterCommands,
        crewCommands: stats.crewCommands,
        clockCommands: stats.clockCommands,
        estimatedSizeKB: stats.estimatedSizeKB,
        timeSpanHours: stats.timeSpanHours,
        isEmpty: stats.totalCommands === 0
      }
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Handle prune button click
    html.find('button[name="prune"]').click(async (event) => {
      event.preventDefault();

      // Confirm with user
      const confirmed = await Dialog.confirm({
        title: 'Prune Command History',
        content: `
          <p><strong>Warning:</strong> This action cannot be undone!</p>
          <p>All command history will be permanently deleted, keeping only the current state.</p>
          <p>You will lose the ability to:</p>
          <ul>
            <li>Undo past actions</li>
            <li>View action history</li>
            <li>Replay commands</li>
          </ul>
          <p>Are you sure you want to continue?</p>
        `,
        defaultYes: false
      });

      if (confirmed) {
        // Prune history
        const adapter = game.fitgd.adapter;
        adapter.pruneAllHistory();

        // Notify user
        ui.notifications.info('Command history has been pruned successfully.');

        // Re-render the form to show updated stats
        this.render();
      }
    });

    // Handle refresh stats button
    html.find('button[name="refresh"]').click((event) => {
      event.preventDefault();
      this.render();
    });
  }

  async _updateObject(event, formData) {
    // No form submission handling needed
  }
}
```

### Handlebars Template

Create `templates/history-management.hbs`:

```handlebars
<form class="fitgd-history-management">
  <div class="form-group">
    <h2>Command History Statistics</h2>

    {{#if stats.isEmpty}}
      <div class="notification info">
        <p>No command history recorded yet.</p>
      </div>
    {{else}}
      <table class="history-stats">
        <tr>
          <td><strong>Total Commands:</strong></td>
          <td>{{stats.totalCommands}}</td>
        </tr>
        <tr>
          <td><strong>Character Commands:</strong></td>
          <td>{{stats.characterCommands}}</td>
        </tr>
        <tr>
          <td><strong>Crew Commands:</strong></td>
          <td>{{stats.crewCommands}}</td>
        </tr>
        <tr>
          <td><strong>Clock Commands:</strong></td>
          <td>{{stats.clockCommands}}</td>
        </tr>
        <tr>
          <td><strong>Estimated Size:</strong></td>
          <td>~{{stats.estimatedSizeKB}} KB</td>
        </tr>
        {{#if stats.timeSpanHours}}
          <tr>
            <td><strong>Time Span:</strong></td>
            <td>{{stats.timeSpanHours}} hours</td>
          </tr>
        {{/if}}
      </table>

      <div class="notification warning" style="margin-top: 1em;">
        <p><strong>Warning:</strong> Pruning history is permanent and cannot be undone!</p>
      </div>
    {{/if}}
  </div>

  <div class="form-group">
    <button type="button" name="refresh" style="margin-right: 0.5em;">
      <i class="fas fa-sync"></i> Refresh Stats
    </button>

    {{#unless stats.isEmpty}}
      <button type="button" name="prune" class="danger">
        <i class="fas fa-trash"></i> Prune History
      </button>
    {{/unless}}
  </div>
</form>

<style>
  .fitgd-history-management .history-stats {
    width: 100%;
    border-collapse: collapse;
  }

  .fitgd-history-management .history-stats td {
    padding: 0.5em;
    border-bottom: 1px solid var(--color-border-light-tertiary);
  }

  .fitgd-history-management .notification {
    padding: 1em;
    border-radius: 4px;
    margin: 1em 0;
  }

  .fitgd-history-management .notification.info {
    background-color: var(--color-info-bg);
    border: 1px solid var(--color-info);
  }

  .fitgd-history-management .notification.warning {
    background-color: var(--color-warning-bg);
    border: 1px solid var(--color-warning);
  }

  .fitgd-history-management button.danger {
    background-color: var(--color-level-error);
    color: white;
  }
</style>
```

### Localization (en.json)

```json
{
  "FITGD.Settings.HistoryManagement.Name": "History Management",
  "FITGD.Settings.HistoryManagement.Label": "Manage Command History",
  "FITGD.Settings.HistoryManagement.Hint": "View command history statistics and prune old history to reduce storage usage."
}
```

## Architecture Details

### How It Works

1. **Event Sourcing**: Every action (create character, add trait, spend momentum, etc.) is stored as a command
2. **Command History**: Commands are stored in three separate arrays:
   - `state.characters.history[]` - Character-related commands
   - `state.crews.history[]` - Crew-related commands
   - `state.clocks.history[]` - Clock-related commands
3. **Current State**: The `byId` and `allIds` structures represent the current state (result of all commands)
4. **Pruning**: Clears all history arrays while keeping current state intact

### Redux Actions

Three slice-specific actions are provided:

```typescript
import { pruneHistory } from './slices/characterSlice';
import { pruneCrewHistory } from './slices/crewSlice';
import { pruneClockHistory } from './slices/clockSlice';

// Prune individual slices
store.dispatch(pruneHistory());        // Characters only
store.dispatch(pruneCrewHistory());    // Crews only
store.dispatch(pruneClockHistory());   // Clocks only

// Or use the adapter to prune all at once
adapter.pruneAllHistory();
```

### Selectors

History statistics are computed using memoized selectors:

```typescript
import {
  selectHistoryStats,
  selectTotalCommandCount,
  selectHistorySizeKB,
  selectIsHistoryEmpty,
} from './selectors/historySelectors';

const state = store.getState();

// Get comprehensive stats
const stats = selectHistoryStats(state);
// {
//   characterCommands: 150,
//   crewCommands: 45,
//   clockCommands: 320,
//   totalCommands: 515,
//   estimatedSizeKB: 75,
//   oldestCommandTimestamp: 1699564800000,
//   newestCommandTimestamp: 1699651200000,
//   timeSpanHours: 24.0
// }

// Get specific metrics
const total = selectTotalCommandCount(state);  // 515
const sizeKB = selectHistorySizeKB(state);     // 75
const isEmpty = selectIsHistoryEmpty(state);   // false
```

## Best Practices

### When NOT to Prune

- During active gameplay sessions
- If you need undo/redo functionality
- When debugging or testing
- If you want to maintain an audit trail

### Recommended Workflow

1. **After Campaign Milestones**: Prune after major story beats or session breaks
2. **Before Backups**: Prune before creating world backups to reduce file size
3. **Regular Maintenance**: Consider pruning monthly for long-running campaigns

### Data Persistence

**Important**: Pruning only affects the Redux store in memory. To persist the pruned state:

```typescript
// After pruning, save the current state to Foundry
adapter.pruneAllHistory();

// Export and save to world flags
const state = adapter.exportState();
await game.settings.set('fitgd', 'gameState', state);
```

## Troubleshooting

### History Still Large After Pruning

If history stats still show many commands after pruning:
1. Verify you called `pruneAllHistory()` not individual prune actions
2. Check if new commands were created after pruning
3. Ensure the store instance is the same one being queried

### State Lost After Pruning

Pruning should **never** lose current state. If you experience state loss:
1. File a bug report with reproduction steps
2. Check console for errors during pruning
3. Verify Redux middleware isn't interfering

### Performance Not Improved

History pruning reduces **storage size**, not necessarily runtime performance. If you're experiencing performance issues:
1. Check if the bottleneck is rendering, not state management
2. Profile the application to identify slow operations
3. Consider optimizing selectors with memoization

## See Also

- [Redux Store Architecture](./ARCHITECTURE.md)
- [Command Schema](./COMMANDS.md)
- [Foundry Integration Guide](./FOUNDRY_INTEGRATION.md)
