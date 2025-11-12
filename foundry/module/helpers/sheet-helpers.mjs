/**
 * Sheet Helper Functions
 *
 * Utilities for managing Foundry sheet lifecycle and rendering
 */

// @ts-check

/**
 * Refresh sheets for the given entity IDs
 *
 * With unified IDs, Redux ID === Foundry Actor ID, so we just match by actor.id
 *
 * @param {string[]} reduxIds - Array of entity IDs to refresh (unified IDs)
 * @param {boolean} force - Whether to force re-render (default: true)
 */
export function refreshSheetsByReduxId(reduxIds, force = true) {
  const affectedIds = new Set(reduxIds.filter(id => id)); // Remove nulls/undefined
  if (affectedIds.size === 0) return;

  console.log(`FitGD | Refreshing sheets for IDs:`, Array.from(affectedIds));

  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) continue;

    if (app.constructor.name === 'FitGDCharacterSheet' || app.constructor.name === 'FitGDCrewSheet') {
      try {
        const actorId = app.actor?.id; // Unified IDs: actor.id === Redux ID
        if (actorId && affectedIds.has(actorId)) {
          console.log(`FitGD | Re-rendering ${app.constructor.name} for ID ${actorId}`);
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
