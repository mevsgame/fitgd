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

import type { Store } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

// foundry/module/fitgd.ts (AFTER)

import { configureStore } from '@/store'; // Example: adjust to your actual file path in src
import { createGameAPI } from '@/api'; // Example: adjust to your actual file path in src
import { createFoundryAdapter } from '@/adapters/foundry'; // Example: adjust to your path

import { createFoundryReduxBridge } from './foundry-redux-bridge';

// Helper modules
import { refreshSheetsByReduxId, takeAction } from './helpers/sheet-helpers';
import { registerSystemSettings } from './settings/system-settings';
import { registerSheetClasses } from './helpers/sheet-registration';
import { registerHandlebarsHelpers } from './helpers/handlebars-helpers';

// Hook modules
import { registerCombatHooks } from './hooks/combat-hooks';
import { registerActorHooks } from './hooks/actor-hooks';
import { registerHotbarHooks } from './hooks/hotbar-hooks';

// Socket and autosave modules
import { receiveCommandsFromSocket, handleTakeAction } from './socket/socket-handler';
import { saveCommandHistory, trackInitialCommandsAsApplied, getNewCommandsSinceLastBroadcast, checkCircuitBreaker } from './autosave/autosave-manager';

// Developer commands
import { registerDevCommands } from './console/dev-commands';

/* -------------------------------------------- */
/*  Type Definitions                            */
/* -------------------------------------------- */

/**
 * Command history structure stored in Foundry settings
 */
interface CommandHistory {
  characters: unknown[];
  crews: unknown[];
  clocks: unknown[];
}

/**
 * State snapshot structure (used after history pruning)
 */
interface StateSnapshot {
  timestamp: number;
  version: string;
  [key: string]: unknown;
}

/**
 * Socket data structure for command synchronization
 */
interface SocketCommandData {
  type: 'commandsAdded';
  userId: string;
  userName: string;
  commandCount: number;
  commands: CommandHistory;
  playerRoundState: RootState['playerRoundState'];
  timestamp: number;
}

/**
 * Helper to access game settings with custom namespace
 * Foundry types only include "core" namespace, but we use custom namespace
 */
function getSetting<T>(key: string): T {
  return (game.settings as any).get('forged-in-the-grimdark', key) as T;
}

function setSetting<T>(key: string, value: T): Promise<T> {
  return (game.settings as any).set('forged-in-the-grimdark', key, value) as Promise<T>;
}

/* -------------------------------------------- */
/*  System Initialization                       */
/* -------------------------------------------- */

/**
 * Initialize the FitGD system
 */
