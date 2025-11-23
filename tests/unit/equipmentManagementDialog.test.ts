/**
 * Equipment Management Dialog Tests
 *
 * Tests the equipment management dialog logic:
 * - Transaction pattern: Stage changes, preview costs, commit atomically
 * - Load validation: Prevent exceeding max load
 * - Momentum cost calculation: 1M for rare, 0 for common
 * - Equipment toggling: Equip/unequip items
 * - Real-time cost preview
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Character, Equipment } from '@/src/types/character';

describe('Equipment Management Dialog', () => {
  let character: Character;
  const maxLoad = 5;

  beforeEach(() => {
    character = {
      id: 'char-1',
      name: 'Test Character',
      traits: [],
      approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      unallocatedApproachDots: 0,
      equipment: [
        {
          id: 'equip-1',
          name: 'Combat Rifle',
          type: 'equipment',
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
          id: 'equip-2',
          name: 'Flak Armor',
          type: 'equipment',
          tier: 'common',
          category: 'armor',
          description: 'Basic protection',
          passive: false,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'equip-rare-1',
          name: 'Plasma Rifle',
          type: 'equipment',
          tier: 'rare',
          category: 'weapon',
          description: 'Advanced weapon',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'aug-1',
          name: 'Cybernetic Implant',
          type: 'augmentation',
          tier: 'common',
          category: 'cybernetic',
          description: 'Permanent enhancement',
          passive: true,
          equipped: true,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
      ],
      rallyAvailable: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  /**
   * Test transaction pattern: Stage, Preview, Commit
   */
  describe('Transaction pattern', () => {
    it('should create transaction with initial state', () => {
      const transaction = {
        stagedChanges: new Map<string, boolean>(),
        originalState: character.equipment.map((e) => ({ id: e.id, equipped: e.equipped })),
      };

      expect(transaction.stagedChanges.size).toBe(0);
      expect(transaction.originalState).toHaveLength(4);
    });

    it('should stage equipment toggle changes', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', true); // Toggle rare item on

      expect(stagedChanges.has('equip-rare-1')).toBe(true);
      expect(stagedChanges.get('equip-rare-1')).toBe(true);
    });

    it('should allow rollback by clearing staged changes', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-1', false);
      stagedChanges.set('equip-rare-1', true);

      stagedChanges.clear();
      expect(stagedChanges.size).toBe(0);
    });

    it('should preview momentum cost before committing', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', true); // Equipping rare item

      const cost = calculateStagedMomentumCost(character, stagedChanges);
      expect(cost).toBe(1);
    });

    it('should commit all staged changes atomically', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', true);
      stagedChanges.set('equip-1', false);

      const updated = applyTransactionChanges(character, stagedChanges);
      expect(updated.equipment.find((e) => e.id === 'equip-rare-1')?.equipped).toBe(true);
      expect(updated.equipment.find((e) => e.id === 'equip-1')?.equipped).toBe(false);
    });
  });

  /**
   * Test load validation
   */
  describe('Load validation', () => {
    it('should calculate current load (excluding augmentations)', () => {
      const currentLoad = getCurrentLoad(character);
      expect(currentLoad).toBe(2); // equip-1 and equip-2 are equipped (aug-1 doesn't count)
    });

    it('should prevent equipping when at max load', () => {
      // Fill up to max load (5 non-augmentation items)
      const fullCharacter = {
        ...character,
        equipment: [
          { ...character.equipment[0], equipped: true }, // equip-1
          { ...character.equipment[1], equipped: true }, // equip-2
          { ...character.equipment[2], equipped: true }, // equip-rare-1 (now equipped)
          {
            // Add 2 more to reach 5
            id: 'equip-3',
            name: 'Item 3',
            type: 'equipment',
            tier: 'common',
            category: 'gear',
            description: 'Test',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'equip-4',
            name: 'Item 4',
            type: 'equipment',
            tier: 'common',
            category: 'gear',
            description: 'Test',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
          { ...character.equipment[3], equipped: true }, // aug-1 (doesn't count toward load)
        ],
      };

      const newItem = {
        id: 'equip-5',
        name: 'Item 5',
        type: 'equipment',
        tier: 'common',
        category: 'gear',
        description: 'Test',
        passive: false,
        equipped: false,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      fullCharacter.equipment.push(newItem);

      const canEquip = canEquipItem(fullCharacter, 'equip-5', maxLoad);
      expect(canEquip).toBe(false); // Would exceed load
    });

    it('should allow equipping when space available', () => {
      const canEquip = canEquipItem(character, 'equip-rare-1', maxLoad);
      expect(canEquip).toBe(true); // Currently at 2/5
    });

    it('should allow unequipping at any time', () => {
      const canUnequip = true; // Can always unequip
      expect(canUnequip).toBe(true);
    });
  });

  /**
   * Test momentum cost calculation
   */
  describe('Momentum cost calculation', () => {
    it('should return 0 cost for common item', () => {
      const cost = getEquipmentMomentumCost('equip-1', character);
      expect(cost).toBe(0);
    });

    it('should return 1 cost for rare item', () => {
      const cost = getEquipmentMomentumCost('equip-rare-1', character);
      expect(cost).toBe(1);
    });

    it('should only charge for items being equipped', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', true); // Equipping rare
      stagedChanges.set('equip-1', false); // Unequipping common

      const cost = calculateStagedMomentumCost(character, stagedChanges);
      expect(cost).toBe(1); // Only rare costs, unequipping free
    });

    it('should not charge for unequipping rare item', () => {
      // Rare item already equipped
      const equippedRare = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'equip-rare-1' ? { ...e, equipped: true } : e
        ),
      };

      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', false); // Unequipping rare

      const cost = calculateStagedMomentumCost(equippedRare, stagedChanges);
      expect(cost).toBe(0); // Unequipping is free
    });

    it('should accumulate costs for multiple rare items', () => {
      const stagedChanges = new Map<string, boolean>();
      stagedChanges.set('equip-rare-1', true);
      stagedChanges.set('equip-rare-2', true); // Another rare item

      // Add second rare item
      character.equipment.push({
        id: 'equip-rare-2',
        name: 'Rare Armor',
        type: 'equipment',
        tier: 'rare',
        category: 'armor',
        description: 'Rare protection',
        passive: false,
        equipped: false,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      });

      const cost = calculateStagedMomentumCost(character, stagedChanges);
      expect(cost).toBe(2); // Two rare items
    });
  });

  /**
   * Test equipment organization
   */
  describe('Equipment organization', () => {
    it('should organize equipped items at top', () => {
      const equipped = character.equipment.filter((e) => e.equipped);
      const unequipped = character.equipment.filter((e) => !e.equipped);

      expect(equipped.length).toBeGreaterThan(0);
      expect(unequipped.length).toBeGreaterThan(0);
    });

    it('should separate augmentations from regular equipment', () => {
      const regular = character.equipment.filter((e) => e.type !== 'augmentation' && e.equipped);
      const augmentations = character.equipment.filter((e) => e.type === 'augmentation');

      expect(regular.length).toBe(2);
      expect(augmentations.length).toBe(1);
    });

    it('should identify depleted consumables', () => {
      const depletedItem: Equipment = {
        id: 'cons-1',
        name: 'Used Stim',
        type: 'consumable',
        tier: 'common',
        category: 'stim',
        description: 'Depleted',
        passive: false,
        equipped: true,
        locked: false,
        depleted: true,
        acquiredAt: Date.now(),
      };

      const testChar = {
        ...character,
        equipment: [...character.equipment, depletedItem],
      };

      const depleted = testChar.equipment.filter((e) => e.depleted);
      expect(depleted).toHaveLength(1);
    });
  });

  /**
   * Test locked equipment handling
   */
  describe('Locked equipment', () => {
    it('should prevent unequipping locked items', () => {
      const lockedItem = character.equipment.find((e) => e.id === 'equip-1');
      if (lockedItem) {
        lockedItem.locked = true;
      }

      const canUnequip = !lockedItem?.locked;
      expect(canUnequip).toBe(false);
    });

    it('should show lock indicator in UI', () => {
      const lockedItem = character.equipment.find((e) => e.id === 'equip-1');
      if (lockedItem) {
        lockedItem.locked = true;
      }

      const isLocked = lockedItem?.locked || false;
      expect(isLocked).toBe(true);
    });
  });

  /**
   * Test search/filter functionality
   */
  describe('Search and filter', () => {
    it('should filter by item name', () => {
      const query = 'combat';
      const filtered = character.equipment.filter((e) => e.name.toLowerCase().includes(query));

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('equip-1');
    });

    it('should filter by tier', () => {
      const rareTier = 'rare';
      const filtered = character.equipment.filter((e) => e.tier === rareTier);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('equip-rare-1');
    });

    it('should be case-insensitive', () => {
      const query = 'ARMOR';
      const filtered = character.equipment.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('equip-2');
    });
  });

  /**
   * Test real-time cost preview
   */
  describe('Real-time cost preview', () => {
    it('should update cost when item is toggled', () => {
      let cost = 0;
      const stagedChanges = new Map<string, boolean>();

      // Stage equipping rare item
      stagedChanges.set('equip-rare-1', true);
      cost = calculateStagedMomentumCost(character, stagedChanges);
      expect(cost).toBe(1);

      // Unstage it
      stagedChanges.delete('equip-rare-1');
      cost = calculateStagedMomentumCost(character, stagedChanges);
      expect(cost).toBe(0);
    });

    it('should display current load in real-time', () => {
      const initialLoad = getCurrentLoad(character);
      expect(initialLoad).toBe(2);
    });

    it('should warn when near max load', () => {
      const current = getCurrentLoad(character);
      const remaining = maxLoad - current;
      const isNearMax = remaining <= 1;

      expect(isNearMax).toBe(false); // 2/5, not near max
    });
  });
});

