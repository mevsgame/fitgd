/**
 * Add Clock Dialog
 *
 * Dialog for adding progress clocks
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class AddClockDialog {
  /**
   * Create a new Add Clock Dialog
   *
   * This is now a wrapper around ClockCreationDialog for backwards compatibility.
   * Consolidates duplicate clock creation logic.
   *
   * @param {string} crewId - Redux ID of the crew
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(crewId, options = {}) {
    this.crewId = crewId;
    this.options = options;
    this._dialogPromise = null;
  }

  /**
   * Render the underlying clock creation dialog
   *
   * @param {boolean} force - Force render
   * @returns {Promise<Application>}
   */
  async render(force) {
    // Dynamically import to avoid circular dependency
    const { ClockCreationDialog } = await import('./dialogs/ClockCreationDialog.mjs');

    const dialog = new ClockCreationDialog(
      this.crewId,
      'progress',
      async (clockData) => {
        try {
          const clockId = game.fitgd.api.clock.createProgress({
            entityId: this.crewId,
            name: clockData.name,
            segments: clockData.segments,
            category: clockData.category,
            isCountdown: clockData.isCountdown,
            description: clockData.description
          });

          // Save immediately (critical state change)
          await game.fitgd.saveImmediate();

          // Re-render sheet (force = true to ensure new clock appears)
          refreshSheetsByReduxId([this.crewId], true);
        } catch (error) {
          ui.notifications.error(`Error: ${error.message}`);
          console.error('FitGD | Add Clock error:', error);
          throw error; // Re-throw so dialog can handle it
        }
      },
      this.options
    );

    return dialog.render(force);
  }
}
