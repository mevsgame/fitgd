/**
 * Equipment Selectors
 *
 * Shared selectors for equipment-related logic.
 * Used by both Character Sheet and Player Action Widget.
 *
 * Three-category system:
 * - Active: Selected by player in dice pool
 * - Passive: Approved by GM during roll conversation
 * - Consumable: Single-use items, deplete after use
 */

import type { Character, Equipment } from '../types';
import { DEFAULT_CONFIG } from '../config';
import {
  calculateLoadUsed,
  calculateFirstLockCost,
} from '../validators/equipmentValidator';

/**
 * Get all equipped Active equipment items
 *
 * Active items can be selected as secondary in the dice pool.
 * Excludes unequipped and depleted items.
 *
 * @param character - Character entity
 * @returns Array of equipped, non-depleted active items
 *
 * @example
 * selectActiveEquipment(character) // [sword, gun, lockpicks]
 */
export function selectActiveEquipment(character: Character): Equipment[] {
  return character.equipment.filter(
    (item) => item.category === 'active' && item.equipped && !item.consumed
  );
}

/**
 * Get all equipped Passive equipment items
 *
 * Passive items are always-on and approved by GM during roll conversation.
 * Locked items still appear (can be used multiple times after first lock).
 *
 * @param character - Character entity
 * @returns Array of equipped passive items (locked or unlocked)
 *
 * @example
 * selectPassiveEquipment(character) // [armor, implant]
 */
export function selectPassiveEquipment(character: Character): Equipment[] {
  return character.equipment.filter(
    (item) => item.category === 'passive' && item.equipped
  );
}

/**
 * Get all equipped Consumable equipment items (non-depleted)
 *
 * Consumables can be selected like Active items and deplete after use.
 * Excludes depleted consumables (filtered from secondary dropdown).
 *
 * @param character - Character entity
 * @returns Array of equipped, non-depleted consumable items
 *
 * @example
 * selectConsumableEquipment(character) // [grenade, medkit]
 */
export function selectConsumableEquipment(character: Character): Equipment[] {
  return character.equipment.filter(
    (item) => item.category === 'consumable' && item.equipped && !item.consumed
  );
}

/**
 * Get total slots currently in use
 *
 * All categories count toward load limit.
 *
 * @param character - Character entity
 * @returns Total slots used by equipped items
 *
 * @example
 * selectLoadUsed(character) // 3 (if equipped items occupy 3 slots)
 */
export function selectLoadUsed(character: Character): number {
  return calculateLoadUsed(character);
}

/**
 * Get first-lock momentum cost for equipment items
 *
 * Only Rare/Epic items cost 1M on first lock (when locked=false).
 * Common items cost 0M. Already-locked items cost 0M.
 *
 * @param items - Equipment items to check
 * @returns Total momentum cost (1M per unlocked Rare/Epic)
 *
 * @example
 * selectFirstLockCost([commonSword, rareSword])       // 1
 * selectFirstLockCost([lockedRareSword, epicArmor])   // 1 (epic unlocked)
 */
export function selectFirstLockCost(items: Equipment[]): number {
  return calculateFirstLockCost(items);
}

/**
 * Get all equipped items (all categories)
 *
 * @param character - Character entity
 * @returns Array of all equipped items
 */
export function selectAllEquippedItems(character: Character): Equipment[] {
  return character.equipment.filter((item) => item.equipped);
}

/**
 * Get all unequipped items
 *
 * @param character - Character entity
 * @returns Array of unequipped items
 */
export function selectUnequippedItems(character: Character): Equipment[] {
  return character.equipment.filter((item) => !item.equipped);
}

/**
 * Check if character is at max load
 *
 * @param character - Character entity
 * @returns true if equipped load >= loadLimit
 */
export function selectIsAtMaxLoad(character: Character): boolean {
  return selectLoadUsed(character) >= character.loadLimit;
}

/**
 * Get all locked equipment
 *
 * Locked items cannot be unequipped until Momentum Reset.
 * They can still be used in multiple rolls (no additional cost).
 *
 * @param character - Character entity
 * @returns Array of locked items
 */
export function selectLockedEquipment(character: Character): Equipment[] {
  return character.equipment.filter((item) => item.locked);
}

/**
 * Get all unlocked equipment
 *
 * Unlocked items can be unequipped and swapped freely.
 *
 * @param character - Character entity
 * @returns Array of unlocked items
 */
export function selectUnlockedEquipment(character: Character): Equipment[] {
  return character.equipment.filter((item) => !item.locked);
}

/**
 * Get all depleted consumables
 *
 * Depleted items remain equipped (occupy slots) but are unusable
 * until Momentum Reset.
 *
 * @param character - Character entity
 * @returns Array of depleted items
 */
export function selectDepletedConsumables(character: Character): Equipment[] {
  return character.equipment.filter(
    (item) => item.category === 'consumable' && item.consumed
  );
}

/**
 * Get all non-depleted equipment (usable items)
 *
 * @param character - Character entity
 * @returns Array of items that are not consumed/depleted
 */
export function selectUsableEquipment(character: Character): Equipment[] {
  return character.equipment.filter((item) => !item.consumed);
}
