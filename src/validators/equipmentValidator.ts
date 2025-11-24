/**
 * Equipment Validators
 *
 * Pure functions for validating equipment state changes.
 * Per CLAUDE.md: Extract pure functions with comprehensive test coverage.
 */

import type { Character, Equipment } from '../types';
import { DEFAULT_CONFIG } from '../config';

/**
 * Calculate total load (slots) currently used by a character
 *
 * @param character - Character with equipped items
 * @param items - Optional: map of item ID to full item data (for load calculation)
 * @returns Total slots currently in use by equipped items
 *
 * @example
 * calculateLoadUsed(character) // 3 (if equipped items occupy 3 slots)
 */
export function calculateLoadUsed(character: Character): number {
  return character.equipment
    .filter(item => item.equipped)
    .reduce((total, item) => total + item.slots, 0);
}

/**
 * Check if a character can equip an additional item without exceeding load limit
 *
 * @param character - Character to check
 * @param item - Item to equip
 * @returns true if item can be equipped, false if it would exceed load limit
 *
 * @example
 * canEquipItem(character, sword) // true if 2+1 slots <= limit
 * canEquipItem(character, sword) // false if 4+1 slots > 5 limit
 */
export function canEquipItem(character: Character, item: Equipment): boolean {
  const currentLoad = calculateLoadUsed(character);
  const newLoad = currentLoad + item.slots;
  return newLoad <= character.loadLimit;
}

/**
 * Check if a character can unequip an item
 *
 * Locked items cannot be unequipped until Momentum Reset.
 *
 * @param item - Item to unequip
 * @returns true if item can be unequipped, false if it's locked
 *
 * @example
 * canUnequipItem(unlockedSword) // true
 * canUnequipItem(lockedSword)   // false
 */
export function canUnequipItem(item: Equipment): boolean {
  return !item.locked;
}

/**
 * Calculate first-lock momentum cost for items
 *
 * Only Rare and Epic items cost 1M on first lock (when locked = false).
 * Common items cost 0M. Already-locked items cost 0M (no repeat charge).
 *
 * Per rules_primer.md: "Costs 1 Momentum on first use (when locked in a roll)"
 *
 * @param items - Equipment items to check
 * @returns Total momentum cost (1M per unlocked Rare/Epic item)
 *
 * @example
 * calculateFirstLockCost([commonSword, rareSword])        // 1 (rare unlocked)
 * calculateFirstLockCost([commonSword, lockedRareSword])  // 0 (already locked)
 * calculateFirstLockCost([epicArmor, lockedEpicArmor])    // 1 (epic unlocked)
 */
export function calculateFirstLockCost(items: Equipment[]): number {
  return items
    .filter(item => (item.tier === 'rare' || item.tier === 'epic') && !item.locked)
    .reduce((cost, item) => cost + DEFAULT_CONFIG.equipment.momentumCostByTier[item.tier], 0);
}

/**
 * Validate that an item meets equipment requirements
 *
 * Ensures item has required fields for game mechanics.
 *
 * @param item - Item to validate
 * @returns true if item is valid, false otherwise
 *
 * @example
 * validateEquipment(sword)        // true
 * validateEquipment({id: "x"})    // false (missing required fields)
 */
export function validateEquipment(item: Equipment): boolean {
  return !!(
    item.id &&
    item.name &&
    item.category &&
    item.tier &&
    item.slots &&
    item.slots > 0 &&
    item.description !== undefined &&
    typeof item.equipped === 'boolean' &&
    typeof item.locked === 'boolean' &&
    typeof item.consumed === 'boolean'
  );
}
