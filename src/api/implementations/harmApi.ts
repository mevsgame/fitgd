import type { Store } from '@reduxjs/toolkit';
import type { Trait } from '../../types';
import type { Position, Effect } from '../../types/resolution';
import { applyHarmConsequence } from '../../resolution';
import { clearSegments, deleteClock } from '../../slices/clockSlice';
import { addTrait } from '../../slices/characterSlice';
import { isClockFilled } from '../../validators/clockValidator';
import { generateId } from '../../utils/uuid';

/**
 * Harm API Implementation
 *
 * High-level functions for harm management
 */
export function createHarmAPI(store: Store) {
  return {
    /**
     * Take harm (create or add to harm clock)
     */
    take(params: {
      characterId: string;
      harmType: string;
      position: Position;
      effect: Effect;
    }): {
      clockId: string;
      segmentsAdded: number;
      newSegments: number;
      isDying: boolean;
    } {
      const { characterId, harmType, position, effect } = params;

      const result = applyHarmConsequence(store, {
        characterId,
        position,
        effect,
        harmType,
      });

      // Get the current segments from the clock
      const state = store.getState();
      const clock = state.clocks.byId[result.clockId];

      return {
        clockId: result.clockId,
        segmentsAdded: result.segmentsAdded,
        newSegments: clock?.segments ?? result.segmentsAdded,
        isDying: result.isDying,
      };
    },

    /**
     * Recover from harm (clear segments)
     */
    recover(params: {
      characterId: string;
      clockId: string;
      segments: number;
    }): {
      segmentsCleared: number;
      newSegments: number;
      clockCleared: boolean;
    } {
      const { clockId, segments } = params;

      const stateBefore = store.getState();
      const clockBefore = stateBefore.clocks.byId[clockId];

      if (!clockBefore) {
        throw new Error(`Clock ${clockId} not found`);
      }

      const previousSegments = clockBefore.segments;

      store.dispatch(clearSegments({ clockId, amount: segments }));

      const stateAfter = store.getState();
      const clockAfter = stateAfter.clocks.byId[clockId];

      const newSegments = clockAfter.segments;
      const clockCleared = newSegments === 0;

      return {
        segmentsCleared: previousSegments - newSegments,
        newSegments,
        clockCleared,
      };
    },

    /**
     * Convert harm clock to scar trait
     */
    convertToScar(params: {
      characterId: string;
      clockId: string;
      trait: Omit<Trait, 'id' | 'acquiredAt' | 'category'>;
    }): { traitId: string; clockDeleted: boolean } {
      const { characterId, clockId, trait } = params;

      const state = store.getState();
      const clock = state.clocks.byId[clockId];

      if (!clock) {
        throw new Error(`Clock ${clockId} not found`);
      }

      // Clock must be cleared (0 segments) or filled (6/6) to convert
      const isCleared = clock.segments === 0;
      const isFilled = isClockFilled(clock);

      if (!isCleared && !isFilled) {
        throw new Error(
          `Clock must be cleared (0/6) or filled (6/6) to convert to scar trait`
        );
      }

      // Create scar trait
      const traitWithId: Trait = {
        ...trait,
        id: generateId(),
        category: 'scar',
        disabled: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addTrait({ characterId, trait: traitWithId }));

      // Delete the harm clock
      store.dispatch(deleteClock(clockId));

      return {
        traitId: traitWithId.id,
        clockDeleted: true,
      };
    },
  };
}
