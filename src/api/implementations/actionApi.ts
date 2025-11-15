import type { Store } from '@reduxjs/toolkit';
import type { Trait } from '../../types';
import type { Position, Effect, ActionPushType, Result } from '../../types/resolution';
import { spendMomentum } from '../../slices/crewSlice';
import { createTraitFromFlashback } from '../../slices/characterSlice';
import {
  resolveActionConsequence,
  applyHarmConsequence,
} from '../../resolution';
import { generateId } from '../../utils/uuid';

/**
 * Action API Implementation
 *
 * High-level functions for action rolls and Momentum spending
 */
export function createActionAPI(store: Store) {
  return {
    /**
     * Push yourself (spend 1 Momentum for advantage)
     */
    push(params: {
      crewId: string;
      type: ActionPushType;
    }): { momentumSpent: number; newMomentum: number; pushType: string } {
      const { crewId, type } = params;

      // Push costs 1 Momentum
      const cost = 1;

      store.dispatch(spendMomentum({ crewId, amount: cost }));

      const state = store.getState();
      const newMomentum = state.crews.byId[crewId]?.currentMomentum ?? 0;

      return {
        momentumSpent: cost,
        newMomentum,
        pushType: type,
      };
    },

    /**
     * Perform a flashback (spend 1 Momentum, create trait)
     */
    flashback(params: {
      crewId: string;
      characterId: string;
      trait: Omit<Trait, 'id' | 'acquiredAt' | 'category'>;
    }): { traitId: string; momentumSpent: number; newMomentum: number } {
      const { crewId, characterId, trait } = params;

      // Flashback costs 1 Momentum
      const cost = 1;

      store.dispatch(spendMomentum({ crewId, amount: cost }));

      const traitWithId: Trait = {
        ...trait,
        id: generateId(),
        category: 'flashback',
        disabled: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(
        createTraitFromFlashback({
          characterId,
          trait: traitWithId,
        })
      );

      const state = store.getState();
      const newMomentum = state.crews.byId[crewId]?.currentMomentum ?? 0;

      return {
        traitId: traitWithId.id,
        momentumSpent: cost,
        newMomentum,
      };
    },

    /**
     * Apply consequences from an action roll
     */
    applyConsequences(params: {
      crewId: string;
      characterId: string;
      position: Position;
      effect: Effect;
      result: Result;
      harmType?: string;
    }): {
      momentumGenerated: number;
      newMomentum: number;
      harmApplied?: {
        clockId: string;
        segmentsAdded: number;
        isDying: boolean;
      };
    } {
      const { crewId, characterId, position, effect, result, harmType } = params;

      // Resolve consequences (automatic Momentum generation)
      const consequenceResult = resolveActionConsequence(store, {
        crewId,
        position,
        result,
      });

      // Apply harm if specified
      let harmApplied: {
        clockId: string;
        segmentsAdded: number;
        isDying: boolean;
      } | undefined;

      if (harmType) {
        const harmResult = applyHarmConsequence(store, {
          characterId,
          position,
          effect,
          harmType,
        });

        harmApplied = {
          clockId: harmResult.clockId,
          segmentsAdded: harmResult.segmentsAdded,
          isDying: harmResult.isDying,
        };
      }

      const state = store.getState();
      const newMomentum = state.crews.byId[crewId]?.currentMomentum ?? 0;

      return {
        momentumGenerated: consequenceResult.momentumGenerated,
        newMomentum,
        harmApplied,
      };
    },
  };
}
