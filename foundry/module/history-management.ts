/**
 * History Management Configuration UI
 *
 * Allows GMs to view command history statistics and prune history to reduce storage.
 */

/**
 * History statistics for display
 */
interface HistoryStats {
  totalCommands: number;
  characterCommands: number;
  crewCommands: number;
  clockCommands: number;
  estimatedSizeKB: number;
  timeSpanHours: number;
  isEmpty: boolean;
  oldestDate: string | null;
  newestDate: string | null;
}

/**
 * Template data for history management dialog
 */
interface HistoryManagementData {
  stats: HistoryStats | null;
  error: string | null;
}

/**
 * History Management Configuration Dialog
 *
 * Provides UI for viewing command history statistics and pruning old history
 * to reduce storage requirements. Only accessible to GMs.
 */
export class HistoryManagementConfig extends FormApplication {
  /**
   * Default options for the history management dialog
   */
  static get defaultOptions(): any {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n!.localize('FITGD.Settings.HistoryManagement.Title'),
      id: 'fitgd-history-management',
      template: 'systems/forged-in-the-grimdark/templates/history-management.html',
      width: 600,
      height: 'auto',
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  /**
   * Get template data for rendering the history management dialog
   *
   * Fetches current history statistics from the Foundry adapter and formats
   * them for display, including formatted timestamps and size estimates.
   */
  getData(): HistoryManagementData {
    // Get history stats from the Foundry adapter
    const adapter = game.fitgd?.foundry;

    if (!adapter) {
      return {
        stats: null,
        error: 'Game API not initialized'
      };
    }

    const stats = adapter.getHistoryStats();

    // Format timestamp for display
    let oldestDate: string | null = null;
    let newestDate: string | null = null;

    if (stats.oldestCommandTimestamp) {
      oldestDate = new Date(stats.oldestCommandTimestamp).toLocaleString();
    }

    if (stats.newestCommandTimestamp) {
      newestDate = new Date(stats.newestCommandTimestamp).toLocaleString();
    }

    return {
      stats: {
        totalCommands: stats.totalCommands,
        characterCommands: stats.characterCommands,
        crewCommands: stats.crewCommands,
        clockCommands: stats.clockCommands,
        estimatedSizeKB: stats.estimatedSizeKB,
        timeSpanHours: stats.timeSpanHours,
        isEmpty: stats.totalCommands === 0,
        oldestDate,
        newestDate
      },
      error: null
    };
  }

  /**
   * Activate event listeners for the history management dialog
   *
   * Sets up handlers for:
   * - Prune button: Removes all command history after confirmation
   * - Refresh button: Re-renders the dialog with updated stats
   */
  activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Handle prune button click
    html.find('button[name="prune"]').click(async (event) => {
      event.preventDefault();

      // Confirm with user
      const confirmed = await Dialog.confirm({
        title: game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.Title'),
        content: `
          <p><strong>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.Warning')}</strong></p>
          <p>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.Description')}</p>
          <p>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.WillLose')}</p>
          <ul>
            <li>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseUndo')}</li>
            <li>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseHistory')}</li>
            <li>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseReplay')}</li>
          </ul>
          <p>${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneDialog.Confirm')}</p>
        `,
        defaultYes: false
      });

      if (confirmed) {
        try {
          const adapter = game.fitgd!.foundry;

          // Prune all command history
          adapter.pruneAllHistory();

          // Export current state snapshot and save
          const state = adapter.exportState();
          await (game.settings as any).set('forged-in-the-grimdark', 'stateSnapshot', state);

          // Save empty command history
          await (game.settings as any).set('forged-in-the-grimdark', 'commandHistory', {
            characters: [],
            crews: [],
            clocks: []
          });

          ui.notifications!.info(game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneSuccess'));

          // Re-render the form to show updated stats
          this.render();
        } catch (error) {
          console.error('FitGD | Error pruning history:', error);
          ui.notifications!.error(`${game.i18n!.localize('FITGD.Settings.HistoryManagement.PruneError')}: ${(error as Error).message}`);
        }
      }
    });

    // Handle refresh stats button
    html.find('button[name="refresh"]').click((event) => {
      event.preventDefault();
      this.render();
    });
  }

  /**
   * Form submission handler (not used for this dialog)
   *
   * All actions in this dialog are button-based (prune/refresh), so this method
   * is intentionally empty. Required by FormApplication but not needed for our use case.
   */
  async _updateObject(_event: Event, _formData: object): Promise<void> {
    // No form submission handling needed - all actions are button-based
  }
}
