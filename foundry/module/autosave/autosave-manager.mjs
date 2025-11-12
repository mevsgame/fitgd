/**
 * Auto-save Manager
 *
 * Handles periodic saving of Redux state to Foundry settings
 */

// @ts-check

/* -------------------------------------------- */
/*  Auto-save Functionality                     */
/* -------------------------------------------- */

let autoSaveTimer = null;

// Track applied command IDs for idempotency (prevents re-applying same command)
const appliedCommandIds = new Set();

// Track last broadcast command counts to detect new commands
let lastBroadcastCount = {
  characters: 0,
  crews: 0,
  clocks: 0
};

/**
 * Extract new commands since last broadcast (for incremental sync)
 */
function getNewCommandsSinceLastBroadcast() {
  const history = game.fitgd.foundry.exportHistory();

  console.log(`FitGD | Current history counts: chars=${history.characters.length}, crews=${history.crews.length}, clocks=${history.clocks.length}`);
  console.log(`FitGD | Last broadcast counts: chars=${lastBroadcastCount.characters}, crews=${lastBroadcastCount.crews}, clocks=${lastBroadcastCount.clocks}`);

  const newCommands = {
    characters: history.characters.slice(lastBroadcastCount.characters),
    crews: history.crews.slice(lastBroadcastCount.crews),
    clocks: history.clocks.slice(lastBroadcastCount.clocks)
  };

  // Update the tracking counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };

  const totalNew = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;
  console.log(`FitGD | Found ${totalNew} new commands to broadcast:`, {
    characters: newCommands.characters.length,
    crews: newCommands.crews.length,
    clocks: newCommands.clocks.length
  });

  if (totalNew > 0) {
    console.log(`FitGD | New command types:`, newCommands.characters.map(c => c.type), newCommands.crews.map(c => c.type), newCommands.clocks.map(c => c.type));

    // DIAGNOSTIC: Warn if suspiciously large number of commands
    if (totalNew > 100) {
      console.error(`FitGD | WARNING: Suspiciously large command batch (${totalNew} commands)! Possible infinite loop!`);
      console.error(`FitGD | Command breakdown:`, {
        characters: newCommands.characters.length,
        crews: newCommands.crews.length,
        clocks: newCommands.clocks.length
      });
      console.error(`FitGD | Stack trace:`, new Error().stack);

      // If it's all clock commands, log which clocks and operations
      if (newCommands.clocks.length > 100) {
        const clockOps = {};
        newCommands.clocks.forEach(cmd => {
          const key = `${cmd.type}:${cmd.payload?.clockId?.substring(0, 8)}`;
          clockOps[key] = (clockOps[key] || 0) + 1;
        });
        console.error(`FitGD | Clock operation frequency:`, clockOps);
      }
    }
  }

  return newCommands;
}

/**
 * Apply commands incrementally to Redux store (for real-time sync)
 */
function applyCommandsIncremental(commands) {
  let appliedCount = 0;
  let skippedCount = 0;

  // Merge all commands and sort by timestamp
  const allCommands = [
    ...commands.characters,
    ...commands.crews,
    ...commands.clocks
  ].sort((a, b) => a.timestamp - b.timestamp);

  console.log(`FitGD | Applying ${allCommands.length} commands incrementally...`);

  for (const command of allCommands) {
    // Skip if already applied (idempotency check)
    if (appliedCommandIds.has(command.commandId)) {
      skippedCount++;
      continue;
    }

    try {
      // Dispatch command to Redux
      game.fitgd.store.dispatch({
        type: command.type,
        payload: command.payload,
        meta: { command }
      });

      // Track as applied
      appliedCommandIds.add(command.commandId);
      appliedCount++;
    } catch (error) {
      console.error(`FitGD | Error applying command ${command.type}:`, error);
    }
  }

  console.log(`FitGD | Applied ${appliedCount} commands, skipped ${skippedCount} duplicates`);
  return appliedCount;
}

/**
 * Circuit breaker to prevent broadcast loops
 */
let consecutiveLargeBroadcasts = 0;
const MAX_CONSECUTIVE_LARGE_BROADCASTS = 3;
const LARGE_BROADCAST_THRESHOLD = 50;

function resetCircuitBreaker() {
  consecutiveLargeBroadcasts = 0;
}

