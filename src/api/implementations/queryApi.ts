import type { Store } from '@reduxjs/toolkit';
import { logger } from '../../utils/logger';
import type { Trait } from '../../types';
import {
  selectStimsAvailable,
  selectIsCharacterDying,
  selectHarmClocksByCharacter,
  selectClocksByEntityId,
  selectClocksByTypeAndEntity,
} from '../../selectors/clockSelectors';
import { DEFAULT_CONFIG } from '../../config';

/**
 * Query API Implementation
 *
 * High-level functions for querying game state
 */
export function createQueryAPI(store: Store) {
  return {
    /**
     * Can character use Rally?
     */
    canUseRally(params: { characterId: string; crewId: string }): boolean {
      const { characterId, crewId } = params;

      const state = store.getState();
      const character = state.characters.byId[characterId];
      const crew = state.crews.byId[crewId];

      if (!character || !crew) {
        return false;
      }

      // Rally only available at 0-3 Momentum
      const maxMomentumForRally =
        DEFAULT_CONFIG.rally?.maxMomentumToUse ?? 3;
      const momentumOk = crew.currentMomentum <= maxMomentumForRally;

      // Rally must be available
      const rallyAvailable = character.rallyAvailable;

      return momentumOk && rallyAvailable;
    },

    /**
     * Can crew use stims?
     */
    canUseStim(_crewId: string): boolean {
      const state = store.getState();
      return selectStimsAvailable(state);
    },


    /**
     * Is character dying? (has 6/6 harm clock)
     */
    isDying(characterId: string): boolean {
      const state = store.getState();
      return selectIsCharacterDying(state, characterId);
    },

    /**
     * Get current Momentum
     */
    getMomentum(crewId: string): number {
      const state = store.getState();
      const crew = state.crews.byId[crewId];
      return crew?.currentMomentum ?? 0;
    },

    /**
     * Get available (not disabled) traits
     */
    getAvailableTraits(characterId: string): Trait[] {
      const state = store.getState();
      const character = state.characters.byId[characterId];

      if (!character) {
        return [];
      }

      return character.traits.filter((t: Trait) => !t.disabled);
    },

    /**
     * Get all harm clocks for character
     */
    getHarmClocks(characterId: string): Array<{
      id: string;
      subtype: string;
      clockType: string;
      segments: number;
      maxSegments: number;
      metadata?: any;
    }> {
      const state = store.getState();
      const harmClocks = selectHarmClocksByCharacter(state, characterId);
      logger.debug(`queryApi.getHarmClocks(${characterId}): found ${harmClocks.length} clocks`, harmClocks);

      // Log the index to check for duplicates
      const key = `harm:${characterId}`;
      const clockIds = state.clocks.byTypeAndEntity[key] || [];
      logger.debug(`byTypeAndEntity index for ${key}:`, clockIds);

      // Check for duplicate IDs in the index
      const uniqueIds = new Set(clockIds);
      if (uniqueIds.size !== clockIds.length) {
        console.error(`FitGD | DUPLICATE CLOCK IDS IN INDEX! ${clockIds.length} total, ${uniqueIds.size} unique`);
        console.error(`FitGD | Duplicate IDs:`, clockIds);
      }

      const result = harmClocks.map((clock) => ({
        id: clock.id,
        subtype: clock.subtype ?? 'Unknown',
        clockType: clock.clockType,
        segments: clock.segments,
        maxSegments: clock.maxSegments,
        metadata: clock.metadata,
      }));
      logger.debug(`queryApi.getHarmClocks result:`, result);

      return result;
    },

    /**
     * Get all progress clocks for entity
     */
    getProgressClocks(entityId: string): Array<{
      id: string;
      name: string;
      segments: number;
      maxSegments: number;
      category?: string;
      isCountdown?: boolean;
    }> {
      const state = store.getState();
      const allClocks = selectClocksByEntityId(state, entityId);

      // Filter to only progress clocks
      const progressClocks = allClocks.filter(
        (clock) => clock.clockType === 'progress'
      );

      return progressClocks.map((clock) => ({
        id: clock.id,
        name: clock.subtype ?? 'Unknown',
        clockType: 'progress' as const,
        segments: clock.segments,
        maxSegments: clock.maxSegments,
        category: clock.metadata?.category as string | undefined,
        isCountdown: clock.metadata?.isCountdown as boolean | undefined,
      }));
    },

    /**
     * Get addiction clock for crew
     */
    getAddictionClock(crewId: string): {
      id: string;
      segments: number;
      maxSegments: number;
    } | null {
      const state = store.getState();
      const clock = selectClocksByTypeAndEntity(state, 'addiction', crewId)[0];

      if (!clock) return null;

      return {
        id: clock.id,
        segments: clock.segments,
        maxSegments: clock.maxSegments,
      };
    },

  };
}
