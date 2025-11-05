import type { Store } from '@reduxjs/toolkit';
import { useConsumable, useStim } from '../../resources';

/**
 * Resource API Implementation
 *
 * High-level functions for consumables and stims
 */
export function createResourceAPI(store: Store) {
  return {
    /**
     * Use a consumable item (grenades, medkits, etc.)
     */
    useConsumable(params: {
      crewId: string;
      characterId: string;
      consumableType: string;
      depletionRoll: number;
    }) {
      return useConsumable(store, params);
    },

    /**
     * Use a stim (reroll, risk addiction)
     */
    useStim(params: {
      crewId: string;
      characterId: string;
      addictionRoll: number;
    }) {
      return useStim(store, params);
    },
  };
}
