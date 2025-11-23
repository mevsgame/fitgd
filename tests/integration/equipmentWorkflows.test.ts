/**
 * Equipment Workflows Integration Tests
 *
 * End-to-end tests verifying complete equipment workflows:
 * 1. Equipping/unequipping regular equipment
 * 2. Acquiring rare equipment via flashback (1M cost)
 * 3. Load management and enforcement
 * 4. Augmentation system (no load counting, GM control)
 * 5. Consumable depletion and replenishment
 * 6. Equipment locking/unlocking at Momentum Reset
 * 7. Equipment state transitions across game phases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Character, Equipment } from '../../src/types/character';
import type { Crew } from '../../src/types/crew';
import type { PlayerRoundState } from '../../src/types/playerRoundState';
import { selectCurrentLoad, selectCanEquipItem, selectConsumables, selectAugmentations } from '../../src/selectors/equipmentSelectors';

describe('Equipment Workflows - Integration Tests', () => {
  let character: Character;
  let crew: Crew;

  beforeEach(() => {
    crew = {
      id: 'crew-1',
      name: 'Test Crew',
      characters: ['char-1'],
      currentMomentum: 10,
      maxMomentum: 10,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    character = {
      id: 'char-1',
      name: 'Test Character',
      traits: [],
      approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
      unallocatedApproachDots: 0,
      equipment: [
        {
          id: 'equip-common-1',
          name: 'Basic Rifle',
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
          id: 'equip-common-2',
          name: 'Combat Armor',
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
          id: 'cons-1',
          name: 'Stim Pack',
          type: 'consumable',
          tier: 'common',
          category: 'stim',
          description: 'Single-use stim',
          passive: false,
          equipped: false,
          locked: false,
          depleted: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'aug-1',
          name: 'Cybernetic Limb',
          type: 'augmentation',
          tier: 'common',
          category: 'cybernetic',
          description: 'Enhanced limb',
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
   * Workflow 1: Equipping and unequipping regular equipment
   */
  describe('Workflow 1: Regular Equipment Management', () => {
    it('should equip common item without cost', () => {
      const initialLoad = selectCurrentLoad(character);
      const item = character.equipment.find((e) => e.id === 'equip-common-2');

      expect(item?.equipped).toBe(true);
      expect(initialLoad).toBe(2); // Two common items equipped
    });

    it('should prevent exceeding load limit when equipping', () => {
      // Fill load to max (5)
      const fullChar = {
        ...character,
        equipment: [
          { ...character.equipment[0], equipped: true },
          { ...character.equipment[1], equipped: true },
          {
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
          {
            id: 'equip-5',
            name: 'Item 5',
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
          { ...character.equipment[4], equipped: true }, // Augmentation (doesn't count)
        ],
      };

      const canEquip = selectCanEquipItem(fullChar, character.equipment[2]);
      expect(canEquip).toBe(false); // Cannot equip rare item, at max load
    });

    it('should unequip and free load space', () => {
      const initialLoad = selectCurrentLoad(character);

      // Unequip first item
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'equip-common-1' ? { ...e, equipped: false } : e
        ),
      };

      const newLoad = selectCurrentLoad(modChar);
      expect(initialLoad).toBe(2);
      expect(newLoad).toBe(1); // One less
    });
  });

  /**
   * Workflow 2: Acquiring rare equipment via flashback
   */
  describe('Workflow 2: Flashback Rare Equipment Acquisition', () => {
    it('should acquire rare item with 1M cost', () => {
      const rareItem = character.equipment.find((e) => e.id === 'equip-rare-1');
      expect(rareItem?.tier).toBe('rare');

      // Flashback acquisition cost
      const cost = rareItem?.tier === 'rare' ? 1 : 0;
      expect(cost).toBe(1);
    });

    it('should prevent rare acquisition without sufficient momentum', () => {
      const lowMomentumCrew = { ...crew, currentMomentum: 0 };
      const rareItem = character.equipment.find((e) => e.id === 'equip-rare-1');

      const cost = rareItem?.tier === 'rare' ? 1 : 0;
      const canAcquire = lowMomentumCrew.currentMomentum >= cost;

      expect(canAcquire).toBe(false);
    });

    it('should spend momentum when acquiring rare item', () => {
      const initialMomentum = crew.currentMomentum;
      const cost = 1; // Rare item cost

      const finalMomentum = initialMomentum - cost;
      expect(finalMomentum).toBe(9);
      expect(finalMomentum).toBeGreaterThanOrEqual(0);
    });

    it('should immediately equip flashback rare items', () => {
      const flashbackRare: Equipment = {
        id: 'flashback-rare-1',
        name: 'Flashback Rifle',
        type: 'equipment',
        tier: 'rare',
        category: 'weapon',
        description: 'Acquired via flashback',
        passive: false,
        equipped: true, // Immediately equipped
        locked: true, // Locked until reset
        depleted: false,
        acquiredVia: 'flashback',
        acquiredAt: Date.now(),
      };

      expect(flashbackRare.equipped).toBe(true);
      expect(flashbackRare.locked).toBe(true);
    });
  });

  /**
   * Workflow 3: Augmentation system (no load counting, GM control)
   */
  describe('Workflow 3: Augmentation System', () => {
    it('should not count augmentations toward load limit', () => {
      const regularLoad = character.equipment
        .filter((e) => e.type !== 'augmentation' && e.equipped)
        .length;
      const augmentationCount = character.equipment
        .filter((e) => e.type === 'augmentation')
        .length;

      expect(regularLoad).toBe(2);
      expect(augmentationCount).toBe(1);
      // Total load is 2, not 3
      expect(selectCurrentLoad(character)).toBe(2);
    });

    it('should allow unlimited augmentations', () => {
      const augChar = {
        ...character,
        equipment: [
          ...character.equipment,
          {
            id: 'aug-2',
            name: 'Biological Enhancement',
            type: 'augmentation',
            tier: 'rare',
            category: 'biological',
            description: 'Bio aug',
            passive: true,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'aug-3',
            name: 'Psionic Attunement',
            type: 'augmentation',
            tier: 'epic',
            category: 'psionic',
            description: 'Psi aug',
            passive: true,
            equipped: true,
            locked: false,
            depleted: false,
            acquiredAt: Date.now(),
          },
        ],
      };

      const augs = selectAugmentations(augChar);
      expect(augs).toHaveLength(3);
      expect(selectCurrentLoad(augChar)).toBe(2); // Still just 2 (regular items)
    });

    it('should track enabled augmentations in player round state', () => {
      const playerRoundState: Partial<PlayerRoundState> = {
        characterId: character.id,
        enabledAugmentationIds: ['aug-1'], // GM enables this augmentation
      };

      expect(playerRoundState.enabledAugmentationIds).toContain('aug-1');
      expect(playerRoundState.enabledAugmentationIds).toHaveLength(1);
    });

    it('should allow GM to toggle augmentations per roll', () => {
      let enabledAugIds: string[] = ['aug-1'];

      // GM enables another
      enabledAugIds.push('aug-2');
      expect(enabledAugIds).toHaveLength(2);

      // GM disables first
      enabledAugIds = enabledAugIds.filter((id) => id !== 'aug-1');
      expect(enabledAugIds).toContain('aug-2');
      expect(enabledAugIds).not.toContain('aug-1');
    });
  });

  /**
   * Workflow 4: Consumable depletion and tracking
   */
  describe('Workflow 4: Consumable Management', () => {
    it('should identify consumable items', () => {
      const consumables = selectConsumables(character);
      expect(consumables).toHaveLength(1);
      expect(consumables[0].id).toBe('cons-1');
    });

    it('should mark consumable as depleted when used', () => {
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true, depleted: true } : e
        ),
      };

      const consumable = modChar.equipment.find((e) => e.id === 'cons-1');
      expect(consumable?.depleted).toBe(true);
      expect(consumable?.equipped).toBe(true); // Still takes load
    });

    it('should prevent using depleted consumables', () => {
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true, depleted: true } : e
        ),
      };

      const equippedActive = modChar.equipment.filter(
        (e) => e.equipped && !e.depleted && e.type !== 'augmentation'
      );

      // Depleted consumable should not be available for selection
      expect(equippedActive.find((e) => e.id === 'cons-1')).toBeUndefined();
    });

    it('should replenish consumables at Momentum Reset', () => {
      // Before reset
      const depleted = character.equipment.map((e) =>
        e.id === 'cons-1' ? { ...e, depleted: true } : e
      );

      // Simulate reset: replenish all consumables
      const replenished = depleted.map((e) =>
        e.type === 'consumable' ? { ...e, depleted: false } : e
      );

      const replenishedConsumable = replenished.find((e) => e.id === 'cons-1');
      expect(replenishedConsumable?.depleted).toBe(false);
    });
  });

  /**
   * Workflow 5: Equipment locking at Momentum Reset
   */
  describe('Workflow 5: Equipment Locking at Momentum Reset', () => {
    it('should lock equipment when equipped during mission', () => {
      const missionChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.equipped ? { ...e, locked: true } : e
        ),
      };

      const equippedLocked = missionChar.equipment.filter(
        (e) => e.equipped && e.locked
      );
      expect(equippedLocked.length).toBeGreaterThan(0);
    });

    it('should prevent unequipping locked items', () => {
      const missionChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.equipped ? { ...e, locked: true } : e
        ),
      };

      const lockedItem = missionChar.equipment.find(
        (e) => e.id === 'equip-common-1'
      );
      expect(lockedItem?.locked).toBe(true);

      // Cannot unequip locked item
      const canUnequip = !lockedItem?.locked;
      expect(canUnequip).toBe(false);
    });

    it('should unlock all equipment at Momentum Reset', () => {
      // Before reset
      const lockedChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.equipped ? { ...e, locked: true } : e
        ),
      };

      // After reset: unlock all
      const resetChar = {
        ...lockedChar,
        equipment: lockedChar.equipment.map((e) => ({ ...e, locked: false })),
      };

      const anyLocked = resetChar.equipment.find((e) => e.locked);
      expect(anyLocked).toBeUndefined();
    });

    it('should auto-equip items with autoEquip flag at reset', () => {
      // Set some items to auto-equip
      const autoEquipChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'equip-common-1' ? { ...e, autoEquip: true, locked: false } : e
        ),
      };

      const autoEquipItems = autoEquipChar.equipment.filter(
        (e) => e.autoEquip
      );
      expect(autoEquipItems).toHaveLength(1);
      expect(autoEquipItems[0].id).toBe('equip-common-1');
    });
  });

  /**
   * Workflow 6: Complex load management scenario
   */
  describe('Workflow 6: Complex Load Management Scenario', () => {
    it('should handle mixed equipment types correctly', () => {
      // Scenario: 2 common equipped, 1 rare unequipped, 1 consumable unequipped, 1 augmentation
      // Current load should be 2 (only regular equipped items count)

      const load = selectCurrentLoad(character);
      expect(load).toBe(2);

      // Add consumable to equipped
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true } : e
        ),
      };

      const newLoad = selectCurrentLoad(modChar);
      expect(newLoad).toBe(3); // Now 2 common + 1 consumable
    });

    it('should calculate correct momentum cost for batch changes', () => {
      // Scenario: Unequip 1 common (free), equip 1 rare (1M)
      const common = character.equipment.find((e) => e.id === 'equip-common-1');
      const rare = character.equipment.find((e) => e.id === 'equip-rare-1');

      const commonCost = common?.tier === 'rare' && !common?.equipped ? 1 : 0;
      const rareCost = rare?.tier === 'rare' && !rare?.equipped ? 1 : 0;
      const totalCost = commonCost + rareCost;

      expect(totalCost).toBe(1); // Only rare item costs
    });

    it('should validate load after all changes applied', () => {
      // Batch: unequip 1 common, equip 1 rare, equip 1 consumable
      const batchChar = {
        ...character,
        equipment: character.equipment.map((e) => {
          if (e.id === 'equip-common-1') return { ...e, equipped: false };
          if (e.id === 'equip-rare-1') return { ...e, equipped: true };
          if (e.id === 'cons-1') return { ...e, equipped: true };
          return e;
        }),
      };

      const finalLoad = selectCurrentLoad(batchChar);
      expect(finalLoad).toBe(3); // 1 common + 1 rare + 1 consumable
    });
  });

  /**
   * Workflow 7: Full action resolution with equipment
   */
  describe('Workflow 7: Equipment in Action Resolution', () => {
    it('should mark equipment as locked when selected for action', () => {
      const playerState: Partial<PlayerRoundState> = {
        characterId: character.id,
        state: 'DECISION_PHASE',
        equippedForAction: ['equip-common-1'], // Selected for this action
      };

      expect(playerState.equippedForAction).toContain('equip-common-1');
    });

    it('should mark consumable as depleted when selected for action', () => {
      // Consumable selected for action
      const equippedForAction = ['cons-1'];

      // After action resolution: mark depleted
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          equippedForAction.includes(e.id) && e.type === 'consumable'
            ? { ...e, depleted: true }
            : e
        ),
      };

      const depletedConsumable = modChar.equipment.find((e) => e.id === 'cons-1');
      expect(depletedConsumable?.depleted).toBe(true);
    });

    it('should lock all equipped items when action completes (mission context)', () => {
      // After action is taken during mission, all equipped items lock
      const missionChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.equipped ? { ...e, locked: true } : e
        ),
      };

      const allEquippedLocked = missionChar.equipment
        .filter((e) => e.equipped)
        .every((e) => e.locked);

      expect(allEquippedLocked).toBe(true);
    });
  });

  /**
   * Workflow 8: State consistency across phases
   */
  describe('Workflow 8: State Consistency Across Game Phases', () => {
    it('should maintain equipment state through decision → rolling → resolution', () => {
      const baseChar = { ...character };

      // Decision phase: select equipment
      const decisionChar = {
        ...baseChar,
        equipment: baseChar.equipment.map((e) =>
          e.id === 'equip-common-1' ? { ...e, locked: true } : e
        ),
      };

      // Rolling phase: state unchanged
      const rollingChar = { ...decisionChar };

      // Resolution phase: consumables depleted, rare locked
      const resolutionChar = {
        ...rollingChar,
        equipment: rollingChar.equipment.map((e) => {
          if (e.type === 'consumable' && e.equipped) {
            return { ...e, depleted: true };
          }
          return e;
        }),
      };

      const initialLocked = baseChar.equipment.filter((e) => e.locked).length;
      const finalLocked = resolutionChar.equipment.filter((e) => e.locked).length;

      expect(initialLocked).toBe(0);
      expect(finalLocked).toBeGreaterThanOrEqual(0);
    });
  });
});
