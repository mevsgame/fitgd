import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createClock, addSegments } from '../../src/slices/clockSlice';
import { createCrew } from '../../src/slices/crewSlice';
import { selectThreatClocksByCrew } from '../../src/selectors/clockSelectors';
import type { Clock } from '../../src/types';

describe('clockSelectors', () => {
  let store: ReturnType<typeof configureStore>;
  let crewId: string;

  beforeEach(() => {
    store = configureStore();

    // Create a crew
    store.dispatch(createCrew({ name: 'Test Crew' }));
    crewId = store.getState().crews.allIds[0];
  });

  describe('selectThreatClocksByCrew', () => {
    it('should return only threat category clocks for crew', () => {
      // Create threat clock
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
          description: 'Enemy Patrol',
        })
      );

      // Create non-threat clock (long-term-project)
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'long-term-project',
          description: 'Investigate Conspiracy',
        })
      );

      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].metadata?.category).toBe('threat');
    });

    it('should return empty array if no threat clocks exist', () => {
      // Create only non-threat clocks
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'long-term-project',
          description: 'Campaign',
        })
      );

      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'personal-goal',
          description: 'Personal Goal',
        })
      );

      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(0);
      expect(threatClocks).toEqual([]);
    });

    it('should handle crew with no clocks at all', () => {
      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(0);
    });

    it('should ignore threat clocks from other crews', () => {
      // Create another crew
      store.dispatch(createCrew({ name: 'Other Crew' }));
      const otherCrewId = store.getState().crews.allIds[1];

      // Create threat clock for this crew
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
        })
      );

      // Create threat clock for other crew
      store.dispatch(
        createClock({
          entityId: otherCrewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
        })
      );

      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].entityId).toBe(crewId);
    });

    it('should handle clocks without metadata gracefully', () => {
      // Create clock with no category
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
        })
      );

      // Create threat clock
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
        })
      );

      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].metadata?.category).toBe('threat');
    });

    it('should memoize selector results', () => {
      // Create a threat clock
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
        })
      );

      const state = store.getState();

      // Call selector twice with same state
      const result1 = selectThreatClocksByCrew(state, crewId);
      const result2 = selectThreatClocksByCrew(state, crewId);

      // Should be same reference (memoized)
      expect(result1).toBe(result2);
    });

    it('should exclude non-threat categories (personal-goal, obstacle, faction)', () => {
      // Create multiple category clocks
      const categories = ['personal-goal', 'obstacle', 'faction', 'long-term-project'] as const;
      for (const category of categories) {
        store.dispatch(
          createClock({
            entityId: crewId,
            clockType: 'progress',
            maxSegments: 6,
            category,
          })
        );
      }

      // Create one threat clock
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'progress',
          maxSegments: 6,
          category: 'threat',
        })
      );

      const threatClocks = selectThreatClocksByCrew(store.getState(), crewId);
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].metadata?.category).toBe('threat');
    });
  });
});
