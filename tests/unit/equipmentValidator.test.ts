/**
 * Equipment Validator Tests
 *
 * TDD-first tests for equipment validation logic.
 * Covers load limits, locking, first-lock costs, and item validation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLoadUsed,
  canEquipItem,
  canUnequipItem,
  calculateFirstLockCost,
  validateEquipment,
} from '../../src/validators/equipmentValidator';
import type { Character } from '../../src/types/character';
import type { Equipment } from '../../src/types/equipment';

// Test fixtures
const createCharacter = (overrides?: Partial<Character>): Character => ({
  id: 'char-1',
  name: 'Test Character',
  traits: [],
  approaches: { force: 2, guile: 1, focus: 2, spirit: 0 },
  unallocatedApproachDots: 0,
  equipment: [],
  loadLimit: 5,
  rallyAvailable: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createEquipment = (overrides?: Partial<Equipment>): Equipment => ({
  id: 'item-1',
  name: 'Test Item',
  category: 'active',
  tier: 'common',
  slots: 1,
  description: 'A test item',
  equipped: true,
  locked: false,
  consumed: false,
  ...overrides,
});

describe('equipmentValidator', () => {
  describe('calculateLoadUsed', () => {
    it('should return 0 when no items are equipped', () => {
      const character = createCharacter({
        equipment: [
          createEquipment({ equipped: false, slots: 2 }),
          createEquipment({ equipped: false, slots: 1 }),
        ],
      });

      expect(calculateLoadUsed(character)).toBe(0);
    });

    it('should count slots of equipped items only', () => {
      const character = createCharacter({
        equipment: [
          createEquipment({ equipped: true, slots: 2 }),
          createEquipment({ equipped: false, slots: 3 }),
          createEquipment({ equipped: true, slots: 1 }),
        ],
      });

      expect(calculateLoadUsed(character)).toBe(3); // 2 + 1
    });

    it('should handle multiple equipped items with different slot sizes', () => {
      const character = createCharacter({
        equipment: [
          createEquipment({ slots: 2, equipped: true }),
          createEquipment({ slots: 1, equipped: true }),
          createEquipment({ slots: 3, equipped: true }),
        ],
      });

      expect(calculateLoadUsed(character)).toBe(6); // 2 + 1 + 3
    });

    it('should count locked items toward load', () => {
      const character = createCharacter({
        equipment: [
          createEquipment({ equipped: true, locked: true, slots: 2 }),
          createEquipment({ equipped: true, locked: false, slots: 1 }),
        ],
      });

      expect(calculateLoadUsed(character)).toBe(3);
    });

    it('should count consumed items toward load', () => {
      const character = createCharacter({
        equipment: [
          createEquipment({ equipped: true, consumed: true, slots: 1 }),
          createEquipment({ equipped: true, consumed: false, slots: 2 }),
        ],
      });

      expect(calculateLoadUsed(character)).toBe(3);
    });
  });

  describe('canEquipItem', () => {
    it('should allow equipping item when under load limit', () => {
      const character = createCharacter({
        loadLimit: 5,
        equipment: [
          createEquipment({ equipped: true, slots: 2 }),
          createEquipment({ equipped: true, slots: 2 }),
        ],
      });

      const item = createEquipment({ slots: 1 });

      expect(canEquipItem(character, item)).toBe(true); // 2 + 2 + 1 = 5
    });

    it('should prevent equipping item when it would exceed load', () => {
      const character = createCharacter({
        loadLimit: 5,
        equipment: [
          createEquipment({ equipped: true, slots: 3 }),
          createEquipment({ equipped: true, slots: 2 }),
        ],
      });

      const item = createEquipment({ slots: 1 });

      expect(canEquipItem(character, item)).toBe(false); // 3 + 2 + 1 > 5
    });

    it('should allow equipping when exactly at limit', () => {
      const character = createCharacter({
        loadLimit: 5,
        equipment: [createEquipment({ equipped: true, slots: 5 })],
      });

      const item = createEquipment({ slots: 0 }); // Edge case: 0-slot item

      expect(canEquipItem(character, item)).toBe(true); // 5 + 0 = 5
    });

    it('should not count unequipped items toward load', () => {
      const character = createCharacter({
        loadLimit: 5,
        equipment: [
          createEquipment({ equipped: false, slots: 10 }),
          createEquipment({ equipped: true, slots: 3 }),
        ],
      });

      const item = createEquipment({ slots: 2 });

      expect(canEquipItem(character, item)).toBe(true); // 3 + 2 = 5
    });
  });

  describe('canUnequipItem', () => {
    it('should allow unequipping unlocked items', () => {
      const item = createEquipment({ locked: false });

      expect(canUnequipItem(item)).toBe(true);
    });

    it('should prevent unequipping locked items', () => {
      const item = createEquipment({ locked: true });

      expect(canUnequipItem(item)).toBe(false);
    });

    it('should allow unequipping locked items with consumed flag', () => {
      // consumed flag does not prevent unequipping, only locked does
      const item = createEquipment({ locked: false, consumed: true });

      expect(canUnequipItem(item)).toBe(true);
    });
  });

  describe('calculateFirstLockCost', () => {
    it('should return 0 for common items', () => {
      const items = [
        createEquipment({ tier: 'common', locked: false }),
      ];

      expect(calculateFirstLockCost(items)).toBe(0);
    });

    it('should return 1 for unlocked rare item', () => {
      const items = [
        createEquipment({ tier: 'rare', locked: false }),
      ];

      expect(calculateFirstLockCost(items)).toBe(1);
    });

    it('should return 1 for unlocked epic item', () => {
      const items = [
        createEquipment({ tier: 'epic', locked: false }),
      ];

      expect(calculateFirstLockCost(items)).toBe(1);
    });

    it('should return 0 for already-locked rare item', () => {
      const items = [
        createEquipment({ tier: 'rare', locked: true }),
      ];

      expect(calculateFirstLockCost(items)).toBe(0);
    });

    it('should sum costs for multiple unlocked rare/epic items', () => {
      const items = [
        createEquipment({ tier: 'rare', locked: false }),
        createEquipment({ tier: 'rare', locked: false }),
        createEquipment({ tier: 'epic', locked: false }),
      ];

      expect(calculateFirstLockCost(items)).toBe(3); // 1 + 1 + 1
    });

    it('should ignore common items in cost calculation', () => {
      const items = [
        createEquipment({ tier: 'common', locked: false }),
        createEquipment({ tier: 'rare', locked: false }),
        createEquipment({ tier: 'common', locked: false }),
      ];

      expect(calculateFirstLockCost(items)).toBe(1); // Only rare counts
    });

    it('should count only unlocked rare/epic items', () => {
      const items = [
        createEquipment({ tier: 'rare', locked: false }),
        createEquipment({ tier: 'rare', locked: true }),
        createEquipment({ tier: 'epic', locked: false }),
        createEquipment({ tier: 'epic', locked: true }),
      ];

      expect(calculateFirstLockCost(items)).toBe(2); // rare (unlocked) + epic (unlocked)
    });

    it('should handle empty array', () => {
      expect(calculateFirstLockCost([])).toBe(0);
    });
  });

  describe('validateEquipment', () => {
    it('should validate correct equipment', () => {
      const item = createEquipment();

      expect(validateEquipment(item)).toBe(true);
    });

    it('should reject equipment missing id', () => {
      const item = createEquipment({ id: '' });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment missing name', () => {
      const item = createEquipment({ name: '' });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment missing category', () => {
      const item = createEquipment({
        category: undefined as any,
      });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment with 0 slots', () => {
      const item = createEquipment({ slots: 0 });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment with negative slots', () => {
      const item = createEquipment({ slots: -1 });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment missing description', () => {
      const item = createEquipment({ description: undefined as any });

      expect(validateEquipment(item)).toBe(false);
    });

    it('should reject equipment without state flags', () => {
      const item = createEquipment({ equipped: undefined as any });

      expect(validateEquipment(item)).toBe(false);
    });
  });
});
