/**
 * Sheet Helper Functions
 *
 * Utilities for managing Foundry sheet lifecycle and rendering
 */

// @ts-check

/**
 * Refresh sheets for the given Redux entity IDs
 *
 * This properly handles the fact that characterId/crewId are Redux IDs,
 * not Foundry Actor IDs. We need to find sheets by matching the Redux ID
 * stored in the actor's flags.
 *
 * @param {string[]} reduxIds - Array of Redux entity IDs to refresh
 * @param {boolean} force - Whether to force re-render (default: true)
 */
export function refreshSheetsByReduxId(reduxIds, force = true) {
  const affectedReduxIds = new Set(reduxIds.filter(id => id)); // Remove nulls/undefined
  if (affectedReduxIds.size === 0) return;

  console.log(`FitGD | Refreshing sheets for Redux IDs:`, Array.from(affectedReduxIds));

  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) continue;

    if (app.constructor.name === 'FitGDCharacterSheet' || app.constructor.name === 'FitGDCrewSheet') {
      try {
        const reduxId = app.actor?.getFlag('forged-in-the-grimdark', 'reduxId');
        if (reduxId && affectedReduxIds.has(reduxId)) {
          console.log(`FitGD | Re-rendering ${app.constructor.name} for Redux ID ${reduxId}`);
          app.render(force);
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`FitGD | Could not refresh sheet:`, error);
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheet(s)`);
}
