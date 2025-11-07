import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer, {
  createCharacter,
  addTrait,
  disableTrait,
  enableTrait,
  setActionDots,
  addEquipment,
  removeEquipment,
  addUnallocatedDots,
  useRally,
  resetRally,
} from '../../src/slices/characterSlice';
import { DEFAULT_CONFIG } from '../../src/config';
import type { Character, Trait, ActionDots, Equipment } from '../../src/types';

describe('characterSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        characters: characterReducer,
      },
    });
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

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            actionDots,
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

      const actionDots: ActionDots = {
        shoot: 3,
        skirmish: 3,
        skulk: 2,
        wreck: 2, // Total = 13 (invalid)
        finesse: 1,
        survey: 1,
        study: 1,
        tech: 0,
        attune: 0,
        command: 0,
        consort: 0,
        sway: 0,
      };

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            actionDots,
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

      const actionDots: ActionDots = {
        shoot: 4, // Invalid: max 3 at creation
        skirmish: 2,
        skulk: 2,
        wreck: 1,
        finesse: 1,
        survey: 1,
        study: 1,
        tech: 0,
        attune: 0,
        command: 0,
        consort: 0,
        sway: 0,
      };

      expect(() => {
        store.dispatch(
          createCharacter({
            name: 'Invalid Character',
            traits,
            actionDots,
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

    it('should set action dots during advancement (up to 4)', () => {
      // Character starts with shoot: 2, needs 2 more to reach 4
      // Grant 2 unallocated dots first
      store.dispatch(
        addUnallocatedDots({ characterId, amount: 2 })
      );

      store.dispatch(
        setActionDots({ characterId, action: 'shoot', dots: 4 })
      );

      const character = store.getState().characters.byId[characterId];
      expect(character.actionDots.shoot).toBe(4);
      expect(character.unallocatedActionDots).toBe(0); // All used up
    });

    it('should reject setting action dots above 4', () => {
      expect(() => {
        store.dispatch(
          setActionDots({ characterId, action: 'shoot', dots: 5 })
        );
      }).toThrow();
    });

    it('should reject setting negative action dots', () => {
      expect(() => {
        store.dispatch(
          setActionDots({ characterId, action: 'shoot', dots: -1 })
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

    it('should add equipment', () => {
      const equipment: Equipment = {
        id: 'equip-1',
        name: 'Las Rifle',
        tier: 'accessible',
        category: 'weapon',
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
