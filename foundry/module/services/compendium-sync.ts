/**
 * Compendium Sync Service
 *
 * Handles synchronization of equipment items from Redux state to the System Compendium.
 * Allows items to be "discovered" and added to the compendium automatically or manually.
 *
 * NOTE: Equipment in this system is stored in Redux state on Characters, NOT as Foundry Items.
 * This service reads from Redux state and creates/updates Foundry Items in the compendium.
 */

import { logger } from '../utils/logger';
import type { Equipment } from '@/types/equipment';

export class CompendiumSyncService {
    private static readonly PACK_NAME = 'forged-in-the-grimdark.equipment';

    /**
     * Sync a single equipment item to the compendium
     *
     * @param equipment - The Redux equipment data to sync
     * @returns Promise resolving to the synced item in compendium, or null if skipped
     */
    static async syncEquipment(equipment: Equipment): Promise<Item | null> {
        if (!game.user!.isGM) return null; // Only GM can write to compendium

        const pack = this.getPack();
        if (!pack) {
            logger.error(`CompendiumSyncService | Pack not found: ${this.PACK_NAME}`);
            return null;
        }

        if (pack.locked) {
            logger.warn(`CompendiumSyncService | Pack is locked, cannot sync: ${this.PACK_NAME}`);
            return null;
        }

        // Check if item already exists in compendium by name
        const existingIndex = pack.index.find((i: any) => i.name === equipment.name);

        // Convert Redux equipment to Foundry Item data format
        const itemData = this.equipmentToItemData(equipment);

        if (existingIndex) {
            // Update existing item
            logger.info(`CompendiumSyncService | Updating existing item: ${equipment.name}`);
            const existingItem = await pack.getDocument(existingIndex._id) as any;
            if (existingItem) {
                return await existingItem.update(itemData);
            }
        } else {
            // Create new item in compendium
            logger.info(`CompendiumSyncService | Creating new item: ${equipment.name}`);
            const ItemClass = (CONFIG as any).Item.documentClass;
            const newItem = await ItemClass.create(itemData, { pack: this.PACK_NAME });
            return newItem;
        }

        return null;
    }

    /**
     * Sync all equipment from all Characters in Redux state to the compendium
     */
    static async syncAll(): Promise<void> {
        if (!game.user!.isGM) {
            ui.notifications!.warn('Only the GM can sync to the compendium.');
            return;
        }

        const pack = this.getPack();
        if (!pack) {
            ui.notifications!.error(`Compendium ${this.PACK_NAME} not found.`);
            return;
        }

        if (pack.locked) {
            ui.notifications!.warn(`Compendium ${this.PACK_NAME} is locked. Please unlock it first.`);
            return;
        }

        logger.info('CompendiumSyncService | Starting full sync from Redux state...');
        ui.notifications!.info('Compendium Sync: Starting...');

        let createdCount = 0;
        let updatedCount = 0;
        const seenNames = new Set<string>();

        // Get all characters from Redux state
        const state = game.fitgd?.store?.getState();
        if (!state || !state.characters) {
            ui.notifications!.error('Cannot access Redux state. Game may not be fully initialized.');
            return;
        }

        const characters = Object.values(state.characters.byId);
        logger.info(`CompendiumSyncService | Found ${characters.length} characters in Redux state`);

        // Iterate all characters and their equipment
        for (const character of characters) {
            if (!character || !character.equipment) continue;

            logger.info(`CompendiumSyncService | Processing character: ${character.name} (${character.equipment.length} items)`);

            for (const equipment of character.equipment) {
                if (seenNames.has(equipment.name)) continue; // Skip duplicates in this pass
                seenNames.add(equipment.name);

                try {
                    // Check existence in compendium
                    const existingIndex = pack.index.find((i: any) => i.name === equipment.name);

                    // Convert Redux equipment to Foundry Item data
                    const itemData = this.equipmentToItemData(equipment);

                    if (existingIndex) {
                        // Update existing
                        const existingItem = await pack.getDocument(existingIndex._id) as any;
                        if (existingItem) {
                            await existingItem.update(itemData);
                            updatedCount++;
                            logger.info(`CompendiumSyncService | Updated: ${equipment.name}`);
                        }
                    } else {
                        // Create new
                        const ItemClass = (CONFIG as any).Item.documentClass;
                        await ItemClass.create(itemData, { pack: this.PACK_NAME });
                        createdCount++;
                        logger.info(`CompendiumSyncService | Created: ${equipment.name}`);
                    }
                } catch (err) {
                    logger.error(`CompendiumSyncService | Failed to sync ${equipment.name}:`, err);
                }
            }
        }

        logger.info(`CompendiumSyncService | Sync complete. Created ${createdCount}, Updated ${updatedCount}.`);
        ui.notifications!.info(`Compendium Sync: Complete. Created ${createdCount}, Updated ${updatedCount} items.`);
    }

    /**
     * Convert Redux Equipment object to Foundry Item data format
     */
    private static equipmentToItemData(equipment: Equipment): object {
        return {
            name: equipment.name,
            type: 'equipment',
            system: {
                // Store all equipment properties in system data
                category: equipment.category,
                tier: equipment.tier,
                slots: equipment.slots,
                description: equipment.description,
                modifiers: equipment.modifiers || {},
                // Don't copy instance-specific state to compendium (equipped, locked, consumed)
            },
            // Standard Foundry fields
            img: 'icons/svg/item-bag.svg', // Default icon
        };
    }

    /**
     * Helper to get the compendium pack
     */
    private static getPack(): CompendiumCollection<any> | undefined {
        return (game.packs as any).get(this.PACK_NAME);
    }
}
