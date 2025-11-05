import { createSelector } from '@reduxjs/toolkit';
import type { ClockState } from '../slices/clockSlice';
import type { Clock, ClockType } from '../types';
import { isClockFilled, isClockFrozen } from '../validators/clockValidator';

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
 * Get consumable clocks for a crew
 */
export const selectConsumableClocksByCrew = createSelector(
  [
    selectClocksState,
    (_state: RootState, crewId: string) => crewId,
  ],
  (clocksState, crewId): Clock[] => {
    const key = `consumable:${crewId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    return clockIds.map((id) => clocksState.byId[id]);
  }
);

/**
 * Get addiction clock for a crew
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
 * Get consumable clock by subtype
 */
export const selectConsumableClockBySubtype = createSelector(
  [
    selectClocksState,
    (_state: RootState, crewId: string, _subtype: string) => crewId,
    (_state: RootState, _crewId: string, subtype: string) => subtype,
  ],
  (clocksState, crewId, subtype): Clock | null => {
    const key = `consumable:${crewId}`;
    const clockIds = clocksState.byTypeAndEntity[key] || [];
    const clocks = clockIds.map((id) => clocksState.byId[id]);
    return clocks.find((clock) => clock.subtype === subtype) || null;
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
 * Check if stims are available (addiction clock not filled)
 */
export const selectStimsAvailable = createSelector(
  [selectAddictionClockByCrew],
  (addictionClock): boolean => {
    if (!addictionClock) return true; // No addiction clock yet
    return !isClockFilled(addictionClock);
  }
);

/**
 * Check if consumable is available (not frozen crew-wide)
 *
 * Consumables are tracked per-character but frozen crew-wide when ANY clock fills.
 * This checks if ANY consumable clock with the given subtype is frozen.
 */
export const selectConsumableAvailable = createSelector(
  [
    selectClocksState,
    (_state: RootState, _crewId: string, subtype: string) => subtype,
  ],
  (clocksState, subtype): boolean => {
    // Find ALL consumable clocks with this subtype
    const consumableClocks = clocksState.allIds
      .map((id) => clocksState.byId[id])
      .filter(
        (clock) => clock.clockType === 'consumable' && clock.subtype === subtype
      );

    // If no clocks exist yet, available
    if (consumableClocks.length === 0) return true;

    // If ANY clock is frozen, consumable is not available
    return !consumableClocks.some((clock) => isClockFrozen(clock));
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
