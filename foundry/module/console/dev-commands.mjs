/**
 * Developer Console Commands
 *
 * Provides console commands for testing and debugging
 */

// @ts-check

/**
 * Register developer console commands
 */
export function registerDevCommands() {
/* -------------------------------------------- */
/*  Console Commands (for testing)              */
/* -------------------------------------------- */

// Expose API to console for debugging
window.fitgd = {
  store: () => game.fitgd.store,
  api: () => game.fitgd.api,
  adapter: () => game.fitgd.foundry,
  getState: () => game.fitgd.store.getState(),
  exportHistory: () => game.fitgd.foundry.exportHistory(),
};
}
