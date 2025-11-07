import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import playerRoundStateReducer, {
  initializePlayerState,
  transitionState,
  setActivePlayer,
  setActionPlan,
  setImprovements,
  setRollResult,
  setConsequence,
  resetPlayerState,
  undoState,
  clearAllStates,
} from '../../src/slices/playerRoundStateSlice';
import { isValidTransition } from '../../src/types/playerRoundState';
import type { PlayerRoundState, PlayerRoundStateType } from '../../src/types/playerRoundState';

describe('playerRoundStateSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        playerRoundState: playerRoundStateReducer,
      },
    });
  });

  describe('initializePlayerState', () => {
    it('should initialize a new player state in IDLE_WAITING', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      expect(playerState).toBeDefined();
      expect(playerState.characterId).toBe(characterId);
      expect(playerState.state).toBe('IDLE_WAITING');
      expect(playerState.selectedAction).toBeUndefined();
      expect(playerState.position).toBeUndefined();
      expect(playerState.effect).toBeUndefined();
      expect(playerState.pushed).toBeUndefined();
      expect(playerState.outcome).toBeUndefined();
      expect(playerState.previousState).toBeUndefined();
      expect(playerState.stateEnteredAt).toBeDefined();
    });

    it('should overwrite existing player state when re-initialized', () => {
      const characterId = 'char-123';

      // Initialize first time
      store.dispatch(initializePlayerState({ characterId }));

      // Set action plan
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'desperate',
          effect: 'great',
        })
      );

      // Initialize again - should reset to initial state
      store.dispatch(initializePlayerState({ characterId }));

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      // Should be reset to initial state
      expect(playerState.state).toBe('IDLE_WAITING');
      expect(playerState.selectedAction).toBeUndefined();
      expect(playerState.position).toBeUndefined();
      expect(playerState.effect).toBeUndefined();
    });
  });

  describe('setActivePlayer', () => {
    it('should set the active player and initialize if needed', () => {
      const characterId = 'char-456';

      store.dispatch(setActivePlayer({ characterId }));

      const state = store.getState().playerRoundState;

      expect(state.activeCharacterId).toBe(characterId);
      expect(state.byCharacterId[characterId]).toBeDefined();
      expect(state.byCharacterId[characterId].state).toBe('DECISION_PHASE');
    });

    it('should transition existing IDLE_WAITING player to DECISION_PHASE', () => {
      const characterId = 'char-456';

      // Initialize in IDLE_WAITING
      store.dispatch(initializePlayerState({ characterId }));

      // Set as active player
      store.dispatch(setActivePlayer({ characterId }));

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      expect(playerState.state).toBe('DECISION_PHASE');
      expect(state.activeCharacterId).toBe(characterId);
    });
  });

  describe('transitionState', () => {
    it('should transition to a valid next state', () => {
      const characterId = 'char-789';

      // Initialize and set to DECISION_PHASE
      store.dispatch(setActivePlayer({ characterId }));

      // Transition to ROLL_CONFIRM
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLL_CONFIRM',
        })
      );

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      expect(playerState.state).toBe('ROLL_CONFIRM');
      expect(playerState.previousState).toBeDefined();
      expect(playerState.previousState?.state).toBe('DECISION_PHASE');
    });

    it('should reject invalid state transitions', () => {
      const characterId = 'char-789';

      // Initialize in IDLE_WAITING
      store.dispatch(initializePlayerState({ characterId }));

      // Try invalid transition: IDLE_WAITING -> ROLLING (not allowed)
      expect(() => {
        store.dispatch(
          transitionState({
            characterId,
            newState: 'ROLLING',
          })
        );
      }).toThrow('Invalid state transition');

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      // Should remain in IDLE_WAITING
      expect(playerState.state).toBe('IDLE_WAITING');
    });

    it('should store previous state for undo', () => {
      const characterId = 'char-789';

      store.dispatch(setActivePlayer({ characterId }));
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLL_CONFIRM',
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];
      expect(playerState.state).toBe('ROLL_CONFIRM');
      expect(playerState.previousState).toBeDefined();
      expect(playerState.previousState?.state).toBe('DECISION_PHASE');
    });
  });

  describe('setActionPlan', () => {
    it('should set action plan without auto-transitioning', () => {
      const characterId = 'char-abc';

      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setActionPlan({
          characterId,
          action: 'skirmish',
          position: 'desperate',
          effect: 'standard',
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.selectedAction).toBe('skirmish');
      expect(playerState.position).toBe('desperate');
      expect(playerState.effect).toBe('standard');
      // Should NOT auto-transition - still in DECISION_PHASE
      expect(playerState.state).toBe('DECISION_PHASE');
    });
  });

  describe('setImprovements', () => {
    it('should set improvements (trait, equipment, pushed, flashback)', () => {
      const characterId = 'char-abc';

      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setImprovements({
          characterId,
          selectedTraitId: 'trait-123',
          equippedForAction: ['weapon-1', 'armor-1'],
          pushed: true,
          flashbackApplied: false,
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.selectedTraitId).toBe('trait-123');
      expect(playerState.equippedForAction).toEqual(['weapon-1', 'armor-1']);
      expect(playerState.pushed).toBe(true);
      expect(playerState.flashbackApplied).toBe(false);
    });
  });

  describe('setRollResult', () => {
    it('should set roll result and outcome', () => {
      const characterId = 'char-def';

      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );

      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 6, 4],
          outcome: 'critical',
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.dicePool).toBe(3);
      expect(playerState.rollResult).toEqual([6, 6, 4]);
      expect(playerState.outcome).toBe('critical');
    });
  });

  describe('setConsequence', () => {
    it('should set consequence data', () => {
      const characterId = 'char-ghi';

      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setConsequence({
          characterId,
          consequenceType: 'harm',
          consequenceValue: 2,
          momentumGain: 2,
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.consequenceType).toBe('harm');
      expect(playerState.consequenceValue).toBe(2);
      expect(playerState.momentumGain).toBe(2);
    });

    it('should handle effect consequence', () => {
      const characterId = 'char-ghi';

      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setConsequence({
          characterId,
          consequenceType: 'effect',
          consequenceValue: 1,
          momentumGain: 1,
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.consequenceType).toBe('effect');
      expect(playerState.consequenceValue).toBe(1);
      expect(playerState.momentumGain).toBe(1);
    });
  });

  describe('undoState', () => {
    it('should revert to previous state', () => {
      const characterId = 'char-jkl';

      store.dispatch(setActivePlayer({ characterId }));
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLL_CONFIRM',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('ROLL_CONFIRM');

      store.dispatch(undoState({ characterId }));

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];
      expect(playerState.state).toBe('DECISION_PHASE');
      expect(playerState.previousState).toBeUndefined();
    });

    it('should throw error if no previous state exists', () => {
      const characterId = 'char-jkl';

      store.dispatch(initializePlayerState({ characterId }));

      expect(() => {
        store.dispatch(undoState({ characterId }));
      }).toThrow('No previous state to undo');
    });
  });

  describe('resetPlayerState', () => {
    it('should reset player to IDLE_WAITING and clear action data', () => {
      const characterId = 'char-mno';

      // Set up a complex state
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'desperate',
          effect: 'great',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
        })
      );
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 5],
          outcome: 'critical',
        })
      );

      // Reset
      store.dispatch(resetPlayerState({ characterId }));

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.state).toBe('IDLE_WAITING');
      expect(playerState.selectedAction).toBeUndefined();
      expect(playerState.pushed).toBeUndefined();
      expect(playerState.rollResult).toBeUndefined();
      expect(playerState.outcome).toBeUndefined();
      expect(playerState.consequenceType).toBeUndefined();
    });
  });

  describe('clearAllStates', () => {
    it('should clear all player states and active player', () => {
      // Set up multiple players
      store.dispatch(setActivePlayer({ characterId: 'char-1' }));
      store.dispatch(initializePlayerState({ characterId: 'char-2' }));
      store.dispatch(initializePlayerState({ characterId: 'char-3' }));

      expect(Object.keys(store.getState().playerRoundState.byCharacterId)).toHaveLength(3);
      expect(store.getState().playerRoundState.activeCharacterId).toBe('char-1');

      // Clear all
      store.dispatch(clearAllStates());

      const state = store.getState().playerRoundState;

      expect(Object.keys(state.byCharacterId)).toHaveLength(0);
      expect(state.activeCharacterId).toBeNull();
    });
  });

  describe('state transition validation', () => {
    it('should validate all legal transitions', () => {
      // Test a few key transitions
      expect(isValidTransition('IDLE_WAITING', 'DECISION_PHASE')).toBe(true);
      expect(isValidTransition('DECISION_PHASE', 'ROLL_CONFIRM')).toBe(true);
      expect(isValidTransition('ROLL_CONFIRM', 'ROLLING')).toBe(true);
      expect(isValidTransition('ROLLING', 'SUCCESS_COMPLETE')).toBe(true);
      expect(isValidTransition('ROLLING', 'CONSEQUENCE_CHOICE')).toBe(true);
    });

    it('should reject illegal transitions', () => {
      expect(isValidTransition('IDLE_WAITING', 'ROLLING')).toBe(false);
      expect(isValidTransition('DECISION_PHASE', 'SUCCESS_COMPLETE')).toBe(false);
      expect(isValidTransition('ROLL_CONFIRM', 'CONSEQUENCE_CHOICE')).toBe(false);
    });
  });

  describe('complete workflow', () => {
    it('should handle a successful roll workflow', () => {
      const characterId = 'char-workflow';

      // 1. Set active player (initializes to DECISION_PHASE)
      store.dispatch(setActivePlayer({ characterId }));
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      // 2. Set action plan (doesn't auto-transition)
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      // 3. Transition to ROLL_CONFIRM
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLL_CONFIRM',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('ROLL_CONFIRM');

      // 4. Commit roll (ROLL_CONFIRM -> ROLLING)
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLLING',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('ROLLING');

      // 5. Set roll result
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 5, 3],
          outcome: 'critical',
        })
      );

      // 6. Transition to SUCCESS_COMPLETE
      store.dispatch(
        transitionState({
          characterId,
          newState: 'SUCCESS_COMPLETE',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('SUCCESS_COMPLETE');

      // 7. Complete turn (SUCCESS_COMPLETE -> TURN_COMPLETE)
      store.dispatch(
        transitionState({
          characterId,
          newState: 'TURN_COMPLETE',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('TURN_COMPLETE');
    });

    it('should handle a failed roll with consequence workflow', () => {
      const characterId = 'char-fail-workflow';

      // Setup
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'skulk',
          position: 'desperate',
          effect: 'standard',
        })
      );
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLL_CONFIRM',
        })
      );
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLLING',
        })
      );

      // Roll failure
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 2,
          rollResult: [3, 2],
          outcome: 'failure',
        })
      );

      // ROLLING -> CONSEQUENCE_CHOICE
      store.dispatch(
        transitionState({
          characterId,
          newState: 'CONSEQUENCE_CHOICE',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('CONSEQUENCE_CHOICE');

      // Choose consequence
      store.dispatch(
        setConsequence({
          characterId,
          consequenceType: 'harm',
          consequenceValue: 4,
          momentumGain: 4,
        })
      );

      // CONSEQUENCE_CHOICE -> CONSEQUENCE_RESOLUTION
      store.dispatch(
        transitionState({
          characterId,
          newState: 'CONSEQUENCE_RESOLUTION',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('CONSEQUENCE_RESOLUTION');

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];
      expect(playerState.consequenceType).toBe('harm');
      expect(playerState.consequenceValue).toBe(4);
      expect(playerState.momentumGain).toBe(4);
    });
  });
});
