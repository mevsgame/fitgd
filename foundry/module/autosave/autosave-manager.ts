/**
 * Auto-save Manager
 *
 * Handles periodic saving of Redux state to Foundry settings
 */

/* -------------------------------------------- */
/*  Type Definitions                            */
/* -------------------------------------------- */

/**
 * Command history structure
 */
interface CommandHistory {
  characters: any[];
  crews: any[];
  clocks: any[];
  playerRoundState: any[];  // NEW: Player round state commands
}

/**
 * Command count tracking structure
 */
interface CommandCount {
  characters: number;
  crews: number;
  clocks: number;
  playerRoundState: number;  // NEW: Player round state command count
}

/* -------------------------------------------- */
/*  Auto-save Functionality                     */
/* -------------------------------------------- */

let autoSaveTimer: number | null = null;

// Track applied command IDs for idempotency (prevents re-applying same command)
const appliedCommandIds = new Set<string>();

// Track last broadcast command counts to detect new commands
let lastBroadcastCount: CommandCount = {
  characters: 0,
  crews: 0,
  clocks: 0,
  playerRoundState: 0  // NEW: Player round state command count
};

/**
 * Extract new commands since last broadcast (for incremental sync)
 */
export function getNewCommandsSinceLastBroadcast(): CommandHistory {
  const history = game.fitgd!.foundry.exportHistory();

  // Get playerRoundState commands from Redux state
  const playerRoundStateHistory = game.fitgd!.store.getState().playerRoundState.history || [];

  console.log(`FitGD | Current history counts: chars=${history.characters.length}, crews=${history.crews.length}, clocks=${history.clocks.length}, playerRoundState=${playerRoundStateHistory.length}`);
  console.log(`FitGD | Last broadcast counts: chars=${lastBroadcastCount.characters}, crews=${lastBroadcastCount.crews}, clocks=${lastBroadcastCount.clocks}, playerRoundState=${lastBroadcastCount.playerRoundState}`);

  const newCommands: CommandHistory = {
    characters: history.characters.slice(lastBroadcastCount.characters),
    crews: history.crews.slice(lastBroadcastCount.crews),
    clocks: history.clocks.slice(lastBroadcastCount.clocks),
    playerRoundState: playerRoundStateHistory.slice(lastBroadcastCount.playerRoundState)
  };

  // Update the tracking counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length,
    playerRoundState: playerRoundStateHistory.length
  };

  const totalNew = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length + newCommands.playerRoundState.length;
  console.log(`FitGD | Found ${totalNew} new commands to broadcast:`, {
    characters: newCommands.characters.length,
    crews: newCommands.crews.length,
    clocks: newCommands.clocks.length,
    playerRoundState: newCommands.playerRoundState.length
  });

  if (totalNew > 0) {
    console.log(`FitGD | New command types:`,
      newCommands.characters.map((c: any) => c.type),
      newCommands.crews.map((c: any) => c.type),
      newCommands.clocks.map((c: any) => c.type),
      newCommands.playerRoundState.map((c: any) => c.type));

    // DIAGNOSTIC: Warn if suspiciously large number of commands
    if (totalNew > 100) {
      console.error(`FitGD | WARNING: Suspiciously large command batch (${totalNew} commands)! Possible infinite loop!`);
      console.error(`FitGD | Command breakdown:`, {
        characters: newCommands.characters.length,
        crews: newCommands.crews.length,
        clocks: newCommands.clocks.length,
        playerRoundState: newCommands.playerRoundState.length
      });
      console.error(`FitGD | Stack trace:`, new Error().stack);

      // If it's all clock commands, log which clocks and operations
      if (newCommands.clocks.length > 100) {
        const clockOps: Record<string, number> = {};
        newCommands.clocks.forEach((cmd: any) => {
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
export function applyCommandsIncremental(commands: CommandHistory): number {
  let appliedCount = 0;
  let skippedCount = 0;

  // Merge all commands and sort by timestamp
  const allCommands = [
    ...commands.characters,
    ...commands.crews,
    ...commands.clocks,
    ...(commands.playerRoundState || [])
  ].sort((a: any, b: any) => a.timestamp - b.timestamp);

  console.log(`FitGD | Applying ${allCommands.length} commands incrementally...`);

  // Track startPlayerAction commands for widget opening
  const startPlayerActionCommands: any[] = [];

  for (const command of allCommands) {
    const cmd = command as any;
    // Skip if already applied (idempotency check)
    if (appliedCommandIds.has(cmd.commandId)) {
      skippedCount++;
      continue;
    }

    try {
      // Dispatch command to Redux
      game.fitgd!.store.dispatch({
        type: cmd.type,
        payload: cmd.payload,
        meta: { command: cmd }
      });

      // Track as applied
      appliedCommandIds.add(cmd.commandId);
      appliedCount++;

      // Track startPlayerAction for widget opening
      if (cmd.type === 'crews/startPlayerAction') {
        startPlayerActionCommands.push(cmd);
      }
    } catch (error) {
      console.error(`FitGD | Error applying command ${cmd.type}:`, error);
    }
  }

  console.log(`FitGD | Applied ${appliedCount} commands, skipped ${skippedCount} duplicates`);

  // PLAYER WIDGET OPENING: Open widget for non-GM users when startPlayerAction arrives
  // This is the counterpart to GM opening widget in combat-hooks
  if (!game.user!.isGM && startPlayerActionCommands.length > 0) {
    for (const cmd of startPlayerActionCommands) {
      const characterId = cmd.payload.characterId;

      // Check if current user owns this character's actor
      const actor = game.actors?.get(characterId);
      if (actor && actor.isOwner) {
        // Check if widget already exists
        const existingWidget = Object.values(ui.windows).find(
          (app: any) => app.constructor.name === 'PlayerActionWidget' && app.characterId === characterId
        );

        if (!existingWidget) {
          console.log(`FitGD | Opening Player Action Widget for owned character ${characterId} (from socket)`);
          // Dynamically import to avoid circular dependency
          import('../widgets/player-action-widget').then(({ PlayerActionWidget }) => {
            const widget = new PlayerActionWidget(characterId);
            widget.render(true);
          });
        }
      }
    }
  }

  return appliedCount;
}

/**
 * Circuit breaker to prevent broadcast loops
 */
let consecutiveLargeBroadcasts = 0;
const MAX_CONSECUTIVE_LARGE_BROADCASTS = 3;
const LARGE_BROADCAST_THRESHOLD = 50;

function resetCircuitBreaker(): void {
  consecutiveLargeBroadcasts = 0;
}

export function checkCircuitBreaker(commandCount: number): boolean {
  if (commandCount > LARGE_BROADCAST_THRESHOLD) {
    consecutiveLargeBroadcasts++;
    if (consecutiveLargeBroadcasts >= MAX_CONSECUTIVE_LARGE_BROADCASTS) {
      console.error(`FitGD | CIRCUIT BREAKER TRIPPED! Detected ${MAX_CONSECUTIVE_LARGE_BROADCASTS} consecutive large broadcasts (>${LARGE_BROADCAST_THRESHOLD} commands each). Possible infinite loop!`);
      ui.notifications!.error('FitGD: Broadcast loop detected! Auto-save disabled. Please report this bug and reload the page.');
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
export function updateBroadcastTracking(): void {
  const history = game.fitgd!.foundry.exportHistory();
  const playerRoundStateHistory = game.fitgd!.store.getState().playerRoundState.history || [];
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length,
    playerRoundState: playerRoundStateHistory.length
  };
  console.log(`FitGD | Updated broadcast tracking after receiving commands`);
}

/**
 * Track initial commands as applied (called on ready)
 */
export function trackInitialCommandsAsApplied(): void {
  const history = game.fitgd!.foundry.exportHistory();
  const playerRoundStateHistory = game.fitgd!.store.getState().playerRoundState.history || [];

  // Track all initial commands as applied
  for (const command of history.characters) {
    appliedCommandIds.add((command as any).commandId);
  }
  for (const command of history.crews) {
    appliedCommandIds.add((command as any).commandId);
  }
  for (const command of history.clocks) {
    appliedCommandIds.add((command as any).commandId);
  }
  for (const command of playerRoundStateHistory) {
    appliedCommandIds.add((command as any).commandId);
  }

  // Set initial broadcast counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length,
    playerRoundState: playerRoundStateHistory.length
  };

  const total = history.characters.length + history.crews.length + history.clocks.length + playerRoundStateHistory.length;
  console.log(`FitGD | Tracked ${total} initial commands as applied`);
}

/**
 * Refresh only the sheets affected by the given commands (optimization)
 */
export function refreshAffectedSheets(commands: CommandHistory, clockEntityIds: Map<string, string> = new Map()): void {
  const affectedEntityIds = new Set<string>();
  const state = game.fitgd!.store.getState();

  // Extract entity IDs from command payloads
  for (const command of [...commands.characters, ...commands.crews, ...commands.clocks]) {
    const cmd = command as any;
    // Direct entity references
    if (cmd.payload?.characterId) {
      affectedEntityIds.add(cmd.payload.characterId);
    }
    if (cmd.payload?.crewId) {
      affectedEntityIds.add(cmd.payload.crewId);
    }
    if (cmd.payload?.id) {
      affectedEntityIds.add(cmd.payload.id);
    }
    if (cmd.payload?.entityId) {
      affectedEntityIds.add(cmd.payload.entityId);
    }

    // Clock commands: resolve clockId to entityId
    if (cmd.payload?.clockId) {
      // First try the pre-captured map (for deleted clocks)
      if (clockEntityIds.has(cmd.payload.clockId)) {
        const entityId = clockEntityIds.get(cmd.payload.clockId);
        if (entityId) {
          affectedEntityIds.add(entityId);
          console.log(`FitGD | Resolved clockId ${cmd.payload.clockId} to entityId ${entityId} (from pre-delete capture)`);
        }
      } else {
        // Otherwise try current state (for non-deleted clocks)
        const clock = state.clocks.byId[cmd.payload.clockId];
        if (clock && clock.entityId) {
          affectedEntityIds.add(clock.entityId);
          console.log(`FitGD | Resolved clockId ${cmd.payload.clockId} to entityId ${clock.entityId}`);
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
      const entityId = (app as any).actor?.id;

      console.log(`FitGD | Checking ${app.constructor.name} - Actor: ${(app as any).actor?.name}, ID: ${entityId}, Match: ${affectedEntityIds.has(entityId)}`);

      if (entityId && affectedEntityIds.has(entityId)) {
        try {
          const actor = (app as any).actor;
          const permission = actor?.testUserPermission(game.user, 'OBSERVER') ? 'observer+' :
            actor?.testUserPermission(game.user, 'OWNER') ? 'owner' : 'limited';
          console.log(`FitGD | Re-rendering ${app.constructor.name} for ${entityId} (user: ${game.user!.name}, permission: ${permission})`);

          // Force a full re-render (true = force) to ensure observers see updates
          // The sheet's getData() will read from Redux which has the latest state
          app.render(true);
          refreshedCount++;
        } catch (error) {
          console.error(`FitGD | Error re-rendering sheet for ${entityId}:`, error);
        }
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheets`);

  // Note: CrewHUDPanel now handles its own updates via store subscription
  // No explicit refresh needed here
}

/**
 * Reload Redux state from Foundry settings (for multi-client sync)
 */
export async function reloadStateFromSettings(): Promise<void> {
  try {
    console.log('FitGD | Reloading state from settings...');

    // Load command history from settings
    const defaultHistory: CommandHistory = { characters: [], crews: [], clocks: [], playerRoundState: [] };
    const history = (game.settings as any).get('forged-in-the-grimdark', 'commandHistory') || defaultHistory;

    // Ensure history has the correct structure
    const validHistory: CommandHistory = {
      characters: history.characters || [],
      crews: history.crews || [],
      clocks: history.clocks || [],
      playerRoundState: history.playerRoundState || []
    };

    const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length + validHistory.playerRoundState.length;

    if (totalCommands > 0) {
      console.log(`FitGD | Replaying ${totalCommands} commands...`);

      // Clear existing state by dispatching reset actions
      console.log('FitGD | Resetting store to initial state...');
      game.fitgd!.store.dispatch({ type: 'characters/reset' });
      game.fitgd!.store.dispatch({ type: 'crews/reset' });
      game.fitgd!.store.dispatch({ type: 'clocks/reset' });
      game.fitgd!.store.dispatch({ type: 'playerRoundState/reset' });

      // Replay commands
      game.fitgd!.foundry.replayCommands(validHistory);

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
    ui.notifications!.error('Failed to reload game state. Please refresh the page.');
  }
}

export async function saveCommandHistoryImmediate(): Promise<void> {
  // Delegate to the centralized save function in fitgd.ts
  // This ensures all broadcast logic (activePlayerActions, circuit breakers, etc.) is unified
  if (game.fitgd?.saveImmediate) {
    return game.fitgd.saveImmediate();
  } else {
    console.error('FitGD | game.fitgd.saveImmediate is not defined!');
  }
}

export function saveCommandHistory(): void {
  // Debounced auto-save for non-critical updates
  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  const interval = (game.settings as any).get('forged-in-the-grimdark', 'autoSaveInterval') as number;
  if (interval === 0) return;

  autoSaveTimer = setTimeout(async () => {
    await saveCommandHistoryImmediate();
  }, interval * 1000) as unknown as number;
}
