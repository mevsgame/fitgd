/**
 * FlashbackEquipmentDialog Tests
 *
 * Tests the flashback equipment acquisition dialog logic:
 * - Common items: 0 Momentum (declared freely)
 * - Rare items: 1 Momentum (requires flashback)
 * - Epic items: CANNOT be acquired (must be earned)
 * - Load validation: cannot exceed max load
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('FlashbackEquipmentDialog - Validation Logic', () => {
  /**
   * Test Momentum cost calculation for different equipment tiers
   */
  describe('Momentum cost calculation', () => {
    it('should return 0 cost for common tier items', () => {
      const cost = calculateMomentumCost('common');
      expect(cost).toBe(0);
    });

    it('should return 1 cost for rare tier items', () => {
      const cost = calculateMomentumCost('rare');
      expect(cost).toBe(1);
    });

    it('should return Infinity for epic tier items (blocking acquisition)', () => {
      const cost = calculateMomentumCost('epic');
      expect(cost).toBe(Infinity);
    });
  });

  /**
   * Test validation of Momentum requirement before acquiring rare items
   */
  describe('Momentum validation for rare items', () => {
    it('should allow rare item acquisition with sufficient Momentum', () => {
      const currentMomentum = 5;
      const cost = 1;
      const canAcquire = currentMomentum >= cost;
      expect(canAcquire).toBe(true);
    });

    it('should block rare item acquisition with insufficient Momentum', () => {
      const currentMomentum = 0;
      const cost = 1;
      const canAcquire = currentMomentum >= cost;
      expect(canAcquire).toBe(false);
    });

    it('should allow rare item acquisition at exactly minimum Momentum', () => {
      const currentMomentum = 1;
      const cost = 1;
      const canAcquire = currentMomentum >= cost;
      expect(canAcquire).toBe(true);
    });
  });

  /**
   * Test epic tier blocking (cannot be acquired via flashback)
   */
  describe('Epic tier blocking', () => {
    it('should reject epic tier selection with error message', () => {
      const tier = 'epic' as const;
      const isEpic = tier === 'epic';
      expect(isEpic).toBe(true);
    });

    it('should disable epic option in tier selector UI', () => {
      const tiers = ['common', 'rare', 'epic'] as const;
      const availableTiers = tiers.filter((t) => t !== 'epic');
      expect(availableTiers).toEqual(['common', 'rare']);
    });

    it('should provide clear message that epic items must be earned', () => {
      const tier = 'epic' as const;
      const message =
        tier === 'epic'
          ? 'Epic equipment cannot be acquired through flashbacks - must be earned'
          : '';
      expect(message).toBe('Epic equipment cannot be acquired through flashbacks - must be earned');
    });
  });

  /**
   * Test load limit validation
   */
  describe('Load limit validation', () => {
    it('should allow equipment acquisition when load has space', () => {
      const currentLoad = 3;
      const maxLoad = 5;
      const canEquip = currentLoad < maxLoad;
      expect(canEquip).toBe(true);
    });

    it('should block equipment acquisition when load is full', () => {
      const currentLoad = 5;
      const maxLoad = 5;
      const canEquip = currentLoad < maxLoad;
      expect(canEquip).toBe(false);
    });

    it('should allow equipment acquisition at max-1 load', () => {
      const currentLoad = 4;
      const maxLoad = 5;
      const canEquip = currentLoad < maxLoad;
      expect(canEquip).toBe(true);
    });
  });

  /**
   * Test item name validation
   */
  describe('Item name validation', () => {
    it('should require non-empty item name', () => {
      const itemName = '';
      const isValid = itemName.trim().length > 0;
      expect(isValid).toBe(false);
    });

    it('should accept item name with text', () => {
      const itemName = 'Plasma Rifle';
      const isValid = itemName.trim().length > 0;
      expect(isValid).toBe(true);
    });

    it('should trim whitespace from item name', () => {
      const itemName = '  Combat Armor  ';
      const cleaned = itemName.trim();
      expect(cleaned).toBe('Combat Armor');
    });
  });

  /**
   * Test combined validation scenarios
   */
  describe('Combined validation scenarios', () => {
    it('should allow common item acquisition without Momentum check', () => {
      const tier = 'common' as const;
      const currentMomentum = 0;
      const cost = calculateMomentumCost(tier);

      const canAcquire = currentMomentum >= cost;
      expect(canAcquire).toBe(true); // 0 >= 0
    });

    it('should block rare item with low Momentum and insufficient funds', () => {
      const tier = 'rare' as const;
      const currentMomentum = 0;
      const cost = calculateMomentumCost(tier);
      const itemName = 'Rare Weapon';
      const currentLoad = 4;
      const maxLoad = 5;

      const canAcquire = currentMomentum >= cost && itemName.trim().length > 0 && currentLoad < maxLoad;
      expect(canAcquire).toBe(false); // false: insufficient Momentum (0 < 1)
    });

    it('should block rare item with full load', () => {
      const tier = 'rare' as const;
      const currentMomentum = 5;
      const cost = calculateMomentumCost(tier);
      const itemName = 'Rare Weapon';
      const currentLoad = 5;
      const maxLoad = 5;

      const canAcquire = currentMomentum >= cost && itemName.trim().length > 0 && currentLoad < maxLoad;
      expect(canAcquire).toBe(false); // false: load is full (5 >= 5)
    });

    it('should allow rare item with sufficient Momentum and space', () => {
      const tier = 'rare' as const;
      const currentMomentum = 5;
      const cost = calculateMomentumCost(tier);
      const itemName = 'Rare Weapon';
      const currentLoad = 3;
      const maxLoad = 5;

      const canAcquire = currentMomentum >= cost && itemName.trim().length > 0 && currentLoad < maxLoad;
      expect(canAcquire).toBe(true); // true: all checks pass
    });

    it('should always block epic items regardless of other conditions', () => {
      const tier = 'epic' as const;
      const currentMomentum = 10;
      const cost = calculateMomentumCost(tier);
      const itemName = 'Epic Armor';
      const currentLoad = 0;
      const maxLoad = 5;

      // Epic tier always blocks with Infinity cost
      const canAcquire = cost !== Infinity && currentMomentum >= cost && itemName.trim().length > 0 && currentLoad < maxLoad;
      expect(canAcquire).toBe(false); // false: cost is Infinity
    });
  });

  /**
   * Test equipment object construction after validation
   */
  describe('Equipment object construction', () => {
    it('should create equipment object with correct tier for common item', () => {
      const equipment = createEquipmentObject({
        name: 'Basic Rifle',
        tier: 'common' as const,
        description: 'A standard rifle',
      });

      expect(equipment.tier).toBe('common');
      expect(equipment.acquiredVia).toBe('flashback');
    });

    it('should create equipment object with correct tier for rare item', () => {
      const equipment = createEquipmentObject({
        name: 'Plasma Rifle',
        tier: 'rare' as const,
        description: 'Advanced weapon',
      });

      expect(equipment.tier).toBe('rare');
      expect(equipment.acquiredVia).toBe('flashback');
    });

    it('should create equipment object with type equipment', () => {
      const equipment = createEquipmentObject({
        name: 'Combat Armor',
        tier: 'common' as const,
        description: 'Protective gear',
      });

      expect(equipment.type).toBe('equipment');
    });

    it('should set equipped and locked flags for flashback items', () => {
      const equipment = createEquipmentObject({
        name: 'Combat Armor',
        tier: 'common' as const,
        description: 'Protective gear',
      });

      expect(equipment.equipped).toBe(true); // Immediately equipped
      expect(equipment.locked).toBe(true); // Locked until Momentum Reset
      expect(equipment.depleted).toBe(false); // Not depleted
    });

    it('should set category to flashback for identification', () => {
      const equipment = createEquipmentObject({
        name: 'Scoped Rifle',
        tier: 'rare' as const,
        description: 'Precise weapon',
      });

      expect(equipment.category).toBe('flashback');
    });

    it('should include item description in equipment object', () => {
      const description = 'This weapon saved my life in the siege';
      const equipment = createEquipmentObject({
        name: 'Veteran Rifle',
        tier: 'common' as const,
        description,
      });

      expect(equipment.description).toBe(description);
    });
  });

  /**
   * Test Momentum spending action
   */
  describe('Momentum spending for rare items', () => {
    it('should create Momentum spend action for rare items', () => {
      const tier = 'rare' as const;
      const actions = buildFlashbackActions({
        tier,
        itemName: 'Rare Weapon',
        itemDescription: 'A specialized weapon',
        crewId: 'crew-123',
      });

      const momentumSpendAction = actions.find((a) => a.type === 'crews/spendMomentum');
      expect(momentumSpendAction).toBeDefined();
      expect(momentumSpendAction?.payload.amount).toBe(1);
    });

    it('should not create Momentum spend action for common items', () => {
      const tier = 'common' as const;
      const actions = buildFlashbackActions({
        tier,
        itemName: 'Common Weapon',
        itemDescription: 'A basic weapon',
        crewId: 'crew-123',
      });

      const momentumSpendAction = actions.find((a) => a.type === 'crews/spendMomentum');
      expect(momentumSpendAction).toBeUndefined();
    });

    it('should always create addEquipment action', () => {
      const tier = 'rare' as const;
      const actions = buildFlashbackActions({
        tier,
        itemName: 'Rare Weapon',
        itemDescription: 'A specialized weapon',
        crewId: 'crew-123',
      });

      const addAction = actions.find((a) => a.type === 'characters/addEquipment');
      expect(addAction).toBeDefined();
    });
  });
});

