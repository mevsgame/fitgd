import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import characterReducer, {
  createCharacter,
  addTrait,
  disableTrait,
  enableTrait,
  setApproach,
  addEquipment,
  removeEquipment,
  addUnallocatedDots,
  useRally,
  resetRally,
} from '../../src/slices/characterSlice';
import { DEFAULT_CONFIG } from '../../src/config';
import type { Character, Trait, Approaches, Equipment } from '../../src/types';

describe('characterSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore();
  });

  describe('createCharacter', () => {
    it('should create a character with valid starting stats', () => {
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

      const state = store.getState().characters;
      const characterId = state.allIds[0];
      const character = state.byId[characterId];

      expect(character).toBeDefined();
      expect(character.name).toBe('Test Character');
      expect(character.traits).toHaveLength(2);
      expect(character.rallyAvailable).toBe(true);
      expect(character.equipment).toEqual([]);
    });

    it('should reject character with incorrect starting trait count', () => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Only One Trait',
          category: 'role',
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

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            approaches,
          })
        );
      }).toThrow();
    });

    it('should reject character with more than 12 starting action dots', () => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
          category: 'background',
          disabled: false,
          acquiredAt: Date.now(),
        },
      ];

      const approaches: Approaches = {
        force: 4,
        guile: 4,
        focus: 4,
        spirit: 4, // Total = 16 (invalid)
      };

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            approaches,
          })
        );
      }).toThrow();
    });

    it('should reject character with more than 3 dots in a single action at creation', () => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
          category: 'background',
          disabled: false,
          acquiredAt: Date.now(),
        },
      ];

      const approaches: Approaches = {
        force: 4, // Invalid: max 3 at creation
        guile: 1,
        focus: 1,
        spirit: 0,
      };

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            approaches,
          })
        );
      }).toThrow();
    });
  });

  describe('trait management', () => {
    let characterId: string;

    beforeEach(() => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
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

    it('should add a new trait', () => {
      const newTrait: Trait = {
        id: 'trait-3',
        name: 'Fought Against Orks',
        category: 'flashback',
        disabled: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addTrait({ characterId, trait: newTrait }));

      const character = store.getState().characters.byId[characterId];
      expect(character.traits).toHaveLength(3);
      expect(character.traits[2].name).toBe('Fought Against Orks');
    });

    it('should disable a trait', () => {
      const traitId = 'trait-1';

      store.dispatch(disableTrait({ characterId, traitId }));

      const character = store.getState().characters.byId[characterId];
      const trait = character.traits.find((t) => t.id === traitId);
      expect(trait?.disabled).toBe(true);
    });

    it('should enable a disabled trait', () => {
      const traitId = 'trait-1';

      // First disable
      store.dispatch(disableTrait({ characterId, traitId }));
      let character = store.getState().characters.byId[characterId];
      expect(character.traits[0].disabled).toBe(true);

      // Then enable
      store.dispatch(enableTrait({ characterId, traitId }));
      character = store.getState().characters.byId[characterId];
      expect(character.traits[0].disabled).toBe(false);
    });
  });

  describe('action dots', () => {
    let characterId: string;

    beforeEach(() => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
          category: 'background',
          disabled: false,
          acquiredAt: Date.now(),
        },
      ];

      const approaches: Approaches = {
        force: 2,
        guile: 1,
        focus: 1,
        spirit: 1,
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

    it('should set action dots during advancement (up to 4)', () => {
      // Character starts with force: 2, needs 2 more to reach 4
      // Grant 2 unallocated dots first
      store.dispatch(
        addUnallocatedDots({ characterId, amount: 2 })
      );

      store.dispatch(
        setApproach({ characterId, approach: 'force', dots: 4 })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.approaches.force).toBe(4);
      expect(character.unallocatedApproachDots).toBe(0); // All used up
    });

    it('should reject setting action dots above 4', () => {
      expect(() => {
        store.dispatch(
          setApproach({ characterId, approach: 'force', dots: 5 })
        );
      }).toThrow();
    });

    it('should reject setting negative action dots', () => {
      expect(() => {
        store.dispatch(
          setApproach({ characterId, approach: 'force', dots: -1 })
        );
      }).toThrow();
    });
  });

  describe('equipment', () => {
    let characterId: string;

    beforeEach(() => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
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

    it('should add equipment', () => {
      const equipment: Equipment = {
        id: 'equip-1',
        name: 'Las Rifle',
        tier: 'accessible',
        category: 'weapon',
        rarity: 'common',
        description: 'Standard issue laser rifle',
        tags: ['ranged'],
        equipped: true,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));

      const character = store.getState().characters.byId[characterId];
      expect(character.equipment).toHaveLength(1);
      expect(character.equipment[0].name).toBe('Las Rifle');
    });

    it('should remove equipment', () => {
      const equipment: Equipment = {
        id: 'equip-1',
        name: 'Las Rifle',
        tier: 'accessible',
        category: 'weapon',
        rarity: 'common',
        description: 'Standard issue laser rifle',
        tags: ['ranged'],
        equipped: true,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(removeEquipment({ characterId, equipmentId: 'equip-1' }));

      const character = store.getState().characters.byId[characterId];
      expect(character.equipment).toHaveLength(0);
    });
  });

  describe('rally', () => {
    let characterId: string;

    beforeEach(() => {
      const traits: Trait[] = [
        {
          id: 'trait-1',
          name: 'Role',
          category: 'role',
          disabled: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'trait-2',
          name: 'Background',
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

    it('should mark rally as used', () => {
      store.dispatch(useRally({ characterId }));

      const character = store.getState().characters.byId[characterId];
      expect(character.rallyAvailable).toBe(false);
    });

    it('should reset rally availability', () => {
      // Use rally
      store.dispatch(useRally({ characterId }));
      let character = store.getState().characters.byId[characterId];
      expect(character.rallyAvailable).toBe(false);

      // Reset
      store.dispatch(resetRally({ characterId }));
      character = store.getState().characters.byId[characterId];
      expect(character.rallyAvailable).toBe(true);
    });
  });
});



