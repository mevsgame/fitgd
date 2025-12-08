/**
 * Socket Communication Handler
 *
 * Manages socket communication for Redux state synchronization across clients
 *
 * CRITICAL: This module contains INTENTIONAL bare dispatch() calls that must NOT
 * be refactored to use the Bridge API. These dispatches handle incoming state
 * from other clients and must NOT re-broadcast to avoid infinite loops.
 */

import { updateBroadcastTracking, applyCommandsIncremental, refreshAffectedSheets, reloadStateFromSettings } from '../autosave/autosave-manager';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers';
import { PlayerActionWidget } from '../widgets/player-action-widget';
import { logger } from '@/utils/logger';

// Flag to prevent re-broadcasting when receiving from socket
let isReceivingFromSocket = false;
export function getIsReceivingFromSocket(): boolean {
  return isReceivingFromSocket;
}

/* -------------------------------------------- */
/*  Socket Communication (socketlib)            */
/* -------------------------------------------- */

/**
 * Command history structure for socket messages
 */
interface CommandHistory {
  characters: unknown[];
  crews: unknown[];
  clocks: unknown[];
  playerRoundState: unknown[];  // NEW: Player round state commands
}

/**
 * Player round state structure (ephemeral UI state)
 */
interface PlayerRoundState {
  state?: string;
  position?: string;
  effect?: string;
  selectedAction?: string;
  selectedApproach?: string;
  secondaryApproach?: string;
  equippedForAction?: string[];
  rollMode?: string;
  gmApproved?: boolean;
  traitTransaction?: any;
  pushed?: boolean;
  pushType?: string;
  rollResult?: any[];
  outcome?: string;
  dicePool?: number;
  consequenceTransaction?: any;
  stimsUsedThisAction?: boolean;
  approvedPassiveId?: string;
}

/**
 * Player round state collection by character ID
 */
interface PlayerRoundStateCollection {
  byCharacterId: Record<string, PlayerRoundState>;
  activeCharacterId?: string | null;
}

/**
 * Socket message data structure
 */
interface SocketMessageData {
  type?: string;
  test?: string;
  userId?: string;
  userName?: string;
  commandCount?: number;
  commands?: CommandHistory;
  playerRoundState?: PlayerRoundStateCollection;
  activePlayerActions?: Record<string, any>; // Widget lifecycle sync
  timestamp?: number;
}

/**
 * Receive commands from other clients via socketlib
 * This function is registered with socketlib and called automatically
 * when other clients broadcast commands.
 */
