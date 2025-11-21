import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import characterReducer from '../../src/slices/characterSlice';
import crewReducer from '../../src/slices/crewSlice';
import clockReducer from '../../src/slices/clockSlice';
import { createCharacter } from '../../src/slices/characterSlice';
import { createCrew } from '../../src/slices/crewSlice';
import {
  useConsumable,
  useStim,
  performMomentumReset,
} from '../../src/resources';
import {
  selectConsumableClockBySubtype,
  selectAddictionClockByCharacter,
  selectStimsAvailable,
  selectConsumableAvailable,
} from '../../src/selectors/clockSelectors';
import type { RootState } from '../../src/store';

/**
 * Resource Management Tests
 *
 * Tests for consumable and stim usage with proper validation
 */

describe('Resource Management', () => {
  let store: ReturnType<typeof configureStore>;
  let characterId: string;
  let crewId: string;

  beforeEach(() => {
    // Create store with all reducers
    store = configureStore();

    // Create test character
    store.dispatch(
      createCharacter({
        name: 'Test Character',
        traits: [
          {
            id: 'trait-1',
            name: 'Test Role',
            category: 'role',
            disabled: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'trait-2',
            name: 'Test Background',
            category: 'background',
            disabled: false,
            acquiredAt: Date.now(),
          },
        ],
        approaches: {
          force: 2,
          guile: 1,
          focus: 1,
          spirit: 0,
        },
      })
    );

    // Create test crew
    store.dispatch(createCrew({ name: 'Test Crew' }));

    // Get IDs
    characterId = store.getState().characters.allIds[0];
    crewId = store.getState().crews.allIds[0];

    // Add character to crew
    store.dispatch({
      type: 'crews/addCharacterToCrew',
      payload: { crewId, characterId },
    });
  });

  describe('useConsumable', () => {
    it('should create consumable clock on first use', () => {
      const result = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 3,
      });

      expect(result.clockId).toBeDefined();
      expect(result.segmentsAdded).toBe(3);
      expect(result.newSegments).toBe(3);
      expect(result.isFrozen).toBe(false);
      expect(result.tierDowngraded).toBe(false);

      // Verify clock was created
      const state = store.getState() as RootState;
      const clock = selectConsumableClockBySubtype(
        state,
        characterId,
        'frag_grenades'
      );
      expect(clock).toBeDefined();
      expect(clock?.segments).toBe(3);
      expect(clock?.maxSegments).toBe(8); // Common rarity
    });

    it('should add segments to existing consumable clock', () => {
      // First use
      const result1 = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 3,
      });

      // Second use
      const result2 = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 2,
      });

      expect(result2.clockId).toBe(result1.clockId);
      expect(result2.segmentsAdded).toBe(2);
      expect(result2.newSegments).toBe(5);
      expect(result2.isFrozen).toBe(false);
    });

    it('should freeze consumable clock when filled', () => {
      // Use consumable multiple times to fill clock (8 segments)
      useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 3,
      });

      const result = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 5, // 3 + 5 = 8 (filled)
      });

      expect(result.newSegments).toBe(8);
      expect(result.isFrozen).toBe(true);
      expect(result.tierDowngraded).toBe(true);

      // Verify clock is frozen
      const state = store.getState() as RootState;
      const clock = selectConsumableClockBySubtype(
        state,
        characterId,
        'frag_grenades'
      );
      expect(clock?.metadata?.frozen).toBe(true);
      expect(clock?.metadata?.tier).toBe('inaccessible');
    });

    it('should reject usage when consumable is frozen', () => {
      // Fill the clock (8 segments for common rarity)
      useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 4,
      });
      useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Try to use again
      expect(() =>
        useConsumable(store, {
          crewId,
          characterId,
          consumableType: 'frag_grenades',
          depletionRoll: 1,
        })
      ).toThrow('no longer accessible');
    });

    it('should validate depletion roll is 1-6', () => {
      expect(() =>
        useConsumable(store, {
          crewId,
          characterId,
          consumableType: 'frag_grenades',
          depletionRoll: 0,
        })
      ).toThrow('must be 1-6');

      expect(() =>
        useConsumable(store, {
          crewId,
          characterId,
          consumableType: 'frag_grenades',
          depletionRoll: 7,
        })
      ).toThrow('must be 1-6');
    });

    it('should track different consumable types separately', () => {
      const grenades = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 3,
      });

      const medkits = useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'medkits',
        depletionRoll: 2,
      });

      expect(grenades.clockId).not.toBe(medkits.clockId);
      expect(grenades.newSegments).toBe(3);
      expect(medkits.newSegments).toBe(2);
    });

    it('should check availability with selector', () => {
      // Available initially
      let state = store.getState() as RootState;
      expect(
        selectConsumableAvailable(state, characterId, 'frag_grenades')
      ).toBe(true);

      // Fill clock (8 segments for common rarity)
      useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 4,
      });
      useConsumable(store, {
        crewId,
        characterId,
        consumableType: 'frag_grenades',
        depletionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Not available after freezing
      state = store.getState() as RootState;
      expect(
        selectConsumableAvailable(state, characterId, 'frag_grenades')
      ).toBe(false);
    });
  });

  describe('useStim', () => {
    it('should create addiction clock on first use', () => {
      const result = useStim(store, {
        crewId,
        characterId,
        addictionRoll: 3,
      });

      expect(result.clockId).toBeDefined();
      expect(result.segmentsAdded).toBe(3);
      expect(result.newSegments).toBe(3);
      expect(result.isAddicted).toBe(false);
      expect(result.addictTraitId).toBeUndefined();

      // Verify clock was created
      const state = store.getState() as RootState;
      const clock = selectAddictionClockByCharacter(state, characterId);
      expect(clock).toBeDefined();
      expect(clock?.segments).toBe(3);
      expect(clock?.maxSegments).toBe(8);
    });

    it('should add segments to existing addiction clock', () => {
      // First use
      const result1 = useStim(store, {
        crewId,
        characterId,
        addictionRoll: 2,
      });

      // Second use
      const result2 = useStim(store, {
        crewId,
        characterId,
        addictionRoll: 3,
      });

      expect(result2.clockId).toBe(result1.clockId);
      expect(result2.segmentsAdded).toBe(3);
      expect(result2.newSegments).toBe(5);
      expect(result2.isAddicted).toBe(false);
    });

    it('should add "Addict" trait when addiction clock fills', () => {
      // Use stim to get close to filling
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 5,
      });

      // Fill the clock
      const result = useStim(store, {
        crewId,
        characterId,
        addictionRoll: 3, // 5 + 3 = 8 (filled)
      });

      expect(result.newSegments).toBe(8);
      expect(result.isAddicted).toBe(true);
      expect(result.addictTraitId).toBeDefined();

      // Verify "Addict" trait was added
      const state = store.getState();
      const character = state.characters.byId[characterId];
      const addictTrait = character.traits.find((t) => t.name === 'Addict');

      expect(addictTrait).toBeDefined();
      expect(addictTrait?.category).toBe('scar');
      expect(addictTrait?.id).toBe(result.addictTraitId);
    });

    it('should reject usage when addiction clock is filled', () => {
      // Fill the clock (8 segments)
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4,
      });
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Try to use again
      expect(() =>
        useStim(store, {
          crewId,
          characterId,
          addictionRoll: 1,
        })
      ).toThrow('locked due to addiction');
    });

    it('should validate addiction roll is 1-6', () => {
      expect(() =>
        useStim(store, {
          crewId,
          characterId,
          addictionRoll: 0,
        })
      ).toThrow('must be 1-6');

      expect(() =>
        useStim(store, {
          crewId,
          characterId,
          addictionRoll: 7,
        })
      ).toThrow('must be 1-6');
    });

    it('should check availability with selector', () => {
      // Available initially
      let state = store.getState() as RootState;
      expect(selectStimsAvailable(state)).toBe(true);

      // Fill clock (8 segments)
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4,
      });
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Not available after addiction
      state = store.getState() as RootState;
      expect(selectStimsAvailable(state)).toBe(false);
    });

    it('should prevent entire crew from using stims when addicted', () => {
      // Create second character
      store.dispatch(
        createCharacter({
          name: 'Test Character 2',
          traits: [
            {
              id: 'trait-3',
              name: 'Test Role 2',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-4',
              name: 'Test Background 2',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          approaches: {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
          },
        })
      );

      const character2Id = store.getState().characters.allIds[1];

      // First character uses stims and gets addicted (8 segments)
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4,
      });
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Second character cannot use stims
      expect(() =>
        useStim(store, {
          crewId,
          characterId: character2Id,
          addictionRoll: 1,
        })
      ).toThrow('locked due to addiction');
    });

    it('should set frozen metadata when addiction clock fills', () => {
      // Use stim to fill addiction clock
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4,
      });
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 4, // 4 + 4 = 8 (filled)
      });

      // Verify frozen metadata is set
      const state = store.getState() as RootState;
      const clock = selectAddictionClockByCharacter(state, characterId);
      expect(clock?.metadata?.frozen).toBe(true);
    });

    it('should freeze crew-wide addiction clocks when any fills', () => {
      // Create second character
      store.dispatch(
        createCharacter({
          name: 'Test Character 2',
          traits: [
            {
              id: 'trait-2a',
              name: 'Test Role',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2b',
              name: 'Test Background',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          approaches: {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
          },
        })
      );

      const character2Id = store.getState().characters.allIds[1];

      // Create addiction clocks for both characters
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 2,
      });
      useStim(store, {
        crewId,
        characterId: character2Id,
        addictionRoll: 3,
      });

      // Fill first character's addiction clock
      useStim(store, {
        crewId,
        characterId,
        addictionRoll: 6, // 2 + 6 = 8 (filled)
      });

      // Verify both clocks are now frozen
      const state = store.getState() as RootState;
      const clock1 = selectAddictionClockByCharacter(state, characterId);
      const clock2 = selectAddictionClockByCharacter(state, character2Id);

      expect(clock1?.metadata?.frozen).toBe(true);
      expect(clock2?.metadata?.frozen).toBe(true);
    });
  });

  describe('performMomentumReset', () => {
    it('should reset crew momentum to 5', () => {
      // Set momentum to some other value
      store.dispatch({ type: 'crews/setMomentum', payload: { crewId, amount: 8 } });

      const result = performMomentumReset(store, { crewId });

      expect(result.newMomentum).toBe(5);
      expect(result.crewId).toBe(crewId);

      // Verify in state
      const state = store.getState();
      expect(state.crews.byId[crewId].currentMomentum).toBe(5);
    });

    it('should recover addiction clock during reset', () => {
      // Create addiction clock with 6 segments (partial)
      useStim(store, { crewId, characterId, addictionRoll: 6 });

      const result = performMomentumReset(store, { crewId });

      // Verify addiction was recovered for character
      expect(result.charactersReset[0].addictionClocksRecovered).toBe(1);

      // Verify in state: partial (6) reduces by 2 to 4
      const state = store.getState() as RootState;
      const clock = selectAddictionClockByCharacter(state, characterId);
      expect(clock?.segments).toBe(4);
    });

    it('should reset rally availability for all characters', () => {
      // Use rally
      store.dispatch({
        type: 'characters/useRally',
        payload: { characterId },
      });

      // Verify rally is used
      let state = store.getState();
      expect(state.characters.byId[characterId].rallyAvailable).toBe(false);

      // Perform reset
      const result = performMomentumReset(store, { crewId });

      expect(result.charactersReset[0].rallyReset).toBe(true);

      // Verify rally is available again
      state = store.getState();
      expect(state.characters.byId[characterId].rallyAvailable).toBe(true);
    });

    it('should re-enable all disabled traits', () => {
      // Disable a trait (lean into trait)
      const traitId = store.getState().characters.byId[characterId].traits[0].id;
      store.dispatch({
        type: 'characters/disableTrait',
        payload: { characterId, traitId },
      });

      // Verify trait is disabled
      let state = store.getState();
      const trait = state.characters.byId[characterId].traits.find(
        (t) => t.id === traitId
      );
      expect(trait?.disabled).toBe(true);

      // Perform reset
      const result = performMomentumReset(store, { crewId });

      expect(result.charactersReset[0].traitsReEnabled).toBe(1);

      // Verify trait is enabled again
      state = store.getState();
      const updatedTrait = state.characters.byId[characterId].traits.find(
        (t) => t.id === traitId
      );
      expect(updatedTrait?.disabled).toBe(false);
    });

    it('should perform all reset actions in one call', () => {
      // Setup: use rally, disable trait, use stim, set momentum
      const traitId = store.getState().characters.byId[characterId].traits[0].id;

      store.dispatch({ type: 'characters/useRally', payload: { characterId } });
      store.dispatch({
        type: 'characters/disableTrait',
        payload: { characterId, traitId },
      });
      useStim(store, { crewId, characterId, addictionRoll: 6 });
      store.dispatch({ type: 'crews/setMomentum', payload: { crewId, amount: 2 } });

      // Perform complete reset
      const result = performMomentumReset(store, { crewId });

      // Verify all changes
      expect(result.newMomentum).toBe(5);
      expect(result.charactersReset[0].rallyReset).toBe(true);
      expect(result.charactersReset[0].traitsReEnabled).toBe(1);
      expect(result.charactersReset[0].addictionClocksRecovered).toBe(1); // partial 6 → 4

      // Verify in state
      const state = store.getState() as RootState;
      expect(state.crews.byId[crewId].currentMomentum).toBe(5);
      expect(state.characters.byId[characterId].rallyAvailable).toBe(true);

      const trait = state.characters.byId[characterId].traits.find(
        (t) => t.id === traitId
      );
      expect(trait?.disabled).toBe(false);

      const clock = selectAddictionClockByCharacter(state, characterId);
      expect(clock?.segments).toBe(4);
    });

    it('should handle multiple characters in crew', () => {
      // Create second character
      store.dispatch(
        createCharacter({
          name: 'Test Character 2',
          traits: [
            {
              id: 'trait-3',
              name: 'Test Role 2',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-4',
              name: 'Test Background 2',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          approaches: {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
          },
        })
      );

      const character2Id = store.getState().characters.allIds[1];

      // Add second character to crew (first is already added in beforeEach)
      store.dispatch({
        type: 'crews/addCharacterToCrew',
        payload: { crewId, characterId: character2Id },
      });

      // Use rally for both
      store.dispatch({ type: 'characters/useRally', payload: { characterId } });
      store.dispatch({
        type: 'characters/useRally',
        payload: { characterId: character2Id },
      });

      // Perform reset
      const result = performMomentumReset(store, { crewId });

      // Should reset both characters
      expect(result.charactersReset.length).toBe(2);
      expect(result.charactersReset[0].rallyReset).toBe(true);
      expect(result.charactersReset[1].rallyReset).toBe(true);

      // Verify both characters have rally available
      const state = store.getState();
      expect(state.characters.byId[characterId].rallyAvailable).toBe(true);
      expect(state.characters.byId[character2Id].rallyAvailable).toBe(true);
    });

  });
});



