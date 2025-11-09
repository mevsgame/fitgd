/**
 * Player Round State Slice
 *
 * Manages the ephemeral state of players during their turns.
 * This is UI state, not persisted to Foundry - it tracks the current round flow.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  PlayerRoundState,
  PlayerRoundStateType,
  Position,
  Effect,
  RollOutcome,
  ConsequenceType,
  createInitialPlayerRoundState,
  isValidTransition,
} from '../types/playerRoundState';
import type { ActionDots } from '../types/character';

/**
 * Player Round State Slice State
 */
export interface PlayerRoundStateSliceState {
  /** Current states by character ID */
  byCharacterId: Record<string, PlayerRoundState>;

  /** Currently active player (whose turn it is) */
  activeCharacterId: string | null;
}

const initialState: PlayerRoundStateSliceState = {
  byCharacterId: {},
  activeCharacterId: null,
};

/**
 * Payload Types
 */
interface InitializePlayerStatePayload {
  characterId: string;
}

interface TransitionStatePayload {
  characterId: string;
  newState: PlayerRoundStateType;
}

interface SetActivePlayerPayload {
  characterId: string;
}

interface SetActionPlanPayload {
  characterId: string;
  action: keyof ActionDots;
  position: Position;
  effect: Effect;
}

interface SetPositionPayload {
  characterId: string;
  position: Position;
}

interface SetEffectPayload {
  characterId: string;
  effect: Effect;
}

interface SetGmApprovedPayload {
  characterId: string;
  approved: boolean;
}

interface SetImprovementsPayload {
  characterId: string;
  selectedTraitId?: string;
  equippedForAction?: string[];
  pushed?: boolean;
  flashbackApplied?: boolean;
}

interface SetRollResultPayload {
  characterId: string;
  dicePool: number;
  rollResult: number[];
  outcome: RollOutcome;
}

interface SetConsequencePayload {
  characterId: string;
  consequenceType: ConsequenceType;
  consequenceValue: number;
  momentumGain: number;
}

interface ResetPlayerStatePayload {
  characterId: string;
}

/**
 * Player Round State Slice
 */
const playerRoundStateSlice = createSlice({
  name: 'playerRoundState',
  initialState,
  reducers: {
    /**
     * Initialize state for a character
     */
    initializePlayerState: (state, action: PayloadAction<InitializePlayerStatePayload>) => {
      const { characterId } = action.payload;
      state.byCharacterId[characterId] = createInitialPlayerRoundState(characterId);
    },

    /**
     * Transition to a new state (with validation)
     */
    transitionState: (state, action: PayloadAction<TransitionStatePayload>) => {
      const { characterId, newState } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      // Validate transition
      if (!isValidTransition(currentState.state, newState)) {
        throw new Error(
          `Invalid state transition: ${currentState.state} -> ${newState}`
        );
      }

      // Store previous state for undo
      const previousState = { ...currentState };

      // Update state
      state.byCharacterId[characterId] = {
        ...currentState,
        state: newState,
        stateEnteredAt: Date.now(),
        previousState,
      };
    },

    /**
     * Set the active player (whose turn it is)
     */
    setActivePlayer: (state, action: PayloadAction<SetActivePlayerPayload>) => {
      const { characterId } = action.payload;

      // Transition previous active player to IDLE
      if (state.activeCharacterId && state.activeCharacterId !== characterId) {
        const prevState = state.byCharacterId[state.activeCharacterId];
        if (prevState) {
          prevState.state = 'IDLE_WAITING';
          prevState.stateEnteredAt = Date.now();
        }
      }

      // Set new active player
      state.activeCharacterId = characterId;

      // Transition new active player to DECISION_PHASE
      const currentState = state.byCharacterId[characterId];
      if (currentState) {
        currentState.state = 'DECISION_PHASE';
        currentState.stateEnteredAt = Date.now();
      } else {
        // Initialize if not exists
        state.byCharacterId[characterId] = {
          ...createInitialPlayerRoundState(characterId),
          state: 'DECISION_PHASE',
        };
      }
    },

    /**
     * Set action plan (action, position, effect)
     */
    setActionPlan: (state, action: PayloadAction<SetActionPlanPayload>) => {
      const { characterId, action: selectedAction, position, effect } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        selectedAction,
        position,
        effect,
      };
    },

    /**
     * Set position (GM control)
     */
    setPosition: (state, action: PayloadAction<SetPositionPayload>) => {
      const { characterId, position } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        position,
      };
    },

    /**
     * Set effect (GM control)
     */
    setEffect: (state, action: PayloadAction<SetEffectPayload>) => {
      const { characterId, effect } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        effect,
      };
    },

    /**
     * Set GM approved flag (enables player's Commit Roll button)
     */
    setGmApproved: (state, action: PayloadAction<SetGmApprovedPayload>) => {
      const { characterId, approved } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        gmApproved: approved,
      };
    },

    /**
     * Set improvements (traits, equipment, push, flashback)
     */
    setImprovements: (state, action: PayloadAction<SetImprovementsPayload>) => {
      const {
        characterId,
        selectedTraitId,
        equippedForAction,
        pushed,
        flashbackApplied,
      } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        selectedTraitId,
        equippedForAction,
        pushed,
        flashbackApplied,
      };
    },

    /**
     * Set roll result
     */
    setRollResult: (state, action: PayloadAction<SetRollResultPayload>) => {
      const { characterId, dicePool, rollResult, outcome } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        dicePool,
        rollResult,
        outcome,
      };
    },

    /**
     * Set consequence data
     */
    setConsequence: (state, action: PayloadAction<SetConsequencePayload>) => {
      const { characterId, consequenceType, consequenceValue, momentumGain } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        consequenceType,
        consequenceValue,
        momentumGain,
      };
    },

    /**
     * Reset player state (clear all data, return to IDLE)
     */
    resetPlayerState: (state, action: PayloadAction<ResetPlayerStatePayload>) => {
      const { characterId } = action.payload;
      state.byCharacterId[characterId] = createInitialPlayerRoundState(characterId);
    },

    /**
     * Undo to previous state
     */
    undoState: (state, action: PayloadAction<{ characterId: string }>) => {
      const { characterId } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState || !currentState.previousState) {
        throw new Error(`No previous state to undo for character ${characterId}`);
      }

      state.byCharacterId[characterId] = currentState.previousState;
    },

    /**
     * Clear all player states (e.g., on encounter end)
     */
    clearAllStates: (state) => {
      state.byCharacterId = {};
      state.activeCharacterId = null;
    },
  },
});

// Export actions
export const {
  initializePlayerState,
  transitionState,
  setActivePlayer,
  setActionPlan,
  setPosition,
  setEffect,
  setGmApproved,
  setImprovements,
  setRollResult,
  setConsequence,
  resetPlayerState,
  undoState,
  clearAllStates,
} = playerRoundStateSlice.actions;

// Export reducer
export default playerRoundStateSlice.reducer;
