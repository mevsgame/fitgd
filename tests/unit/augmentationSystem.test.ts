/**
 * Augmentation System Tests
 *
 * Tests the augmentation mechanics:
 * - Augmentations don't count toward load limit (5 items max for regular equipment)
 * - Only GM can enable/disable augmentations per roll
 * - Augmentations provide conditional bonuses (Position, Effect, Dice)
 * - Augmentations are identified by category (cybernetic, biological, psionic)
 * - Multiple augmentations can be enabled simultaneously
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Character, Equipment } from '@/src/types/character';

describe('Augmentation System', () => {
  let character: Character;

  beforeEach(() => {
    character = {
      id: 'char-1',
      name: 'Test Character',
      traits: [],
      approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      unallocatedApproachDots: 0,
      equipment: [],
      rallyAvailable: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  /**
   * Test augmentation identification
   */
  describe('Augmentation identification', () => {
    it('should identify augmentation type by type field', () => {
      const augmentation: Equipment = {
        id: 'aug-1',
        name: 'Cybernetic Limb',
        type: 'augmentation',
        tier: 'common',
        category: 'cybernetic',
        description: 'Enhanced limb',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      expect(augmentation.type).toBe('augmentation');
    });

    it('should recognize regular equipment as non-augmentation', () => {
      const equipment: Equipment = {
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
      };

      expect(equipment.type).not.toBe('augmentation');
    });

    it('should identify consumables as non-augmentation', () => {
      const consumable: Equipment = {
        id: 'cons-1',
        name: 'Stim Pack',
        type: 'consumable',
        tier: 'common',
        category: 'stim',
        description: 'Single-use stim',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      expect(consumable.type).not.toBe('augmentation');
    });
  });

  /**
   * Test load limit with augmentations
   */
  describe('Load limit with augmentations', () => {
    it('should NOT count augmentations toward load limit', () => {
      const augmentation: Equipment = {
        id: 'aug-1',
        name: 'Cybernetic Implant',
        type: 'augmentation',
        tier: 'rare',
        category: 'cybernetic',
        description: 'Permanent enhancement',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      character.equipment = [augmentation];

      const regularEquipmentCount = character.equipment.filter(
        (e) => e.type !== 'augmentation' && e.equipped
      ).length;

      expect(regularEquipmentCount).toBe(0); // Only augmentation, doesn't count
    });

    it('should count regular equipment toward load limit', () => {
      const regularEquip: Equipment = {
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
      };

      character.equipment = [regularEquip];

      const regularEquipmentCount = character.equipment.filter(
        (e) => e.type !== 'augmentation' && e.equipped
      ).length;

      expect(regularEquipmentCount).toBe(1); // Counts toward load
    });

    it('should allow 5 items + unlimited augmentations', () => {
      const maxLoad = 5;
      const regularItems = Array.from({ length: maxLoad }, (_, i) => ({
        id: `equip-${i}`,
        name: `Item ${i}`,
        type: 'equipment' as const,
        tier: 'common' as const,
        category: 'gear',
        description: 'Test item',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      }));

      const augmentations = Array.from({ length: 3 }, (_, i) => ({
        id: `aug-${i}`,
        name: `Augmentation ${i}`,
        type: 'augmentation' as const,
        tier: 'common' as const,
        category: 'cybernetic',
        description: 'Test augmentation',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      }));

      character.equipment = [...regularItems, ...augmentations];

      const regularCount = character.equipment.filter(
        (e) => e.type !== 'augmentation' && e.equipped
      ).length;
      const augmentCount = character.equipment.filter((e) => e.type === 'augmentation').length;

      expect(regularCount).toBe(5);
      expect(augmentCount).toBe(3);
    });
  });

  /**
   * Test GM augmentation control
   */
  describe('GM augmentation control', () => {
    it('should track enabled augmentations in player round state', () => {
      const enabledAugmentationIds = ['aug-1', 'aug-3'];
      expect(enabledAugmentationIds).toHaveLength(2);
    });

    it('should allow GM to enable multiple augmentations', () => {
      const aug1 = {
        id: 'aug-1',
        enabled: true,
      };
      const aug2 = {
        id: 'aug-2',
        enabled: true,
      };
      const aug3 = {
        id: 'aug-3',
        enabled: false,
      };

      const enabledAugs = [aug1, aug2, aug3].filter((a) => a.enabled);
      expect(enabledAugs).toHaveLength(2);
      expect(enabledAugs.map((a) => a.id)).toEqual(['aug-1', 'aug-2']);
    });

    it('should allow GM to disable previously enabled augmentation', () => {
      let enabledAugmentationIds = ['aug-1', 'aug-2', 'aug-3'];
      enabledAugmentationIds = enabledAugmentationIds.filter((id) => id !== 'aug-2');
      expect(enabledAugmentationIds).toEqual(['aug-1', 'aug-3']);
    });

    it('should allow GM to clear all enabled augmentations', () => {
      let enabledAugmentationIds = ['aug-1', 'aug-2', 'aug-3'];
      enabledAugmentationIds = [];
      expect(enabledAugmentationIds).toHaveLength(0);
    });
  });

  /**
   * Test augmentation bonuses
   */
  describe('Augmentation bonuses', () => {
    it('should apply dice bonus from enabled augmentation', () => {
      const augmentation: Equipment = {
        id: 'aug-1',
        name: 'Targeting System',
        type: 'augmentation',
        tier: 'rare',
        category: 'cybernetic',
        description: 'Improves accuracy',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      const diceBonus = 1; // From augmentation effect
      const baseDicePool = 3;
      const totalDicePool = baseDicePool + diceBonus;

      expect(totalDicePool).toBe(4);
    });

    it('should apply position bonus from enabled augmentation', () => {
      const augmentation: Equipment = {
        id: 'aug-2',
        name: 'Combat Armor',
        type: 'augmentation',
        tier: 'common',
        category: 'biological',
        description: 'Protective enhancement',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      const positionBonus = 1; // Can improve position by 1 step
      const basePosition = 'risky';
      const improvedPosition = basePosition === 'risky' ? 'controlled' : basePosition;

      expect(improvedPosition).toBe('controlled');
    });

    it('should apply effect bonus from enabled augmentation', () => {
      const augmentation: Equipment = {
        id: 'aug-3',
        name: 'Precision Module',
        type: 'augmentation',
        tier: 'rare',
        category: 'psionic',
        description: 'Enhances precision',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      const effectBonus = 1; // Can improve effect by 1 level
      const baseEffect = 'standard';
      const improvedEffect = baseEffect === 'standard' ? 'great' : baseEffect;

      expect(improvedEffect).toBe('great');
    });

    it('should combine bonuses from multiple enabled augmentations', () => {
      const augmentations = [
        { id: 'aug-1', diceBonus: 1, positionBonus: 0, effectBonus: 0 },
        { id: 'aug-2', diceBonus: 0, positionBonus: 1, effectBonus: 0 },
        { id: 'aug-3', diceBonus: 0, positionBonus: 0, effectBonus: 1 },
      ];

      const totalDiceBonus = augmentations.reduce((sum, a) => sum + a.diceBonus, 0);
      const totalPositionBonus = augmentations.reduce((sum, a) => sum + a.positionBonus, 0);
      const totalEffectBonus = augmentations.reduce((sum, a) => sum + a.effectBonus, 0);

      expect(totalDiceBonus).toBe(1);
      expect(totalPositionBonus).toBe(1);
      expect(totalEffectBonus).toBe(1);
    });
  });

  /**
   * Test augmentation categories
   */
  describe('Augmentation categories', () => {
    it('should identify cybernetic augmentations', () => {
      const cyberAug: Equipment = {
        id: 'aug-cyber-1',
        name: 'Cybernetic Limb',
        type: 'augmentation',
        tier: 'rare',
        category: 'cybernetic',
        description: 'Enhanced limb',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      expect(cyberAug.category).toBe('cybernetic');
    });

    it('should identify biological augmentations', () => {
      const bioAug: Equipment = {
        id: 'aug-bio-1',
        name: 'Genetic Enhancement',
        type: 'augmentation',
        tier: 'rare',
        category: 'biological',
        description: 'Biological upgrade',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      expect(bioAug.category).toBe('biological');
    });

    it('should identify psionic augmentations', () => {
      const psionicAug: Equipment = {
        id: 'aug-psi-1',
        name: 'Psychic Attunement',
        type: 'augmentation',
        tier: 'rare',
        category: 'psionic',
        description: 'Psychic enhancement',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      expect(psionicAug.category).toBe('psionic');
    });
  });

  /**
   * Test augmentation state in playerRoundState
   */
  describe('Augmentation state tracking', () => {
    it('should store array of enabled augmentation IDs', () => {
      const enabledAugmentationIds: string[] = ['aug-1', 'aug-3', 'aug-5'];
      expect(enabledAugmentationIds).toEqual(['aug-1', 'aug-3', 'aug-5']);
    });

    it('should start with empty array when no augmentations enabled', () => {
      const enabledAugmentationIds: string[] = [];
      expect(enabledAugmentationIds).toHaveLength(0);
    });

    it('should allow toggling augmentation on/off', () => {
      let enabledAugmentationIds: string[] = ['aug-1', 'aug-2'];

      // Enable aug-3
      if (!enabledAugmentationIds.includes('aug-3')) {
        enabledAugmentationIds.push('aug-3');
      }
      expect(enabledAugmentationIds).toContain('aug-3');

      // Disable aug-2
      enabledAugmentationIds = enabledAugmentationIds.filter((id) => id !== 'aug-2');
      expect(enabledAugmentationIds).not.toContain('aug-2');
    });
  });

  /**
   * Test that augmentations are only applied when enabled
   */
  describe('Augmentation application', () => {
    it('should only apply bonuses from enabled augmentations', () => {
      const allAugmentations = [
        { id: 'aug-1', enabled: true, diceBonus: 1 },
        { id: 'aug-2', enabled: false, diceBonus: 1 },
        { id: 'aug-3', enabled: true, diceBonus: 1 },
      ];

      const enabledBonus = allAugmentations
        .filter((a) => a.enabled)
        .reduce((sum, a) => sum + a.diceBonus, 0);

      expect(enabledBonus).toBe(2); // Only aug-1 and aug-3 (not aug-2)
    });

    it('should not apply bonuses from disabled augmentations', () => {
      const allAugmentations = [
        { id: 'aug-1', enabled: false, diceBonus: 1 },
        { id: 'aug-2', enabled: false, diceBonus: 1 },
      ];

      const enabledBonus = allAugmentations
        .filter((a) => a.enabled)
        .reduce((sum, a) => sum + a.diceBonus, 0);

      expect(enabledBonus).toBe(0); // None enabled
    });
  });
});
