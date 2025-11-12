/**
 * System Settings Registration
 *
 * Registers all Foundry game settings for the system
 */

// @ts-expect-error - Gradual migration: .mjs files don't have type declarations yet
import { HistoryManagementConfig } from '../history-management.mjs';

/**
 * Register all system settings
 */
export function registerSystemSettings(): void {
  // History Management Menu
  (game.settings as any).registerMenu('forged-in-the-grimdark', 'historyManagement', {
    name: game.i18n!.localize('FITGD.Settings.HistoryManagement.Name'),
    label: game.i18n!.localize('FITGD.Settings.HistoryManagement.Label'),
    hint: game.i18n!.localize('FITGD.Settings.HistoryManagement.Hint'),
    icon: 'fas fa-database',
    type: HistoryManagementConfig,
    restricted: true // GM only
  });

  // Command history (for event sourcing)
  (game.settings as any).register('forged-in-the-grimdark', 'commandHistory', {
    name: 'Command History',
    hint: 'Event-sourced command history for state reconstruction',
    scope: 'world',
    config: false,
    type: Object,
    default: { characters: [], crews: [], clocks: [] }
  });

  // Game state snapshot (for performance)
  (game.settings as any).register('forged-in-the-grimdark', 'stateSnapshot', {
    name: 'State Snapshot',
    hint: 'Periodic state snapshot for faster loading',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  // Auto-save interval
  (game.settings as any).register('forged-in-the-grimdark', 'autoSaveInterval', {
    name: game.i18n!.localize('FITGD.Settings.AutoSaveInterval.Name'),
    hint: game.i18n!.localize('FITGD.Settings.AutoSaveInterval.Hint'),
    scope: 'world',
    config: true,
    type: Number,
    default: 30,
    range: {
      min: 0,
      max: 300,
      step: 10
    }
  });

  // Auto-prune orphaned history
  (game.settings as any).register('forged-in-the-grimdark', 'autoPruneHistory', {
    name: game.i18n!.localize('FITGD.Settings.AutoPruneHistory.Name'),
    hint: game.i18n!.localize('FITGD.Settings.AutoPruneHistory.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });
}
