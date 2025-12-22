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
import { registerHUDHooks } from './hooks/hud-hooks';

// Widgets
import { CrewHUDPanel } from './widgets/crew-hud-panel';

// Socket and autosave modules
import { receiveCommandsFromSocket, handleTakeAction, getIsReceivingFromSocket } from './socket/socket-handler';
import { saveCommandHistory, trackInitialCommandsAsApplied, getNewCommandsSinceLastBroadcast, checkCircuitBreaker } from './autosave/autosave-manager';

// Developer commands
import { registerDevCommands } from './console/dev-commands';
import { logger } from './utils/logger';

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
  playerRoundState: unknown[];  // NEW: Player round state commands
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
  activePlayerActions: Record<string, RootState['crews']['byId'][string]['activePlayerAction']>;
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
  logger.info('Initializing Forged in the Grimdark system');

  // Create global namespace
  if (!game.fitgd) {
    (game as any).fitgd = {};
  }

  // Initialize Redux store
  logger.info('Creating Redux store...');
  try {
    game.fitgd!.store = configureStore() as Store<RootState>;
    logger.info('Redux store created successfully');
  } catch (error) {
    logger.error('Failed to create Redux store:', error);
    return;
  }

  // Initialize Game API
  logger.info('Creating Game API...');
  try {
    game.fitgd!.api = createGameAPI(game.fitgd!.store);
    logger.info('Game API created successfully. Available APIs:', Object.keys(game.fitgd!.api));
  } catch (error) {
    logger.error('Failed to create Game API:', error);
    return;
  }

  // Initialize Foundry adapter
  logger.info('Creating Foundry adapter...');
  try {
    game.fitgd!.foundry = createFoundryAdapter(game.fitgd!.store);
    logger.info('Foundry adapter created successfully');
  } catch (error) {
    logger.error('Failed to create Foundry adapter:', error);
    return;
  }

  // Initialize socketlib for reliable multi-client communication
  logger.info('Initializing socketlib...');
  logger.info('socketlib available?', typeof socketlib !== 'undefined');

  try {
    if (typeof socketlib === 'undefined') {
      throw new Error('socketlib is not defined - module may not be installed or enabled');
    }

    game.fitgd!.socket = socketlib.registerSystem('forged-in-the-grimdark');
    logger.info('socketlib registered successfully, socket object:', game.fitgd!.socket);

    // Register socket handlers
    // Note: Handler function must be defined before registration
    game.fitgd!.socket.register('syncCommands', receiveCommandsFromSocket);
    game.fitgd!.socket.register('takeAction', handleTakeAction);
    logger.info('Socket handlers registered for "syncCommands" and "takeAction"');
    logger.info('Handler functions:', receiveCommandsFromSocket, handleTakeAction);
  } catch (error) {
    logger.error('Failed to initialize socketlib:', error);
    logger.error('Make sure socketlib module is installed and enabled');
    return;
  }

  // Track last broadcast activePlayerActions to prevent re-broadcasting unchanged state
  let lastBroadcastActivePlayerActions = '';

  // Expose function to sync tracking when receiving from socket (prevents ping-pong)
  game.fitgd!.syncActivePlayerActionsTracking = function (receivedActions: Record<string, unknown>): void {
    lastBroadcastActivePlayerActions = JSON.stringify(receivedActions);
  };

  // Expose save function for dialogs and sheets to use
  game.fitgd!.saveImmediate = async function (): Promise<void> {
    try {
      // Get new commands since last broadcast
      const newCommands = getNewCommandsSinceLastBroadcast();
      const newCommandCount = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;

      // Circuit breaker: prevent infinite broadcast loops
      if (!checkCircuitBreaker(newCommandCount)) {
        logger.error(`Broadcast blocked by circuit breaker`);
        return;
      }

      // Also get current playerRoundState for real-time collaboration
      const state = game.fitgd!.store.getState();
      const playerRoundState = state.playerRoundState;

      // Get activePlayerActions from all crews for widget lifecycle sync
      const activePlayerActions: Record<string, typeof state.crews.byId[string]['activePlayerAction']> = {};
      for (const crewId of state.crews.allIds) {
        const crew = state.crews.byId[crewId];
        if (crew?.activePlayerAction !== undefined) {
          activePlayerActions[crewId] = crew.activePlayerAction;
        }
      }

      // Check if activePlayerActions actually changed to prevent infinite broadcast loop
      const currentActivePlayerActionsJson = JSON.stringify(activePlayerActions);
      const activePlayerActionsChanged = currentActivePlayerActionsJson !== lastBroadcastActivePlayerActions;

      // Skip broadcasting activePlayerActions if we're currently receiving from socket (prevents loop)
      const shouldBroadcastActivePlayerActions = activePlayerActionsChanged && !getIsReceivingFromSocket();

      // Broadcast commands FIRST (before persistence) - all users can do this
      // Only broadcast activePlayerActions if they actually changed (to prevent infinite loop)
      if (newCommandCount > 0 || Object.keys(playerRoundState.byCharacterId).length > 0 || shouldBroadcastActivePlayerActions) {
        const socketData: SocketCommandData = {
          type: 'commandsAdded',
          userId: game.user!.id,
          userName: game.user!.name,
          commandCount: newCommandCount,
          commands: newCommands,
          playerRoundState: playerRoundState, // Include ephemeral UI state
          activePlayerActions: shouldBroadcastActivePlayerActions ? activePlayerActions : {}, // Only if changed and not receiving
          timestamp: Date.now()
        };

        // DEBUG: Log activePlayerActions being broadcast
        if (shouldBroadcastActivePlayerActions) {
          console.log('FitGD | Broadcasting activePlayerActions (changed):', activePlayerActions);
          // Update tracking to prevent re-broadcast
          lastBroadcastActivePlayerActions = currentActivePlayerActionsJson;
        }

        logger.info(`Broadcasting ${newCommandCount} commands + playerRoundState via socketlib`);
        logger.debug(`PlayerRoundState being broadcast:`, JSON.stringify(playerRoundState, null, 2));

        try {
          // Use socketlib to broadcast to OTHER clients (not self)
          const result = await game.fitgd!.socket.executeForOthers('syncCommands', socketData);
          logger.info(`socketlib broadcast completed, result:`, result);
        } catch (error) {
          logger.error('socketlib broadcast error:', error);
        }
      } else {
        logger.info(`No new commands or playerRoundState to broadcast`);
      }

      // Auto-prune orphaned history if enabled
      if (game.user!.isGM) {
        const autoPruneEnabled = getSetting<boolean>('autoPruneHistory');

        if (autoPruneEnabled) {
          logger.info('Auto-prune enabled, checking for orphaned history...');

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
            logger.info(`Auto-prune: Removed ${cleanedCount} orphaned entities and ${prunedCount} history commands`);

            if (cleanedCount > 0) {
              ui.notifications!.info(`FitGD: Cleaned up ${cleanedCount} orphaned entities`);

              // If we cleaned up state, we MUST update the snapshot to persist the deletion
              // Otherwise, re-hydrating from the old snapshot would bring them back
              logger.info('Updating state snapshot to persist cleanup...');
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
        logger.info(`Saved ${total} commands to world settings (GM only)`);
      } else {
        logger.info(`Skipped settings save (player - GM will persist on receipt)`);
      }
    } catch (error) {
      logger.error('Error in saveImmediate:', error);
      // Don't throw - we still want broadcasts to work even if save fails
    }
  };

  // Initialize Foundry-Redux Bridge API
  logger.info('Creating Foundry-Redux Bridge...');
  try {
    game.fitgd!.bridge = createFoundryReduxBridge(
      game.fitgd!.store,
      game.fitgd!.saveImmediate
    );
    logger.info('Foundry-Redux Bridge created successfully');
    logger.info('Bridge API available at game.fitgd.bridge');
  } catch (error) {
    logger.error('Failed to create Foundry-Redux Bridge:', error);
    return;
  }

  // Extend game.fitgd.api.action with Foundry-specific takeAction helper
  (game.fitgd!.api.action as any).takeAction = takeAction;
  logger.info('Extended action API with takeAction helper');

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
  registerHUDHooks();

  // Register developer console commands
  registerDevCommands();

  // Manually load CSS files if not loaded (workaround for system.json hot reload)
  const cssFiles = [
    'systems/forged-in-the-grimdark/templates/styles/equipment-row-view.css',
    'systems/forged-in-the-grimdark/templates/styles/crew-hud-panel.css'
  ];
  for (const cssPath of cssFiles) {
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssPath;
      document.head.appendChild(link);
      logger.info(`Manually loaded ${cssPath}`);
    }
  }

  // Expose HUD API for console/macro access
  game.fitgd!.hud = {
    show: CrewHUDPanel.show.bind(CrewHUDPanel),
    hide: CrewHUDPanel.hide.bind(CrewHUDPanel),
    isVisible: CrewHUDPanel.isVisible.bind(CrewHUDPanel)
  };

  logger.info('Initialization complete');
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

/**
 * Load saved game state when world is ready
 */
Hooks.once('ready', async function () {
  logger.info(`World ready for user: ${game.user!.name} (isGM: ${game.user!.isGM})`);
  logger.debug(`game.fitgd initialized: ${!!game.fitgd}, has store: ${!!game.fitgd?.store}, has api: ${!!game.fitgd?.api}`);

  // Check for state snapshot first (used after history pruning)
  const stateSnapshot = getSetting<StateSnapshot | undefined>('stateSnapshot');
  const defaultHistory: CommandHistory = { characters: [], crews: [], clocks: [], playerRoundState: [] };
  const history = getSetting<CommandHistory | undefined>('commandHistory') || defaultHistory;

  // Ensure history has the correct structure
  const validHistory: CommandHistory = {
    characters: history.characters || [],
    crews: history.crews || [],
    clocks: history.clocks || [],
    playerRoundState: history.playerRoundState || []
  };

  const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length + validHistory.playerRoundState.length;

  // Warn if command history is bloated (possible corruption or spam issue)
  if (totalCommands > 1000) {
    logger.warn(`WARNING: Command history is large (${totalCommands} commands). This may indicate a previous spam issue.`);
    logger.warn(`Breakdown: chars=${validHistory.characters.length}, crews=${validHistory.crews.length}, clocks=${validHistory.clocks.length}`);

    if (totalCommands > 3000) {
      logger.error(`CRITICAL: Command history is VERY large (${totalCommands} commands)!`);
      ui.notifications!.warn(`FitGD: Large command history detected (${totalCommands} commands). Performance may be affected. Consider using History Management to prune old commands.`, { permanent: true });
    }
  }

  if (stateSnapshot?.timestamp) {
    // Load from snapshot first
    logger.info('State snapshot found, hydrating from snapshot...');
    logger.info(`Snapshot timestamp: ${new Date(stateSnapshot.timestamp).toLocaleString()}`);

    try {
      // Hydrate Redux store from snapshot
      game.fitgd!.foundry.importState(stateSnapshot);
      logger.info('State restored from snapshot');

      // Then replay any new commands that occurred after the snapshot
      if (totalCommands > 0) {
        logger.info(`Replaying ${totalCommands} commands on top of snapshot...`);
        game.fitgd!.foundry.replayCommands(validHistory);
        logger.info('New commands applied');
      }

      // Track all commands as applied
      trackInitialCommandsAsApplied();
    } catch (error) {
      logger.error('Error loading from snapshot:', error);
      ui.notifications!.error('Failed to load game state from snapshot');
    }
  } else if (totalCommands > 0) {
    // No snapshot, use command history replay (old behavior)
    logger.info(`Replaying ${totalCommands} commands from history...`);
    game.fitgd!.foundry.replayCommands(validHistory);
    logger.info('State restored from command history');

    // Track all initial commands as applied (prevents re-application on sync)
    trackInitialCommandsAsApplied();
  } else {
    logger.info('No command history or snapshot found, starting fresh');
  }

  // Synchronize Redux state from Foundry Actors (Authoritative Source for Names)
  // This ensures that if Redux state was stale (e.g. name change not persisted in history),
  // it is updated to match the Foundry world data on load.
  logger.info('Syncing Redux state from Foundry Actors...');
  try {
    const state = game.fitgd!.store.getState();

    // Sync Characters
    game.actors!.filter(a => a.type === 'character').forEach(actor => {
      const reduxChar = state.characters.byId[actor.id as string];
      if (reduxChar && reduxChar.name !== actor.name) {
        logger.info(`Syncing character name for ${actor.name} (${actor.id})`);
        game.fitgd!.store.dispatch({
          type: 'characters/updateCharacterName',
          payload: { characterId: actor.id, name: actor.name }
        });
      }
    });

    // Sync Crews
    game.actors!.filter(a => a.type === 'crew').forEach(actor => {
      const reduxCrew = state.crews.byId[actor.id as string];
      if (reduxCrew && reduxCrew.name !== actor.name) {
        logger.info(`Syncing crew name for ${actor.name} (${actor.id})`);
        game.fitgd!.store.dispatch({
          type: 'crews/updateCrewName',
          payload: { crewId: actor.id, name: actor.name }
        });
      }
    });

    // If any changes were made during sync, we should probably save them to the snapshot/history
    // But since these are "lightweight" syncs that don't generate history, they won't be saved to history anyway.
    // They are just ensuring the in-memory state is correct for the session.
    // The next snapshot save will capture them.

  } catch (err) {
    logger.error('Error syncing from Foundry Actors:', err);
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
        logger.info(`Saved ${total} commands (on unload - GM)`);
      } catch (error) {
        logger.error('Failed to save on unload:', error);
      }
    }
  });

  // Expose test function for manual socket testing
  game.fitgd!.testSocket = async function (): Promise<void> {
    logger.info('Testing socketlib...');
    logger.info('Socket object:', game.fitgd!.socket);

    const testData = {
      test: 'Hello from ' + game.user!.name,
      timestamp: Date.now(),
      userId: game.user!.id
    };

    try {
      logger.info('Sending test message:', testData);
      const result = await game.fitgd!.socket.executeForOthers('syncCommands', testData);
      logger.info('Test message sent, result:', result);
    } catch (error) {
      logger.error('Test message failed:', error);
      throw error;
    }
  };

  // Widget Lifecycle Sync: Auto-open widget on page ready if there's an active action for a character this user owns
  // This ensures players reconnecting mid-action see their widget
  setTimeout(async () => {
    try {
      const state = game.fitgd!.store.getState();
      for (const crewId of state.crews.allIds) {
        const crew = state.crews.byId[crewId];
        const action = crew?.activePlayerAction;
        if (action) {
          // Check if this user owns the character or is GM
          const actor = game.actors!.get(action.characterId);
          if (actor && (actor.isOwner || game.user!.isGM)) {
            // Check if widget is already open
            const existingWidget = Object.values(ui.windows).find(
              (app) => (app as any).characterId === action.characterId
            );
            if (!existingWidget) {
              logger.info(`Widget Lifecycle Sync: Reopening widget for ${action.characterId} (active action found)`);

              // Ensure playerRoundState is initialized for this character before opening widget
              const currentState = game.fitgd!.store.getState();
              if (!currentState.playerRoundState.byCharacterId[action.characterId]) {
                logger.info(`Widget Lifecycle Sync: Initializing playerRoundState for ${action.characterId}`);
                game.fitgd!.store.dispatch({
                  type: 'playerRoundState/initializePlayerState',
                  payload: { characterId: action.characterId }
                });
              }

              // Use dynamic import for ESM compatibility
              const { PlayerActionWidget } = await import('./widgets/player-action-widget');
              const widget = new PlayerActionWidget(action.characterId);
              widget.render(true);
            }
          }
        }
      }
    } catch (err) {
      logger.warn('Error checking for active player actions on ready:', err);
    }
  }, 500); // Short delay to ensure state is hydrated

  logger.info('Ready (socketlib handlers active)');
});

// Export helper for use in other modules if needed
export { refreshSheetsByReduxId };
