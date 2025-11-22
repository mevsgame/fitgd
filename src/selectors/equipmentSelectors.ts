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
 * Get current load (count of all equipped items)
 */
export function selectCurrentLoad(character: Character): number {
    return character.equipment.filter((item) => item.equipped).length;
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