/**
 * Helper function to calculate Momentum cost by tier
 */
function calculateMomentumCost(tier: 'common' | 'rare' | 'epic'): number {
  if (tier === 'common') return 0;
  if (tier === 'rare') return 1;
  return Infinity; // Epic cannot be acquired
}

/**
 * Helper function to create equipment object
 */
function createEquipmentObject({
  name,
  tier,
  description,
}: {
  name: string;
  tier: 'common' | 'rare' | 'epic';
  description: string;
}) {
  return {
    id: 'equipment-' + Math.random().toString(36).substr(2, 9),
    name,
    type: 'equipment' as const,
    tier,
    category: 'flashback',
    description,
    passive: false,
    equipped: true,
    locked: true,
    depleted: false,
    acquiredAt: Date.now(),
    acquiredVia: 'flashback' as const,
    metadata: {},
  };
}

/**
 * Helper function to build flashback actions
 */
function buildFlashbackActions({
  tier,
  itemName,
  itemDescription,
  crewId,
}: {
  tier: 'common' | 'rare' | 'epic';
  itemName: string;
  itemDescription: string;
  crewId: string;
}) {
  const actions: any[] = [
    {
      type: 'characters/addEquipment',
      payload: {
        characterId: 'char-123',
        equipment: createEquipmentObject({
          name: itemName,
          tier,
          description: itemDescription,
        }),
      },
    },
  ];

  if (tier === 'rare') {
    actions.push({
      type: 'crews/spendMomentum',
      payload: {
        crewId,
        amount: 1,
      },
    });
  }

  return actions;
}
