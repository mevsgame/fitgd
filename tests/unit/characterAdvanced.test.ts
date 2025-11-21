import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import {
  createCharacter,
  addTrait,
  groupTraits,
  createTraitFromFlashback,
  advanceApproach,
} from '../../src/slices/characterSlice';
import type { Trait, Approaches } from '../../src/types';

describe('characterSlice - Advanced Features', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore();
  });

  describe('groupTraits', () => {
    let characterId: string;

    beforeEach(() => {
      // Create character with starting traits
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

      const approaches: Approaches = {
        force: 2,
        guile: 1,
        focus: 1,
        spirit: 0,
      };

      store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits,
          approaches,
        })
      );

      characterId = store.getState().characters.allIds[0];

      // Add 3 more traits to group
      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-3',
            name: 'Fought in Battle of Cadia',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-4',
            name: 'Trained in Urban Warfare',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-5',
            name: 'Siege Warfare Specialist',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );
    });

    it('should group 3 traits into 1 broader trait', () => {
      const traitIds = ['trait-3', 'trait-4', 'trait-5'];
      const groupedTrait: Trait = {
        id: 'grouped-1',
        name: 'Elite Infantry Regiment Veteran',
        category: 'grouped',
        disabled: false,
        description: 'Consolidated from: Battle of Cadia, Urban Warfare, Siege Specialist',
        acquiredAt: Date.now(),
      };

      store.dispatch(
        groupTraits({
          characterId,
          traitIds,
          groupedTrait,
        })
      );

      const character = store.getState().characters.byId[characterId];

      // Should have 3 traits (2 starting + 1 grouped)
      expect(character.traits).toHaveLength(3);

      // Original 3 traits should be removed
      expect(character.traits.find((t) => t.id === 'trait-3')).toBeUndefined();
      expect(character.traits.find((t) => t.id === 'trait-4')).toBeUndefined();
      expect(character.traits.find((t) => t.id === 'trait-5')).toBeUndefined();

      // Grouped trait should exist
      const grouped = character.traits.find((t) => t.id === 'grouped-1');
      expect(grouped).toBeDefined();
      expect(grouped?.name).toBe('Elite Infantry Regiment Veteran');
      expect(grouped?.category).toBe('grouped');
    });

    it('should reject grouping if less than 3 traits provided', () => {
      const traitIds = ['trait-3', 'trait-4']; // Only 2
      const groupedTrait: Trait = {
        id: 'grouped-1',
        name: 'Some Grouped Trait',
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      expect(() => {
        store.dispatch(
          groupTraits({
            characterId,
            traitIds,
            groupedTrait,
          })
        );
      }).toThrow();
    });

    it('should reject grouping if more than 3 traits provided', () => {
      // Add 4th trait
      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-6',
            name: 'Another Trait',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      const traitIds = ['trait-3', 'trait-4', 'trait-5', 'trait-6']; // 4 traits
      const groupedTrait: Trait = {
        id: 'grouped-1',
        name: 'Some Grouped Trait',
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      expect(() => {
        store.dispatch(
          groupTraits({
            characterId,
            traitIds,
            groupedTrait,
          })
        );
      }).toThrow();
    });

    it('should reject grouping if trait IDs do not exist', () => {
      const traitIds = ['trait-3', 'trait-4', 'nonexistent-trait'];
      const groupedTrait: Trait = {
        id: 'grouped-1',
        name: 'Some Grouped Trait',
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      expect(() => {
        store.dispatch(
          groupTraits({
            characterId,
            traitIds,
            groupedTrait,
          })
        );
      }).toThrow();
    });
  });

  describe('createTraitFromFlashback', () => {
    let characterId: string;

    beforeEach(() => {
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

      const approaches: Approaches = {
        force: 2,
        guile: 1,
        focus: 1,
        spirit: 0,
      };

      store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits,
          approaches,
        })
      );

      characterId = store.getState().characters.allIds[0];
    });

    it('should create a new trait from flashback', () => {
      const newTrait: Trait = {
        id: 'flashback-1',
        name: 'Infiltrated Chaos Cult Hideout',
        category: 'flashback',
        disabled: false,
        description: 'Established during flashback to justify stealth approach',
        acquiredAt: Date.now(),
      };

      store.dispatch(
        createTraitFromFlashback({
          characterId,
          trait: newTrait,
        })
      );

      const character = store.getState().characters.byId[characterId];

      // Should have 3 traits now (2 starting + 1 flashback)
      expect(character.traits).toHaveLength(3);

      const flashbackTrait = character.traits.find((t) => t.id === 'flashback-1');
      expect(flashbackTrait).toBeDefined();
      expect(flashbackTrait?.name).toBe('Infiltrated Chaos Cult Hideout');
      expect(flashbackTrait?.category).toBe('flashback');
    });

    it('should allow multiple flashback traits', () => {
      store.dispatch(
        createTraitFromFlashback({
          characterId,
          trait: {
            id: 'flashback-1',
            name: 'First Flashback',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      store.dispatch(
        createTraitFromFlashback({
          characterId,
          trait: {
            id: 'flashback-2',
            name: 'Second Flashback',
            category: 'flashback',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.traits).toHaveLength(4); // 2 starting + 2 flashback
    });

    it('should create trait with specific event/place/person details', () => {
      const newTrait: Trait = {
        id: 'flashback-1',
        name: 'Served with Captain Gaius of the 33rd Regiment',
        category: 'flashback',
        disabled: false,
        description: 'Specific person and unit from past experience',
        acquiredAt: Date.now(),
      };

      store.dispatch(
        createTraitFromFlashback({
          characterId,
          trait: newTrait,
        })
      );

      const character = store.getState().characters.byId[characterId];
      const flashbackTrait = character.traits.find((t) => t.id === 'flashback-1');

      expect(flashbackTrait?.name).toBe('Served with Captain Gaius of the 33rd Regiment');
      expect(flashbackTrait?.description).toContain('person and unit');
    });
  });

  describe('advanceApproach', () => {
    let characterId: string;

    beforeEach(() => {
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

      const approaches: Approaches = {
        force: 2,
        guile: 1,
        focus: 1,
        spirit: 0,
      };

      store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits,
          approaches,
        })
      );

      characterId = store.getState().characters.allIds[0];
    });

    it('should advance action dots by 1 at milestone', () => {
      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'force',
        })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.approaches.force).toBe(3); // Was 2, now 3
    });

    it('should not exceed maximum of 4 dots', () => {
      // Advance to 3
      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'force',
        })
      );
      // Advance to 4
      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'force',
        })
      );

      // Try to advance again (would be 5)
      expect(() => {
        store.dispatch(
          advanceApproach({
            characterId,
            approach: 'force',
          })
        );
      }).toThrow();
    });

    it('should advance from 0 to 1', () => {
      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'spirit', // Currently 0
        })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.approaches.spirit).toBe(1);
    });

    it('should allow advancing different actions over time', () => {
      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'force',
        })
      );

      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'focus',
        })
      );

      store.dispatch(
        advanceApproach({
          characterId,
          approach: 'guile',
        })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.approaches.force).toBe(3); // 2->3
      expect(character.approaches.focus).toBe(2); // 1->2
      expect(character.approaches.guile).toBe(2); // 1->2
    });
  });
});



