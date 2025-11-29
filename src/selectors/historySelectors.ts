import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { isOrphanedCommand } from '../utils/commandUtils';

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

/**
 * Orphaned Commands Interface
 */
export interface OrphanedCommands {
  characters: any[];
  crews: any[];
  clocks: any[];
  total: number;
}

/**
 * Select orphaned commands (commands referencing deleted entities)
 *
 * Orphaned commands are commands that reference entities (characters, crews, clocks)
 * that no longer exist in the current state. These can be safely pruned without
 * losing current state integrity.
 *
 * **IMPORTANT:** Deletion commands themselves are NEVER considered orphaned,
 * even if the entity doesn't exist. This preserves audit trail: "who deleted what when".
 *
 * Useful for:
 * - Debugging auto-prune feature
 * - Showing "what would be pruned" in UI
 * - Monitoring orphaned command growth
 *
 * @example
 * ```typescript
 * const orphaned = selectOrphanedCommands(state);
 * console.log(`${orphaned.total} orphaned commands found`);
 * console.log(`Characters: ${orphaned.characters.length}`);
 * console.log(`Crews: ${orphaned.crews.length}`);
 * console.log(`Clocks: ${orphaned.clocks.length}`);
 * ```
 */
export const selectOrphanedCommands = createSelector(
  [
    (state: RootState) => state.characters,
    (state: RootState) => state.crews,
    (state: RootState) => state.clocks,
  ],
  (characters, crews, clocks): OrphanedCommands => {
    const characterIds = new Set<string>(characters.allIds);
    const crewIds = new Set<string>(crews.allIds);
    const clockIds = new Set<string>(clocks.allIds);

    const orphanedCharacterCommands = characters.history.filter((cmd: any) =>
      isOrphanedCommand(cmd, characterIds)
    );

    const orphanedCrewCommands = crews.history.filter((cmd: any) =>
      isOrphanedCommand(cmd, crewIds)
    );

    const orphanedClockCommands = clocks.history.filter((cmd: any) =>
      isOrphanedCommand(cmd, clockIds)
    );

    return {
      characters: orphanedCharacterCommands,
      crews: orphanedCrewCommands,
      clocks: orphanedClockCommands,
      total:
        orphanedCharacterCommands.length +
        orphanedCrewCommands.length +
        orphanedClockCommands.length,
    };
  }
);

/**
 * Select count of orphaned commands
 *
 * Quick accessor for total orphaned command count without full details.
 */
export const selectOrphanedCommandCount = createSelector(
  [selectOrphanedCommands],
  (orphaned) => orphaned.total
);
