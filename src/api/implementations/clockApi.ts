import type { Store } from '@reduxjs/toolkit';
import {
  createClock,
  addSegments,
  clearSegments,
  setSegments,
  deleteClock,
  changeSubtype,
} from '../../slices/clockSlice';
import { isClockFilled } from '../../validators/clockValidator';

/**
 * Clock API Implementation
 *
 * High-level functions for progress/threat clocks
 */
export function createClockAPI(store: Store) {
  return {
    /**
     * Create a progress clock
     */
    createProgress(params: {
      entityId: string;
      name: string;
      segments: 4 | 6 | 8 | 12;
      category?:
        | 'long-term-project'
        | 'threat'
        | 'personal-goal'
        | 'obstacle'
        | 'faction';
      isCountdown?: boolean;
      description?: string;
    }): string {
      const { entityId, name, segments, category, isCountdown, description } =
        params;

      store.dispatch(
        createClock({
          entityId,
          clockType: 'progress',
          subtype: name,
          maxSegments: segments,
          category,
          isCountdown,
          description,
        })
      );

      // Get the ID of the newly created clock
      const state = store.getState();
      return state.clocks.allIds[state.clocks.allIds.length - 1];
    },

    /**
     * Advance a clock (add segments)
     */
    advance(params: {
      clockId: string;
      segments: number;
    }): {
      newSegments: number;
      isFilled: boolean;
    } {
      const { clockId, segments } = params;

      store.dispatch(addSegments({ clockId, amount: segments }));

      const state = store.getState();
      const clock = state.clocks.byId[clockId];

      if (!clock) {
        throw new Error(`Clock ${clockId} not found`);
      }

      return {
        newSegments: clock.segments,
        isFilled: isClockFilled(clock),
      };
    },

    /**
     * Reduce a clock (clear segments)
     */
    reduce(params: {
      clockId: string;
      segments: number;
    }): {
      newSegments: number;
      isCleared: boolean;
    } {
      const { clockId, segments } = params;

      store.dispatch(clearSegments({ clockId, amount: segments }));

      const state = store.getState();
      const clock = state.clocks.byId[clockId];

      if (!clock) {
        throw new Error(`Clock ${clockId} not found`);
      }

      return {
        newSegments: clock.segments,
        isCleared: clock.segments === 0,
      };
    },

    /**
     * Set clock segments directly
     */
    setSegments(params: {
      clockId: string;
      segments: number;
    }): {
      newSegments: number;
      isFilled: boolean;
    } {
      const { clockId, segments } = params;

      store.dispatch(setSegments({ clockId, segments }));

      const state = store.getState();
      const clock = state.clocks.byId[clockId];

      if (!clock) {
        throw new Error(`Clock ${clockId} not found`);
      }

      return {
        newSegments: clock.segments,
        isFilled: isClockFilled(clock),
      };
    },

    /**
     * Rename a clock (changes subtype which is displayed as the name)
     */
    rename(params: {
      clockId: string;
      name: string;
    }): void {
      const { clockId, name } = params;

      store.dispatch(changeSubtype({ clockId, newSubtype: name }));
    },

    /**
     * Delete a clock
     */
    delete(clockId: string): void {
      store.dispatch(deleteClock({ clockId }));
    },
  };
}
