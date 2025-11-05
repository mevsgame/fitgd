import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer, { createCharacter, disableTrait } from '../../src/slices/characterSlice';
import {
  selectAllCharacters,
  selectCharacterTraits,
  selectEnabledTraits,
  selectDisabledTraits,
  selectCanUseRally,
  selectTotalActionDots,
  selectHasTraitByName,
  selectTraitsByCategory,
} from '../../src/selectors/characterSelectors';
import type { Trait, ActionDots } from '../../src/types';

describe('characterSelectors', () => {
  let store: ReturnType<typeof configureStore>;
  let characterId: string;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        characters: characterReducer,
      },
    });

    const traits: Trait[] = [
      {
        id: 'trait-1',
        name: 'Astra Militarum Veteran',
        category: 'role',
        disabled: false,
        acquiredAt: Date.now(),
      },
      {
        id: 'trait-2',
        name: 'Survived Hive Gang Wars',
        category: 'background',
        disabled: false,
        acquiredAt: Date.now(),
      },
    ];

    const actionDots: ActionDots = {
      shoot: 2,
      skirmish: 2,
      skulk: 1,
      wreck: 1,
      finesse: 1,
      survey: 1,
      study: 1,
      tech: 1,
      attune: 0,
      command: 1,
      consort: 1,
      sway: 0,
    };

    store.dispatch(
      createCharacter({
        name: 'Test Character',
        traits,
        actionDots,
      })
    );

    characterId = store.getState().characters.allIds[0];
  });

  it('should select all characters', () => {
    const characters = selectAllCharacters(store.getState());
    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('Test Character');
  });

  it('should select character traits', () => {
    const traits = selectCharacterTraits(store.getState(), characterId);
    expect(traits).toHaveLength(2);
    expect(traits[0].name).toBe('Astra Militarum Veteran');
  });

  it('should select only enabled traits', () => {
    // Disable one trait
    store.dispatch(disableTrait({ characterId, traitId: 'trait-1' }));

    const enabledTraits = selectEnabledTraits(store.getState(), characterId);
    expect(enabledTraits).toHaveLength(1);
    expect(enabledTraits[0].name).toBe('Survived Hive Gang Wars');
  });

  it('should select only disabled traits', () => {
    // Disable one trait
    store.dispatch(disableTrait({ characterId, traitId: 'trait-1' }));

    const disabledTraits = selectDisabledTraits(store.getState(), characterId);
    expect(disabledTraits).toHaveLength(1);
    expect(disabledTraits[0].name).toBe('Astra Militarum Veteran');
  });

  it('should check rally availability', () => {
    const canRally = selectCanUseRally(store.getState(), characterId);
    expect(canRally).toBe(true);
  });

  it('should calculate total action dots', () => {
    const total = selectTotalActionDots(store.getState(), characterId);
    expect(total).toBe(12);
  });

  it('should check if character has trait by name', () => {
    const hasVeteran = selectHasTraitByName(
      store.getState(),
      characterId,
      'Astra Militarum Veteran'
    );
    expect(hasVeteran).toBe(true);

    const hasNonExistent = selectHasTraitByName(
      store.getState(),
      characterId,
      'Nonexistent Trait'
    );
    expect(hasNonExistent).toBe(false);
  });

  it('should select traits by category', () => {
    const roleTraits = selectTraitsByCategory(
      store.getState(),
      characterId,
      'role'
    );
    expect(roleTraits).toHaveLength(1);
    expect(roleTraits[0].name).toBe('Astra Militarum Veteran');

    const backgroundTraits = selectTraitsByCategory(
      store.getState(),
      characterId,
      'background'
    );
    expect(backgroundTraits).toHaveLength(1);
    expect(backgroundTraits[0].name).toBe('Survived Hive Gang Wars');
  });
});
