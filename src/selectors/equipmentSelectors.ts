/**
 * Equipment Selectors
 *
 * Shared selectors for equipment-related logic.
 * Used by both Character Sheet and Player Action Widget.
 */

import type { Character, Equipment } from '../types';
import { DEFAULT_CONFIG } from '../config';

/**
 * Get all equipped items WITHOUT passive tag (active equipment)
 * These are items that can be actively used in actions
 */
export function selectActiveEquipment(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.equipped && !item.tags.includes('passive')
    );
}

/**
 * Get all equipped items WITH passive tag (passive equipment)
 * These are items that provide passive benefits
 */
export function selectPassiveEquipment(character: Character): Equipment[] {
    return character.equipment.filter(
        (item) => item.equipped && item.tags.includes('passive')
    );
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