async function receiveCommandsFromSocket(data: SocketMessageData): Promise<void> {
  logger.debug(`socketlib received data:`, data);

  // Handle test messages (for diagnostics)
  if (data.test) {
    console.log(`FitGD | Received test message: "${data.test}"`);
    return;
  }

  // Handle real command sync messages
  if (data.type !== 'commandsAdded') {
    console.warn(`FitGD | Received unknown message type: ${data.type}`);
    return;
  }

  const userName = data.userName || 'Unknown User';
  logger.info(`Received ${data.commandCount || 0} new commands from ${userName}`);

  // Validate commands structure
  if (!data.commands) {
    logger.error(`No commands in message data`);
    return;
  }

  logger.debug(`Commands to apply:`, data.commands);

  try {
    // BEFORE applying commands, capture entityIds for clocks that will be deleted
    // (so we can refresh sheets even after the clock is gone)
    const state = game.fitgd!.store.getState();
    const clockEntityIds = new Map<string, string>();
    for (const command of data.commands.clocks) {
      const cmd = command as any;
      if (cmd.payload?.clockId) {
        const clock = state.clocks.byId[cmd.payload.clockId];
        if (clock) {
          clockEntityIds.set(cmd.payload.clockId, clock.entityId);
        }
      }
    }

    // Apply commands incrementally (no store reset!)
    const appliedCount = applyCommandsIncremental(data.commands);

    // Also apply playerRoundState if present (ephemeral UI state)
    const changedCharacterIds: string[] = [];
    if (data.playerRoundState) {
      logger.debug(`Applying received playerRoundState:`, data.playerRoundState);

      const currentState = game.fitgd!.store.getState();

      // Update each character's playerRoundState by dispatching actions
      for (const [characterId, receivedPlayerState] of Object.entries(data.playerRoundState.byCharacterId)) {
        let currentPlayerState = currentState.playerRoundState.byCharacterId[characterId];

        logger.debug(`Socket handler - character ${characterId.substring(0, 8)}:`);
        logger.debug(`  Current state: ${currentPlayerState?.state}`);
        logger.debug(`  Received state: ${receivedPlayerState.state}`);

        // CRITICAL: Initialize player state if it doesn't exist!
        if (!currentPlayerState) {
          logger.debug(`  No current state - initializing player state first`);
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/initializePlayerState',
            payload: { characterId }
          });
          // Re-fetch the newly initialized state for this character
          const updatedState = game.fitgd!.store.getState();
          currentPlayerState = updatedState.playerRoundState.byCharacterId[characterId];
          logger.debug(`  Initialized state: ${currentPlayerState?.state}`);
        }

        // Skip if identical (avoid unnecessary updates)
        if (JSON.stringify(currentPlayerState) === JSON.stringify(receivedPlayerState)) {
          logger.debug(`  Skipping - states are identical`);
          continue;
        }

        logger.debug(`  States differ - applying updates`);

        // Track that this character's state changed
        changedCharacterIds.push(characterId);

        // Check if this is a fresh/reset state (IDLE_WAITING with minimal data)
        // Note: DECISION_PHASE is a valid active state (player choosing action), not a reset!
        if (receivedPlayerState.state === 'IDLE_WAITING' &&
          !receivedPlayerState.selectedAction &&
          !receivedPlayerState.rollResult &&
          !receivedPlayerState.traitTransaction &&
          !receivedPlayerState.consequenceTransaction) {
          logger.debug(`  Received state appears to be reset (IDLE_WAITING) - dispatching resetPlayerState`);
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/resetPlayerState',
            payload: { characterId }
          });
          continue; // Skip field-by-field updates
        }

        // Dispatch individual property updates
        if (receivedPlayerState.position && receivedPlayerState.position !== currentPlayerState?.position) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setPosition',
            payload: { characterId, position: receivedPlayerState.position }
          });
        }

        if (receivedPlayerState.effect && receivedPlayerState.effect !== currentPlayerState?.effect) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setEffect',
            payload: { characterId, effect: receivedPlayerState.effect }
          });
        }

        // Handle new approach-based action plan (selectedApproach, secondaryApproach, equippedForAction, rollMode)
        if (receivedPlayerState.selectedApproach &&
          (receivedPlayerState.selectedApproach !== currentPlayerState?.selectedApproach ||
            receivedPlayerState.secondaryApproach !== currentPlayerState?.secondaryApproach ||
            JSON.stringify(receivedPlayerState.equippedForAction) !== JSON.stringify(currentPlayerState?.equippedForAction) ||
            receivedPlayerState.rollMode !== currentPlayerState?.rollMode)) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setActionPlan',
            payload: {
              characterId,
              approach: receivedPlayerState.selectedApproach,
              secondaryApproach: receivedPlayerState.secondaryApproach,
              equippedForAction: receivedPlayerState.equippedForAction,
              rollMode: receivedPlayerState.rollMode,
              position: receivedPlayerState.position || 'risky',
              effect: receivedPlayerState.effect || 'standard'
            }
          });
        }

        if (receivedPlayerState.gmApproved !== currentPlayerState?.gmApproved) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setGmApproved',
            payload: { characterId, approved: receivedPlayerState.gmApproved || false }
          });
        }

        // CRITICAL: Handle passive equipment approval (NEW)
        if (receivedPlayerState.approvedPassiveId !== currentPlayerState?.approvedPassiveId) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setApprovedPassive',
            payload: {
              characterId,
              equipmentId: receivedPlayerState.approvedPassiveId || null
            }
          });
        }

        // CRITICAL: Handle trait transactions (the missing piece!)
        if (JSON.stringify(receivedPlayerState.traitTransaction) !== JSON.stringify(currentPlayerState?.traitTransaction)) {
          if (receivedPlayerState.traitTransaction) {
            game.fitgd!.store.dispatch({
              type: 'playerRoundState/setTraitTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.traitTransaction
              }
            });
          } else {
            game.fitgd!.store.dispatch({
              type: 'playerRoundState/clearTraitTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle push improvements (pushed + pushType)
        if (receivedPlayerState.pushed !== currentPlayerState?.pushed ||
          receivedPlayerState.pushType !== currentPlayerState?.pushType) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setImprovements',
            payload: {
              characterId,
              pushed: receivedPlayerState.pushed || false,
              pushType: receivedPlayerState.pushType || undefined
            }
          });
        }

        // CRITICAL: Handle state transitions
        if (receivedPlayerState.state && receivedPlayerState.state !== currentPlayerState?.state) {
          logger.debug(`  Dispatching state transition: ${currentPlayerState?.state} → ${receivedPlayerState.state}`);
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/transitionState',
            payload: {
              characterId,
              newState: receivedPlayerState.state
            }
          });
        } else {
          logger.debug(`  State transition skipped - receivedPlayerState.state: ${receivedPlayerState.state}, currentPlayerState.state: ${currentPlayerState?.state}`);
        }

        // CRITICAL: Handle roll results (dicePool, rollResult, outcome)
        if (receivedPlayerState.rollResult || receivedPlayerState.outcome || receivedPlayerState.dicePool !== undefined) {
          if (JSON.stringify(receivedPlayerState.rollResult) !== JSON.stringify(currentPlayerState?.rollResult) ||
            receivedPlayerState.outcome !== currentPlayerState?.outcome ||
            receivedPlayerState.dicePool !== currentPlayerState?.dicePool) {
            game.fitgd!.store.dispatch({
              type: 'playerRoundState/setRollResult',
              payload: {
                characterId,
                dicePool: receivedPlayerState.dicePool || 0,
                rollResult: receivedPlayerState.rollResult || [],
                outcome: receivedPlayerState.outcome
              }
            });
          }
        }

        // CRITICAL: Handle consequence transactions (NEW in Phase 3)
        if (JSON.stringify(receivedPlayerState.consequenceTransaction) !== JSON.stringify(currentPlayerState?.consequenceTransaction)) {
          if (receivedPlayerState.consequenceTransaction) {
            // Set or update consequence transaction
            game.fitgd!.store.dispatch({
              type: 'playerRoundState/setConsequenceTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.consequenceTransaction
              }
            });
          } else if (currentPlayerState?.consequenceTransaction) {
            // Clear consequence transaction
            game.fitgd!.store.dispatch({
              type: 'playerRoundState/clearConsequenceTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle stims usage tracking (NEW in Phase 5)
        if (receivedPlayerState.stimsUsedThisAction !== currentPlayerState?.stimsUsedThisAction) {
          game.fitgd!.store.dispatch({
            type: 'playerRoundState/setStimsUsed',
            payload: {
              characterId,
              used: receivedPlayerState.stimsUsedThisAction || false
            }
          });
        }
      }

      // Update active player if changed
      if (data.playerRoundState.activeCharacterId !== currentState.playerRoundState.activeCharacterId) {
        game.fitgd!.store.dispatch({
          type: 'playerRoundState/setActivePlayer',
          payload: { characterId: data.playerRoundState.activeCharacterId }
        });
      }
    }


    // Widget Lifecycle Sync: Apply activePlayerActions from remote client
    if (data.activePlayerActions && Object.keys(data.activePlayerActions).length > 0) {
      logger.debug('Applying received activePlayerActions:', data.activePlayerActions);

      // Set flag to prevent re-broadcasting received state
      isReceivingFromSocket = true;

      try {
        for (const [crewId, receivedAction] of Object.entries(data.activePlayerActions)) {
          const currentCrew = game.fitgd!.store.getState().crews.byId[crewId];
          if (!currentCrew) continue;

          const currentAction = currentCrew.activePlayerAction;

          // Compare and update if different
          if (JSON.stringify(currentAction) !== JSON.stringify(receivedAction)) {
            if (receivedAction === null) {
              // Action was cleared (aborted or completed)
              logger.debug(`Crew ${crewId}: activePlayerAction cleared`);
              game.fitgd!.store.dispatch({
                type: 'crews/abortPlayerAction',
                payload: { crewId }
              });
            } else if (!currentAction) {
              // New action started
              logger.debug(`Crew ${crewId}: new activePlayerAction started`);
              game.fitgd!.store.dispatch({
                type: 'crews/startPlayerAction',
                payload: {
                  crewId,
                  characterId: receivedAction.characterId,
                  playerId: receivedAction.playerId
                }
              });
              // If already committed, update that too
              if (receivedAction.committedToRoll) {
                game.fitgd!.store.dispatch({
                  type: 'crews/commitToRoll',
                  payload: { crewId }
                });
              }
            } else if (currentAction && receivedAction.committedToRoll && !currentAction.committedToRoll) {
              logger.debug(`Crew ${crewId}: activePlayerAction committed to roll`);
              game.fitgd!.store.dispatch({
                type: 'crews/commitToRoll',
                payload: { crewId }
              });
            }
          }
        }
      } finally {
        // Always clear the flag
        isReceivingFromSocket = false;
      }

      // CRITICAL: Sync the tracking with what we received to prevent ping-pong
      // This ensures our "last broadcast" matches what the remote sent us
      game.fitgd!.syncActivePlayerActionsTracking(data.activePlayerActions);
    }

    if (appliedCount > 0 || data.playerRoundState) {
      // Update broadcast tracking to prevent re-broadcasting received commands
      updateBroadcastTracking();

      // Refresh affected sheets (pass the captured entityIds for deleted clocks)
      refreshAffectedSheets(data.commands, clockEntityIds);

      // CRITICAL: Also refresh widgets for playerRoundState changes
      // This ensures GM sees player's trait transactions and plan updates
      if (changedCharacterIds.length > 0) {
        logger.debug(`Refreshing widgets for ${changedCharacterIds.length} changed characters:`, changedCharacterIds);
        refreshSheetsByReduxId(changedCharacterIds, false);
      }

      logger.debug(`Sync complete - applied ${appliedCount} new commands + playerRoundState`);

      // GM persists changes from players to world settings
      if (game.user!.isGM) {
        try {
          const history = game.fitgd!.foundry.exportHistory();
          await (game.settings as any).set('forged-in-the-grimdark', 'commandHistory', history);
          logger.debug(`GM persisted player changes to world settings`);
        } catch (error) {
          logger.error('GM failed to persist player changes:', error);
        }
      }
    } else {
      logger.debug(`No commands or playerRoundState were applied (all duplicates or empty)`);
    }
  } catch (error) {
    logger.error('Error applying incremental commands:', error);
    logger.warn('Falling back to full state reload...');

    await reloadStateFromSettings();
  }
}


