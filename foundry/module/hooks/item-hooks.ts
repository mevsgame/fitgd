/**
 * Item Hooks
 *
 * Handles Item lifecycle events.
 * 
 * NOTE: Currently disabled because equipment is stored in Redux state, not as Foundry Items.
 * The CompendiumSyncService reads from Redux state via the "Sync All" button.
 * 
 * TODO: If automatic sync is needed, subscribe to Redux store changes or
 * add middleware to catch addEquipment/updateEquipment actions.
 */

import { logger } from '../utils/logger';

/**
 * Register all item-related hooks
 */
export function registerItemHooks(): void {
    logger.info('ItemHooks | Registered (manual sync mode - use Compendium Utilities to sync)');

    // Automatic Foundry Item sync is disabled because equipment lives in Redux state.
    // The CompendiumSyncService.syncAll() reads directly from Redux state.
    // 
    // To enable automatic sync on equipment changes, we would need to:
    // 1. Subscribe to Redux store changes for equipment actions, OR
    // 2. Add Redux middleware to intercept addEquipment/updateEquipment actions
}
