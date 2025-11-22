import { createSelector } from '@reduxjs/toolkit';
import type { ClockState } from '../slices/clockSlice';
import type { Clock, ClockType } from '../types';
import { isClockFilled } from '../validators/clockValidator';

/**
 * Clock Selectors
 *
 * Memoized selectors for efficiently querying clock state using indexes.
 */

// Root selector type (will be expanded when we have RootState)
interface RootState {
  clocks: ClockState;
}

/**
 * Base selectors
 */
export const selectClocksState = (state: RootState) => state.clocks;

export const selectAllClockIds = (state: RootState) => state.clocks.allIds;

export const selectClockById = (state: RootState, clockId: string) =>
  state.clocks.byId[clockId];

/**
 * Get all clocks as an array
 */
export const selectAllClocks = createSelector(
  [selectClocksState],
  (clocksState): Clock[] =>
    clocksState.allIds.map((id) => clocksState.byId[id])
);

/**
 * Get clocks by entity ID (using index)
 */
export const selectClocksByEntityId = createSelector(
  [
    selectClocksState,
    (_state: RootState, entityId: string) => entityId,
  ],
  (clocksState, entityId): Clock[] => {
    const clockIds = clocksState.byEntityId[entityId] || [];
    return clockIds.map((id) => clocksState.byId[id]);
  }
);

/**
 * Get clocks by type (using index)
 */
export const selectClocksByType = createSelector(
  [
    selectClocksState,
    (_state: RootState, clockType: ClockType) => clockType,
  ],
  (clocksState, clockType): Clock[] => {
    const clockIds = clocksState.byType[clockType] || [];
    return clockIds.map((id) => clocksState.byId[id]);
  }
);

/**
 * Get clocks by type and entity (using index)
 */
export const selectClocksByTypeAndEntity = createSelector(
  [
    selectClocksState,
    (_state: RootState, clockType: ClockType, _entityId: string) => clockType,
    (_state: RootState, _clockType: ClockType, entityId: string) => entityId,
  ],
  (clocksState, clockType, entityId): Clock[] => {
    const key = `${clockType}:${entityId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    return clockIds.map((id) => clocksState.byId[id]);
  }
);

/**
 * Get harm clocks for a character
 */
export const selectHarmClocksByCharacter = createSelector(
  [
    selectClocksState,
    (_state: RootState, characterId: string) => characterId,
  ],
  (clocksState, characterId): Clock[] => {
    const key = `harm:${characterId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    return clockIds.map((id) => clocksState.byId[id]);
  }
);



/**
 * Get addiction clock for a character
 */
export const selectAddictionClockByCharacter = createSelector(
  [
    selectClocksState,
    (_state: RootState, characterId: string) => characterId,
  ],
  (clocksState, characterId): Clock | null => {
    const key = `addiction:${characterId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    return clockIds.length > 0 ? clocksState.byId[clockIds[0]] : null;
  }
);

/**
 * Get addiction clock for a crew
 * @deprecated Use selectAddictionClockByCharacter for per-character addiction clocks
 */
export const selectAddictionClockByCrew = createSelector(
  [
    selectClocksState,
    (_state: RootState, crewId: string) => crewId,
  ],
  (clocksState, crewId): Clock | null => {
    const key = `addiction:${crewId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    return clockIds.length > 0 ? clocksState.byId[clockIds[0]] : null;
  }
);



/**
 * Check if character is dying (has 6/6 harm clock)
 */
export const selectIsCharacterDying = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): boolean => {
    return harmClocks.some((clock) => isClockFilled(clock));
  }
);

/**
 * Check if character has dying clock (5/6 or 6/6)
 */
export const selectHasDyingClock = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): boolean => {
    return harmClocks.some((clock) => clock.segments >= 5);
  }
);

/**
 * Check if stims are available (crew-wide lock)
 *
 * Addiction clocks are character-level. Stims are locked crew-wide if ANY character's
 * addiction clock is filled or frozen. This works like consumables.
 *
 * Note: Filters out orphaned clocks (clocks referencing deleted characters).
 */
export const selectStimsAvailable = createSelector(
  [
    selectClocksState,
    (state: any) => state.characters?.byId || {},
  ],
  (clocksState: ClockState, characterById: any): boolean => {
    // Find ALL addiction clocks across all characters
    let addictionClocks: Clock[] = clocksState.allIds
      .map((id: string) => clocksState.byId[id])
      .filter((clock: any): clock is Clock => Boolean(clock) && clock.clockType === 'addiction');

    // Filter out orphaned clocks (clocks referencing deleted characters)
    addictionClocks = addictionClocks.filter((clock: Clock) => {
      const characterExists = clock.entityId in characterById;
      if (!characterExists) {
        console.log(`FitGD | Filtered orphaned addiction clock: ${clock.id} (deleted entity: ${clock.entityId})`);
      }
      return characterExists;
    });

    // Debug: Log addiction clock info
    if (addictionClocks.length > 0) {
      console.log('FitGD | Active Addiction Clocks:', addictionClocks.map((c: Clock) => ({
        id: c.id,
        entityId: c.entityId,
        segments: c.segments,
        maxSegments: c.maxSegments,
        filled: c.segments >= c.maxSegments,
        frozen: c.metadata?.frozen === true
      })));
    }

    // If no clocks exist yet, stims available
    if (addictionClocks.length === 0) {
      console.log('FitGD | No active addiction clocks - stims AVAILABLE');
      return true;
    }

    // Stims are LOCKED crew-wide if ANY character's addiction clock is filled or frozen
    const isLocked = addictionClocks.some((clock: Clock) => isClockFilled(clock) || clock.metadata?.frozen === true);
    console.log('FitGD | Stims available:', !isLocked);
    return !isLocked;
  }
);



/**
 * Get harm clock count for character
 */
export const selectHarmClockCount = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): number => harmClocks.length
);

/**
 * Check if character has max harm clocks (3)
 */
export const selectHasMaxHarmClocks = createSelector(
  [selectHarmClockCount],
  (count): boolean => count >= 3
);

/**
 * Get filled harm clocks
 */
export const selectFilledHarmClocks = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): Clock[] => {
    return harmClocks.filter((clock) => isClockFilled(clock));
  }
);

/**
 * Get total segments across all harm clocks
 */
export const selectTotalHarmSegments = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): number => {
    return harmClocks.reduce((total, clock) => total + clock.segments, 0);
  }
);

/**
 * Get clock with fewest segments (for replacement)
 */
export const selectHarmClockWithFewestSegments = createSelector(
  [selectHarmClocksByCharacter],
  (harmClocks): Clock | null => {
    if (harmClocks.length === 0) return null;
    return harmClocks.reduce((min, clock) =>
      clock.segments < min.segments ? clock : min
    );
  }
);
