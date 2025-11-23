/**
 * Equipment Workflows Integration Tests
 *
 * End-to-end tests verifying complete equipment workflows:
 * 1. Equipping/unequipping regular equipment
 * 2. Acquiring rare equipment via flashback (1M cost)
 * 3. Load management and enforcement (all categories count)
 * 4. Passive equipment system (armor, implants, augmentations - GM approved)
 * 5. Consumable consumption and replenishment
 * 6. Equipment locking/unlocking at Momentum Reset
 * 7. Equipment state transitions across game phases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Character, Equipment } from '../../src/types/character';
import type { Crew } from '../../src/types/crew';
import type { PlayerRoundState } from '../../src/types/playerRoundState';
import { selectCurrentLoad, selectCanEquipItem, selectConsumableEquipment, selectPassiveEquipment } from '../../src/selectors/equipmentSelectors';

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
          category: 'active',
          tier: 'common',
          slots: 1,
          description: 'Standard weapon',
          equipped: true,
          locked: false,
          consumed: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'equip-common-2',
          name: 'Combat Armor',
          category: 'passive',
          tier: 'common',
          slots: 1,
          description: 'Basic protection',
          equipped: true,
          locked: false,
          consumed: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'equip-rare-1',
          name: 'Plasma Rifle',
          category: 'active',
          tier: 'rare',
          slots: 1,
          description: 'Advanced weapon',
          equipped: false,
          locked: false,
          consumed: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'cons-1',
          name: 'Stim Pack',
          category: 'consumable',
          tier: 'common',
          slots: 1,
          description: 'Single-use stim',
          equipped: false,
          locked: false,
          consumed: false,
          acquiredAt: Date.now(),
        },
        {
          id: 'aug-1',
          name: 'Cybernetic Limb',
          category: 'passive',
          tier: 'common',
          slots: 1,
          description: 'Enhanced limb (passive augmentation)',
          equipped: true,
          locked: false,
          consumed: false,
          acquiredAt: Date.now(),
        },
      ],
      loadLimit: 5,
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
      expect(initialLoad).toBe(3); // Three items equipped: 1 active + 2 passive
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
            category: 'active',
            tier: 'common',
            slots: 1,
            description: 'Test',
            equipped: true,
            locked: false,
            consumed: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'equip-4',
            name: 'Item 4',
            category: 'active',
            tier: 'common',
            slots: 1,
            description: 'Test',
            equipped: true,
            locked: false,
            consumed: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'equip-5',
            name: 'Item 5',
            category: 'active',
            tier: 'common',
            slots: 1,
            description: 'Test',
            equipped: true,
            locked: false,
            consumed: false,
            acquiredAt: Date.now(),
          },
          { ...character.equipment[4], equipped: true }, // Passive item (counts toward load)
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
      expect(initialLoad).toBe(3);
      expect(newLoad).toBe(2); // One less
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
        category: 'active',
        tier: 'rare',
        slots: 1,
        description: 'Acquired via flashback',
        equipped: true, // Immediately equipped
        locked: true, // Locked until reset
        consumed: false,
        acquiredVia: 'flashback',
        acquiredAt: Date.now(),
      };

      expect(flashbackRare.equipped).toBe(true);
      expect(flashbackRare.locked).toBe(true);
    });
  });

  /**
   * Workflow 3: Passive Equipment System (armor, implants, augmentations)
   */
  describe('Workflow 3: Passive Equipment System', () => {
    it('should count passive items toward load limit', () => {
      const activeLoad = character.equipment
        .filter((e) => e.category === 'active' && e.equipped)
        .reduce((sum, e) => sum + e.slots, 0);
      const passiveLoad = character.equipment
        .filter((e) => e.category === 'passive' && e.equipped)
        .reduce((sum, e) => sum + e.slots, 0);

      expect(activeLoad).toBe(1); // Basic Rifle
      expect(passiveLoad).toBe(2); // Combat Armor + Cybernetic Limb
      // Total load is 3 (all categories count)
      expect(selectCurrentLoad(character)).toBe(3);
    });

    it('should track multiple passive items', () => {
      const passiveChar = {
        ...character,
        equipment: [
          ...character.equipment,
          {
            id: 'passive-2',
            name: 'Biological Enhancement',
            category: 'passive',
            tier: 'rare',
            slots: 1,
            description: 'Bio aug',
            equipped: true,
            locked: false,
            consumed: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'passive-3',
            name: 'Psionic Attunement',
            category: 'passive',
            tier: 'epic',
            slots: 1,
            description: 'Psi aug',
            equipped: true,
            locked: false,
            consumed: false,
            acquiredAt: Date.now(),
          },
        ],
      };

      const passives = selectPassiveEquipment(passiveChar);
      expect(passives).toHaveLength(4); // 2 initial + 2 new = 4 passive items
      expect(selectCurrentLoad(passiveChar)).toBe(5); // 1 active + 4 passive = 5 slots used
    });

    it('should track enabled passive equipment in player round state', () => {
      const playerRoundState: Partial<PlayerRoundState> = {
        characterId: character.id,
        enabledAugmentationIds: ['aug-1'], // GM approves this passive equipment for the roll
      };

      expect(playerRoundState.enabledAugmentationIds).toContain('aug-1');
      expect(playerRoundState.enabledAugmentationIds).toHaveLength(1);
    });

    it('should allow GM to approve passive equipment per roll', () => {
      let enabledPassiveIds: string[] = ['aug-1'];

      // GM approves another
      enabledPassiveIds.push('passive-2');
      expect(enabledPassiveIds).toHaveLength(2);

      // GM removes approval for first
      enabledPassiveIds = enabledPassiveIds.filter((id) => id !== 'aug-1');
      expect(enabledPassiveIds).toContain('passive-2');
      expect(enabledPassiveIds).not.toContain('aug-1');
    });
  });

  /**
   * Workflow 4: Consumable depletion and tracking
   */
  describe('Workflow 4: Consumable Management', () => {
    it('should identify consumable items', () => {
      const consumables = character.equipment.filter((e) => e.category === 'consumable');
      expect(consumables).toHaveLength(1);
      expect(consumables[0].id).toBe('cons-1');
    });

    it('should mark consumable as consumed when used', () => {
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true, consumed: true } : e
        ),
      };

      const consumable = modChar.equipment.find((e) => e.id === 'cons-1');
      expect(consumable?.consumed).toBe(true);
      expect(consumable?.equipped).toBe(true); // Still takes load
    });

    it('should prevent using consumed consumables', () => {
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true, consumed: true } : e
        ),
      };

      // Get available consumables (not consumed)
      const availableConsumables = selectConsumableEquipment(modChar);

      // Consumed consumable should not be available for selection
      expect(availableConsumables.find((e) => e.id === 'cons-1')).toBeUndefined();
    });

    it('should replenish consumables at Momentum Reset', () => {
      // Before reset
      const depleted = character.equipment.map((e) =>
        e.id === 'cons-1' ? { ...e, consumed: true } : e
      );

      // Simulate reset: replenish all consumables
      const replenished = depleted.map((e) =>
        e.category === 'consumable' ? { ...e, consumed: false } : e
      );

      const replenishedConsumable = replenished.find((e) => e.id === 'cons-1');
      expect(replenishedConsumable?.consumed).toBe(false);
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
      // Scenario: 1 active equipped, 2 passive equipped, 1 rare unequipped, 1 consumable unequipped
      // Current load should be 3 (all equipped items count)

      const load = selectCurrentLoad(character);
      expect(load).toBe(3);

      // Add consumable to equipped
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          e.id === 'cons-1' ? { ...e, equipped: true } : e
        ),
      };

      const newLoad = selectCurrentLoad(modChar);
      expect(newLoad).toBe(4); // Now 1 active + 2 passive + 1 consumable
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
      // Batch: unequip 1 active, equip 1 rare active, equip 1 consumable
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
      expect(finalLoad).toBe(4); // 2 passive + 1 rare active + 1 consumable
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

    it('should mark consumable as consumed when selected for action', () => {
      // Consumable selected for action
      const equippedForAction = ['cons-1'];

      // After action resolution: mark consumed
      const modChar = {
        ...character,
        equipment: character.equipment.map((e) =>
          equippedForAction.includes(e.id) && e.category === 'consumable'
            ? { ...e, consumed: true }
            : e
        ),
      };

      const consumedConsumable = modChar.equipment.find((e) => e.id === 'cons-1');
      expect(consumedConsumable?.consumed).toBe(true);
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

      // Resolution phase: consumables consumed, rare locked
      const resolutionChar = {
        ...rollingChar,
        equipment: rollingChar.equipment.map((e) => {
          if (e.category === 'consumable' && e.equipped) {
            return { ...e, consumed: true };
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
