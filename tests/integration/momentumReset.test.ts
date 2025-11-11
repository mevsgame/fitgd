/**
 * Momentum Reset Integration Tests
 *
 * Tests the complete reset mechanic workflow using api.crew.performReset():
 * - Reset momentum to 5
 * - Reset rally for all crew members
 * - Re-enable all disabled traits
 * - Reduce addiction clock by 2 segments
 * - Recover all 6/6 harm clocks to 5/6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';
import { createClock, addSegments } from '../../src/slices/clockSlice';

describe('Momentum Reset Mechanic', () => {
  let store: ReturnType<typeof configureStore>;
  let api: ReturnType<typeof createGameAPI>;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  describe('perform Reset - Complete Workflow', () => {
    it('should reset momentum to 5 from various values', () => {
      const crewId = api.crew.create('Test Crew');

      // Test from low value (0)
      api.crew.setMomentum({ crewId, amount: 0 });
      let result = api.crew.performReset(crewId);
      expect(result.newMomentum).toBe(5);

      // Test from high value (10)
      api.crew.setMomentum({ crewId, amount: 10 });
      result = api.crew.performReset(crewId);
      expect(result.newMomentum).toBe(5);

      // Test from mid value (3)
      api.crew.setMomentum({ crewId, amount: 3 });
      result = api.crew.performReset(crewId);
      expect(result.newMomentum).toBe(5);

      // Test already at 5
      api.crew.setMomentum({ crewId, amount: 5 });
      result = api.crew.performReset(crewId);
      expect(result.newMomentum).toBe(5);
    });

    it('should reset rally for all crew members', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role Trait', category: 'role', disabled: false },
          { name: 'Background Trait', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2, command: 2, skirmish: 2, skulk: 2,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      // Set momentum to 3 so rally can be used
      api.crew.setMomentum({ crewId, amount: 3 });

      // Use rally
      api.character.useRally({ characterId, crewId });
      expect(api.query.canUseRally({ characterId, crewId })).toBe(false);

      // Perform reset
      const result = api.crew.performReset(crewId);

      expect(result.charactersReset[0].rallyReset).toBe(true);

      // After reset, rally is available but can't be used yet (momentum = 5 > 3)
      const character = api.character.getCharacter(characterId);
      expect(character!.rallyAvailable).toBe(true); // Rally flag is reset
      expect(api.query.canUseRally({ characterId, crewId })).toBe(false); // Can't use yet (momentum too high)

      // Lower momentum to 3 to test that rally can now be used
      api.crew.setMomentum({ crewId, amount: 3 });
      expect(api.query.canUseRally({ characterId, crewId })).toBe(true); // Now can use rally
    });

    it('should re-enable all disabled traits', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role Trait', category: 'role', disabled: false },
          { name: 'Background Trait', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2, command: 2, skirmish: 2, skulk: 2,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      // Add a scar trait after creation
      api.character.addTrait({
        characterId,
        trait: { name: 'Battle Scar', category: 'scar', disabled: false },
      });

      // Lean into traits (disable them)
      const character = api.character.getCharacter(characterId);
      api.character.leanIntoTrait({ crewId, characterId, traitId: character!.traits[0].id });
      api.character.leanIntoTrait({ crewId, characterId, traitId: character!.traits[2].id });

      // Verify 2 traits disabled
      const updatedChar = api.character.getCharacter(characterId);
      expect(updatedChar!.traits[0].disabled).toBe(true);
      expect(updatedChar!.traits[2].disabled).toBe(true);

      // Perform reset
      const result = api.crew.performReset(crewId);

      expect(result.charactersReset[0].traitsReEnabled).toBe(2);

      // Verify traits re-enabled
      const resetChar = api.character.getCharacter(characterId);
      expect(resetChar!.traits[0].disabled).toBe(false);
      expect(resetChar!.traits[1].disabled).toBe(false);
      expect(resetChar!.traits[2].disabled).toBe(false);
    });

    it('should reduce addiction clock by 2 segments', () => {
      const crewId = api.crew.create('Test Crew');

      // Create addiction clock at 8 segments
      store.dispatch(createClock({
        entityId: crewId,
        clockType: 'addiction',
      }));
      const state = store.getState();
      const clockId = state.clocks.allIds[state.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId, amount: 8 }));

      expect(store.getState().clocks.byId[clockId].segments).toBe(8);

      // Perform reset
      const result = api.crew.performReset(crewId);

      expect(result.addictionReduced).toBe(6); // New value after reducing by 2
      expect(store.getState().clocks.byId[clockId].segments).toBe(6);
    });

    it('should reduce addiction clock to minimum 0', () => {
      const crewId = api.crew.create('Test Crew');

      // Create addiction clock at 1 segment
      store.dispatch(createClock({
        entityId: crewId,
        clockType: 'addiction',
      }));
      const state = store.getState();
      const clockId = state.clocks.allIds[state.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId, amount: 1 }));

      expect(store.getState().clocks.byId[clockId].segments).toBe(1);

      // Perform reset (should reduce to 0, not negative)
      const result = api.crew.performReset(crewId);

      expect(result.addictionReduced).toBe(0);
      expect(store.getState().clocks.byId[clockId].segments).toBe(0);
    });

    it('should handle crew with no addiction clock', () => {
      const crewId = api.crew.create('Test Crew');

      // No addiction clock created
      expect(api.query.getAddictionClock(crewId)).toBeNull();

      // Reset should not throw error
      const result = api.crew.performReset(crewId);

      expect(result.addictionReduced).toBeNull();
    });

    it('should recover all 6/6 harm clocks to 5/6', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role Trait', category: 'role', disabled: false },
          { name: 'Background Trait', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2, command: 2, skirmish: 2, skulk: 2,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      // Create 3 harm clocks at 6/6
      store.dispatch(createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: 'Physical Harm',
      }));
      const state1 = store.getState();
      const clock1Id = state1.clocks.allIds[state1.clocks.allIds.length - 1];

      store.dispatch(createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: 'Morale Harm',
      }));
      const state2 = store.getState();
      const clock2Id = state2.clocks.allIds[state2.clocks.allIds.length - 1];

      store.dispatch(createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: 'Psychic Corruption',
      }));
      const state3 = store.getState();
      const clock3Id = state3.clocks.allIds[state3.clocks.allIds.length - 1];

      store.dispatch(addSegments({ clockId: clock1Id, amount: 6 }));
      store.dispatch(addSegments({ clockId: clock2Id, amount: 6 }));
      store.dispatch(addSegments({ clockId: clock3Id, amount: 6 }));

      // All at 6/6
      expect(store.getState().clocks.byId[clock1Id].segments).toBe(6);
      expect(store.getState().clocks.byId[clock2Id].segments).toBe(6);
      expect(store.getState().clocks.byId[clock3Id].segments).toBe(6);

      // Perform reset
      const result = api.crew.performReset(crewId);

      expect(result.charactersReset[0].harmClocksRecovered).toBe(3);

      // All now at 5/6
      expect(store.getState().clocks.byId[clock1Id].segments).toBe(5);
      expect(store.getState().clocks.byId[clock2Id].segments).toBe(5);
      expect(store.getState().clocks.byId[clock3Id].segments).toBe(5);
    });

    it('should not affect harm clocks below 6/6', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role Trait', category: 'role', disabled: false },
          { name: 'Background Trait', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2, command: 2, skirmish: 2, skulk: 2,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      // Create harm clocks at various levels
      store.dispatch(createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: 'Physical Harm',
      }));
      const state1 = store.getState();
      const clock1Id = state1.clocks.allIds[state1.clocks.allIds.length - 1];

      store.dispatch(createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: 'Morale Harm',
      }));
      const state2 = store.getState();
      const clock2Id = state2.clocks.allIds[state2.clocks.allIds.length - 1];

      store.dispatch(addSegments({ clockId: clock1Id, amount: 3 })); // 3/6
      store.dispatch(addSegments({ clockId: clock2Id, amount: 5 })); // 5/6

      // Check initial values
      expect(store.getState().clocks.byId[clock1Id].segments).toBe(3);
      expect(store.getState().clocks.byId[clock2Id].segments).toBe(5);

      // Perform reset
      const result = api.crew.performReset(crewId);

      expect(result.charactersReset[0].harmClocksRecovered).toBe(0);

      // Should remain unchanged
      expect(store.getState().clocks.byId[clock1Id].segments).toBe(3);
      expect(store.getState().clocks.byId[clock2Id].segments).toBe(5);
    });

    it('should handle character with no harm clocks', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role Trait', category: 'role', disabled: false },
          { name: 'Background Trait', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2, command: 2, skirmish: 2, skulk: 2,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      // No harm clocks
      expect(api.query.getHarmClocks(characterId)).toHaveLength(0);

      // Should not throw error
      const result = api.crew.performReset(crewId);

      expect(result.charactersReset[0].harmClocksRecovered).toBe(0);
    });

    it('should handle reset on empty crew (no members)', () => {
      const crewId = api.crew.create('Empty Crew');

      // Set momentum to 2
      api.crew.setMomentum({ crewId, amount: 2 });

      // Reset should work without errors
      const result = api.crew.performReset(crewId);

      expect(result.newMomentum).toBe(5);
      expect(result.charactersReset).toHaveLength(0);
    });

    it('should perform all reset actions together in a complete scenario', () => {
      // Setup: Create crew with 2 characters
      const crewId = api.crew.create('Strike Team Alpha');

      const char1Id = api.character.create({
        name: 'Character 1',
        traits: [
          { name: 'Elite Infantry', category: 'role', disabled: false },
          { name: 'Hive Gang Survivor', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3, command: 2, skirmish: 2, skulk: 1,
          wreck: 1, finesse: 1, survey: 1, study: 1,
          tech: 0, attune: 0, consort: 0, sway: 0,
        },
      });

      const char2Id = api.character.create({
        name: 'Character 2',
        traits: [
          { name: 'Tech Priest', category: 'role', disabled: false },
          { name: 'Forge World', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 1, command: 1, skirmish: 1, skulk: 1,
          wreck: 2, finesse: 2, survey: 2, study: 1,
          tech: 1, attune: 0, consort: 0, sway: 0,
        },
      });

      api.crew.addCharacter({ crewId, characterId: char1Id });
      api.crew.addCharacter({ crewId, characterId: char2Id });

      // Add a scar trait to char1 after creation
      api.character.addTrait({
        characterId: char1Id,
        trait: { name: 'Battle Scar', category: 'scar', disabled: false },
      });

      // Set momentum to 3 so rally can be used
      api.crew.setMomentum({ crewId, amount: 3 });

      // Both use rally
      api.character.useRally({ characterId: char1Id, crewId });
      api.character.useRally({ characterId: char2Id, crewId });

      // Set momentum to 10 for rest of test
      api.crew.setMomentum({ crewId, amount: 10 });

      // Disable some traits
      const char1 = api.character.getCharacter(char1Id);
      const char2 = api.character.getCharacter(char2Id);

      api.character.leanIntoTrait({ crewId, characterId: char1Id, traitId: char1!.traits[0].id });
      api.character.leanIntoTrait({ crewId, characterId: char1Id, traitId: char1!.traits[2].id });
      api.character.leanIntoTrait({ crewId, characterId: char2Id, traitId: char2!.traits[0].id });

      // Create addiction clock at 6 segments
      store.dispatch(createClock({
        entityId: crewId,
        clockType: 'addiction',
      }));
      const addictionState = store.getState();
      const addictionClockId = addictionState.clocks.allIds[addictionState.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId: addictionClockId, amount: 6 }));

      // Create harm clocks (some at 6/6, some below)
      store.dispatch(createClock({
        entityId: char1Id,
        clockType: 'harm',
        subtype: 'Physical Harm',
      }));
      const state1 = store.getState();
      const char1HarmClock1 = state1.clocks.allIds[state1.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId: char1HarmClock1, amount: 6 })); // 6/6

      store.dispatch(createClock({
        entityId: char1Id,
        clockType: 'harm',
        subtype: 'Morale Harm',
      }));
      const state2 = store.getState();
      const char1HarmClock2 = state2.clocks.allIds[state2.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId: char1HarmClock2, amount: 3 })); // 3/6

      store.dispatch(createClock({
        entityId: char2Id,
        clockType: 'harm',
        subtype: 'Physical Harm',
      }));
      const state3 = store.getState();
      const char2HarmClock1 = state3.clocks.allIds[state3.clocks.allIds.length - 1];
      store.dispatch(addSegments({ clockId: char2HarmClock1, amount: 6 })); // 6/6

      // PERFORM RESET
      const result = api.crew.performReset(crewId);

      // Verify all reset actions
      expect(result.newMomentum).toBe(5); // ✓ Reset to 5
      expect(result.addictionReduced).toBe(4); // ✓ Reduced by 2 (6 → 4)
      expect(result.charactersReset).toHaveLength(2);

      // Character 1 results
      const char1Result = result.charactersReset.find(r => r.characterId === char1Id);
      expect(char1Result!.rallyReset).toBe(true);
      expect(char1Result!.traitsReEnabled).toBe(2);
      expect(char1Result!.harmClocksRecovered).toBe(1); // Only 1 was at 6/6

      // Character 2 results
      const char2Result = result.charactersReset.find(r => r.characterId === char2Id);
      expect(char2Result!.rallyReset).toBe(true);
      expect(char2Result!.traitsReEnabled).toBe(1);
      expect(char2Result!.harmClocksRecovered).toBe(1);

      // Verify final state
      expect(api.query.canUseRally({ characterId: char1Id, crewId })).toBe(false); // Still at momentum 5 after reset (>3)
      expect(api.query.canUseRally({ characterId: char2Id, crewId })).toBe(false); // Still at momentum 5 after reset (>3)
      expect(api.character.getCharacter(char1Id)!.traits[0].disabled).toBe(false);
      expect(api.character.getCharacter(char1Id)!.traits[2].disabled).toBe(false);
      expect(api.character.getCharacter(char2Id)!.traits[0].disabled).toBe(false);
      expect(store.getState().clocks.byId[addictionClockId].segments).toBe(4);
      expect(store.getState().clocks.byId[char1HarmClock1].segments).toBe(5); // Recovered
      expect(store.getState().clocks.byId[char1HarmClock2].segments).toBe(3); // Unchanged
      expect(store.getState().clocks.byId[char2HarmClock1].segments).toBe(5); // Recovered
    });
  });
});
