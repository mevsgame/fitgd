/**
 * Sheet Helper Functions
 *
 * Utilities for managing Foundry sheet lifecycle and rendering
 */

import type { ReduxId } from '@/types/foundry';

/**
 * Refresh sheets for the given entity IDs
 *
 * With unified IDs, Redux ID === Foundry Actor ID, so we just match by actor.id
 *
 * @param reduxIds - Array of entity IDs to refresh (unified IDs)
 * @param force - Whether to force re-render (default: true)
 */
export function refreshSheetsByReduxId(reduxIds: string[], force = true): void {
  const affectedIds = new Set(reduxIds.filter(id => id)); // Remove nulls/undefined
  if (affectedIds.size === 0) return;

  console.log(`FitGD | Refreshing sheets for IDs:`, Array.from(affectedIds));

  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) continue;

    if (app.constructor.name === 'FitGDCharacterSheet' || app.constructor.name === 'FitGDCrewSheet') {
      try {
        const actorId = (app as any).actor?.id; // Unified IDs: actor.id === Redux ID
        if (actorId && affectedIds.has(actorId)) {
          console.log(`FitGD | Re-rendering ${app.constructor.name} for ID ${actorId}`);
          app.render(force);
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`FitGD | Could not refresh sheet:`, error);
      }
    } else if (app.constructor.name === 'PlayerActionWidget') {
      try {
        const widgetCharId = (app as any).characterId;
        if (widgetCharId && affectedIds.has(widgetCharId)) {
          console.log(`FitGD | Re-rendering PlayerActionWidget for ID ${widgetCharId}`);
          app.render(force);
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`FitGD | Could not refresh PlayerActionWidget:`, error);
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheet(s)`);
}

/**
 * Open Player Action Widget for a character
 * This replicates the experience of entering a turn in combat
 *
 * Broadcasts the action via socketlib so all clients (GM + owning player) can show the widget
 *
 * @param characterId - Character Redux ID (unified with Foundry Actor ID)
 * @returns Promise that resolves when action is initiated
 */
export async function takeAction(characterId: string): Promise<void> {
  if (!characterId) {
    ui.notifications!.error('Invalid character ID');
    return;
  }

  // Verify character exists in Redux
  const state = game.fitgd!.store.getState();
  const character = state.characters.byId[characterId];
  if (!character) {
    ui.notifications!.error('Character not found');
    return;
  }

  console.log(`FitGD | Taking action for character: ${character.name} (${characterId})`);

  // Reset player state to ensure fresh start
  // resetPlayerState bypasses state machine validation and sets to IDLE_WAITING
  const currentState = state.playerRoundState.byCharacterId[characterId];
  if (currentState && currentState.state !== 'IDLE_WAITING') {
    console.log(`FitGD | Resetting player state from ${currentState.state} to IDLE_WAITING`);
    await game.fitgd!.bridge.execute(
      {
        type: 'playerRoundState/resetPlayerState',
        payload: { characterId },
      },
      { affectedReduxIds: [characterId as ReduxId], silent: true }
    );
  }

  // Set as active player (this transitions IDLE_WAITING -> DECISION_PHASE)
  await game.fitgd!.bridge.execute(
    {
      type: 'playerRoundState/setActivePlayer',
      payload: { characterId },
    },
    { affectedReduxIds: [characterId as ReduxId], silent: true }
  );

  // Broadcast "takeAction" event to ALL clients via socketlib
  // Each client will decide whether to show the widget based on ownership
  try {
    await game.fitgd!.socket.executeForEveryone('takeAction', {
      characterId,
      userId: game.user!.id,
      userName: game.user!.name
    });
    console.log(`FitGD | Broadcast takeAction for character ${characterId} to all clients`);
  } catch (error) {
    console.error('FitGD | Failed to broadcast takeAction:', error);
    ui.notifications!.error('Failed to open action widget - check console for details');
  }
}
