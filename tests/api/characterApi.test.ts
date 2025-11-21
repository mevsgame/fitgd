/**
 * Character API Tests
 *
 * Tests all character-related API methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type { RootState } from '../../src/store';
import type { GameAPI } from '../../src/api';
import type { Trait } from '../../src/types';

describe('CharacterAPI', () => {
  let store: EnhancedStore<RootState>;
  let api: GameAPI;

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
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      });

      expect(characterId).toBeDefined();

      const character = api.character.getCharacter(characterId);
      expect(character.name).toBe('Sergeant Kane');
      expect(character.traits).toHaveLength(2);
      expect(character.approaches.force).toBe(2);
      expect(character.rallyAvailable).toBe(true);
    });

    it('should reject more than 5 starting approach dots', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [
            { name: 'Role', category: 'role', disabled: false },
            { name: 'Background', category: 'background', disabled: false },
          ],
          approaches: { force: 3, guile: 3, focus: 0, spirit: 0 }, // Total 6 > 5
        });
      }).toThrow('Character cannot have more than 5 approach dots at creation');
    });

    it('should reject more than 2 dots in single approach at creation', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [
            { name: 'Role', category: 'role', disabled: false },
            { name: 'Background', category: 'background', disabled: false },
          ],
          approaches: { force: 3, guile: 0, focus: 0, spirit: 0 }, // Force 3 > 2
        });
      }).toThrow("Approach 'force' cannot have more than 2 dots at character creation");
    });

    it('should require exactly 2 starting traits', () => {
      expect(() => {
        api.character.create({
          name: 'Invalid Character',
          traits: [{ name: 'Role', category: 'role', disabled: false }], // Only 1
          approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
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
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      });

      const traitId = api.character.addTrait(characterId, {
        name: 'Survived Ambush',
        category: 'scar',
        disabled: false,
        description: 'Lived through a brutal ambush',
      });

      expect(traitId).toBeDefined();

      const character = api.character.getCharacter(characterId);
      expect(character.traits).toHaveLength(3);
      expect(character.traits.find((t: Trait) => t.id === traitId)?.name).toBe(
        'Survived Ambush'
      );
    });
  });

  describe('setApproach()', () => {
    let characterId: string;

    beforeEach(() => {
      characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      });
    });

    it('should set action dots to specific value', () => {
      // Character starts with force: 2, needs 2 more to reach 4
      // Grant 1 unallocated dot first
      api.character.addUnallocatedDots({
        characterId,
        amount: 1,
      });

      api.character.setApproach({
        characterId,
        approach: 'force',
        dots: 4,
      });

      const character = api.character.getCharacter(characterId);
      expect(character.approaches.force).toBe(4);
      expect(character.unallocatedApproachDots).toBe(0); // All used up
    });

    it('should set action dots to 0', () => {
      api.character.setApproach({
        characterId,
        approach: 'guile',
        dots: 0,
      });

      const character = api.character.getCharacter(characterId);
      expect(character.approaches.guile).toBe(0); // Set to 0
    });

    it('should reject dots less than 0', () => {
      expect(() => {
        api.character.setApproach({
          characterId,
          approach: 'force',
          dots: -1,
        });
      }).toThrow('Approach dots cannot be negative');
    });

    it('should reject dots greater than 4', () => {
      expect(() => {
        api.character.setApproach({
          characterId,
          approach: 'force',
          dots: 5,
        });
      }).toThrow('Approach dots cannot exceed 4');
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
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
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
      expect(character.traits.find((t: Trait) => t.id === traitId)?.disabled).toBe(true);
    });

    it('should increase crew Momentum by 2', () => {
      api.character.leanIntoTrait({ characterId, traitId, crewId });

      const crew = api.crew.getCrew(crewId);
      expect(crew.currentMomentum).toBe(7);
    });
  });

  describe('advanceApproach()', () => {
    it('should increase action dots by 1', () => {
      const characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      });

      api.character.advanceApproach({
        characterId,
        approach: 'force',
      });

      const character = api.character.getCharacter(characterId);
      expect(character.approaches.force).toBe(3); // 2 + 1 = 3
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
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
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

  describe('useRally()', () => {
    let crewId: string;
    let characterId: string;
    let traitId: string;

    beforeEach(() => {
      // Create crew and character
      crewId = api.crew.create('Test Crew');
      characterId = api.character.create({
        name: 'Test Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      });
      api.crew.addCharacter({ crewId, characterId });

      // Disable a trait so we can re-enable it
      const character = api.character.getCharacter(characterId);
      traitId = character.traits[0].id;
      api.character.leanIntoTrait({ characterId, traitId, crewId });
    });

    it('should allow Rally when Momentum is 0-3', () => {
      // Set Momentum to 3
      api.crew.setMomentum({ crewId, amount: 3 });

      const result = api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 2,
      });

      expect(result.rallyUsed).toBe(true);
      expect(result.traitReEnabled).toBe(true);
      expect(result.momentumSpent).toBe(2);
      expect(result.newMomentum).toBe(1);

      const character = api.character.getCharacter(characterId);
      expect(character.rallyAvailable).toBe(false);
      expect(character.traits.find((t: Trait) => t.id === traitId)?.disabled).toBe(false);
    });

    it('should reject Rally when Momentum is above 3', () => {
      // Set Momentum to 4 (above the threshold)
      api.crew.setMomentum({ crewId, amount: 4 });

      expect(() => {
        api.character.useRally({
          characterId,
          crewId,
          traitId,
          momentumToSpend: 1,
        });
      }).toThrow('Rally only available at 0-3 Momentum');

      const character = api.character.getCharacter(characterId);
      expect(character.rallyAvailable).toBe(true); // Should remain available
    });

    it('should reject Rally when already used', () => {
      // Set Momentum to 2
      api.crew.setMomentum({ crewId, amount: 2 });

      // Use Rally once
      api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 1,
      });

      // Try to use Rally again
      expect(() => {
        api.character.useRally({
          characterId,
          crewId,
          momentumToSpend: 1,
        });
      }).toThrow('Rally already used for character');
    });

    it('should allow Rally without re-enabling a trait', () => {
      // Set Momentum to 2
      api.crew.setMomentum({ crewId, amount: 2 });

      const result = api.character.useRally({
        characterId,
        crewId,
        momentumToSpend: 2,
      });

      expect(result.rallyUsed).toBe(true);
      expect(result.traitReEnabled).toBe(false);
      expect(result.momentumSpent).toBe(2);
      expect(result.newMomentum).toBe(0);
    });
  });
});





