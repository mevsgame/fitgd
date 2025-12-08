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

/**
 * Get active player action for a crew (widget lifecycle sync)
 */
export const selectActivePlayerAction = createSelector(
  [selectCrewById],
  (crew) => crew?.activePlayerAction ?? null
);

/**
 * Check if a player action is in progress for a crew
 */
export const selectIsPlayerActionInProgress = createSelector(
  [selectActivePlayerAction],
  (action): boolean => action !== null
);

/**
 * Check if a player can close the widget (pre-commit only)
 *
 * Returns true if:
 * - No action in progress, OR
 * - Action is in progress AND player owns it AND not committed to roll
 */
export const selectCanPlayerCloseWidget = createSelector(
  [
    selectActivePlayerAction,
    (_state: RootState, _crewId: string, playerId: string) => playerId,
  ],
  (action, playerId): boolean => {
    if (!action) return true; // No action, can close
    return action.playerId === playerId && !action.committedToRoll;
  }
);

/**
 * Check if GM can close the widget (always true, with confirmation)
 *
 * This selector exists for API consistency - GM can always close.
 */
export const selectCanGMCloseWidget = createSelector(
  [selectActivePlayerAction],
  (_action): boolean => true // GM can always close
);
