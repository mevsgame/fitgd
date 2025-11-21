import { createSelector } from '@reduxjs/toolkit';
import type { CharacterState } from '../slices/characterSlice';
import type { Character, Trait } from '../types';

/**
 * Character Selectors
 *
 * Memoized selectors for efficiently querying character state.
 */

// Root selector type (will be expanded when we have RootState)
interface RootState {
  characters: CharacterState;
}

/**
 * Base selectors
 */
export const selectCharactersState = (state: RootState) => state.characters;

export const selectAllCharacterIds = (state: RootState) =>
  state.characters.allIds;

export const selectCharacterById = (state: RootState, characterId: string) =>
  state.characters.byId[characterId];

/**
 * Get all characters as an array
 */
export const selectAllCharacters = createSelector(
  [selectCharactersState],
  (charactersState): Character[] =>
    charactersState.allIds.map((id) => charactersState.byId[id])
);

/**
 * Get character by ID with default fallback
 */
export const makeSelectCharacter = () =>
  createSelector(
    [selectCharacterById],
    (character): Character | null => character || null
  );

/**
 * Get character traits
 */
export const selectCharacterTraits = createSelector(
  [selectCharacterById],
  (character): Trait[] => (character ? character.traits : [])
);

/**
 * Get enabled traits only
 */
export const selectEnabledTraits = createSelector(
  [selectCharacterTraits],
  (traits): Trait[] => traits.filter((t) => !t.disabled)
);

/**
 * Get disabled traits only
 */
export const selectDisabledTraits = createSelector(
  [selectCharacterTraits],
  (traits): Trait[] => traits.filter((t) => t.disabled)
);

/**
 * Check if character can use Rally
 */
export const selectCanUseRally = createSelector(
  [selectCharacterById],
  (character): boolean => (character ? character.rallyAvailable : false)
);

/**
 * Get total approach dots for a character
 */
export const selectTotalApproachDots = createSelector(
  [selectCharacterById],
  (character): number => {
    if (!character) return 0;
    return Object.values(character.approaches).reduce(
      (sum: number, dots: number) => sum + dots,
      0
    );
  }
);

/**
 * Get equipment by tier
 */
export const selectEquipmentByTier = createSelector(
  [selectCharacterById, (_state: RootState, _characterId: string, tier: string) => tier],
  (character, tier) => {
    if (!character) return [];
    return character.equipment.filter((e) => e.tier === tier);
  }
);

/**
 * Check if character has a specific trait by name
 */
export const selectHasTraitByName = createSelector(
  [selectCharacterTraits, (_state: RootState, _characterId: string, traitName: string) => traitName],
  (traits, traitName): boolean =>
    traits.some((t) => t.name.toLowerCase() === traitName.toLowerCase())
);

/**
 * Get traits by category
 */
export const selectTraitsByCategory = createSelector(
  [
    selectCharacterTraits,
    (_state: RootState, _characterId: string, category: string) => category,
  ],
  (traits, category) => traits.filter((t) => t.category === category)
);
