/**
 * Clock Interaction Integration Tests
 *
 * Tests for Redux integration of clock interaction system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import clockReducer, { createClock, applyInteraction } from '@/slices/clockSlice';
import type { ClockState } from '@/slices/clockSlice';
import type { ClockInteraction } from '@/types/clockInteraction';

describe('applyInteraction Redux integration', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        clocks: clockReducer
      }
    });
  });

  describe('advancing clocks', () => {
    it('should advance harm clock by 3 segments', () => {
      // Create harm clock
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Apply interaction: advance by 3
      const interaction: ClockInteraction = {
        clockId,
        direction: 'advance',
        amount: 3,
        context: 'Risky failure'
      };

      store.dispatch(applyInteraction({ interaction }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(3);
      expect(clock.maxSegments).toBe(6);
    });

    it('should cap clock at maxSegments', () => {
      // Create harm clock with 5 segments
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Set to 5 segments
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 5 }
      }));

      // Try to add 4 more (would be 9, but should cap at 6)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 4 }
      }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(6); // Capped at maxSegments
    });

    it('should advance progress clock by position+effect', () => {
      // Create progress clock
      store.dispatch(createClock({
        entityId: 'crew-1',
        clockType: 'progress',
        subtype: 'Infiltrate Vault',
        maxSegments: 8,
        category: 'long-term-project'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Apply interaction: advance by 4 (risky + great)
      const interaction: ClockInteraction = {
        clockId,
        direction: 'advance',
        amount: 4,
        context: 'Success at risky/great'
      };

      store.dispatch(applyInteraction({ interaction }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(4);
    });

    it('should advance threat clock on failure', () => {
      // Create threat clock
      store.dispatch(createClock({
        entityId: 'crew-1',
        clockType: 'progress',
        subtype: 'Enemy Reinforcements',
        maxSegments: 8,
        isCountdown: true,
        category: 'threat'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Apply interaction: advance by 5 (desperate failure)
      const interaction: ClockInteraction = {
        clockId,
        direction: 'advance',
        amount: 5,
        context: 'Desperate failure'
      };

      store.dispatch(applyInteraction({ interaction }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(5);
    });
  });

  describe('reducing clocks', () => {
    it('should reduce harm clock by 2 segments (Rally)', () => {
      // Create harm clock with 4 segments
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Set to 4 segments
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 4 }
      }));

      // Reduce by 2 (Rally success with standard effect)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'reduce', amount: 2, context: 'Rally success' }
      }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(2); // 4 - 2 = 2
    });

    it('should reduce threat clock by 4 segments (Defuse with great effect)', () => {
      // Create threat clock with 6 segments
      store.dispatch(createClock({
        entityId: 'crew-1',
        clockType: 'progress',
        subtype: 'Alarm Level',
        maxSegments: 8,
        isCountdown: true,
        category: 'threat'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Set to 6 segments
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 6 }
      }));

      // Reduce by 4 (Defuse with great effect)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'reduce', amount: 4, context: 'Defuse great effect' }
      }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(2); // 6 - 4 = 2
    });

    it('should auto-delete clock when reduced to 0', () => {
      // Create harm clock with 2 segments
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Set to 2 segments
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 2 }
      }));

      // Reduce by 2 (empties clock)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'reduce', amount: 2, context: 'Full recovery' }
      }));

      const updatedState = store.getState().clocks as ClockState;

      expect(updatedState.byId[clockId]).toBeUndefined();
      expect(updatedState.allIds).not.toContain(clockId);
    });

    it('should not reduce below 0', () => {
      // Create harm clock with 1 segment
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Set to 1 segment
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 1 }
      }));

      // Try to reduce by 4 (should delete at 0, not go negative)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'reduce', amount: 4 }
      }));

      const updatedState = store.getState().clocks as ClockState;

      // Clock should be deleted (reduced to 0)
      expect(updatedState.byId[clockId]).toBeUndefined();
    });
  });

  describe('interaction context logging', () => {
    it('should log interaction context in history', () => {
      // Create harm clock
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Apply interaction with context
      const interaction: ClockInteraction = {
        clockId,
        direction: 'advance',
        amount: 3,
        context: 'Combat failure at risky position'
      };

      store.dispatch(applyInteraction({
        interaction,
        context: {
          outcome: 'failure',
          position: 'risky',
          effect: 'standard',
          characterId: 'char-1',
          crewId: 'crew-1',
          actionType: 'combat'
        }
      }));

      const updatedState = store.getState().clocks as ClockState;

      // Check history
      const lastCommand = updatedState.history[updatedState.history.length - 1];
      expect(lastCommand.type).toBe('clocks/applyInteraction');
      expect(lastCommand.payload).toHaveProperty('interaction');
      expect(lastCommand.payload).toHaveProperty('context');
    });
  });

  describe('special cases', () => {
    it('should handle consumable clock freezing when filled', () => {
      // Create consumable clock
      store.dispatch(createClock({
        entityId: 'crew-1',
        clockType: 'consumable',
        subtype: 'grenades',
        rarity: 'common',
        tier: 'accessible'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Fill clock (8 segments for common)
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 8 }
      }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(8);
      expect(clock.metadata.frozen).toBe(true);
      expect(clock.metadata.tier).toBe('inaccessible');
    });

    it('should throw error for non-existent clock', () => {
      const interaction: ClockInteraction = {
        clockId: 'non-existent-id',
        direction: 'advance',
        amount: 3
      };

      expect(() => {
        store.dispatch(applyInteraction({ interaction }));
      }).toThrow();
    });
  });

  describe('multiple interactions', () => {
    it('should handle multiple interactions on same clock', () => {
      // Create harm clock
      store.dispatch(createClock({
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm'
      }));

      const state = store.getState().clocks as ClockState;
      const clockId = state.allIds[0];

      // Advance by 3
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 3 }
      }));

      // Advance by 2 more
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'advance', amount: 2 }
      }));

      // Reduce by 1
      store.dispatch(applyInteraction({
        interaction: { clockId, direction: 'reduce', amount: 1 }
      }));

      const updatedState = store.getState().clocks as ClockState;
      const clock = updatedState.byId[clockId];

      expect(clock.segments).toBe(4); // 3 + 2 - 1 = 4
    });
  });
});
