/**
 * System Settings Registration
 *
 * Registers all Foundry game settings for the system
 */

import { HistoryManagementConfig } from '../history-management';

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

  // Primary Crew ID (world-level, GM sets which crew shows in HUD)
  (game.settings as any).register('forged-in-the-grimdark', 'primaryCrewId', {
    name: 'Primary Crew',
    hint: 'The crew shown in the HUD panel',
    scope: 'world',
    config: false,
    type: String,
    default: ''
  });

  // HUD visible state (per-client, persists across sessions)
  (game.settings as any).register('forged-in-the-grimdark', 'hudVisible', {
    name: 'HUD Visible',
    hint: 'Whether the Crew HUD panel is shown',
    scope: 'client',
    config: false,
    type: Boolean,
    default: false
  });

  // HUD position (per-client, for drag-to-reposition)
  (game.settings as any).register('forged-in-the-grimdark', 'hudPosition', {
    name: 'HUD Position',
    hint: 'Saved position of the HUD panel',
    scope: 'client',
    config: false,
    type: String,
    default: ''
  });
}
