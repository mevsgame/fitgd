/**
 * Character API Tests
 *
 * Tests all character-related API methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('CharacterAPI', () => {
  let store;
  let api;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  describe('create()', () => {
    it('should create a character with starting traits and action dots', () => {
      const characterId = api.character.create({
        name: 'Sergeant Kane',
        traits: [
          { name: 'Elite Infantry', category: 'role', disabled: false },
          { name: 'Hive Gang Survivor', category: 'background', disabled: false },
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

      expect(characterId).toBeDefined();

      const character = api.character.getCharacter(characterId);
      expect(character.name).toBe('Sergeant Kane');
      expect(character.traits).toHaveLength(2);
      expect(character.actionDots.shoot).toBe(3);
      expect(character.rallyAvailable).toBe(true);
    });

    it('should reject more than 12 starting action dots', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [
            { name: 'Role', category: 'role', disabled: false },
            { name: 'Background', category: 'background', disabled: false },
          ],
          actionDots: {
            shoot: 4,
            command: 4,
            skirmish: 4,
            skulk: 4, // Total = 16 > 12
            wreck: 0,
            finesse: 0,
            survey: 0,
            study: 0,
            tech: 0,
            attune: 0,
            consort: 0,
            sway: 0,
          },
        });
      }).toThrow('Character cannot have more than 12 action dots at creation');
    });

    it('should reject more than 3 dots in single action at creation', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [
            { name: 'Role', category: 'role', disabled: false },
            { name: 'Background', category: 'background', disabled: false },
          ],
          actionDots: {
            shoot: 4, // > 3 at creation
            command: 2,
            skirmish: 2,
            skulk: 2,
            wreck: 2,
            finesse: 0,
            survey: 0,
            study: 0,
            tech: 0,
            attune: 0,
            consort: 0,
            sway: 0,
          },
        });
      }).toThrow("cannot have more than 3 dots at character creation");
    });

    it('should require exactly 2 starting traits', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [{ name: 'Role', category: 'role', disabled: false }], // Only 1
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
      }).toThrow('Character must start with exactly 2 traits');
    });
  });

  describe('addTrait()', () => {
    it('should add a trait to character', () => {
      const characterId = api.character.create({
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

      const traitId = api.character.addTrait({
        characterId,
        trait: {
          name: 'Survived Ambush',
          category: 'scar',
          disabled: false,
          description: 'Lived through a brutal ambush',
        },
      });

      expect(traitId).toBeDefined();

      const character = api.character.getCharacter(characterId);
      expect(character.traits).toHaveLength(3);
      expect(character.traits.find((t) => t.id === traitId).name).toBe(
        'Survived Ambush'
      );
    });
  });

  describe('setActionDots()', () => {
    let characterId: string;

    beforeEach(() => {
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
    });

    it('should set action dots to specific value', () => {
      api.character.setActionDots({
        characterId,
        action: 'shoot',
        dots: 4,
      });

      const character = api.character.getCharacter(characterId);
      expect(character.actionDots.shoot).toBe(4);
    });

    it('should set action dots to 0', () => {
      api.character.setActionDots({
        characterId,
        action: 'skulk',
        dots: 0,
      });

      const character = api.character.getCharacter(characterId);
      expect(character.actionDots.skulk).toBe(0);
    });

    it('should reject dots less than 0', () => {
      expect(() => {
        api.character.setActionDots({
          characterId,
          action: 'shoot',
          dots: -1,
        });
      }).toThrow('Action dots must be between 0 and 4');
    });

    it('should reject dots greater than 4', () => {
      expect(() => {
        api.character.setActionDots({
          characterId,
          action: 'shoot',
          dots: 5,
        });
      }).toThrow('Action dots must be between 0 and 4');
    });
  });

  describe('leanIntoTrait()', () => {
    let characterId: string;
    let crewId: string;
    let traitId: string;

    beforeEach(() => {
      crewId = api.crew.create('Test Crew');
      characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Elite Infantry', category: 'role', disabled: false },
          { name: 'Hive Gang Survivor', category: 'background', disabled: false },
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

    it('should disable trait and gain 2 Momentum', () => {
      const result = api.character.leanIntoTrait({
        characterId,
        traitId,
        crewId,
      });

      expect(result.traitDisabled).toBe(true);
      expect(result.momentumGained).toBe(2);
      expect(result.newMomentum).toBe(7); // Started at 5

      const character = api.character.getCharacter(characterId);
      expect(character.traits.find((t) => t.id === traitId).disabled).toBe(true);
    });

    it('should increase crew Momentum by 2', () => {
      api.character.leanIntoTrait({ characterId, traitId, crewId });

      const crew = api.crew.getCrew(crewId);
      expect(crew.currentMomentum).toBe(7);
    });
  });

  describe('advanceActionDots()', () => {
    it('should increase action dots by 1', () => {
      const characterId = api.character.create({
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

      api.character.advanceActionDots({
        characterId,
        action: 'shoot',
      });

      const character = api.character.getCharacter(characterId);
      expect(character.actionDots.shoot).toBe(4);
    });
  });

  describe('getAvailableTraits()', () => {
    it('should return only non-disabled traits', () => {
      const crewId = api.crew.create('Test Crew');
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Trait 1', category: 'role', disabled: false },
          { name: 'Trait 2', category: 'background', disabled: false },
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

      // Disable first trait
      const character = api.character.getCharacter(characterId);
      const traitId = character.traits[0].id;
      api.character.leanIntoTrait({ characterId, traitId, crewId });

      // Get available traits
      const availableTraits = api.character.getAvailableTraits(characterId);
      expect(availableTraits).toHaveLength(1);
      expect(availableTraits[0].disabled).toBe(false);
    });
  });
});