Hooks.once('init', async function () {
  console.log('FitGD | Initializing Forged in the Grimdark system');

  // Create global namespace
  if (!game.fitgd) {
    (game as any).fitgd = {};
  }

  // Initialize Redux store
  console.log('FitGD | Creating Redux store...');
  try {
    game.fitgd!.store = configureStore() as Store<RootState>;
    console.log('FitGD | Redux store created successfully');
  } catch (error) {
    console.error('FitGD | Failed to create Redux store:', error);
    return;
  }

  // Initialize Game API
  console.log('FitGD | Creating Game API...');
  try {
    game.fitgd!.api = createGameAPI(game.fitgd!.store);
    console.log('FitGD | Game API created successfully. Available APIs:', Object.keys(game.fitgd!.api));
  } catch (error) {
    console.error('FitGD | Failed to create Game API:', error);
    return;
  }

  // Initialize Foundry adapter
  console.log('FitGD | Creating Foundry adapter...');
  try {
    game.fitgd!.foundry = createFoundryAdapter(game.fitgd!.store);
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

    game.fitgd!.socket = socketlib.registerSystem('forged-in-the-grimdark');
    console.log('FitGD | socketlib registered successfully, socket object:', game.fitgd!.socket);

    // Register socket handlers
    // Note: Handler function must be defined before registration
    game.fitgd!.socket.register('syncCommands', receiveCommandsFromSocket);
    game.fitgd!.socket.register('takeAction', handleTakeAction);
    console.log('FitGD | Socket handlers registered for "syncCommands" and "takeAction"');
    console.log('FitGD | Handler functions:', receiveCommandsFromSocket, handleTakeAction);
  } catch (error) {
    console.error('FitGD | Failed to initialize socketlib:', error);
    console.error('FitGD | Make sure socketlib module is installed and enabled');
    return;
  }

  // Expose save function for dialogs and sheets to use
  game.fitgd!.saveImmediate = async function (): Promise<void> {
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
      const state = game.fitgd!.store.getState();
      const playerRoundState = state.playerRoundState;

      // Broadcast commands FIRST (before persistence) - all users can do this
      if (newCommandCount > 0 || Object.keys(playerRoundState.byCharacterId).length > 0) {
        const socketData: SocketCommandData = {
          type: 'commandsAdded',
          userId: game.user!.id,
          userName: game.user!.name,
          commandCount: newCommandCount,
          commands: newCommands,
          playerRoundState: playerRoundState, // Include ephemeral UI state
          timestamp: Date.now()
        };

        console.log(`FitGD | Broadcasting ${newCommandCount} commands + playerRoundState via socketlib`);

        try {
          // Use socketlib to broadcast to OTHER clients (not self)
          const result = await game.fitgd!.socket.executeForOthers('syncCommands', socketData);
          console.log(`FitGD | socketlib broadcast completed, result:`, result);
        } catch (error) {
          console.error('FitGD | socketlib broadcast error:', error);
        }
      } else {
        console.log(`FitGD | No new commands or playerRoundState to broadcast`);
      }

      // Auto-prune orphaned history if enabled
      if (game.user!.isGM) {
        const autoPruneEnabled = getSetting<boolean>('autoPruneHistory');

        if (autoPruneEnabled) {
          console.log('FitGD | Auto-prune enabled, checking for orphaned history...');

          // Get state before any operations
          const stateBefore = game.fitgd!.store.getState();
          const commandsBefore =
            stateBefore.characters.history.length +
            stateBefore.crews.history.length +
            stateBefore.clocks.history.length;
          const characterCountBefore = stateBefore.characters.allIds.length;
          const crewCountBefore = stateBefore.crews.allIds.length;
          const clockCountBefore = stateBefore.clocks.allIds.length;

          // 1. Identify valid entity IDs from Foundry
          const validCharacterIds = game.actors.filter(a => a.type === 'character').map(a => a.id);
          const validCrewIds = game.actors.filter(a => a.type === 'crew').map(a => a.id);
          const allValidEntityIds = [...validCharacterIds, ...validCrewIds];

          // 2. Cleanup State (remove orphans from Redux state)
          // This modifies state.byId and state.allIds
          game.fitgd!.foundry.cleanupOrphanedCharacters(validCharacterIds);
          game.fitgd!.foundry.cleanupOrphanedCrews(validCrewIds);
          game.fitgd!.foundry.cleanupOrphanedClocks(allValidEntityIds);

          // Get state after cleanup to identify valid clock IDs for history pruning
          const stateAfterCleanup = game.fitgd!.store.getState();
          const validClockIds = new Set(stateAfterCleanup.clocks.allIds);

          // 3. Prune History (remove commands for orphans)
          // This modifies state.history
          game.fitgd!.store.dispatch({ type: 'characters/pruneOrphanedHistory' });
          game.fitgd!.store.dispatch({ type: 'crews/pruneOrphanedHistory' });
          game.fitgd!.store.dispatch({
            type: 'clocks/pruneOrphanedHistory',
            payload: { validIds: validClockIds }
          });

          // 4. Check results
          const stateAfter = game.fitgd!.store.getState();
          const commandsAfter =
            stateAfter.characters.history.length +
            stateAfter.crews.history.length +
            stateAfter.clocks.history.length;

          const characterCountAfter = stateAfter.characters.allIds.length;
          const crewCountAfter = stateAfter.crews.allIds.length;
          const clockCountAfter = stateAfter.clocks.allIds.length;

          const prunedCount = commandsBefore - commandsAfter;
          const cleanedCount = (characterCountBefore - characterCountAfter) +
            (crewCountBefore - crewCountAfter) +
            (clockCountBefore - clockCountAfter);

          if (prunedCount > 0 || cleanedCount > 0) {
            console.log(`FitGD | Auto-prune: Removed ${cleanedCount} orphaned entities and ${prunedCount} history commands`);

            if (cleanedCount > 0) {
              ui.notifications!.info(`FitGD: Cleaned up ${cleanedCount} orphaned entities`);

              // If we cleaned up state, we MUST update the snapshot to persist the deletion
              // Otherwise, re-hydrating from the old snapshot would bring them back
              console.log('FitGD | Updating state snapshot to persist cleanup...');
              const stateSnapshot = game.fitgd!.foundry.exportState();
              await setSetting('stateSnapshot', stateSnapshot);
            }

            if (prunedCount > 0) {
              ui.notifications!.info(`FitGD: Pruned ${prunedCount} history commands`);
            }
          }
        }
      }

      // Save to Foundry settings (only if user has permission - typically GM)
      // Players will broadcast but won't persist; GM will persist when receiving broadcasts
      if (game.user!.isGM) {
        const history = game.fitgd!.foundry.exportHistory() as CommandHistory;
        await setSetting('commandHistory', history);
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
    game.fitgd!.bridge = createFoundryReduxBridge(
      game.fitgd!.store,
      game.fitgd!.saveImmediate
    );
    console.log('FitGD | Foundry-Redux Bridge created successfully');
    console.log('FitGD | Bridge API available at game.fitgd.bridge');
  } catch (error) {
    console.error('FitGD | Failed to create Foundry-Redux Bridge:', error);
    return;
  }

  // Extend game.fitgd.api.action with Foundry-specific takeAction helper
  (game.fitgd!.api.action as any).takeAction = takeAction;
  console.log('FitGD | Extended action API with takeAction helper');

  // Register settings
  registerSystemSettings();

  // Register sheet classes
  registerSheetClasses();

  // Register Handlebars helpers and partials
  await registerHandlebarsHelpers();

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
Hooks.once('ready', async function () {
  console.log(`FitGD | World ready for user: ${game.user!.name} (isGM: ${game.user!.isGM})`);
  console.log(`FitGD | game.fitgd initialized: ${!!game.fitgd}, has store: ${!!game.fitgd?.store}, has api: ${!!game.fitgd?.api}`);

  // Check for state snapshot first (used after history pruning)
  const stateSnapshot = getSetting<StateSnapshot | undefined>('stateSnapshot');
  const defaultHistory: CommandHistory = { characters: [], crews: [], clocks: [] };
  const history = getSetting<CommandHistory | undefined>('commandHistory') || defaultHistory;

  // Ensure history has the correct structure
  const validHistory: CommandHistory = {
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
      ui.notifications!.warn(`FitGD: Large command history detected (${totalCommands} commands). Performance may be affected. Consider using History Management to prune old commands.`, { permanent: true });
    }
  }

  if (stateSnapshot?.timestamp) {
    // Load from snapshot first
    console.log('FitGD | State snapshot found, hydrating from snapshot...');
    console.log(`FitGD | Snapshot timestamp: ${new Date(stateSnapshot.timestamp).toLocaleString()}`);

    try {
      // Hydrate Redux store from snapshot
      game.fitgd!.foundry.importState(stateSnapshot);
      console.log('FitGD | State restored from snapshot');

      // Then replay any new commands that occurred after the snapshot
      if (totalCommands > 0) {
        console.log(`FitGD | Replaying ${totalCommands} commands on top of snapshot...`);
        game.fitgd!.foundry.replayCommands(validHistory);
        console.log('FitGD | New commands applied');
      }

      // Track all commands as applied
      trackInitialCommandsAsApplied();
    } catch (error) {
      console.error('FitGD | Error loading from snapshot:', error);
      ui.notifications!.error('Failed to load game state from snapshot');
    }
  } else if (totalCommands > 0) {
    // No snapshot, use command history replay (old behavior)
    console.log(`FitGD | Replaying ${totalCommands} commands from history...`);
    game.fitgd!.foundry.replayCommands(validHistory);
    console.log('FitGD | State restored from command history');

    // Track all initial commands as applied (prevents re-application on sync)
    trackInitialCommandsAsApplied();
  } else {
    console.log('FitGD | No command history or snapshot found, starting fresh');
  }

  // Subscribe to store changes to auto-save
  game.fitgd!.store.subscribe(() => {
    saveCommandHistory();
  });

  // Save on page unload to catch any unsaved changes (GM only)
  window.addEventListener('beforeunload', () => {
    if (game.user!.isGM) {
      // Synchronous save (no await) for immediate execution
      try {
        const history = game.fitgd!.foundry.exportHistory() as CommandHistory;
        setSetting('commandHistory', history);
        const total = history.characters.length + history.crews.length + history.clocks.length;
        console.log(`FitGD | Saved ${total} commands (on unload - GM)`);
      } catch (error) {
        console.error('FitGD | Failed to save on unload:', error);
      }
    }
  });

  // Expose test function for manual socket testing
  game.fitgd!.testSocket = async function (): Promise<void> {
    console.log('FitGD | Testing socketlib...');
    console.log('FitGD | Socket object:', game.fitgd!.socket);

    const testData = {
      test: 'Hello from ' + game.user!.name,
      timestamp: Date.now(),
      userId: game.user!.id
    };

    try {
      console.log('FitGD | Sending test message:', testData);
      const result = await game.fitgd!.socket.executeForOthers('syncCommands', testData);
      console.log('FitGD | Test message sent, result:', result);
    } catch (error) {
      console.error('FitGD | Test message failed:', error);
      throw error;
    }
  };

  console.log('FitGD | Ready (socketlib handlers active)');
});

// Export helper for use in other modules if needed
export { refreshSheetsByReduxId };
