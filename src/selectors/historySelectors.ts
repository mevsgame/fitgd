import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';

/**
 * History Statistics Interface
 */
export interface HistoryStats {
  characterCommands: number;
  crewCommands: number;
  clockCommands: number;
  totalCommands: number;
  estimatedSizeKB: number;
  oldestCommandTimestamp: number | null;
  newestCommandTimestamp: number | null;
  timeSpanHours: number | null;
}

/**
 * Select character command history
 */
export const selectCharacterHistory = (state: RootState) => state.characters.history;

/**
 * Select crew command history
 */
export const selectCrewHistory = (state: RootState) => state.crews.history;

/**
 * Select clock command history
 */
export const selectClockHistory = (state: RootState) => state.clocks.history;

/**
 * Calculate estimated size of command history in KB
 *
 * Uses rough approximation: ~150 bytes per command on average
 * (includes command type, payload, timestamp, version, commandId)
 */
function estimateHistorySizeKB(commandCount: number): number {
  const AVG_COMMAND_SIZE_BYTES = 150;
  return Math.round((commandCount * AVG_COMMAND_SIZE_BYTES) / 1024);
}

/**
 * Select comprehensive history statistics
 *
 * Memoized selector that calculates:
 * - Command counts per slice
 * - Total command count
 * - Estimated storage size
 * - Time span of history
 */
export const selectHistoryStats = createSelector(
  [selectCharacterHistory, selectCrewHistory, selectClockHistory],
  (characterHistory, crewHistory, clockHistory): HistoryStats => {
    const characterCommands = characterHistory.length;
    const crewCommands = crewHistory.length;
    const clockCommands = clockHistory.length;
    const totalCommands = characterCommands + crewCommands + clockCommands;

    // Find oldest and newest timestamps
    const allCommands = [...characterHistory, ...crewHistory, ...clockHistory];
    const timestamps = allCommands.map((cmd) => cmd.timestamp);

    const oldestCommandTimestamp =
      timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestCommandTimestamp =
      timestamps.length > 0 ? Math.max(...timestamps) : null;

    // Calculate time span in hours
    let timeSpanHours: number | null = null;
    if (oldestCommandTimestamp !== null && newestCommandTimestamp !== null) {
      const spanMs = newestCommandTimestamp - oldestCommandTimestamp;
      timeSpanHours = Math.round((spanMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal
    }

    return {
      characterCommands,
      crewCommands,
      clockCommands,
      totalCommands,
      estimatedSizeKB: estimateHistorySizeKB(totalCommands),
      oldestCommandTimestamp,
      newestCommandTimestamp,
      timeSpanHours,
    };
  }
);

/**
 * Select total command count
 */
export const selectTotalCommandCount = createSelector(
  [selectHistoryStats],
  (stats) => stats.totalCommands
);

/**
 * Select estimated history size in KB
 */
export const selectHistorySizeKB = createSelector(
  [selectHistoryStats],
  (stats) => stats.estimatedSizeKB
);

/**
 * Check if history is empty
 */
export const selectIsHistoryEmpty = createSelector(
  [selectHistoryStats],
  (stats) => stats.totalCommands === 0
);
