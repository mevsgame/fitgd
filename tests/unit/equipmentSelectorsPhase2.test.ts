import { describe, it, expect } from 'vitest';
import {
  selectMomentumCostForTier,
  selectLockedEquipment,
  selectUnlockedEquipment,
  selectDepletedConsumables,
  selectUsableEquipment,
  selectFlashbackEligibleEquipment,
  selectAugmentations,
  selectConsumables,
} from '../../src/selectors/equipmentSelectors';
import type { Character, Equipment } from '../../src/types';

describe('equipmentSelectors - Phase 2 (Locking, Depleting, Consumables)', () => {
  const mockCharacter: Character = {
    id: 'char-1',
    name: 'Test Character',
    traits: [],
    approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
    unallocatedApproachDots: 0,
    equipment: [
      {
        id: 'equip-common',
        name: 'Common Weapon',
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
        id: 'equip-rare',
        name: 'Rare Tool',
        type: 'equipment',
        tier: 'rare',
        category: 'precision-tool',
        description: 'Specialized tool',
        passive: false,
        equipped: true,
        locked: true,
        depleted: false,
        acquiredAt: Date.now(),
      },
      {
        id: 'equip-epic',
        name: 'Epic Armor',
        type: 'equipment',
        tier: 'epic',
        category: 'armor',
        description: 'Legendary armor',
        passive: true,
        equipped: true,
        locked: true,
        depleted: false,
        acquiredAt: Date.now(),
      },
      {
        id: 'equip-consumable',
        name: 'Stim Pack',
        type: 'consumable',
        tier: 'common',
        category: 'stim',
        description: 'Single-use stim',
        passive: false,
        equipped: true,
        locked: false,
        depleted: true,
        acquiredAt: Date.now(),
      },
      {
        id: 'equip-aug-cyber',
        name: 'Cybernetic Limb',
        type: 'augmentation',
        tier: 'common',
        category: 'cybernetic',
        description: 'Augmentation',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      },
      {
        id: 'equip-unequipped-rare',
        name: 'Unequipped Rare',
        type: 'equipment',
        tier: 'rare',
        category: 'weapon',
        description: 'Unequipped rare item',
        passive: false,
        equipped: false,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      },
    ],
    rallyAvailable: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('selectMomentumCostForTier', () => {
    it('should return 0 cost for common tier items', () => {
      const commonItem = mockCharacter.equipment.find((e) => e.id === 'equip-common')!;
      const cost = selectMomentumCostForTier(commonItem);
      expect(cost).toBe(0);
    });

    it('should return 1 cost for rare tier items', () => {
      const rareItem = mockCharacter.equipment.find((e) => e.id === 'equip-rare')!;
      const cost = selectMomentumCostForTier(rareItem);
      expect(cost).toBe(1);
    });

    it('should return Infinity cost for epic tier items (cannot flashback)', () => {
      const epicItem = mockCharacter.equipment.find((e) => e.id === 'equip-epic')!;
      const cost = selectMomentumCostForTier(epicItem);
      expect(cost).toBe(Infinity);
    });
  });

  describe('selectLockedEquipment', () => {
    it('should return all locked items', () => {
      const locked = selectLockedEquipment(mockCharacter);
      expect(locked).toHaveLength(2);
      expect(locked.map((e) => e.id)).toContain('equip-rare');
      expect(locked.map((e) => e.id)).toContain('equip-epic');
    });

    it('should return empty array if no locked items', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.map((e) => ({
          ...e,
          locked: false,
        })),
      };
      const locked = selectLockedEquipment(char);
      expect(locked).toHaveLength(0);
    });
  });

  describe('selectUnlockedEquipment', () => {
    it('should return all unlocked items', () => {
      const unlocked = selectUnlockedEquipment(mockCharacter);
      expect(unlocked).toHaveLength(4);
      expect(unlocked.map((e) => e.id)).not.toContain('equip-rare');
      expect(unlocked.map((e) => e.id)).not.toContain('equip-epic');
    });

    it('should return all items if none are locked', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.map((e) => ({
          ...e,
          locked: false,
        })),
      };
      const unlocked = selectUnlockedEquipment(char);
      expect(unlocked).toHaveLength(6);
    });
  });

  describe('selectDepletedConsumables', () => {
    it('should return only depleted items', () => {
      const depleted = selectDepletedConsumables(mockCharacter);
      expect(depleted).toHaveLength(1);
      expect(depleted[0].id).toBe('equip-consumable');
    });

    it('should return empty array if no depleted items', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.map((e) => ({
          ...e,
          depleted: false,
        })),
      };
      const depleted = selectDepletedConsumables(char);
      expect(depleted).toHaveLength(0);
    });
  });

  describe('selectUsableEquipment', () => {
    it('should return all non-depleted items', () => {
      const usable = selectUsableEquipment(mockCharacter);
      expect(usable).toHaveLength(5);
      expect(usable.map((e) => e.id)).not.toContain('equip-consumable');
    });

    it('should return all items if none are depleted', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.map((e) => ({
          ...e,
          depleted: false,
        })),
      };
      const usable = selectUsableEquipment(char);
      expect(usable).toHaveLength(6);
    });
  });

  describe('selectFlashbackEligibleEquipment', () => {
    it('should return only common and rare tier items', () => {
      const eligible = selectFlashbackEligibleEquipment(mockCharacter);
      expect(eligible).toHaveLength(5); // common-weapon, rare-tool, consumable, aug-cyber, rare-unequipped
      expect(eligible.every((e) => e.tier === 'common' || e.tier === 'rare')).toBe(true);
    });

    it('should exclude epic tier items', () => {
      const eligible = selectFlashbackEligibleEquipment(mockCharacter);
      expect(eligible.map((e) => e.id)).not.toContain('equip-epic');
    });

    it('should return empty array if only epic items', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: [
          {
            id: 'epic-1',
            name: 'Epic Item',
            tier: 'epic',
            category: 'weapon',
            description: 'Epic only',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
        ],
      };
      const eligible = selectFlashbackEligibleEquipment(char);
      expect(eligible).toHaveLength(0);
    });
  });

  describe('selectAugmentations', () => {
    it('should return only augmentation category items', () => {
      const augs = selectAugmentations(mockCharacter);
      expect(augs).toHaveLength(1);
      expect(augs[0].id).toBe('equip-aug-cyber');
    });

    it('should return empty array if no augmentations', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.filter((e) => !e.id.includes('aug')),
      };
      const augs = selectAugmentations(char);
      expect(augs).toHaveLength(0);
    });

    it('should include items from all augmentation categories', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: [
          ...mockCharacter.equipment,
          {
            id: 'aug-bio',
            name: 'Biological Enhancement',
            type: 'augmentation',
            tier: 'common',
            category: 'biological',
            description: 'Bio aug',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'aug-psy',
            name: 'Psionic Attunement',
            type: 'augmentation',
            tier: 'common',
            category: 'psionic',
            description: 'Psi aug',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
        ],
      };
      const augs = selectAugmentations(char);
      expect(augs).toHaveLength(3);
    });
  });

  describe('selectConsumables', () => {
    it('should return only consumable category items', () => {
      const consumables = selectConsumables(mockCharacter);
      expect(consumables).toHaveLength(1);
      expect(consumables[0].id).toBe('equip-consumable');
    });

    it('should return empty array if no consumables', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: mockCharacter.equipment.filter((e) => !e.id.includes('consumable')),
      };
      const consumables = selectConsumables(char);
      expect(consumables).toHaveLength(0);
    });

    it('should include items from all consumable types', () => {
      const char: Character = {
        ...mockCharacter,
        equipment: [
          ...mockCharacter.equipment,
          {
            id: 'grenade',
            name: 'Grenade',
            type: 'consumable',
            tier: 'common',
            category: 'grenade',
            description: 'Explosive',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'medkit',
            name: 'Medical Kit',
            type: 'consumable',
            tier: 'common',
            category: 'medkit',
            description: 'Medical supply',
            passive: false,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
        ],
      };
      const consumables = selectConsumables(char);
      expect(consumables).toHaveLength(3);
    });
  });
});
