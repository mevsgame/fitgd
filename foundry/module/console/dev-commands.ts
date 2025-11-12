/**
 * Developer Console Commands
 *
 * Provides console commands for testing and debugging
 */

/**
 * Register developer console commands
 * Exposes game.fitgd API to window.fitgd for easy console access
 */
export function registerDevCommands(): void {
  /* -------------------------------------------- */
  /*  Console Commands (for testing)              */
  /* -------------------------------------------- */

  // Expose API to console for debugging
  (window as any).fitgd = {
    store: () => game.fitgd!.store,
    api: () => game.fitgd!.api,
    adapter: () => game.fitgd!.foundry,
    getState: () => game.fitgd!.store.getState(),
    exportHistory: () => game.fitgd!.foundry.exportHistory(),
  };
}
