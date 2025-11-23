/**
 * Equipment Selectors
 *
 * Shared selectors for equipment-related logic.
 * Used by both Character Sheet and Player Action Widget.
 */

import type { Character, Equipment } from '../types';
import type { EquipmentEffect } from '../types/equipment';
import { DEFAULT_CONFIG } from '../config';

/**
 * Get all equipped items that are NOT passive (active equipment)
 * These are items that can be actively used in actions
 */
export function selectActiveEquipment(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.equipped && !item.passive
    );
}

/**
 * Get all equipped items that ARE passive (passive equipment)
 * These are items that provide passive benefits only
 */
export function selectPassiveEquipment(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.equipped && item.passive
    );
}

/**
 * Get equipment mechanical effects from config based on category
 *
 * @param character - Character entity
 * @param equipmentId - Equipment ID to get effects for
 * @returns Equipment effect (dice, position, effect modifiers)
 *
 * @example
 * selectEquipmentEffect(character, 'heavy-weapon-id')
 * // { diceBonus: 2, positionPenalty: 1 }
 */
export function selectEquipmentEffect(
    character: Character,
    equipmentId: string
): EquipmentEffect {
    const item = character.equipment.find((e) => e.id === equipmentId);
    if (!item) return {};

    const categoryConfig = DEFAULT_CONFIG.equipment.categories[item.category];
    return categoryConfig?.effect || {};
}

/**
 * Get current load (count of all equipped items EXCEPT augmentations)
 * Augmentations don't count toward the 5-item load limit
 */
export function selectCurrentLoad(character: Character): number {
    return character.equipment.filter((item) => item.equipped && item.type !== 'augmentation').length;
}

/**
 * Check if an item can be equipped without exceeding load limit
 */
export function selectCanEquipItem(
    character: Character,
    item: Equipment
): boolean {
    // If already equipped, can always unequip
    if (item.equipped) {
        return true;
    }

    // Check if we have room for one more item
    const currentLoad = selectCurrentLoad(character);
    return currentLoad < DEFAULT_CONFIG.character.maxLoad;
}

/**
 * Get all equipped items (both active and passive)
 */
export function selectAllEquippedItems(character: Character): Equipment[] {
    return character.equipment.filter((item) => item.equipped);
}

/**
 * Get all unequipped items
 */
export function selectUnequippedItems(character: Character): Equipment[] {
    return character.equipment.filter((item) => !item.equipped);
}

/**
 * Check if character is at max load
 */
export function selectIsAtMaxLoad(character: Character): boolean {
    const currentLoad = selectCurrentLoad(character);
    return currentLoad >= DEFAULT_CONFIG.character.maxLoad;
}

/**
 * Get Momentum cost to equip a Rare item via flashback (rules_primer.md)
 * Common items: 0 cost (declare freely)
 * Rare items: 1 Momentum cost (requires flashback)
 * Epic items: Cannot be acquired via flashback
 *
 * @param equipment - Equipment to check
 * @returns Momentum cost (0, 1, or Infinity for epic)
 *
 * @example
 * selectMomentumCostForTier(commonItem) // 0
 * selectMomentumCostForTier(rareItem)   // 1
 * selectMomentumCostForTier(epicItem)   // Infinity
 */
export function selectMomentumCostForTier(equipment: Equipment): number {
    return DEFAULT_CONFIG.equipment.momentumCostByTier[equipment.tier];
}

/**
 * Get all locked equipment (items that cannot be unequipped until Momentum Reset)
 * rules_primer.md: "Once an item is equipped, it remains equipped until the next Momentum Reset"
 */
export function selectLockedEquipment(character: Character): Equipment[] {
    return character.equipment.filter((item) => item.locked);
}

/**
 * Get all unlocked equipment (items that can be unequipped)
 */
export function selectUnlockedEquipment(character: Character): Equipment[] {
    return character.equipment.filter((item) => !item.locked);
}

/**
 * Get all depleted consumables (items marked as used but still taking load)
 * rules_primer.md: "After use, they remain equipped but become unusable"
 */
export function selectDepletedConsumables(character: Character): Equipment[] {
    return character.equipment.filter((item) => item.depleted);
}

/**
 * Get all non-depleted equipment (items that are still usable)
 */
export function selectUsableEquipment(character: Character): Equipment[] {
    return character.equipment.filter((item) => !item.depleted);
}

/**
 * Get equipment eligible for flashback acquisition (common and rare tiers only)
 * Epic tier cannot be acquired via flashback and should not appear in flashback dialogs
 */
export function selectFlashbackEligibleEquipment(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.tier === 'common' || item.tier === 'rare'
    );
}

/**
 * Get augmentations (equipment that doesn't count toward load limit)
 * Augmentations are permanent enhancements (cybernetic, biological, psionic) that:
 * - Don't count toward load limit
 * - Are only activated by GM on specific rolls
 * - Provide conditional bonuses (not always active)
 *
 * @param character - Character entity
 * @returns Array of augmentation equipment items
 */
export function selectAugmentations(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.type === 'augmentation'
    );
}

/**
 * Get consumable items (items that can be depleted when used)
 * Consumables are replenished during Momentum Reset
 * rules_primer.md: "Single-use items that provide higher bonuses. After use, they remain equipped but become unusable"
 */
export function selectConsumables(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.type === 'consumable'
    );
}

/**
 * Check if a single equipment item is consumable
 * @param item - Equipment item to check
 * @returns true if the item type is 'consumable'
 */
export function isEquipmentConsumable(item: Equipment): boolean {
    return item.type === 'consumable';
}

/**
 * Check if a single equipment item is an augmentation
 * @param item - Equipment item to check
 * @returns true if the item type is 'augmentation'
 */
export function isEquipmentAugmentation(item: Equipment): boolean {
    return item.type === 'augmentation';
}
