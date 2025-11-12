/**
 * Forged in the Grimdark - Foundry VTT System
 *
 * Main module entry point. Integrates Redux-based state management with Foundry VTT.
 *
 * Architecture:
 * - Redux store maintains single source of truth
 * - Foundry Actors/Items sync from Redux state
 * - All mutations go through Redux actions
 * - Full event sourcing with command history
 */

// @ts-check

/**
 * @typedef {import('../dist/types').Character} Character
 * @typedef {import('../dist/types').Crew} Crew
 * @typedef {import('../dist/types').Clock} Clock
 * @typedef {import('../dist/types').Trait} Trait
 * @typedef {import('../dist/types').Equipment} Equipment
 * @typedef {import('../dist/types').ActionDots} ActionDots
 * @typedef {import('../dist/store').RootState} RootState
 * @typedef {import('../dist/types/playerRoundState').PlayerRoundState} PlayerRoundState
 * @typedef {import('../dist/types/playerRoundState').Position} Position
 * @typedef {import('../dist/types/playerRoundState').Effect} Effect
 */

// Core Redux modules
import { configureStore, createGameAPI } from '../dist/fitgd-core.es.js';
import { createFoundryAdapter } from '../dist/fitgd-core.es.js';
import { createFoundryReduxBridge } from './foundry-redux-bridge.mjs';

// Helper modules
import { refreshSheetsByReduxId } from './helpers/sheet-helpers.mjs';
import { registerSystemSettings } from './settings/system-settings.mjs';
import { registerSheetClasses } from './helpers/sheet-registration.mjs';
import { registerHandlebarsHelpers } from './helpers/handlebars-helpers.mjs';

// Hook modules
import { registerCombatHooks } from './hooks/combat-hooks.mjs';
import { registerActorHooks } from './hooks/actor-hooks.mjs';
import { registerHotbarHooks } from './hooks/hotbar-hooks.mjs';

// Socket and autosave modules
import { receiveCommandsFromSocket } from './socket/socket-handler.mjs';

import {
  saveCommandHistory,
  trackInitialCommandsAsApplied,
  getNewCommandsSinceLastBroadcast,
  checkCircuitBreaker
} from './autosave/autosave-manager.mjs';

// Developer commands
import { registerDevCommands } from './console/dev-commands.mjs';

/* -------------------------------------------- */
/*  System Initialization                       */
/* -------------------------------------------- */

/**
 * Initialize the FitGD system
 */
