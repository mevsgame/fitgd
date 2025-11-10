/**
 * History Management Configuration UI
 *
 * Allows GMs to view command history statistics and prune history to reduce storage.
 */

// @ts-check

/**
 * @typedef {import('../dist/types').Command} Command
 * @typedef {import('../dist/store').RootState} RootState
 */

export class HistoryManagementConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('FITGD.Settings.HistoryManagement.Title'),
      id: 'fitgd-history-management',
      template: 'systems/forged-in-the-grimdark/templates/history-management.html',
      width: 600,
      height: 'auto',
      closeOnSubmit: false,
      submitOnChange: false,
    });
  }

  getData() {
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
    let oldestDate = null;
    let newestDate = null;

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

  activateListeners(html) {
    super.activateListeners(html);

    // Handle prune button click
    html.find('button[name="prune"]').click(async (event) => {
      event.preventDefault();

      // Confirm with user
      const confirmed = await Dialog.confirm({
        title: game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Title'),
        content: `
          <p><strong>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Warning')}</strong></p>
          <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Description')}</p>
          <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.WillLose')}</p>
          <ul>
            <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseUndo')}</li>
            <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseHistory')}</li>
            <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseReplay')}</li>
          </ul>
          <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Confirm')}</p>
        `,
        defaultYes: false
      });

      if (confirmed) {
        try {
          const adapter = game.fitgd.foundry;

          // Prune all command history
          adapter.pruneAllHistory();

          // Export current state snapshot and save
          const state = adapter.exportState();
          await game.settings.set('forged-in-the-grimdark', 'stateSnapshot', state);

          // Save empty command history
          await game.settings.set('forged-in-the-grimdark', 'commandHistory', {
            characters: [],
            crews: [],
            clocks: []
          });

          ui.notifications.info(game.i18n.localize('FITGD.Settings.HistoryManagement.PruneSuccess'));

          // Re-render the form to show updated stats
          this.render();
        } catch (error) {
          console.error('FitGD | Error pruning history:', error);
          ui.notifications.error(`${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneError')}: ${error.message}`);
        }
      }
    });

    // Handle refresh stats button
    html.find('button[name="refresh"]').click((event) => {
      event.preventDefault();
      this.render();
    });
  }

  async _updateObject(event, formData) {
    // No form submission handling needed - all actions are button-based
  }
}
