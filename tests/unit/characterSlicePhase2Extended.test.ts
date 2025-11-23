import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import {
  createCharacter,
  markEquipmentUsed,
  autoEquipItems,
} from '../../src/slices/characterSlice';
import { DEFAULT_CONFIG } from '../../src/config';
import type { Character, Trait, Approaches, Equipment } from '../../src/types';

describe('characterSlice - Phase 2 Extended (Equipment Usage & Auto-Equip)', () => {
  let store: ReturnType<typeof configureStore>;
  let characterCounter = 0;

  beforeEach(() => {
    store = configureStore();
    characterCounter = 0;
  });

  /**
   * Helper to create a character with equipment for testing
   */
  const createTestCharacter = (equipment: Equipment[] = []) => {
    const traits: Trait[] = [
      {
        id: `trait-1-${characterCounter}`,
        name: 'Veteran',
        category: 'role',
        disabled: false,
        acquiredAt: Date.now(),
      },
      {
        id: `trait-2-${characterCounter}`,
        name: 'Scarred',
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
        name: `Test Character ${characterCounter}`,
        traits,
        approaches,
        equipment,
      })
    );

    const state = store.getState().characters;
    const newCharacterId = state.allIds[state.allIds.length - 1]; // Get the last (most recently created) character
    characterCounter++;
    return newCharacterId;
  };

  describe('markEquipmentUsed', () => {
    it('should lock equipment when marked as used', () => {
      // Setup: Create character with unlocked equipment
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Action: Mark equipment as used
      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'weapon-1',
        })
      );

      // Verify: Equipment is now locked
      const state = store.getState().characters;
      const character = state.byId[characterId];
      const equip = character.equipment.find((e) => e.id === 'weapon-1');

      expect(equip?.locked).toBe(true);
    });

    it('should update character updatedAt timestamp', () => {
      const equipment: Equipment[] = [
        {
          id: 'tool-1',
          name: 'Precision Tool',
          tier: 'common',
          category: 'tool',
          description: 'Specialized tool',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);
      const initialState = store.getState().characters;
      const initialUpdatedAt = initialState.byId[characterId].updatedAt;

      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'tool-1',
        })
      );

      const finalState = store.getState().characters;
      const finalUpdatedAt = finalState.byId[characterId].updatedAt;

      expect(finalUpdatedAt).toBeGreaterThanOrEqual(initialUpdatedAt);
    });

    it('should add command to history with correct type', () => {
      const equipment: Equipment[] = [
        {
          id: 'armor-1',
          name: 'Armor',
          tier: 'common',
          category: 'armor',
          description: 'Protective gear',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'armor-1',
        })
      );

      const state = store.getState().characters;
      const lastCommand = state.history[state.history.length - 1];

      expect(lastCommand.type).toBe('characters/markEquipmentUsed');
      expect(lastCommand.payload).toEqual({
        characterId,
        equipmentId: 'armor-1',
      });
      expect(lastCommand.commandId).toBeDefined();
      expect(lastCommand.timestamp).toBeDefined();
      expect(lastCommand.version).toBe(1);
    });

    it('should throw error when character does not exist', () => {
      expect(() => {
        store.dispatch(
          markEquipmentUsed({
            characterId: 'nonexistent-char',
            equipmentId: 'weapon-1',
          })
        );
      }).toThrow('Character nonexistent-char not found');
    });

    it('should throw error when equipment does not exist', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      expect(() => {
        store.dispatch(
          markEquipmentUsed({
            characterId,
            equipmentId: 'nonexistent-equip',
          })
        );
      }).toThrow('Equipment nonexistent-equip not found');
    });

    it('should lock multiple items independently', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'armor-1',
          name: 'Armor',
          tier: 'common',
          category: 'armor',
          description: 'Protective gear',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Mark first equipment as used
      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'weapon-1',
        })
      );

      let state = store.getState().characters;
      let character = state.byId[characterId];
      expect(character.equipment.find((e) => e.id === 'weapon-1')?.locked).toBe(true);
      expect(character.equipment.find((e) => e.id === 'armor-1')?.locked).toBe(false);

      // Mark second equipment as used
      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'armor-1',
        })
      );

      state = store.getState().characters;
      character = state.byId[characterId];
      expect(character.equipment.find((e) => e.id === 'weapon-1')?.locked).toBe(true);
      expect(character.equipment.find((e) => e.id === 'armor-1')?.locked).toBe(true);
    });

    it('should include userId in command history when provided', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'weapon-1',
          userId: 'user-123',
        })
      );

      const state = store.getState().characters;
      const lastCommand = state.history[state.history.length - 1];

      expect(lastCommand.userId).toBe('user-123');
    });
  });

  describe('autoEquipItems', () => {
    it('should equip items with autoEquip flag set to true', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
        {
          id: 'armor-1',
          name: 'Armor',
          tier: 'common',
          category: 'armor',
          description: 'Protective gear',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: false,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Action: Auto-equip flagged items (at Momentum Reset)
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      // Verify: Only autoEquip: true items are equipped
      const state = store.getState().characters;
      const character = state.byId[characterId];

      expect(character.equipment.find((e) => e.id === 'weapon-1')?.equipped).toBe(true);
      expect(character.equipment.find((e) => e.id === 'armor-1')?.equipped).toBe(false);
    });

    it('should unlock items when auto-equipping them', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: true, // Locked from previous session
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Action: Auto-equip at Momentum Reset
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      // Verify: Item is both equipped and unlocked
      const state = store.getState().characters;
      const character = state.byId[characterId];
      const weapon = character.equipment.find((e) => e.id === 'weapon-1');

      expect(weapon?.equipped).toBe(true);
      expect(weapon?.locked).toBe(false);
    });

    it('should ignore items without autoEquip flag', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          // No autoEquip flag (undefined)
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Action: Auto-equip
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      // Verify: Item remains unequipped
      const state = store.getState().characters;
      const character = state.byId[characterId];
      const weapon = character.equipment.find((e) => e.id === 'weapon-1');

      expect(weapon?.equipped).toBe(false);
    });

    it('should handle mixed autoEquip states in single action', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: true,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
        {
          id: 'armor-1',
          name: 'Armor',
          tier: 'common',
          category: 'armor',
          description: 'Protective gear',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
        {
          id: 'tool-1',
          name: 'Tool',
          tier: 'common',
          category: 'tool',
          description: 'A tool',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'consumable-1',
          name: 'Stim',
          tier: 'common',
          category: 'consumable',
          description: 'Single-use item',
          passive: false,
          equipped: false,
          locked: false,
          depleted: true,
          // autoEquip not set
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      const state = store.getState().characters;
      const character = state.byId[characterId];

      // autoEquip: true should be equipped and unlocked
      expect(character.equipment.find((e) => e.id === 'weapon-1')).toMatchObject({
        equipped: true,
        locked: false,
      });

      expect(character.equipment.find((e) => e.id === 'armor-1')).toMatchObject({
        equipped: true,
        locked: false,
      });

      // autoEquip: false should remain unchanged
      expect(character.equipment.find((e) => e.id === 'tool-1')).toMatchObject({
        equipped: false,
        locked: false,
      });

      // No autoEquip flag should remain unchanged
      expect(character.equipment.find((e) => e.id === 'consumable-1')).toMatchObject({
        equipped: false,
        locked: false,
        depleted: true,
      });
    });

    it('should update character updatedAt timestamp', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);
      const initialState = store.getState().characters;
      const initialUpdatedAt = initialState.byId[characterId].updatedAt;

      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      const finalState = store.getState().characters;
      const finalUpdatedAt = finalState.byId[characterId].updatedAt;

      expect(finalUpdatedAt).toBeGreaterThanOrEqual(initialUpdatedAt);
    });

    it('should add command to history with correct type', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      const state = store.getState().characters;
      const lastCommand = state.history[state.history.length - 1];

      expect(lastCommand.type).toBe('characters/autoEquipItems');
      expect(lastCommand.payload).toEqual({ characterId });
      expect(lastCommand.commandId).toBeDefined();
      expect(lastCommand.timestamp).toBeDefined();
      expect(lastCommand.version).toBe(1);
    });

    it('should throw error when character does not exist', () => {
      expect(() => {
        store.dispatch(
          autoEquipItems({
            characterId: 'nonexistent-char',
          })
        );
      }).toThrow('Character nonexistent-char not found');
    });

    it('should include userId in command history when provided', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      store.dispatch(
        autoEquipItems({
          characterId,
          userId: 'gm-user-456',
        })
      );

      const state = store.getState().characters;
      const lastCommand = state.history[state.history.length - 1];

      expect(lastCommand.userId).toBe('gm-user-456');
    });

    it('should be idempotent - can be called multiple times safely', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // First call
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      let state = store.getState().characters;
      let character = state.byId[characterId];
      const firstResult = character.equipment.find((e) => e.id === 'weapon-1');

      // Second call (idempotent)
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      state = store.getState().characters;
      character = state.byId[characterId];
      const secondResult = character.equipment.find((e) => e.id === 'weapon-1');

      // Results should be identical
      expect(firstResult).toEqual(secondResult);
      expect(secondResult?.equipped).toBe(true);
      expect(secondResult?.locked).toBe(false);
    });

    it('should not affect already-equipped items with autoEquip flag', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true, // Already equipped
          locked: true, // And locked
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Auto-equip (should ensure equipped and unlock)
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      const state = store.getState().characters;
      const character = state.byId[characterId];
      const weapon = character.equipment.find((e) => e.id === 'weapon-1');

      // Should remain equipped and be unlocked (fresh equip)
      expect(weapon?.equipped).toBe(true);
      expect(weapon?.locked).toBe(false);
    });
  });

  describe('Integration: markEquipmentUsed + autoEquipItems', () => {
    it('should complete equipment lifecycle: equip -> use (lock) -> reset (unlock + auto-equip)', () => {
      const equipment: Equipment[] = [
        {
          id: 'weapon-1',
          name: 'Bolter',
          tier: 'common',
          category: 'weapon',
          description: 'Standard weapon',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          autoEquip: true,
          acquiredAt: Date.now(),
        },
      ];

      const characterId = createTestCharacter(equipment);

      // Step 1: Initial state - equipped, unlocked, will auto-equip
      let state = store.getState().characters;
      let character = state.byId[characterId];
      let weapon = character.equipment.find((e) => e.id === 'weapon-1');
      expect(weapon).toMatchObject({
        equipped: true,
        locked: false,
        autoEquip: true,
      });

      // Step 2: Player uses equipment in action
      store.dispatch(
        markEquipmentUsed({
          characterId,
          equipmentId: 'weapon-1',
        })
      );

      state = store.getState().characters;
      character = state.byId[characterId];
      weapon = character.equipment.find((e) => e.id === 'weapon-1');
      expect(weapon).toMatchObject({
        equipped: true,
        locked: true, // Now locked
        autoEquip: true,
      });

      // Step 3: Momentum Reset happens (would be called by crew reducer)
      store.dispatch(
        autoEquipItems({
          characterId,
        })
      );

      state = store.getState().characters;
      character = state.byId[characterId];
      weapon = character.equipment.find((e) => e.id === 'weapon-1');
      expect(weapon).toMatchObject({
        equipped: true,
        locked: false, // Unlocked at reset
        autoEquip: true,
      });
    });
  });
});
