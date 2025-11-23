/**
 * Player Round State Machine - Scenario Tests
 *
 * Tests complete gameplay workflows through the state machine.
 * These are higher-level tests that verify entire sequences of state transitions
 * and ensure the state machine enforces game rules correctly.
 *
 * Tests are organized by gameplay scenario rather than individual functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import playerRoundStateReducer, {
  initializePlayerState,
  setActivePlayer,
  setActionPlan,
  transitionState,
  setRollResult,
  setConsequence,
  resetPlayerState,
} from '../../src/slices/playerRoundStateSlice';
import { isValidTransition, STATE_TRANSITIONS } from '../../src/types/playerRoundState';
import type { PlayerRoundStateType } from '../../src/types/playerRoundState';

describe('playerRoundState - Scenario Tests', () => {
  let store: ReturnType<typeof configureStore>;
  const characterId = 'test-char';

  beforeEach(() => {
    store = configureStore();
  });

  describe('Basic Action Roll Scenario', () => {
    it('should complete a full action roll from IDLE to TURN_COMPLETE', () => {
      // Start: Initialize to IDLE_WAITING
      store.dispatch(initializePlayerState({ characterId }));
      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('IDLE_WAITING');

      // Transition to DECISION_PHASE
      store.dispatch(setActivePlayer({ characterId }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('DECISION_PHASE');

      // Set action plan
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.selectedApproach).toBe('force');
      expect(state.state).toBe('DECISION_PHASE'); // Doesn't auto-transition

      // Commit roll
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('ROLLING');

      // Set roll result
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 5, 3],
          outcome: 'success',
        })
      );

      // Transition to SUCCESS_COMPLETE
      store.dispatch(transitionState({ characterId, newState: 'SUCCESS_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('SUCCESS_COMPLETE');

      // Complete turn
      store.dispatch(transitionState({ characterId, newState: 'TURN_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('TURN_COMPLETE');
    });
  });

  describe('Action Roll with Consequence Scenario', () => {
    it('should handle complete failure → consequence → acceptance → end', () => {
      // Setup: IDLE → DECISION_PHASE → Action Plan → ROLLING
      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'guile',
          position: 'desperate',
          effect: 'limited',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));

      // Roll failure (no sixes)
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 2,
          rollResult: [3, 2],
          outcome: 'failure',
        })
      );

      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.outcome).toBe('failure');

      // Transition to GM_RESOLVING_CONSEQUENCE
      store.dispatch(
        transitionState({ characterId, newState: 'GM_RESOLVING_CONSEQUENCE' })
      );
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('GM_RESOLVING_CONSEQUENCE');

      // GM sets consequence
      store.dispatch(
        setConsequence({
          characterId,
          consequenceType: 'harm',
          consequenceValue: 5,
          momentumGain: 4,
        })
      );
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.consequenceType).toBe('harm');
      expect(state.consequenceValue).toBe(5);

      // Apply effects
      store.dispatch(transitionState({ characterId, newState: 'APPLYING_EFFECTS' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('APPLYING_EFFECTS');

      // End turn
      store.dispatch(transitionState({ characterId, newState: 'TURN_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('TURN_COMPLETE');
    });
  });

  describe('Stims Interruption Scenario', () => {
    it('should allow player to use stims and reroll from GM_RESOLVING_CONSEQUENCE', () => {
      // Setup to GM_RESOLVING_CONSEQUENCE
      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'great',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [5, 3, 2],
          outcome: 'partial',
        })
      );
      store.dispatch(
        transitionState({ characterId, newState: 'GM_RESOLVING_CONSEQUENCE' })
      );

      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('GM_RESOLVING_CONSEQUENCE');

      // Player uses stims - interrupt consequence resolution
      store.dispatch(transitionState({ characterId, newState: 'STIMS_ROLLING' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('STIMS_ROLLING');

      // Player rolls addiction check
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 1,
          rollResult: [6],
          outcome: 'success',
        })
      );

      // Reroll original action
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('ROLLING');

      // Get new result (success this time)
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 5, 4],
          outcome: 'success',
        })
      );

      // Back to success path
      store.dispatch(transitionState({ characterId, newState: 'SUCCESS_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('SUCCESS_COMPLETE');
    });
  });

  describe('Multiple Player Turns Scenario', () => {
    it('should manage multiple characters in separate states', () => {
      const char1 = 'char-1';
      const char2 = 'char-2';

      // Initialize both
      store.dispatch(initializePlayerState({ characterId: char1 }));
      store.dispatch(initializePlayerState({ characterId: char2 }));

      let state1 = store.getState().playerRoundState.byCharacterId[char1];
      let state2 = store.getState().playerRoundState.byCharacterId[char2];
      expect(state1.state).toBe('IDLE_WAITING');
      expect(state2.state).toBe('IDLE_WAITING');

      // Char1 takes a turn
      store.dispatch(setActivePlayer({ characterId: char1 }));
      state1 = store.getState().playerRoundState.byCharacterId[char1];
      state2 = store.getState().playerRoundState.byCharacterId[char2];
      expect(state1.state).toBe('DECISION_PHASE');
      expect(state2.state).toBe('IDLE_WAITING'); // Unaffected

      // Char1 rolls
      store.dispatch(
        setActionPlan({
          characterId: char1,
          approach: 'force',
          position: 'controlled',
          effect: 'standard',
        })
      );
      store.dispatch(transitionState({ characterId: char1, newState: 'ROLLING' }));
      state1 = store.getState().playerRoundState.byCharacterId[char1];
      expect(state1.state).toBe('ROLLING');

      // Char2 now takes a turn (becomes active, char1 transitions back)
      store.dispatch(setActivePlayer({ characterId: char2 }));
      state1 = store.getState().playerRoundState.byCharacterId[char1];
      state2 = store.getState().playerRoundState.byCharacterId[char2];
      // When a new player becomes active, the old active player transitions back to IDLE_WAITING
      expect(state1.state).toBe('IDLE_WAITING');
      expect(state2.state).toBe('DECISION_PHASE'); // Now their turn

      // Char2 completes their turn
      store.dispatch(
        setActionPlan({
          characterId: char2,
          approach: 'guile',
          position: 'desperate',
          effect: 'limited',
        })
      );
      store.dispatch(transitionState({ characterId: char2, newState: 'ROLLING' }));
      store.dispatch(
        setRollResult({
          characterId: char2,
          dicePool: 1,
          rollResult: [6],
          outcome: 'critical',
        })
      );
      store.dispatch(transitionState({ characterId: char2, newState: 'SUCCESS_COMPLETE' }));
      store.dispatch(transitionState({ characterId: char2, newState: 'TURN_COMPLETE' }));
      state2 = store.getState().playerRoundState.byCharacterId[char2];
      expect(state2.state).toBe('TURN_COMPLETE');

      // Char1 is back in IDLE_WAITING (as expected after losing active status)
      state1 = store.getState().playerRoundState.byCharacterId[char1];
      expect(state1.state).toBe('IDLE_WAITING');
    });
  });

  describe('State Machine Invariants', () => {
    it('should only allow documented transitions', () => {
      // Verify every state can only transition to documented next states
      const transitions = STATE_TRANSITIONS;

      Object.entries(transitions).forEach(([currentState, allowedNextStates]) => {
        const validCurrentState = currentState as PlayerRoundStateType;

        // Each allowed transition is bidirectional or intentional
        allowedNextStates.forEach((nextState) => {
          const isValid = isValidTransition(validCurrentState, nextState);
          expect(isValid).toBe(true);
        });
      });
    });

    it('should prevent invalid transitions', () => {
      store.dispatch(initializePlayerState({ characterId }));
      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('IDLE_WAITING');

      // Try invalid: IDLE_WAITING → ROLLING (not allowed)
      expect(() => {
        store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      }).toThrow('Invalid state transition');

      // State should be unchanged
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('IDLE_WAITING');
    });

    it('should maintain state history for undo', () => {
      store.dispatch(initializePlayerState({ characterId }));
      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.previousState).toBeUndefined();

      // Manual transition to DECISION_PHASE (setActivePlayer doesn't preserve history, it resets)
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      // Transition via transitionState which preserves history
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('ROLLING');
      expect(state.previousState?.state).toBe('DECISION_PHASE');

      // Another transition
      store.dispatch(transitionState({ characterId, newState: 'SUCCESS_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('SUCCESS_COMPLETE');
      expect(state.previousState?.state).toBe('ROLLING');
    });
  });

  describe('Partial Success Edge Cases', () => {
    it('should handle partial success with optional consequences', () => {
      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));

      // Partial success (one 4-5)
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 2,
          rollResult: [4, 2],
          outcome: 'partial',
        })
      );

      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.outcome).toBe('partial');

      // GM can choose: consequence or success
      // Path A: Consequence
      store.dispatch(
        transitionState({ characterId, newState: 'GM_RESOLVING_CONSEQUENCE' })
      );
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('GM_RESOLVING_CONSEQUENCE');
    });
  });

  describe('Critical Success Path', () => {
    it('should handle critical success (2+ sixes)', () => {
      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'spirit',
          position: 'desperate',
          effect: 'great',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));

      // Critical success (two 6s)
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 6, 3],
          outcome: 'critical',
        })
      );

      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.outcome).toBe('critical');

      // Should transition to SUCCESS_COMPLETE (not consequence)
      store.dispatch(transitionState({ characterId, newState: 'SUCCESS_COMPLETE' }));
      state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('SUCCESS_COMPLETE');
    });
  });

  describe('Turn Reset Scenario', () => {
    it('should reset player state completely for new turn', () => {
      // Setup a complete turn
      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 4, 2],
          outcome: 'success',
        })
      );
      store.dispatch(transitionState({ characterId, newState: 'SUCCESS_COMPLETE' }));
      store.dispatch(transitionState({ characterId, newState: 'TURN_COMPLETE' }));

      let state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('TURN_COMPLETE');
      expect(state.selectedApproach).toBe('force');
      expect(state.rollResult).toBeDefined();

      // Reset for new turn
      store.dispatch(resetPlayerState({ characterId }));
      state = store.getState().playerRoundState.byCharacterId[characterId];

      expect(state.state).toBe('IDLE_WAITING');
      expect(state.selectedApproach).toBeUndefined();
      expect(state.rollResult).toBeUndefined();
      expect(state.position).toBeUndefined();
      expect(state.effect).toBeUndefined();
    });
  });
});




