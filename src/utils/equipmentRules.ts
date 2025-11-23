/**
 * Equipment Rules & Utilities
 *
 * Pure functions for equipment mechanics including:
 * - First-lock cost calculation
 * - Equipment locking logic
 * - Consumable management
 */

import type { Character } from '../types/character';

/**
 * Calculate first-lock cost for equipment selected in a roll
 *
 * First-lock cost is charged once per Momentum Reset for each Rare/Epic item used.
 * Cost is 1M per unlocked Rare/Epic item.
 *
 * @param character - Character with equipment
 * @param activeEquipmentIds - IDs of active equipment selected
 * @param approvedPassiveId - ID of approved passive equipment (or null)
 * @returns Momentum cost (0, 1, or 2M)
 *
 * @example
 * // Active: Rare sword (unlocked), Passive: Epic armor (locked)
 * calculateFirstLockCost(character, ['sword-id'], 'armor-id'); // Returns 1 (only active is unlocked)
 *
 * // Active: Rare sword (unlocked), Passive: Rare armor (unlocked)
 * calculateFirstLockCost(character, ['sword-id'], 'armor-id'); // Returns 2
 *
 * // Active: Common item (no cost), Passive: Rare armor (unlocked)
 * calculateFirstLockCost(character, ['common-id'], 'armor-id'); // Returns 1
 */
export function calculateFirstLockCost(
  character: Character,
  activeEquipmentIds: string[],
  approvedPassiveId: string | null | undefined
): number {
  let cost = 0;

  // Check active equipment
  if (activeEquipmentIds && activeEquipmentIds.length > 0) {
    for (const equipmentId of activeEquipmentIds) {
      const equipment = character.equipment.find(e => e.id === equipmentId);
      if (equipment && !equipment.locked && (equipment.tier === 'rare' || equipment.tier === 'epic')) {
        cost += 1;
      }
    }
  }

  // Check approved passive equipment
  if (approvedPassiveId) {
    const passive = character.equipment.find(e => e.id === approvedPassiveId);
    if (passive && !passive.locked && (passive.tier === 'rare' || passive.tier === 'epic')) {
      cost += 1;
    }
  }

  return cost;
}

/**
 * Get all equipment IDs that should be locked after a roll
 *
 * Includes both active and passive equipment selected for the roll.
 * Does NOT include already-locked items.
 *
 * @param activeEquipmentIds - IDs of active equipment selected
 * @param approvedPassiveId - ID of approved passive equipment (or null)
 * @returns Array of equipment IDs to lock
 *
 * @example
 * getEquipmentToLock(['sword-id', 'shield-id'], 'armor-id');
 * // Returns ['sword-id', 'shield-id', 'armor-id']
 *
 * getEquipmentToLock(['sword-id'], null);
 * // Returns ['sword-id']
 */
export function getEquipmentToLock(
  activeEquipmentIds: string[] | undefined,
  approvedPassiveId: string | null | undefined
): string[] {
  const toLock: string[] = [];

  if (activeEquipmentIds) {
    toLock.push(...activeEquipmentIds);
  }

  if (approvedPassiveId) {
    toLock.push(approvedPassiveId);
  }

  return toLock;
}

/**
 * Get all Consumable equipment IDs that should be marked as consumed
 *
 * Consumables are single-use items that become depleted after selection.
 *
 * @param character - Character with equipment
 * @param activeEquipmentIds - IDs of active equipment selected
 * @returns Array of consumable equipment IDs to mark as consumed
 *
 * @example
 * const consumables = getConsumablesToDeplete(character, ['grenade-id', 'sword-id']);
 * // Returns ['grenade-id'] if grenade is consumable, sword is not
 */
export function getConsumablesToDeplete(
  character: Character,
  activeEquipmentIds: string[] | undefined
): string[] {
  if (!activeEquipmentIds) return [];

  return activeEquipmentIds.filter(equipmentId => {
    const equipment = character.equipment.find(e => e.id === equipmentId);
    return equipment && equipment.category === 'consumable' && !equipment.consumed;
  });
}

/**
 * Check if character has sufficient equipment load capacity
 *
 * @param character - Character to check
 * @param additionalSlots - Number of additional slots needed
 * @param maxLoad - Maximum load capacity (default 5)
 * @returns True if character has capacity, false otherwise
 *
 * @example
 * hasEquipmentCapacity(character, 2); // Has capacity for 2 more slots?
 */
export function hasEquipmentCapacity(
  character: Character,
  additionalSlots: number = 0,
  maxLoad: number = 5
): boolean {
  const currentLoad = character.equipment
    .filter(e => e.equipped && !e.consumed)
    .reduce((total, e) => total + e.slots, 0);

  return currentLoad + additionalSlots <= maxLoad;
}

/**
 * Get total momentum cost for a roll (trait + equipment locking)
 *
 * @param traitMomentumCost - Momentum cost from trait transaction (usually 0 or 1)
 * @param firstLockCost - First-lock equipment cost (0, 1, or 2)
 * @returns Total momentum cost
 *
 * @example
 * calculateTotalMomentumCost(1, 2); // Trait cost + equipment locks = 3M total
 */
export function calculateTotalMomentumCost(traitMomentumCost: number, firstLockCost: number): number {
  return traitMomentumCost + firstLockCost;
}