Hooks.once('init', async function() {
  console.log('FitGD | Initializing Forged in the Grimdark system');

  // Create global namespace
  game.fitgd = game.fitgd || {};

  // Initialize Redux store
  console.log('FitGD | Creating Redux store...');
  try {
    game.fitgd.store = configureStore();
    console.log('FitGD | Redux store created successfully');
  } catch (error) {
    console.error('FitGD | Failed to create Redux store:', error);
    return;
  }

  // Initialize Game API
  console.log('FitGD | Creating Game API...');
  try {
    game.fitgd.api = createGameAPI(game.fitgd.store);
    console.log('FitGD | Game API created successfully. Available APIs:', Object.keys(game.fitgd.api));
  } catch (error) {
    console.error('FitGD | Failed to create Game API:', error);
    return;
  }

  // Initialize Foundry adapter
  console.log('FitGD | Creating Foundry adapter...');
  try {
    game.fitgd.foundry = createFoundryAdapter(game.fitgd.store);
    console.log('FitGD | Foundry adapter created successfully');
  } catch (error) {
    console.error('FitGD | Failed to create Foundry adapter:', error);
    return;
  }

  // Initialize socketlib for reliable multi-client communication
  console.log('FitGD | Initializing socketlib...');
  console.log('FitGD | socketlib available?', typeof socketlib !== 'undefined');

  try {
    if (typeof socketlib === 'undefined') {
      throw new Error('socketlib is not defined - module may not be installed or enabled');
    }

    game.fitgd.socket = socketlib.registerSystem('forged-in-the-grimdark');
    console.log('FitGD | socketlib registered successfully, socket object:', game.fitgd.socket);

    // Register socket handlers
    // Note: Handler function must be defined before registration
    game.fitgd.socket.register('syncCommands', receiveCommandsFromSocket);
    console.log('FitGD | Socket handlers registered for "syncCommands"');
    console.log('FitGD | Handler function:', receiveCommandsFromSocket);
  } catch (error) {
    console.error('FitGD | Failed to initialize socketlib:', error);
    console.error('FitGD | Make sure socketlib module is installed and enabled');
    return;
  }

  // Expose save function for dialogs and sheets to use
  game.fitgd.saveImmediate = async function() {
    try {
      // Get new commands since last broadcast
      const newCommands = getNewCommandsSinceLastBroadcast();
      const newCommandCount = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;

      // Circuit breaker: prevent infinite broadcast loops
      if (!checkCircuitBreaker(newCommandCount)) {
        console.error(`FitGD | Broadcast blocked by circuit breaker`);
        return;
      }

      // Also get current playerRoundState for real-time collaboration
      const state = game.fitgd.store.getState();
      const playerRoundState = state.playerRoundState;

      // Broadcast commands FIRST (before persistence) - all users can do this
      if (newCommandCount > 0 || Object.keys(playerRoundState.byCharacterId).length > 0) {
        const socketData = {
          type: 'commandsAdded',
          userId: game.user.id,
          userName: game.user.name,
          commandCount: newCommandCount,
          commands: newCommands,
          playerRoundState: playerRoundState, // Include ephemeral UI state
          timestamp: Date.now()
        };

        console.log(`FitGD | Broadcasting ${newCommandCount} commands + playerRoundState via socketlib`);

        try {
          // Use socketlib to broadcast to OTHER clients (not self)
          const result = await game.fitgd.socket.executeForOthers('syncCommands', socketData);
          console.log(`FitGD | socketlib broadcast completed, result:`, result);
        } catch (error) {
          console.error('FitGD | socketlib broadcast error:', error);
        }
      } else {
        console.log(`FitGD | No new commands or playerRoundState to broadcast`);
      }

      // Auto-prune orphaned history if enabled
      if (game.user.isGM) {
        const autoPruneEnabled = game.settings.get('forged-in-the-grimdark', 'autoPruneHistory');

        if (autoPruneEnabled) {
          console.log('FitGD | Auto-prune enabled, checking for orphaned history...');

          // Get command counts before pruning
          const stateBefore = game.fitgd.store.getState();
          const commandsBefore =
            stateBefore.characters.history.length +
            stateBefore.crews.history.length +
            stateBefore.clocks.history.length;

          // Dispatch prune actions for all slices
          game.fitgd.store.dispatch({ type: 'characters/pruneOrphanedHistory' });
          game.fitgd.store.dispatch({ type: 'crews/pruneOrphanedHistory' });
          game.fitgd.store.dispatch({ type: 'clocks/pruneOrphanedHistory' });

          // Get command counts after pruning
          const stateAfter = game.fitgd.store.getState();
          const commandsAfter =
            stateAfter.characters.history.length +
            stateAfter.crews.history.length +
            stateAfter.clocks.history.length;

          const prunedCount = commandsBefore - commandsAfter;

          if (prunedCount > 0) {
            console.log(`FitGD | Auto-pruned ${prunedCount} orphaned command(s) from history`);
            ui.notifications.info(`Auto-pruned ${prunedCount} orphaned command(s) from history`);
          }
        }
      }

      // Save to Foundry settings (only if user has permission - typically GM)
      // Players will broadcast but won't persist; GM will persist when receiving broadcasts
      if (game.user.isGM) {
        const history = game.fitgd.foundry.exportHistory();
        await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
        const total = history.characters.length + history.crews.length + history.clocks.length;
        console.log(`FitGD | Saved ${total} commands to world settings (GM only)`);
      } else {
        console.log(`FitGD | Skipped settings save (player - GM will persist on receipt)`);
      }
    } catch (error) {
      console.error('FitGD | Error in saveImmediate:', error);
      // Don't throw - we still want broadcasts to work even if save fails
    }
  };

  // Initialize Foundry-Redux Bridge API
  console.log('FitGD | Creating Foundry-Redux Bridge...');
  try {
    game.fitgd.bridge = createFoundryReduxBridge(
      game.fitgd.store,
      game.fitgd.saveImmediate
    );
    console.log('FitGD | Foundry-Redux Bridge created successfully');
    console.log('FitGD | Bridge API available at game.fitgd.bridge');
  } catch (error) {
    console.error('FitGD | Failed to create Foundry-Redux Bridge:', error);
    return;
  }

  // Register settings
  registerSystemSettings();

  // Register sheet classes
  registerSheetClasses();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Register hooks
  registerCombatHooks();
  registerActorHooks();
  registerHotbarHooks();

  // Register developer console commands
  registerDevCommands();

  console.log('FitGD | Initialization complete');
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

/**
 * Load saved game state when world is ready
 */
Hooks.once('ready', async function() {
  console.log(`FitGD | World ready for user: ${game.user.name} (isGM: ${game.user.isGM})`);
  console.log(`FitGD | game.fitgd initialized: ${!!game.fitgd}, has store: ${!!game.fitgd?.store}, has api: ${!!game.fitgd?.api}`);

  // Check for state snapshot first (used after history pruning)
  const stateSnapshot = game.settings.get('forged-in-the-grimdark', 'stateSnapshot');
  const defaultHistory = { characters: [], crews: [], clocks: [] };
  const history = game.settings.get('forged-in-the-grimdark', 'commandHistory') || defaultHistory;

  // Ensure history has the correct structure
  const validHistory = {
    characters: history.characters || [],
    crews: history.crews || [],
    clocks: history.clocks || []
  };

  const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length;

  // Warn if command history is bloated (possible corruption or spam issue)
  if (totalCommands > 1000) {
    console.warn(`FitGD | WARNING: Command history is large (${totalCommands} commands). This may indicate a previous spam issue.`);
    console.warn(`FitGD | Breakdown: chars=${validHistory.characters.length}, crews=${validHistory.crews.length}, clocks=${validHistory.clocks.length}`);

    if (totalCommands > 3000) {
      console.error(`FitGD | CRITICAL: Command history is VERY large (${totalCommands} commands)!`);
      ui.notifications.warn(`FitGD: Large command history detected (${totalCommands} commands). Performance may be affected. Consider using History Management to prune old commands.`, { permanent: true });
    }
  }

  if (stateSnapshot && stateSnapshot.timestamp) {
    // Load from snapshot first
    console.log('FitGD | State snapshot found, hydrating from snapshot...');
    console.log(`FitGD | Snapshot timestamp: ${new Date(stateSnapshot.timestamp).toLocaleString()}`);

    try {
      // Hydrate Redux store from snapshot
      game.fitgd.foundry.importState(stateSnapshot);
      console.log('FitGD | State restored from snapshot');

      // Then replay any new commands that occurred after the snapshot
      if (totalCommands > 0) {
        console.log(`FitGD | Replaying ${totalCommands} commands on top of snapshot...`);
        game.fitgd.foundry.replayCommands(validHistory);
        console.log('FitGD | New commands applied');
      }

      // Track all commands as applied
      trackInitialCommandsAsApplied();
    } catch (error) {
      console.error('FitGD | Error loading from snapshot:', error);
      ui.notifications.error('Failed to load game state from snapshot');
    }
  } else if (totalCommands > 0) {
    // No snapshot, use command history replay (old behavior)
    console.log(`FitGD | Replaying ${totalCommands} commands from history...`);
    game.fitgd.foundry.replayCommands(validHistory);
    console.log('FitGD | State restored from command history');

    // Track all initial commands as applied (prevents re-application on sync)
    trackInitialCommandsAsApplied();
  } else {
    console.log('FitGD | No command history or snapshot found, starting fresh');
  }

  // Subscribe to store changes to auto-save
  game.fitgd.store.subscribe(() => {
    saveCommandHistory();
  });

  // Save on page unload to catch any unsaved changes (GM only)
  window.addEventListener('beforeunload', () => {
    if (game.user.isGM) {
      // Synchronous save (no await) for immediate execution
      try {
        const history = game.fitgd.foundry.exportHistory();
        game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
        const total = history.characters.length + history.crews.length + history.clocks.length;
        console.log(`FitGD | Saved ${total} commands (on unload - GM)`);
      } catch (error) {
        console.error('FitGD | Failed to save on unload:', error);
      }
    }
  });

  // Expose test function for manual socket testing
  game.fitgd.testSocket = async function() {
    console.log('FitGD | Testing socketlib...');
    console.log('FitGD | Socket object:', game.fitgd.socket);

    const testData = {
      test: 'Hello from ' + game.user.name,
      timestamp: Date.now(),
      userId: game.user.id
    };

    try {
      console.log('FitGD | Sending test message:', testData);
      const result = await game.fitgd.socket.executeForOthers('syncCommands', testData);
      console.log('FitGD | Test message sent, result:', result);
      return result;
    } catch (error) {
      console.error('FitGD | Test message failed:', error);
      throw error;
    }
  };

  // Cleanup function for orphaned entities
  game.fitgd.cleanupOrphans = async function() {
    if (!game.user.isGM) {
      ui.notifications.error('Only the GM can clean up orphaned entities');
      return;
    }

    console.log('='.repeat(60));
    console.log('FitGD | Orphaned Entity Cleanup - Starting...');
    console.log('='.repeat(60));

    // Create backup
    console.log('\n[1/6] Creating backup...');
    const backup = game.fitgd.foundry.exportState();
    game.fitgd.__cleanupBackup = backup;
    console.log('  ✓ Backup created (stored in game.fitgd.__cleanupBackup)');

    // Identify orphaned entities
    console.log('\n[2/6] Identifying orphaned entities...');
    const state = game.fitgd.store.getState();
    const foundryActorIds = new Set(game.actors.map(a => a.id));

    const orphanedCharacterIds = state.characters.allIds.filter(id => !foundryActorIds.has(id));
    const orphanedCrewIds = state.crews.allIds.filter(id => !foundryActorIds.has(id));

    const validEntityIds = new Set([...state.characters.allIds, ...state.crews.allIds]);
    const orphanedClockIds = state.clocks.allIds.filter(id => {
      const clock = state.clocks.byId[id];
      return !validEntityIds.has(clock.entityId);
    });

    console.log(`  Found ${orphanedCharacterIds.length} orphaned characters`);
    console.log(`  Found ${orphanedCrewIds.length} orphaned crews`);
    console.log(`  Found ${orphanedClockIds.length} orphaned clocks`);

    const totalOrphaned = orphanedCharacterIds.length + orphanedCrewIds.length + orphanedClockIds.length;

    if (totalOrphaned === 0) {
      console.log('\n✓ No orphaned entities found!');
      return { orphanedCharacterIds: [], orphanedCrewIds: [], orphanedClockIds: [], totalCleaned: 0 };
    }

    // Confirm with user
    const confirmed = await Dialog.confirm({
      title: 'Clean Up Orphaned Entities',
      content: `
        <p><strong>Found ${totalOrphaned} orphaned entities:</strong></p>
        <ul>
          <li>${orphanedCharacterIds.length} characters</li>
          <li>${orphanedCrewIds.length} crews</li>
          <li>${orphanedClockIds.length} clocks</li>
        </ul>
        <p>These are Redux entities with no corresponding Foundry Actors.</p>
        <p><strong>This will permanently delete them from Redux state.</strong></p>
        <p>A backup has been created. Continue?</p>
      `,
      defaultYes: false
    });

    if (!confirmed) {
      console.log('\n❌ Cleanup cancelled by user');
      return { cancelled: true };
    }

    // Delete orphaned entities from Redux
    console.log('\n[3/6] Deleting orphaned entities from Redux...');

    // Build cleaned state (removing orphaned entities)
    const cleanedCharacters = {};
    for (const charId of state.characters.allIds) {
      if (!orphanedCharacterIds.includes(charId)) {
        cleanedCharacters[charId] = state.characters.byId[charId];
      } else {
        console.log(`  Removing character: ${state.characters.byId[charId].name} (${charId})`);
      }
    }

    const cleanedCrews = {};
    for (const crewId of state.crews.allIds) {
      if (!orphanedCrewIds.includes(crewId)) {
        cleanedCrews[crewId] = state.crews.byId[crewId];
      } else {
        console.log(`  Removing crew: ${state.crews.byId[crewId].name} (${crewId})`);
      }
    }

    const cleanedClocks = {};
    for (const clockId of state.clocks.allIds) {
      if (!orphanedClockIds.includes(clockId)) {
        cleanedClocks[clockId] = state.clocks.byId[clockId];
      } else {
        const clock = state.clocks.byId[clockId];
        console.log(`  Removing clock: ${clock.clockType} - ${clock.subtype || 'N/A'} (${clockId})`);
      }
    }

    // Hydrate cleaned state using Redux actions
    game.fitgd.store.dispatch({
      type: 'characters/hydrateCharacters',
      payload: cleanedCharacters
    });

    game.fitgd.store.dispatch({
      type: 'crews/hydrateCrews',
      payload: cleanedCrews
    });

    game.fitgd.store.dispatch({
      type: 'clocks/hydrateClocks',
      payload: cleanedClocks
    });

    console.log(`  ✓ Removed ${totalOrphaned} entities from Redux`);

    // Prune orphaned commands from history
    console.log('\n[4/6] Pruning orphaned commands from history...');
    const orphanedEntityIds = new Set([...orphanedCharacterIds, ...orphanedCrewIds, ...orphanedClockIds]);

    game.fitgd.store.dispatch({ type: 'characters/pruneOrphanedHistory' });
    game.fitgd.store.dispatch({ type: 'crews/pruneOrphanedHistory' });
    game.fitgd.store.dispatch({ type: 'clocks/pruneOrphanedHistory' });

    console.log('  ✓ Pruned orphaned commands from history');

    // Save cleaned state
    console.log('\n[5/6] Saving cleaned state...');
    await game.fitgd.saveImmediate();
    console.log('  ✓ State saved and broadcasted');

    // Create snapshot to prevent replay of deleted entities
    console.log('\n[6/6] Creating state snapshot...');
    const cleanedState = game.fitgd.foundry.exportState();
    await game.settings.set('forged-in-the-grimdark', 'stateSnapshot', cleanedState);
    console.log('  ✓ Snapshot created');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('FitGD | Orphaned Entity Cleanup - Complete!');
    console.log('='.repeat(60));
    console.log(`✓ Deleted ${orphanedCharacterIds.length} orphaned characters`);
    console.log(`✓ Deleted ${orphanedCrewIds.length} orphaned crews`);
    console.log(`✓ Deleted ${orphanedClockIds.length} orphaned clocks`);
    console.log(`✓ Total cleaned: ${totalOrphaned} entities`);
    console.log('\n📝 Backup available at: game.fitgd.__cleanupBackup');
    console.log('   To restore: game.fitgd.restoreCleanupBackup()');
    console.log('='.repeat(60));

    ui.notifications.info(`Cleaned up ${totalOrphaned} orphaned entities`);

    return {
      orphanedCharacterIds,
      orphanedCrewIds,
      orphanedClockIds,
      totalCleaned: totalOrphaned
    };
  };

  // Restore cleanup backup
  game.fitgd.restoreCleanupBackup = async function() {
    if (!game.fitgd.__cleanupBackup) {
      ui.notifications.error('No cleanup backup found');
      return;
    }

    console.log('FitGD | Restoring cleanup backup...');
    game.fitgd.foundry.importState(game.fitgd.__cleanupBackup);
    await game.fitgd.saveImmediate();
    console.log('FitGD | Backup restored successfully');
    ui.notifications.info('Cleanup backup restored');
  };

  console.log('FitGD | Ready (socketlib handlers active)');
});

// Export helper for use in other modules if needed
export { refreshSheetsByReduxId };