function checkCircuitBreaker(commandCount) {
  if (commandCount > LARGE_BROADCAST_THRESHOLD) {
    consecutiveLargeBroadcasts++;
    if (consecutiveLargeBroadcasts >= MAX_CONSECUTIVE_LARGE_BROADCASTS) {
      console.error(`FitGD | CIRCUIT BREAKER TRIPPED! Detected ${MAX_CONSECUTIVE_LARGE_BROADCASTS} consecutive large broadcasts (>${LARGE_BROADCAST_THRESHOLD} commands each). Possible infinite loop!`);
      ui.notifications.error('FitGD: Broadcast loop detected! Auto-save disabled. Please report this bug and reload the page.');
      return false; // Block broadcast
    }
  } else {
    resetCircuitBreaker();
  }
  return true; // Allow broadcast
}

/**
 * Update broadcast tracking after receiving commands from other clients
 * This prevents re-broadcasting commands that were received via socket
 */
function updateBroadcastTracking() {
  const history = game.fitgd.foundry.exportHistory();
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };
  console.log(`FitGD | Updated broadcast tracking after receiving commands`);
}

/**
 * Track initial commands as applied (called on ready)
 */
function trackInitialCommandsAsApplied() {
  const history = game.fitgd.foundry.exportHistory();

  // Track all initial commands as applied
  for (const command of history.characters) {
    appliedCommandIds.add(command.commandId);
  }
  for (const command of history.crews) {
    appliedCommandIds.add(command.commandId);
  }
  for (const command of history.clocks) {
    appliedCommandIds.add(command.commandId);
  }

  // Set initial broadcast counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };

  const total = history.characters.length + history.crews.length + history.clocks.length;
  console.log(`FitGD | Tracked ${total} initial commands as applied`);
}

/**
 * Refresh only the sheets affected by the given commands (optimization)
 * @param {Object} commands - Commands to process
 * @param {Map} clockEntityIds - Map of clockId to entityId (captured before deletion)
 */
