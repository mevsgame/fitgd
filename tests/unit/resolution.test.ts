import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer from '../../src/slices/characterSlice';
import crewReducer from '../../src/slices/crewSlice';
import clockReducer from '../../src/slices/clockSlice';
import {
  evaluateRoll,
  resolveActionConsequence,
  applyHarmConsequence,
} from '../../src/resolution';
import { createCharacter } from '../../src/slices/characterSlice';
import { createCrew } from '../../src/slices/crewSlice';
import type { ActionDots, Trait } from '../../src/types';

describe('resolution helpers', () => {
  let store: ReturnType<typeof configureStore>;
  let characterId: string;
  let crewId: string;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        characters: characterReducer,
        crews: crewReducer,
        clocks: clockReducer,
      },
    });

    // Create character
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
      shoot: 3,
      skirmish: 2,
      skulk: 1,
      wreck: 1,
      finesse: 1,
      survey: 1,
      study: 1,
      tech: 0,
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

    // Create crew
    store.dispatch(createCrew({ name: 'Test Crew' }));
    crewId = store.getState().crews.allIds[0];
  });

  describe('evaluateRoll', () => {
    it('should return failure for highest die 1-3', () => {
      expect(evaluateRoll([1, 2, 3])).toEqual({
        result: 'failure',
        highestDie: 3,
        dice: [1, 2, 3],
      });

      expect(evaluateRoll([1, 1])).toEqual({
        result: 'failure',
        highestDie: 1,
        dice: [1, 1],
      });

      expect(evaluateRoll([3])).toEqual({
        result: 'failure',
        highestDie: 3,
        dice: [3],
      });
    });

    it('should return partial for highest die 4-5', () => {
      expect(evaluateRoll([2, 4])).toEqual({
        result: 'partial',
        highestDie: 4,
        dice: [2, 4],
      });

      expect(evaluateRoll([1, 5, 3])).toEqual({
        result: 'partial',
        highestDie: 5,
        dice: [1, 5, 3],
      });
    });

    it('should return success for single 6', () => {
      expect(evaluateRoll([1, 6, 3])).toEqual({
        result: 'success',
        highestDie: 6,
        dice: [1, 6, 3],
      });

      expect(evaluateRoll([6])).toEqual({
        result: 'success',
        highestDie: 6,
        dice: [6],
      });
    });

    it('should return critical for two or more 6s', () => {
      expect(evaluateRoll([6, 6])).toEqual({
        result: 'critical',
        highestDie: 6,
        dice: [6, 6],
      });

      expect(evaluateRoll([6, 6, 6, 3])).toEqual({
        result: 'critical',
        highestDie: 6,
        dice: [6, 6, 6, 3],
      });
    });

    it('should handle zero dots roll (2d6 take lowest)', () => {
      // For 0 dots, caller should pass 2 dice, we take lowest
      const dice = [4, 2]; // Lowest is 2
      expect(evaluateRoll(dice, true)).toEqual({
        result: 'failure',
        highestDie: 2, // When useLowest, highestDie is actually the lowest
        dice: [4, 2],
      });
    });
  });

  describe('resolveActionConsequence', () => {
    it('should generate +1 momentum on controlled failure', () => {
      const result = resolveActionConsequence(store, {
        crewId,
        position: 'controlled',
        result: 'failure',
      });

      expect(result.momentumGenerated).toBe(1);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(6); // Started at 5, +1
    });

    it('should generate +2 momentum on risky partial', () => {
      const result = resolveActionConsequence(store, {
        crewId,
        position: 'risky',
        result: 'partial',
      });

      expect(result.momentumGenerated).toBe(2);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(7); // Started at 5, +2
    });

    it('should generate +4 momentum on desperate failure', () => {
      const result = resolveActionConsequence(store, {
        crewId,
        position: 'desperate',
        result: 'failure',
      });

      expect(result.momentumGenerated).toBe(4);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(9); // Started at 5, +4
    });

    it('should not generate momentum on success', () => {
      const result = resolveActionConsequence(store, {
        crewId,
        position: 'risky',
        result: 'success',
      });

      expect(result.momentumGenerated).toBe(0);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(5); // Unchanged
    });

    it('should not generate momentum on critical', () => {
      const result = resolveActionConsequence(store, {
        crewId,
        position: 'desperate',
        result: 'critical',
      });

      expect(result.momentumGenerated).toBe(0);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(5); // Unchanged
    });

    it('should cap momentum at 10', () => {
      // Set momentum to 9
      store.dispatch({ type: 'crews/setMomentum', payload: { crewId, amount: 9 } });

      const result = resolveActionConsequence(store, {
        crewId,
        position: 'desperate',
        result: 'failure', // +4 momentum
      });

      expect(result.momentumGenerated).toBe(4);

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(10); // Capped at 10, not 13
    });
  });

  describe('applyHarmConsequence', () => {
    it('should apply 0 segments for controlled + limited', () => {
      const result = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'limited',
        harmType: 'Physical Harm',
      });

      expect(result.segmentsAdded).toBe(0);
      expect(result.isDying).toBe(false);

      const clock = store.getState().clocks.byId[result.clockId];
      expect(clock.segments).toBe(0);
    });

    it('should apply 1 segment for controlled + standard', () => {
      const result = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'standard',
        harmType: 'Physical Harm',
      });

      expect(result.segmentsAdded).toBe(1);
      expect(result.isDying).toBe(false);

      const clock = store.getState().clocks.byId[result.clockId];
      expect(clock.segments).toBe(1);
    });

    it('should apply 2 segments for controlled + great', () => {
      const result = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'great',
        harmType: 'Physical Harm',
      });

      expect(result.segmentsAdded).toBe(2);

      const clock = store.getState().clocks.byId[result.clockId];
      expect(clock.segments).toBe(2);
    });

    it('should apply 3 segments for risky + standard', () => {
      const result = applyHarmConsequence(store, {
        characterId,
        position: 'risky',
        effect: 'standard',
        harmType: 'Physical Harm',
      });

      expect(result.segmentsAdded).toBe(3);

      const clock = store.getState().clocks.byId[result.clockId];
      expect(clock.segments).toBe(3);
    });

    it('should apply 6 segments for desperate + great (dying)', () => {
      const result = applyHarmConsequence(store, {
        characterId,
        position: 'desperate',
        effect: 'great',
        harmType: 'Physical Harm',
      });

      expect(result.segmentsAdded).toBe(6);
      expect(result.isDying).toBe(true);

      const clock = store.getState().clocks.byId[result.clockId];
      expect(clock.segments).toBe(6);
      expect(clock.maxSegments).toBe(6);
    });

    it('should add to existing harm clock', () => {
      // First harm: 2 segments
      const result1 = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'great',
        harmType: 'Physical Harm',
      });

      expect(result1.segmentsAdded).toBe(2);

      // Second harm: +3 segments (same type)
      const result2 = applyHarmConsequence(store, {
        characterId,
        position: 'risky',
        effect: 'standard',
        harmType: 'Physical Harm',
      });

      expect(result2.segmentsAdded).toBe(3);
      expect(result2.clockId).toBe(result1.clockId); // Same clock

      const clock = store.getState().clocks.byId[result2.clockId];
      expect(clock.segments).toBe(5); // 2 + 3
    });

    it('should create separate clocks for different harm types', () => {
      const result1 = applyHarmConsequence(store, {
        characterId,
        position: 'risky',
        effect: 'standard',
        harmType: 'Physical Harm',
      });

      const result2 = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'standard',
        harmType: 'Shaken Morale',
      });

      expect(result2.clockId).not.toBe(result1.clockId);

      const harmClocks = store.getState().clocks.byTypeAndEntity[`harm:${characterId}`];
      expect(harmClocks).toHaveLength(2);
    });

    it('should replace clock with fewest segments when 4th harm type added', () => {
      // Create 3 harm clocks
      const result1 = applyHarmConsequence(store, {
        characterId,
        position: 'risky',
        effect: 'standard',
        harmType: 'Physical Harm', // 3 segments
      });

      const result2 = applyHarmConsequence(store, {
        characterId,
        position: 'desperate',
        effect: 'standard',
        harmType: 'Shaken Morale', // 5 segments
      });

      const result3 = applyHarmConsequence(store, {
        characterId,
        position: 'controlled',
        effect: 'standard',
        harmType: 'Psychic Corruption', // 1 segment (fewest)
      });

      // Add 4th harm type - should replace Psychic Corruption (1 segment)
      const result4 = applyHarmConsequence(store, {
        characterId,
        position: 'risky',
        effect: 'limited',
        harmType: 'Exhaustion', // 2 segments
      });

      // Should still have 3 clocks
      const harmClocks = store.getState().clocks.byTypeAndEntity[`harm:${characterId}`];
      expect(harmClocks).toHaveLength(3);

      // Exhaustion clock should have replaced Psychic Corruption's clock
      // but kept the segment count (1 segment initially, +2 from new harm = 3)
      const exhaustionClock = store.getState().clocks.byId[result4.clockId];
      expect(exhaustionClock.subtype).toBe('Exhaustion');
      expect(exhaustionClock.segments).toBe(3); // 1 (preserved) + 2 (new harm)
    });
  });
});
