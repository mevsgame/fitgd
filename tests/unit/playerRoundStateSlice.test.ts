import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
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
  setConsequenceTransaction,
  updateConsequenceTransaction,
  clearConsequenceTransaction,
  setStimsUsed,
  clearStimsUsed,
} from '../../src/slices/playerRoundStateSlice';
import { isValidTransition } from '../../src/types/playerRoundState';
import type { PlayerRoundState, PlayerRoundStateType } from '../../src/types/playerRoundState';

describe('playerRoundStateSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore();
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
      expect(playerState.selectedApproach).toBeUndefined();
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
          approach: 'force',
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
      expect(playerState.selectedApproach).toBeUndefined();
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

      // Transition to ROLLING (ROLL_CONFIRM state was removed)
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLLING',
        })
      );

      const state = store.getState().playerRoundState;
      const playerState = state.byCharacterId[characterId];

      expect(playerState.state).toBe('ROLLING');
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
          newState: 'ROLLING',
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];
      expect(playerState.state).toBe('ROLLING');
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
          approach: 'force',
          position: 'desperate',
          effect: 'standard',
        })
      );

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];

      expect(playerState.selectedApproach).toBe('force');
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
          approach: 'force',
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


  });

  describe('undoState', () => {
    it('should revert to previous state', () => {
      const characterId = 'char-jkl';

      store.dispatch(setActivePlayer({ characterId }));
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLLING',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('ROLLING');

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
          approach: 'force',
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
      expect(playerState.selectedApproach).toBeUndefined();
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
      // Test key transitions
      expect(isValidTransition('IDLE_WAITING', 'DECISION_PHASE')).toBe(true);
      expect(isValidTransition('DECISION_PHASE', 'ROLLING')).toBe(true);
      expect(isValidTransition('ROLLING', 'SUCCESS_COMPLETE')).toBe(true);
      expect(isValidTransition('ROLLING', 'GM_RESOLVING_CONSEQUENCE')).toBe(true);
      expect(isValidTransition('DECISION_PHASE', 'RALLY_ROLLING')).toBe(true);
    });

    it('should reject illegal transitions', () => {
      expect(isValidTransition('IDLE_WAITING', 'ROLLING')).toBe(false);
      expect(isValidTransition('DECISION_PHASE', 'SUCCESS_COMPLETE')).toBe(false);
      expect(isValidTransition('ROLLING', 'TURN_COMPLETE')).toBe(false);
      expect(isValidTransition('SUCCESS_COMPLETE', 'GM_RESOLVING_CONSEQUENCE')).toBe(false);
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
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('DECISION_PHASE');

      // 3. Commit roll (DECISION_PHASE -> ROLLING directly, ROLL_CONFIRM removed)
      store.dispatch(
        transitionState({
          characterId,
          newState: 'ROLLING',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('ROLLING');

      // 4. Set roll result
      store.dispatch(
        setRollResult({
          characterId,
          dicePool: 3,
          rollResult: [6, 5, 3],
          outcome: 'critical',
        })
      );

      // 5. Transition to SUCCESS_COMPLETE
      store.dispatch(
        transitionState({
          characterId,
          newState: 'SUCCESS_COMPLETE',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('SUCCESS_COMPLETE');

      // 6. Complete turn (SUCCESS_COMPLETE -> TURN_COMPLETE)
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
          approach: 'guile',
          position: 'desperate',
          effect: 'standard',
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

      // ROLLING -> GM_RESOLVING_CONSEQUENCE (GM-driven consequence flow)
      store.dispatch(
        transitionState({
          characterId,
          newState: 'GM_RESOLVING_CONSEQUENCE',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('GM_RESOLVING_CONSEQUENCE');

      // Set consequence
      store.dispatch(
        setConsequence({
          characterId,
          consequenceType: 'harm',
          consequenceValue: 4,
          momentumGain: 4,
        })
      );

      // GM_RESOLVING_CONSEQUENCE -> APPLYING_EFFECTS
      store.dispatch(
        transitionState({
          characterId,
          newState: 'APPLYING_EFFECTS',
        })
      );
      expect(store.getState().playerRoundState.byCharacterId[characterId].state).toBe('APPLYING_EFFECTS');

      const playerState = store.getState().playerRoundState.byCharacterId[characterId];
      expect(playerState.consequenceType).toBe('harm');
      expect(playerState.consequenceValue).toBe(4);
      expect(playerState.momentumGain).toBe(4);
    });
  });

  describe('GM_RESOLVING_CONSEQUENCE state transitions', () => {
    it('should allow GM_RESOLVING_CONSEQUENCE -> APPLYING_EFFECTS', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(transitionState({ characterId, newState: 'DECISION_PHASE' }));
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      store.dispatch(transitionState({ characterId, newState: 'GM_RESOLVING_CONSEQUENCE' }));

      // Transition to APPLYING_EFFECTS
      store.dispatch(transitionState({ characterId, newState: 'APPLYING_EFFECTS' }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('APPLYING_EFFECTS');
    });

    it('should allow GM_RESOLVING_CONSEQUENCE -> STIMS_ROLLING (player interrupts)', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(transitionState({ characterId, newState: 'DECISION_PHASE' }));
      store.dispatch(transitionState({ characterId, newState: 'ROLLING' }));
      store.dispatch(transitionState({ characterId, newState: 'GM_RESOLVING_CONSEQUENCE' }));

      // Player interrupts with stims
      store.dispatch(transitionState({ characterId, newState: 'STIMS_ROLLING' }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.state).toBe('STIMS_ROLLING');
    });

    it('should not allow SUCCESS_COMPLETE to auto-transition', () => {
      // SUCCESS_COMPLETE should only transition to TURN_COMPLETE manually
      expect(isValidTransition('SUCCESS_COMPLETE', 'TURN_COMPLETE')).toBe(true);
      expect(isValidTransition('SUCCESS_COMPLETE', 'IDLE_WAITING')).toBe(false);
      expect(isValidTransition('SUCCESS_COMPLETE', 'DECISION_PHASE')).toBe(false);
    });
  });

  describe('consequence transaction actions', () => {
    it('should set consequence transaction', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      const transaction = {
        consequenceType: 'harm' as const,
        harmTargetCharacterId: 'char-456',
        newHarmClockType: 'Physical Harm',
        calculatedHarmSegments: 3,
        calculatedMomentumGain: 2,
      };

      store.dispatch(setConsequenceTransaction({ characterId, transaction }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.consequenceTransaction).toEqual(transaction);
    });

    it('should update consequence transaction partially', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      // Set initial transaction
      const transaction = {
        consequenceType: 'harm' as const,
        calculatedHarmSegments: 3,
        calculatedMomentumGain: 2,
      };
      store.dispatch(setConsequenceTransaction({ characterId, transaction }));

      // Update with new fields
      const updates = {
        harmClockId: 'clock-123',
        harmTargetCharacterId: 'char-456',
      };
      store.dispatch(updateConsequenceTransaction({ characterId, updates }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.consequenceTransaction).toEqual({
        ...transaction,
        ...updates,
      });
    });

    it('should clear consequence transaction', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      // Set transaction
      const transaction = {
        consequenceType: 'harm' as const,
        calculatedHarmSegments: 3,
        calculatedMomentumGain: 2,
      };
      store.dispatch(setConsequenceTransaction({ characterId, transaction }));

      // Clear transaction
      store.dispatch(clearConsequenceTransaction({ characterId }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.consequenceTransaction).toBeUndefined();
    });

    it('should auto-create transaction when updating non-existent transaction', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      // Update without setting first - should auto-create transaction
      // This allows success clock operations on SUCCESS_COMPLETE state
      store.dispatch(
        updateConsequenceTransaction({
          characterId,
          updates: { harmClockId: 'clock-123' },
        })
      );

      const state = store.getState();
      const playerState = state.playerRoundState.byCharacterId[characterId];

      // Transaction should be auto-created with the updates
      expect(playerState?.consequenceTransaction).toBeDefined();
      expect(playerState?.consequenceTransaction?.harmClockId).toBe('clock-123');
      expect(playerState?.consequenceTransaction?.consequenceType).toBe('harm'); // Default type
    });

    it('should handle crew-clock consequence type', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));

      const transaction = {
        consequenceType: 'crew-clock' as const,
        crewClockId: 'clock-999',
        calculatedMomentumGain: 2,
      };

      store.dispatch(setConsequenceTransaction({ characterId, transaction }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.consequenceTransaction?.consequenceType).toBe('crew-clock');
      expect(state.consequenceTransaction?.crewClockId).toBe('clock-999');
    });
  });

  describe('stims tracking actions', () => {
    it('should set stims used flag', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setStimsUsed({ characterId, used: true }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.stimsUsedThisAction).toBe(true);
    });

    it('should clear stims used flag', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setStimsUsed({ characterId, used: true }));

      // Clear flag
      store.dispatch(clearStimsUsed({ characterId }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.stimsUsedThisAction).toBeUndefined();
    });

    it('should allow setting stims used to false', () => {
      const characterId = 'char-123';

      store.dispatch(initializePlayerState({ characterId }));
      store.dispatch(setStimsUsed({ characterId, used: true }));
      store.dispatch(setStimsUsed({ characterId, used: false }));

      const state = store.getState().playerRoundState.byCharacterId[characterId];
      expect(state.stimsUsedThisAction).toBe(false);
    });

    it('should track stims used independently per character', () => {
      const char1 = 'char-123';
      const char2 = 'char-456';

      store.dispatch(initializePlayerState({ characterId: char1 }));
      store.dispatch(initializePlayerState({ characterId: char2 }));

      // Char1 uses stims
      store.dispatch(setStimsUsed({ characterId: char1, used: true }));

      const state = store.getState().playerRoundState;
      expect(state.byCharacterId[char1].stimsUsedThisAction).toBe(true);
      expect(state.byCharacterId[char2].stimsUsedThisAction).toBeUndefined();
    });
  });
});