/**
 * Handle takeAction event from socketlib
 * Shows PlayerActionWidget on the owning player's client and GM's client
 *
 * @param data - Event data containing characterId, userId, userName
 */
async function handleTakeAction(data: { characterId: string; userId: string; userName: string }): Promise<void> {
  const { characterId, userId, userName } = data;

  logger.debug(`Received takeAction for character ${characterId} from ${userName} (${userId})`);

  // Get the actor to check ownership
  const actor = game.actors!.get(characterId); // Unified IDs
  if (!actor) {
    logger.warn(`FitGD | Actor not found for characterId ${characterId}`);
    return;
  }

  // Check if this client should show the widget
  const isOwner = actor.isOwner;
  const isGM = game.user!.isGM;

  logger.debug(`Widget visibility check:`, {
    actorName: actor.name,
    currentUser: game.user!.name,
    isOwner,
    isGM,
    permission: actor.permission,
    willShow: isOwner || isGM
  });

  // Only show widget if this user owns the actor or is GM
  if (isOwner || isGM) {
    // Check if widget already exists for this character
    const existingWidget = Object.values(ui.windows).find(
      (app) => app instanceof PlayerActionWidget && (app as any).characterId === characterId
    );

    if (existingWidget) {
      logger.debug(`Bringing existing Player Action Widget to front for character ${characterId}`);
      if ((existingWidget as any).rendered) {
        existingWidget.bringToTop();
      }
      existingWidget.render(true);
    } else {
      logger.debug(`Creating new Player Action Widget for character ${characterId}`);
      const widget = new PlayerActionWidget(characterId);
      widget.render(true);
    }

    // Get character name for notification
    const state = game.fitgd!.store.getState();
    const character = state.characters.byId[characterId];
    const characterName = character?.name || 'Character';

    ui.notifications!.info(`${characterName} is taking action!`);
  } else {
    logger.debug(`Widget NOT shown - user is not owner or GM`);
  }
}

// Export socket handler functions
export { receiveCommandsFromSocket, handleTakeAction };