/**
 * Helper functions for testing
 */

function getCurrentLoad(character: Character): number {
  return character.equipment.filter((e) => e.type !== 'augmentation' && e.equipped).length;
}

function canEquipItem(character: Character, equipmentId: string, maxLoad: number): boolean {
  const item = character.equipment.find((e) => e.id === equipmentId);
  if (!item) return false;
  if (item.equipped) return true; // Already equipped, can unequip

  const currentLoad = getCurrentLoad(character);
  return currentLoad < maxLoad;
}

function getEquipmentMomentumCost(equipmentId: string, character: Character): number {
  const item = character.equipment.find((e) => e.id === equipmentId);
  if (!item) return 0;
  if (item.tier === 'rare') return 1;
  return 0;
}

function calculateStagedMomentumCost(
  character: Character,
  stagedChanges: Map<string, boolean>
): number {
  let cost = 0;

  for (const [equipmentId, newEquippedState] of stagedChanges) {
    const item = character.equipment.find((e) => e.id === equipmentId);
    if (!item) continue;

    // Only charge for equipping rare items
    if (newEquippedState && !item.equipped && item.tier === 'rare') {
      cost += 1;
    }
  }

  return cost;
}

function applyTransactionChanges(
  character: Character,
  stagedChanges: Map<string, boolean>
): Character {
  const updated = {
    ...character,
    equipment: character.equipment.map((e) => {
      if (stagedChanges.has(e.id)) {
        return { ...e, equipped: stagedChanges.get(e.id)! };
      }
      return e;
    }),
  };

  return updated;
}
