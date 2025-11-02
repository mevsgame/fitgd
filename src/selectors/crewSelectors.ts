import { createSelector } from '@reduxjs/toolkit';
import type { CrewState } from '../slices/crewSlice';
import type { Crew } from '../types';
import { DEFAULT_CONFIG } from '../config';

/**
 * Crew Selectors
 *
 * Memoized selectors for efficiently querying crew state.
 */

// Root selector type (will be expanded when we have RootState)
interface RootState {
  crews: CrewState;
}

/**
 * Base selectors
 */
export const selectCrewsState = (state: RootState) => state.crews;

export const selectAllCrewIds = (state: RootState) => state.crews.allIds;

export const selectCrewById = (state: RootState, crewId: string) =>
  state.crews.byId[crewId];

/**
 * Get all crews as an array
 */
export const selectAllCrews = createSelector(
  [selectCrewsState],
  (crewsState): Crew[] =>
    crewsState.allIds.map((id) => crewsState.byId[id])
);

/**
 * Get crew by ID with default fallback
 */
export const makeSelectCrew = () =>
  createSelector(
    [selectCrewById],
    (crew): Crew | null => crew || null
  );

/**
 * Get current momentum for a crew
 */
export const selectCurrentMomentum = createSelector(
  [selectCrewById],
  (crew): number => (crew ? crew.currentMomentum : 0)
);

/**
 * Get crew characters
 */
export const selectCrewCharacters = createSelector(
  [selectCrewById],
  (crew): string[] => (crew ? crew.characters : [])
);

/**
 * Check if crew has maximum momentum
 */
export const selectHasMaxMomentum = createSelector(
  [selectCurrentMomentum],
  (momentum): boolean => momentum >= DEFAULT_CONFIG.crew.maxMomentum
);

/**
 * Check if crew has minimum momentum
 */
export const selectHasMinMomentum = createSelector(
  [selectCurrentMomentum],
  (momentum): boolean => momentum <= DEFAULT_CONFIG.crew.minMomentum
);

/**
 * Check if crew can spend momentum
 */
export const selectCanSpendMomentum = createSelector(
  [selectCurrentMomentum, (_state: RootState, _crewId: string, amount: number) => amount],
  (currentMomentum, amount): boolean => currentMomentum >= amount
);

/**
 * Check if Rally is available (momentum 0-3)
 */
export const selectRallyAvailable = createSelector(
  [selectCurrentMomentum],
  (momentum): boolean => momentum <= DEFAULT_CONFIG.rally.maxMomentumToUse
);

/**
 * Get crew size (number of characters)
 */
export const selectCrewSize = createSelector(
  [selectCrewCharacters],
  (characters): number => characters.length
);

/**
 * Check if character is in crew
 */
export const selectIsCharacterInCrew = createSelector(
  [selectCrewCharacters, (_state: RootState, _crewId: string, characterId: string) => characterId],
  (characters, characterId): boolean => characters.includes(characterId)
);
