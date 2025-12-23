/**
 * Player Round State Slice
 *
 * Manages the persistent state of players during their turns.
 * This state is event-sourced and synced across clients via command history.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  PlayerRoundState,
  PlayerRoundStateType,
  Position,
  Effect,
  RollOutcome,
  ConsequenceType,
  TraitTransaction,
  ConsequenceTransaction,
  PlayerPushType,
  createInitialPlayerRoundState,
  isValidTransition,
} from '../types/playerRoundState';
import type { Approaches } from '../types/character';
import type { Command } from '../types/command';
import { generateId } from '../utils/uuid';

/**
 * Player Round State Slice State
 */
export interface PlayerRoundStateSliceState {
  /** Current states by character ID */
  byCharacterId: Record<string, PlayerRoundState>;

  /** Currently active player (whose turn it is) */
  activeCharacterId: string | null;

  /** Command history for event sourcing */
  history: Command[];
}

const initialState: PlayerRoundStateSliceState = {
  byCharacterId: {},
  activeCharacterId: null,
  history: [],
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
  approach: keyof Approaches;
  secondaryApproach?: keyof Approaches;
  equippedForAction?: string[];
  rollMode?: 'standard' | 'synergy' | 'equipment';
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
  pushType?: PlayerPushType;
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

interface SetTraitTransactionPayload {
  characterId: string;
  transaction: TraitTransaction;
}

interface ClearTraitTransactionPayload {
  characterId: string;
}

interface SetConsequenceTransactionPayload {
  characterId: string;
  transaction: ConsequenceTransaction;
}

interface UpdateConsequenceTransactionPayload {
  characterId: string;
  updates: Partial<ConsequenceTransaction>;
}

interface ClearConsequenceTransactionPayload {
  characterId: string;
}

interface SetStimsUsedPayload {
  characterId: string;
  used: boolean;
}

interface ClearStimsUsedPayload {
  characterId: string;
}

interface SetApprovedPassivePayload {
  characterId: string;
  equipmentId: string | null;
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

      // Always initialize/reset the character's state
      state.byCharacterId[characterId] = createInitialPlayerRoundState(characterId);

      // Log command to history for persistence
      state.history.push({
        type: 'playerRoundState/initializePlayerState',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
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

      // Log command to history for persistence
      const command: Command = {
        type: 'playerRoundState/transitionState',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      };
      state.history.push(command);
    },

    /**
     * Force transition to a new state (WITHOUT validation)
     * 
     * ONLY use this for socket synchronization where the remote client
     * is authoritative and we may have missed intermediate states.
     * For local transitions, always use transitionState instead.
     */
    forceTransitionState: (state, action: PayloadAction<TransitionStatePayload>) => {
      const { characterId, newState } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        // Initialize state if it doesn't exist
        state.byCharacterId[characterId] = {
          ...createInitialPlayerRoundState(characterId),
          state: newState,
          stateEnteredAt: Date.now(),
        };
      } else {
        // Store previous state for undo
        const previousState = { ...currentState };

        // Update state WITHOUT validation
        state.byCharacterId[characterId] = {
          ...currentState,
          state: newState,
          stateEnteredAt: Date.now(),
          previousState,
        };
      }

      // Note: No history logging for forceTransitionState
      // This is intentional - the authoritative client already logged the command
    },

    /**
     * Set the active player (whose turn it is)
     */
    setActivePlayer: (state, action: PayloadAction<SetActivePlayerPayload>) => {
      const { characterId } = action.payload;

      // Transition previous active player to IDLE and reset their state
      if (state.activeCharacterId && state.activeCharacterId !== characterId) {
        const prevCharId = state.activeCharacterId;
        // Reset previous player completely - they're done with their turn
        state.byCharacterId[prevCharId] = {
          ...createInitialPlayerRoundState(prevCharId),
          state: 'IDLE_WAITING',
        };
      }

      // Set new active player
      state.activeCharacterId = characterId;

      // Only transition to DECISION_PHASE if:
      // 1. State doesn't exist (initialization), OR
      // 2. State is IDLE_WAITING or TURN_COMPLETE (ready for new turn)
      // DO NOT override active states like ROLLING, GM_RESOLVING_CONSEQUENCE, etc.
      const currentState = state.byCharacterId[characterId];
      if (currentState) {
        // Only reset to DECISION_PHASE if player is idle/waiting or turn just completed
        if (currentState.state === 'IDLE_WAITING' || currentState.state === 'TURN_COMPLETE') {
          // Clear any leftover roll data when starting a new turn
          currentState.state = 'DECISION_PHASE';
          currentState.stateEnteredAt = Date.now();
          currentState.rollResult = undefined;
          currentState.outcome = undefined;
          currentState.dicePool = undefined;
          currentState.consequenceType = undefined;
          currentState.consequenceValue = undefined;
          currentState.momentumGain = undefined;
        }
        // Otherwise, keep current state (player is in middle of their turn)
      } else {
        // Initialize if not exists
        state.byCharacterId[characterId] = {
          ...createInitialPlayerRoundState(characterId),
          state: 'DECISION_PHASE',
        };
      }

      // Log command to history
      state.history.push({
        type: 'playerRoundState/setActivePlayer',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
    },

    /**
     * Set action plan (action, position, effect)
     */
    setActionPlan: (state, action: PayloadAction<SetActionPlanPayload>) => {
      const {
        characterId,
        approach: selectedApproach,
        secondaryApproach,
        equippedForAction,
        rollMode,
        position,
        effect
      } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        selectedApproach,
        secondaryApproach,
        equippedForAction: equippedForAction !== undefined ? equippedForAction : currentState.equippedForAction,
        rollMode,
        position,
        effect,
      };

      // Log command to history (Player action)
      state.history.push({
        type: 'playerRoundState/setActionPlan',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/setPosition',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/setEffect',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/setGmApproved',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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
        pushType,
        flashbackApplied,
      } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      // Determine new pushed state
      const newPushed = pushed !== undefined ? pushed : currentState.pushed;

      // Determine new push type (but clear it if not pushed)
      let newPushType = pushType !== undefined ? pushType : currentState.pushType;
      if (newPushed === false) {
        newPushType = undefined;
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        selectedTraitId: selectedTraitId !== undefined ? selectedTraitId : currentState.selectedTraitId,
        equippedForAction: equippedForAction !== undefined ? equippedForAction : currentState.equippedForAction,
        pushed: newPushed,
        pushType: newPushType,
        flashbackApplied: flashbackApplied !== undefined ? flashbackApplied : currentState.flashbackApplied,
      };

      // Log command to history (Player action)
      state.history.push({
        type: 'playerRoundState/setImprovements',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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

      // Log command to history (Player action)
      state.history.push({
        type: 'playerRoundState/setRollResult',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: (action.payload as any).userId,
      });
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
     * Set trait transaction (pending changes to apply on roll commit)
     */
    setTraitTransaction: (state, action: PayloadAction<SetTraitTransactionPayload>) => {
      const { characterId, transaction } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        traitTransaction: transaction,
      };

      // Log command to history
      state.history.push({
        type: 'playerRoundState/setTraitTransaction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Clear trait transaction (e.g., on cancellation)
     */
    clearTraitTransaction: (state, action: PayloadAction<ClearTraitTransactionPayload>) => {
      const { characterId } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        traitTransaction: undefined,
      };

      // Log command to history
      state.history.push({
        type: 'playerRoundState/clearTraitTransaction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Set consequence transaction (GM's consequence selections)
     */
    setConsequenceTransaction: (state, action: PayloadAction<SetConsequenceTransactionPayload>) => {
      const { characterId, transaction } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        consequenceTransaction: transaction,
      };

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/setConsequenceTransaction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Update consequence transaction (partial update for live editing)
     */
    updateConsequenceTransaction: (state, action: PayloadAction<UpdateConsequenceTransactionPayload>) => {
      const { characterId, updates } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      // Auto-create transaction if it doesn't exist (for success clock operations on SUCCESS_COMPLETE)
      // Success outcomes don't have consequences but can still advance clocks
      if (!currentState.consequenceTransaction) {
        state.byCharacterId[characterId] = {
          ...currentState,
          consequenceTransaction: {
            consequenceType: 'harm', // Default type (not used for success clock operations)
            ...updates,
          },
        };
      } else {
        state.byCharacterId[characterId] = {
          ...currentState,
          consequenceTransaction: {
            ...currentState.consequenceTransaction,
            ...updates,
          },
        };
      }

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/updateConsequenceTransaction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Clear consequence transaction
     */
    clearConsequenceTransaction: (state, action: PayloadAction<ClearConsequenceTransactionPayload>) => {
      const { characterId } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        consequenceTransaction: undefined,
      };

      // Log command to history
      state.history.push({
        type: 'playerRoundState/clearConsequenceTransaction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Set stims used flag (prevent multiple use per action)
     */
    setStimsUsed: (state, action: PayloadAction<SetStimsUsedPayload>) => {
      const { characterId, used } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        stimsUsedThisAction: used,
      };
    },

    /**
     * Clear stims used flag (on turn end)
     */
    clearStimsUsed: (state, action: PayloadAction<ClearStimsUsedPayload>) => {
      const { characterId } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        stimsUsedThisAction: undefined,
      };
    },

    /**
     * Set approved Passive equipment (GM only)
     */
    setApprovedPassive: (state, action: PayloadAction<SetApprovedPassivePayload>) => {
      const { characterId, equipmentId } = action.payload;
      const currentState = state.byCharacterId[characterId];

      if (!currentState) {
        throw new Error(`No state found for character ${characterId}`);
      }

      state.byCharacterId[characterId] = {
        ...currentState,
        approvedPassiveId: equipmentId,
      };

      // Log command to history (GM action)
      state.history.push({
        type: 'playerRoundState/setApprovedPassive',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
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
      state.history = [];
    },

    /**
     * Hydrate state from serialized snapshot
     *
     * Used when loading saved state from Foundry world settings.
     * Replaces entire state with the provided snapshot.
     */
    hydratePlayerRoundState: (state, action: PayloadAction<{
      byCharacterId: Record<string, PlayerRoundState>;
      activeCharacterId: string | null;
    }>) => {
      const { byCharacterId, activeCharacterId } = action.payload;
      state.byCharacterId = byCharacterId;
      state.activeCharacterId = activeCharacterId;
      state.history = []; // No history in snapshots
    },

    /**
     * Prune command history
     *
     * Clears all command history, keeping only the current state snapshot.
     * This reduces memory/storage usage while maintaining current game state.
     * Should be called on TURN_COMPLETE to flatten history.
     */
    pruneHistory: (state) => {
      state.history = [];
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
  setTraitTransaction,
  clearTraitTransaction,
  setConsequenceTransaction,
  updateConsequenceTransaction,
  clearConsequenceTransaction,
  setStimsUsed,
  clearStimsUsed,
  setRollResult,
  setConsequence,
  resetPlayerState,
  undoState,
  clearAllStates,
  hydratePlayerRoundState,
  pruneHistory: prunePlayerRoundStateHistory,
} = playerRoundStateSlice.actions;

export { playerRoundStateSlice };

// Export reducer
export default playerRoundStateSlice.reducer;