function refreshAffectedSheets(commands, clockEntityIds = new Map()) {
  const affectedEntityIds = new Set();
  const state = game.fitgd.store.getState();

  // Extract entity IDs from command payloads
  for (const command of [...commands.characters, ...commands.crews, ...commands.clocks]) {
    // Direct entity references
    if (command.payload?.characterId) {
      affectedEntityIds.add(command.payload.characterId);
    }
    if (command.payload?.crewId) {
      affectedEntityIds.add(command.payload.crewId);
    }
    if (command.payload?.id) {
      affectedEntityIds.add(command.payload.id);
    }
    if (command.payload?.entityId) {
      affectedEntityIds.add(command.payload.entityId);
    }

    // Clock commands: resolve clockId to entityId
    if (command.payload?.clockId) {
      // First try the pre-captured map (for deleted clocks)
      if (clockEntityIds.has(command.payload.clockId)) {
        const entityId = clockEntityIds.get(command.payload.clockId);
        affectedEntityIds.add(entityId);
        console.log(`FitGD | Resolved clockId ${command.payload.clockId} to entityId ${entityId} (from pre-delete capture)`);
      } else {
        // Otherwise try current state (for non-deleted clocks)
        const clock = state.clocks.byId[command.payload.clockId];
        if (clock && clock.entityId) {
          affectedEntityIds.add(clock.entityId);
          console.log(`FitGD | Resolved clockId ${command.payload.clockId} to entityId ${clock.entityId}`);
        }
      }
    }
  }

  console.log(`FitGD | Refreshing sheets for ${affectedEntityIds.size} affected entities:`, Array.from(affectedEntityIds));
  console.log(`FitGD | Open windows: ${Object.keys(ui.windows).length}`);

  // Refresh only affected sheets (works for all permission levels: owner, observer, etc.)
  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) {
      continue;
    }

    // Check if it's a character or crew sheet by constructor name
    const isCharSheet = app.constructor.name === 'FitGDCharacterSheet';
    const isCrewSheet = app.constructor.name === 'FitGDCrewSheet';

    if (isCharSheet || isCrewSheet) {
      // Get entity ID (unified IDs: actor.id === Redux ID)
      const entityId = app.actor?.id;

      console.log(`FitGD | Checking ${app.constructor.name} - Actor: ${app.actor?.name}, ID: ${entityId}, Match: ${affectedEntityIds.has(entityId)}`);

      if (entityId && affectedEntityIds.has(entityId)) {
        try {
          const permission = app.actor?.testUserPermission(game.user, 'OBSERVER') ? 'observer+' :
                           app.actor?.testUserPermission(game.user, 'OWNER') ? 'owner' : 'limited';
          console.log(`FitGD | Re-rendering ${app.constructor.name} for ${entityId} (user: ${game.user.name}, permission: ${permission})`);

          // Force a full re-render (true = force) to ensure observers see updates
          // The sheet's getData() will read from Redux which has the latest state
          app.render(true);
          refreshedCount++;
        } catch (error) {
          console.error(`FitGD | Error re-rendering sheet for ${reduxId}:`, error);
        }
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheets`);
}

/**
 * Reload Redux state from Foundry settings (for multi-client sync)
 */
async function reloadStateFromSettings() {
  try {
    console.log('FitGD | Reloading state from settings...');

    // Load command history from settings
    const defaultHistory = { characters: [], crews: [], clocks: [] };
    const history = game.settings.get('forged-in-the-grimdark', 'commandHistory') || defaultHistory;

    // Ensure history has the correct structure
    const validHistory = {
      characters: history.characters || [],
      crews: history.crews || [],
      clocks: history.clocks || []
    };

    const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length;

    if (totalCommands > 0) {
      console.log(`FitGD | Replaying ${totalCommands} commands...`);

      // Clear existing state by dispatching reset actions
      console.log('FitGD | Resetting store to initial state...');
      game.fitgd.store.dispatch({ type: 'characters/reset' });
      game.fitgd.store.dispatch({ type: 'crews/reset' });
      game.fitgd.store.dispatch({ type: 'clocks/reset' });
      game.fitgd.store.dispatch({ type: 'playerRoundState/reset' });

      // Replay commands
      game.fitgd.foundry.replayCommands(validHistory);

      console.log('FitGD | State reloaded successfully');

      // Re-render all open sheets to show updated state
      for (const app of Object.values(ui.windows)) {
        if (app.rendered) {
          const isCharSheet = app.constructor.name === 'FitGDCharacterSheet';
          const isCrewSheet = app.constructor.name === 'FitGDCrewSheet';
          if (isCharSheet || isCrewSheet) {
            console.log(`FitGD | Re-rendering ${app.constructor.name}`);
            app.render(false);
          }
        }
      }
    }
  } catch (error) {
    console.error('FitGD | Error reloading state:', error);
    ui.notifications.error('Failed to reload game state. Please refresh the page.');
  }
}

async function saveCommandHistoryImmediate() {
  // Save immediately without debounce
  console.log(`FitGD | saveCommandHistoryImmediate() called`);
  try {
    // Get new commands since last broadcast
    const newCommands = getNewCommandsSinceLastBroadcast();
    const newCommandCount = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;

    // Circuit breaker: prevent infinite broadcast loops
    if (!checkCircuitBreaker(newCommandCount)) {
      console.error(`FitGD | Broadcast blocked by circuit breaker (auto-save)`);
      return;
    }

    // Broadcast commands FIRST (before persistence) - all users can do this
    if (newCommandCount > 0) {
      const socketData = {
        type: 'commandsAdded',
        userId: game.user.id,
        userName: game.user.name,
        commandCount: newCommandCount,
        commands: newCommands,
        timestamp: Date.now()
      };

      console.log(`FitGD | Broadcasting ${newCommandCount} commands via socketlib:`, socketData);
      console.log(`FitGD | game.fitgd.socket exists?`, !!game.fitgd.socket);

      try {
        // Use socketlib to broadcast to OTHER clients (not self)
        const result = await game.fitgd.socket.executeForOthers('syncCommands', socketData);
        console.log(`FitGD | socketlib broadcast completed, result:`, result);
      } catch (error) {
        console.error('FitGD | socketlib broadcast error:', error);
      }
    } else {
      console.log(`FitGD | No new commands to broadcast (count = 0)`);
    }

    // Save to Foundry settings (only if user has permission - typically GM)
    if (game.user.isGM) {
      const history = game.fitgd.foundry.exportHistory();
      await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
      const total = history.characters.length + history.crews.length + history.clocks.length;
      console.log(`FitGD | Saved ${total} commands to world settings (GM only)`);
    } else {
      console.log(`FitGD | Skipped settings save (player - GM will persist on receipt)`);
    }
  } catch (error) {
    console.error('FitGD | Error in saveCommandHistoryImmediate:', error);
    // Don't throw - we still want broadcasts to work even if save fails
  }
}

function saveCommandHistory() {
  // Debounced auto-save for non-critical updates
  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  const interval = game.settings.get('forged-in-the-grimdark', 'autoSaveInterval');
  if (interval === 0) return;

  autoSaveTimer = setTimeout(async () => {
    await saveCommandHistoryImmediate();
  }, interval * 1000);
}

// Export functions used by other modules
export {
  saveCommandHistory,
  trackInitialCommandsAsApplied,
  updateBroadcastTracking,
  applyCommandsIncremental,
  getNewCommandsSinceLastBroadcast,
  checkCircuitBreaker,
  refreshAffectedSheets,
  reloadStateFromSettings,
  saveCommandHistoryImmediate
};
