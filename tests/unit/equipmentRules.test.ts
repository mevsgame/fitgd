/**
 * Tests for Equipment Rules
 *
 * Covers first-lock cost calculation, equipment locking, and consumable management
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFirstLockCost,
  getEquipmentToLock,
  getConsumablesToDeplete,
  hasEquipmentCapacity,
  calculateTotalMomentumCost,
} from '../../src/utils/equipmentRules';
import type { Character, Equipment } from '../../src/types/character';

describe('Equipment Rules', () => {
  const createCharacter = (): Character => ({
    id: 'char-1',
    name: 'Test Character',
    traits: [],
    approaches: {
      force: 2,
      guile: 1,
      focus: 3,
      spirit: 1,
    },
    equipment: [],
    rallyAvailable: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const createEquipment = (overrides: Partial<Equipment> = {}): Equipment => ({
    id: 'equip-1',
    name: 'Test Equipment',
    category: 'active',
    tier: 'common',
    slots: 1,
    equipped: true,
    locked: false,
    consumed: false,
    modifiers: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  describe('calculateFirstLockCost', () => {
    it('should return 0 for common equipment', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'sword', tier: 'common', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, ['sword'], null);
      expect(cost).toBe(0);
    });

    it('should return 1 for one unlocked Rare item', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'rare-sword', tier: 'rare', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, ['rare-sword'], null);
      expect(cost).toBe(1);
    });

    it('should return 0 for locked Rare item', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'locked-sword', tier: 'rare', locked: true }),
      ];

      const cost = calculateFirstLockCost(character, ['locked-sword'], null);
      expect(cost).toBe(0);
    });

    it('should return 1 for one unlocked Epic item', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'epic-armor', tier: 'epic', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, ['epic-armor'], null);
      expect(cost).toBe(1);
    });

    it('should return 1 for unlocked Rare active + locked Rare passive', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'rare-sword', tier: 'rare', locked: false }),
        createEquipment({ id: 'rare-armor', tier: 'rare', locked: true }),
      ];

      const cost = calculateFirstLockCost(character, ['rare-sword'], 'rare-armor');
      expect(cost).toBe(1);
    });

    it('should return 2 for two unlocked Rare items', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'rare-sword', tier: 'rare', locked: false }),
        createEquipment({ id: 'rare-armor', tier: 'rare', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, ['rare-sword'], 'rare-armor');
      expect(cost).toBe(2);
    });

    it('should return 2 for unlocked Rare + unlocked Epic', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'rare-sword', tier: 'rare', locked: false }),
        createEquipment({ id: 'epic-armor', tier: 'epic', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, ['rare-sword'], 'epic-armor');
      expect(cost).toBe(2);
    });

    it('should handle missing equipment gracefully', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'sword-1', tier: 'rare', locked: false }),
      ];

      // Equipment IDs don't exist
      const cost = calculateFirstLockCost(character, ['missing-id'], 'missing-passive');
      expect(cost).toBe(0);
    });

    it('should handle empty equipment list', () => {
      const character = createCharacter();
      const cost = calculateFirstLockCost(character, [], null);
      expect(cost).toBe(0);
    });

    it('should handle undefined inputs', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'sword', tier: 'rare', locked: false }),
      ];

      const cost = calculateFirstLockCost(character, undefined, undefined);
      expect(cost).toBe(0);
    });
  });

  describe('getEquipmentToLock', () => {
    it('should return active equipment IDs', () => {
      const result = getEquipmentToLock(['sword-1', 'shield-1'], null);
      expect(result).toEqual(['sword-1', 'shield-1']);
    });

    it('should include approved passive', () => {
      const result = getEquipmentToLock(['sword-1'], 'armor-1');
      expect(result).toEqual(['sword-1', 'armor-1']);
    });

    it('should handle empty active equipment', () => {
      const result = getEquipmentToLock([], 'armor-1');
      expect(result).toEqual(['armor-1']);
    });

    it('should return empty array when nothing selected', () => {
      const result = getEquipmentToLock([], null);
      expect(result).toEqual([]);
    });

    it('should handle undefined inputs', () => {
      const result = getEquipmentToLock(undefined, undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getConsumablesToDeplete', () => {
    it('should return consumable IDs only', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'grenade', category: 'consumable', consumed: false }),
        createEquipment({ id: 'sword', category: 'active', consumed: false }),
      ];

      const result = getConsumablesToDeplete(character, ['grenade', 'sword']);
      expect(result).toEqual(['grenade']);
    });

    it('should skip already-consumed consumables', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'grenade-1', category: 'consumable', consumed: false }),
        createEquipment({ id: 'grenade-2', category: 'consumable', consumed: true }),
      ];

      const result = getConsumablesToDeplete(character, ['grenade-1', 'grenade-2']);
      expect(result).toEqual(['grenade-1']);
    });

    it('should handle empty active equipment', () => {
      const character = createCharacter();
      const result = getConsumablesToDeplete(character, []);
      expect(result).toEqual([]);
    });

    it('should handle undefined equipment list', () => {
      const character = createCharacter();
      const result = getConsumablesToDeplete(character, undefined);
      expect(result).toEqual([]);
    });
  });

  describe('hasEquipmentCapacity', () => {
    it('should return true when below capacity', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 2, equipped: true }),
      ];

      const result = hasEquipmentCapacity(character, 2); // 2 + 2 = 4, max 5
      expect(result).toBe(true);
    });

    it('should return true when at capacity', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 5, equipped: true }),
      ];

      const result = hasEquipmentCapacity(character, 0); // 5 + 0 = 5, max 5
      expect(result).toBe(true);
    });

    it('should return false when exceeding capacity', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 4, equipped: true }),
      ];

      const result = hasEquipmentCapacity(character, 2); // 4 + 2 = 6 > 5
      expect(result).toBe(false);
    });

    it('should ignore unequipped equipment', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 10, equipped: false }),
      ];

      const result = hasEquipmentCapacity(character, 2); // Only counts equipped = 0 + 2 = 2
      expect(result).toBe(true);
    });

    it('should ignore consumed equipment', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 10, equipped: true, consumed: true }),
      ];

      const result = hasEquipmentCapacity(character, 2); // Consumed not counted = 0 + 2 = 2
      expect(result).toBe(true);
    });

    it('should support custom max load', () => {
      const character = createCharacter();
      character.equipment = [
        createEquipment({ id: 'item-1', slots: 5, equipped: true }),
      ];

      const result = hasEquipmentCapacity(character, 1, 10); // 5 + 1 = 6 <= 10
      expect(result).toBe(true);
    });
  });

  describe('calculateTotalMomentumCost', () => {
    it('should sum trait and equipment costs', () => {
      const cost = calculateTotalMomentumCost(1, 2);
      expect(cost).toBe(3);
    });

    it('should handle zero costs', () => {
      const cost = calculateTotalMomentumCost(0, 0);
      expect(cost).toBe(0);
    });

    it('should handle trait-only cost', () => {
      const cost = calculateTotalMomentumCost(1, 0);
      expect(cost).toBe(1);
    });

    it('should handle equipment-only cost', () => {
      const cost = calculateTotalMomentumCost(0, 2);
      expect(cost).toBe(2);
    });
  });
});
