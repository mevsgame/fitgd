import type { Store } from '@reduxjs/toolkit';
import { useStim } from '../../resources';

/**
 * Resource API Implementation
 *
 * High-level functions for stims
 */
export function createResourceAPI(store: Store) {
  return {
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
