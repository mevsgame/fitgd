/**
 * Crew API Tests
 *
 * Tests crew management and Momentum system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('CrewAPI', () => {
  let store;
  let api;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  describe('create()', () => {
    it('should create a crew with starting Momentum', () => {
      const crewId = api.crew.create('Strike Team Alpha');

      expect(crewId).toBeDefined();

      const crew = api.crew.getCrew(crewId);
      expect(crew.name).toBe('Strike Team Alpha');
      expect(crew.currentMomentum).toBe(5);
      expect(crew.characters).toEqual([]);
    });
  });

  describe('addCharacter()', () => {
    it('should add character to crew', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Sergeant Kane',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });

      api.crew.addCharacter({ crewId, characterId });

      const crew = api.crew.getCrew(crewId);
      expect(crew.characters).toContain(characterId);
      expect(crew.characters).toHaveLength(1);
    });

    it('should add multiple characters to crew', () => {
      const crewId = api.crew.create('Team');
      const char1Id = api.character.create({
        name: 'Character 1',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      const char2Id = api.character.create({
        name: 'Character 2',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 2,
          command: 3,
          skirmish: 2,
          skulk: 1,
          wreck: 0,
          finesse: 0,
          survey: 1,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 1,
        },
      });

      api.crew.addCharacter({ crewId, characterId: char1Id });
      api.crew.addCharacter({ crewId, characterId: char2Id });

      const crew = api.crew.getCrew(crewId);
      expect(crew.characters).toHaveLength(2);
      expect(crew.characters).toContain(char1Id);
      expect(crew.characters).toContain(char2Id);
    });
  });

  describe('removeCharacter()', () => {
    it('should remove character from crew', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });

      api.crew.addCharacter({ crewId, characterId });
      expect(api.crew.getCrew(crewId).characters).toHaveLength(1);

      api.crew.removeCharacter({ crewId, characterId });

      const crew = api.crew.getCrew(crewId);
      expect(crew.characters).not.toContain(characterId);
      expect(crew.characters).toHaveLength(0);
    });
  });

  describe('Momentum system', () => {
    let crewId: string;

    beforeEach(() => {
      crewId = api.crew.create('Test Crew');
    });

    it('should start with 5 Momentum', () => {
      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(5);
    });

    it('should add Momentum', () => {
      api.crew.addMomentum({ crewId, amount: 2 });

      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(7);
    });

    it('should cap Momentum at 10', () => {
      api.crew.addMomentum({ crewId, amount: 10 });

      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(10);
    });

    it('should lose excess Momentum above 10', () => {
      api.crew.setMomentum({ crewId, amount: 8 });
      api.crew.addMomentum({ crewId, amount: 5 });

      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(10); // Not 13
    });

    it('should set Momentum to specific value', () => {
      api.crew.setMomentum({ crewId, amount: 3 });

      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(3);
    });

    it('should spend Momentum', () => {
      // Start at 5, spend 1
      api.action.push({ crewId, type: 'extra-die' });

      const momentum = api.crew.getMomentum(crewId);
      expect(momentum).toBe(4);
    });

    it('should not allow spending more Momentum than available', () => {
      api.crew.setMomentum({ crewId, amount: 2 });

      // Try to spend 3 when only 2 available
      expect(() => {
        api.action.push({ crewId, type: 'extra-die' });
        api.action.push({ crewId, type: 'extra-die' });
        api.action.push({ crewId, type: 'extra-die' });
      }).toThrow();
    });
  });

  describe('performReset()', () => {
    let crewId: string;
    let characterId: string;
    let traitId: string;

    beforeEach(() => {
      crewId = api.crew.create('Test Crew');
      characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      api.crew.addCharacter({ crewId, characterId });

      const character = api.character.getCharacter(characterId);
      traitId = character.traits[0].id;
    });

    it('should reset Momentum to 5', () => {
      api.crew.setMomentum({ crewId, amount: 8 });

      const result = api.crew.performReset(crewId);

      expect(result.newMomentum).toBe(5);
      expect(api.crew.getMomentum(crewId)).toBe(5);
    });

    it('should restore Rally availability for all characters', () => {
      // Disable Rally by using it
      api.crew.setMomentum({ crewId, amount: 3 });
      api.character.leanIntoTrait({ characterId, traitId, crewId });
      api.crew.setMomentum({ crewId, amount: 3 });

      api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 2,
      });

      // Rally should be unavailable now
      expect(api.query.canUseRally({ characterId, crewId })).toBe(false);

      // Perform reset
      api.crew.performReset(crewId);

      // Rally should be available again
      expect(api.query.canUseRally({ characterId, crewId })).toBe(true);
    });

    it('should return reset summary', () => {
      const result = api.crew.performReset(crewId);

      expect(result.newMomentum).toBe(5);
      expect(result.charactersReset).toBeDefined();
      expect(result.charactersReset).toHaveLength(1);
      expect(result.charactersReset[0].characterId).toBe(characterId);
      expect(result.charactersReset[0].rallyReset).toBe(true);
    });
  });
});
