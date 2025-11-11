/**
 * Socket Communication Handler
 *
 * Manages socket communication for Redux state synchronization across clients
 *
 * CRITICAL: This module contains INTENTIONAL bare dispatch() calls that must NOT
 * be refactored to use the Bridge API. These dispatches handle incoming state
 * from other clients and must NOT re-broadcast to avoid infinite loops.
 */

// @ts-check

import {
  updateBroadcastTracking,
  applyCommandsIncremental,
  refreshAffectedSheets,
  reloadStateFromSettings
} from '../autosave/autosave-manager.mjs';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

/* -------------------------------------------- */
/*  Socket Communication (socketlib)            */
/* -------------------------------------------- */

/**
 * Receive commands from other clients via socketlib
 * This function is registered with socketlib and called automatically
 * when other clients broadcast commands.
 */
async function receiveCommandsFromSocket(data) {
  console.log(`FitGD | socketlib received data:`, data);

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
  console.log(`FitGD | Received ${data.commandCount || 0} new commands from ${userName}`);

  // Validate commands structure
  if (!data.commands) {
    console.error(`FitGD | No commands in message data`);
    return;
  }

  console.log(`FitGD | Commands to apply:`, data.commands);

  try {
    // BEFORE applying commands, capture entityIds for clocks that will be deleted
    // (so we can refresh sheets even after the clock is gone)
    const state = game.fitgd.store.getState();
    const clockEntityIds = new Map();
    for (const command of data.commands.clocks) {
      if (command.payload?.clockId) {
        const clock = state.clocks.byId[command.payload.clockId];
        if (clock) {
          clockEntityIds.set(command.payload.clockId, clock.entityId);
        }
      }
    }

    // Apply commands incrementally (no store reset!)
    const appliedCount = applyCommandsIncremental(data.commands);

    // Also apply playerRoundState if present (ephemeral UI state)
    const changedCharacterIds = [];
    if (data.playerRoundState) {
      console.log(`FitGD | Applying received playerRoundState:`, data.playerRoundState);

      const currentState = game.fitgd.store.getState();

      // Update each character's playerRoundState by dispatching actions
      for (const [characterId, receivedPlayerState] of Object.entries(data.playerRoundState.byCharacterId)) {
        let currentPlayerState = currentState.playerRoundState.byCharacterId[characterId];

        console.log(`FitGD | Socket handler - character ${characterId.substring(0, 8)}:`);
        console.log(`  Current state: ${currentPlayerState?.state}`);
        console.log(`  Received state: ${receivedPlayerState.state}`);

        // CRITICAL: Initialize player state if it doesn't exist!
        if (!currentPlayerState) {
          console.log(`  No current state - initializing player state first`);
          game.fitgd.store.dispatch({
            type: 'playerRoundState/initializePlayerState',
            payload: { characterId }
          });
          // Re-fetch the newly initialized state for this character
          const updatedState = game.fitgd.store.getState();
          currentPlayerState = updatedState.playerRoundState.byCharacterId[characterId];
          console.log(`  Initialized state: ${currentPlayerState?.state}`);
        }

        // Skip if identical (avoid unnecessary updates)
        if (JSON.stringify(currentPlayerState) === JSON.stringify(receivedPlayerState)) {
          console.log(`  Skipping - states are identical`);
          continue;
        }

        console.log(`  States differ - applying updates`);

        // Track that this character's state changed
        changedCharacterIds.push(characterId);

        // Dispatch individual property updates
        if (receivedPlayerState.position && receivedPlayerState.position !== currentPlayerState?.position) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setPosition',
            payload: { characterId, position: receivedPlayerState.position }
          });
        }

        if (receivedPlayerState.effect && receivedPlayerState.effect !== currentPlayerState?.effect) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setEffect',
            payload: { characterId, effect: receivedPlayerState.effect }
          });
        }

        if (receivedPlayerState.selectedAction && receivedPlayerState.selectedAction !== currentPlayerState?.selectedAction) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setActionPlan',
            payload: {
              characterId,
              action: receivedPlayerState.selectedAction,
              position: receivedPlayerState.position || 'risky',
              effect: receivedPlayerState.effect || 'standard'
            }
          });
        }

        if (receivedPlayerState.gmApproved !== currentPlayerState?.gmApproved) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setGmApproved',
            payload: { characterId, approved: receivedPlayerState.gmApproved || false }
          });
        }

        // CRITICAL: Handle trait transactions (the missing piece!)
        if (JSON.stringify(receivedPlayerState.traitTransaction) !== JSON.stringify(currentPlayerState?.traitTransaction)) {
          if (receivedPlayerState.traitTransaction) {
            game.fitgd.store.dispatch({
              type: 'playerRoundState/setTraitTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.traitTransaction
              }
            });
          } else {
            game.fitgd.store.dispatch({
              type: 'playerRoundState/clearTraitTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle push improvements (pushed + pushType)
        if (receivedPlayerState.pushed !== currentPlayerState?.pushed ||
            receivedPlayerState.pushType !== currentPlayerState?.pushType) {
          game.fitgd.store.dispatch({
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
          console.log(`  Dispatching state transition: ${currentPlayerState?.state} → ${receivedPlayerState.state}`);
          game.fitgd.store.dispatch({
            type: 'playerRoundState/transitionState',
            payload: {
              characterId,
              newState: receivedPlayerState.state
            }
          });
        } else {
          console.log(`  State transition skipped - receivedPlayerState.state: ${receivedPlayerState.state}, currentPlayerState.state: ${currentPlayerState?.state}`);
        }

        // CRITICAL: Handle roll results (dicePool, rollResult, outcome)
        if (receivedPlayerState.rollResult || receivedPlayerState.outcome || receivedPlayerState.dicePool !== undefined) {
          if (JSON.stringify(receivedPlayerState.rollResult) !== JSON.stringify(currentPlayerState?.rollResult) ||
              receivedPlayerState.outcome !== currentPlayerState?.outcome ||
              receivedPlayerState.dicePool !== currentPlayerState?.dicePool) {
            game.fitgd.store.dispatch({
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
            game.fitgd.store.dispatch({
              type: 'playerRoundState/setConsequenceTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.consequenceTransaction
              }
            });
          } else if (currentPlayerState?.consequenceTransaction) {
            // Clear consequence transaction
            game.fitgd.store.dispatch({
              type: 'playerRoundState/clearConsequenceTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle stims usage tracking (NEW in Phase 5)
        if (receivedPlayerState.stimsUsedThisAction !== currentPlayerState?.stimsUsedThisAction) {
          game.fitgd.store.dispatch({
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
        game.fitgd.store.dispatch({
          type: 'playerRoundState/setActivePlayer',
          payload: { characterId: data.playerRoundState.activeCharacterId }
        });
      }
    }

    if (appliedCount > 0 || data.playerRoundState) {
      // Update broadcast tracking to prevent re-broadcasting received commands
      updateBroadcastTracking();

      // Refresh affected sheets (pass the captured entityIds for deleted clocks)
      refreshAffectedSheets(data.commands, clockEntityIds);

      // CRITICAL: Also refresh widgets for playerRoundState changes
      // This ensures GM sees player's trait transactions and plan updates
      if (changedCharacterIds.length > 0) {
        console.log(`FitGD | Refreshing widgets for ${changedCharacterIds.length} changed characters:`, changedCharacterIds);
        refreshSheetsByReduxId(changedCharacterIds, false);
      }

      console.log(`FitGD | Sync complete - applied ${appliedCount} new commands + playerRoundState`);

      // GM persists changes from players to world settings
      if (game.user.isGM) {
        try {
          await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
          console.log(`FitGD | GM persisted player changes to world settings`);
        } catch (error) {
          console.error('FitGD | GM failed to persist player changes:', error);
        }
      }
    } else {
      console.log(`FitGD | No commands or playerRoundState were applied (all duplicates or empty)`);
    }
  } catch (error) {
    console.error('FitGD | Error applying incremental commands:', error);
    console.warn('FitGD | Falling back to full state reload...');

    await reloadStateFromSettings();
  }
}


// Export socket handler function
export { receiveCommandsFromSocket };
