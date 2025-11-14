/**
 * Combat Hooks
 *
 * Handles combat tracker events for player round state management
 */

import { PlayerActionWidget } from "../widgets/player-action-widget";

/**
 * Register all combat-related hooks
 */
export function registerCombatHooks(): void {
/* -------------------------------------------- */
/*  Combat Tracker Hooks                        */
/* -------------------------------------------- */

/**
 * When combat starts, reset Momentum to 5 (per spec)
 */
Hooks.on('combatStart', async function(combat: Combat, _updateData: object) {
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
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
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
      affectedReduxIds: characterIds,
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
Hooks.on('updateCombat', async function(combat: Combat, updateData: any, _options: object, _userId: string) {
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

  // Update Redux state to mark this player as active
  // Use Bridge API to ensure state propagates to all clients
  await game.fitgd!.bridge.execute(
    {
      type: 'playerRoundState/setActivePlayer',
      payload: { characterId },
    },
    { affectedReduxIds: [characterId], silent: true } // Silent: we'll show widget manually below
  );

  // Show the Player Action Widget for this character
  // Only show for the owning player or GM
  const actor = activeCombatant.actor;
  const isOwner = actor.isOwner;
  const isGM = game.user!.isGM;

  console.log(`FitGD | Widget visibility check:`, {
    actorName: actor.name,
    currentUser: game.user!.name,
    isOwner,
    isGM,
    permission: actor.permission,
    willShow: isOwner || isGM
  });

  if (isOwner || isGM) {
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
  } else {
    console.log(`FitGD | Widget NOT shown - user is not owner or GM`);
  }
});

/**
 * When combat ends, clear all player states
 */
Hooks.on('combatEnd' as any, async function(_combat: Combat) {
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
