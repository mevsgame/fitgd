/**
 * Combat Hooks
 *
 * Handles combat tracker events for player round state management
 */

import { PlayerActionWidget } from "../widgets/player-action-widget";
import { createReduxId } from '@/types/foundry';

export function registerCombatHooks(): void {
  /* -------------------------------------------- */
  /*  Combat Tracker Hooks                        */
  /* -------------------------------------------- */

  /**
   * When combat starts, reset Momentum to 5 (per spec)
   */
  Hooks.on('combatStart', async function (combat: Combat, _updateData: object) {
    console.log('FitGD | Combat started, resetting Momentum to 5');

    // Find crew for this combat
    const state = game.fitgd!.store.getState();
    const crews = Object.values(state.crews.byId);

    if (crews.length > 0) {
      const crew = crews[0]; // Assuming single crew for now
      // Use setMomentum with object parameter (API uses object params)
      game.fitgd!.api.crew.setMomentum({ crewId: crew.id, amount: 5 });
      ui.notifications!.info('Momentum reset to 5 - Combat Start!');
    }

    // Initialize player states for all combatants
    const characterIds: string[] = [];
    for (const combatant of (combat.combatants as unknown as any[])) {
      const actor = (combatant as any).actor;
      if (!actor) continue;

      const characterId = actor.id; // Unified IDs
      if (characterId) {
        characterIds.push(characterId);
      }
    }

    // Use Bridge API to batch all initializations and broadcast once
    if (characterIds.length > 0) {
      const actions = characterIds.map(characterId => ({
        type: 'playerRoundState/initializePlayerState',
        payload: { characterId },
      }));

      await game.fitgd!.bridge.executeBatch(actions, {
        affectedReduxIds: characterIds.map(createReduxId),
        silent: true // Silent: no sheets to refresh for player round state
      });
    }
  });

  /**
   * When a turn starts, show the Player Action Widget for the active combatant
   *
   * NOTE: Using 'updateCombat' instead of 'combatTurn' because 'combatTurn' only
   * fires on the client that initiated the turn change (usually the GM), not on
   * all connected clients. 'updateCombat' fires on ALL clients when combat data changes.
   */
  Hooks.on('updateCombat', async function (combat: Combat, updateData: any, _options: object, _userId: string) {
    // Only trigger when the turn actually changes (not for other combat updates)
    if (!updateData.turn && updateData.turn !== 0) {
      return; // Not a turn change, ignore
    }

    console.log(`FitGD | updateCombat (turn change) hook fired for user: ${game.user!.name} (${game.user!.id}), isGM: ${game.user!.isGM}`);

    const activeCombatant = combat.combatant;
    if (!activeCombatant || !activeCombatant.actor) {
      console.log('FitGD | No active combatant or actor');
      return;
    }

    console.log(`FitGD | Active combatant: ${activeCombatant.actor.name}`);

    // UNIFIED IDs: Redux ID IS the Foundry Actor ID (no flag lookup needed)
    const characterId = activeCombatant.actor.id;
    if (!characterId) {
      console.log('FitGD | Active combatant has no actor ID');
      return;
    }

    console.log(`FitGD | Setting active player: ${characterId}`);

    // CRITICAL: Only GM dispatches turn change commands
    // Players receive these commands via socket broadcast
    // This prevents race condition where both clients dispatch and commands conflict
    if (game.user!.isGM) {
      // CLEANUP and START: Batch all turn change commands together
      // This ensures subscribers see one atomic update (old action → new action)
      // instead of intermediate states (old action → null → new action)
      const state = game.fitgd!.store.getState();
      const crews = Object.values(state.crews.byId);
      const crewId = crews.find(crew => crew.characters.includes(characterId))?.id;

      const actions: any[] = [];
      const affectedIds: string[] = [characterId];

      // Check for stale action to abort
      for (const crew of crews) {
        const existingAction = crew.activePlayerAction;
        if (existingAction && existingAction.characterId !== characterId) {
          console.log(`FitGD | Aborting stale action for ${existingAction.characterId} before starting ${characterId}'s turn`);

          // Abort the previous player's action
          actions.push({
            type: 'crews/abortPlayerAction',
            payload: { crewId: crew.id },
          });

          // Reset the previous player's playerRoundState
          actions.push({
            type: 'playerRoundState/resetPlayerState',
            payload: { characterId: existingAction.characterId },
          });

          affectedIds.push(crew.id, existingAction.characterId);
        }
      }

      // Set active player in playerRoundState
      actions.push({
        type: 'playerRoundState/setActivePlayer',
        payload: { characterId },
      });

      // Start new player action on crew (if crew found)
      if (crewId) {
        actions.push({
          type: 'crews/startPlayerAction',
          payload: {
            crewId,
            characterId,
            playerId: game.user?.id || 'system',
          },
        });
        affectedIds.push(crewId);
      }

      // Execute all turn change commands as single atomic batch
      await game.fitgd!.bridge.executeBatch(
        actions,
        { affectedReduxIds: affectedIds.map(createReduxId), silent: true }
      );
    } else {
      console.log(`FitGD | Player skipping command dispatch (GM will broadcast)`);
    }

    // Show the Player Action Widget for this character
    // CRITICAL: Only GM opens widget immediately (they have the commands locally)
    // Players will have widget opened when startPlayerAction arrives via socket
    // This prevents empty widget due to timing (widget opens before commands arrive)
    if (!game.user!.isGM) {
      console.log(`FitGD | Player waiting for commands via socket before opening widget`);
      return;
    }

    const actor = activeCombatant.actor;
    const isOwner = actor.isOwner;

    console.log(`FitGD | Widget visibility check:`, {
      actorName: actor.name,
      currentUser: game.user!.name,
      isOwner,
      isGM: true,
      permission: actor.permission,
      willShow: true
    });

    // Check if widget already exists for this character
    const existingWidget = Object.values(ui.windows).find(
      app => app instanceof PlayerActionWidget && (app as any).characterId === characterId
    );

    if (existingWidget) {
      console.log(`FitGD | Refreshing existing Player Action Widget for character ${characterId}`);
      existingWidget.render(true); // Just refresh existing widget
    } else {
      console.log(`FitGD | Creating new Player Action Widget for character ${characterId}`);
      const widget = new PlayerActionWidget(characterId);
      widget.render(true);
    }
  });

  /**
   * When combat ends, clear all player states
   */
  Hooks.on('combatEnd' as any, async function (_combat: Combat) {
    console.log('FitGD | Combat ended, clearing player states');

    // Clear all player round states using Bridge API
    await game.fitgd!.bridge.execute(
      {
        type: 'playerRoundState/clearAllStates',
      },
      { silent: true } // Silent: no sheets to refresh, just clear state
    );

    // Close any open Player Action Widgets
    for (const app of Object.values(ui.windows)) {
      if (app instanceof PlayerActionWidget) {
        app.close();
      }
    }
  });
}
