import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import {
  validateMomentumValue,
  validateSufficientMomentum,
  validateMomentumAmount,
  capMomentum,
  validateCharacterInCrew,
  validateCharacterNotInCrew,
} from '../validators/crewValidator';
import { DEFAULT_CONFIG } from '../config';
import { isOrphanedCommand } from '../utils/commandUtils';
import type { Crew, Command } from '../types';
import { logger } from '@/utils/logger';

/**
 * Crew Slice State
 */
export interface CrewState {
  byId: Record<string, Crew>;
  allIds: string[];
  history: Command[];
}

const initialState: CrewState = {
  byId: {},
  allIds: [],
  history: [],
};

/**
 * Payload Types
 */
interface CreateCrewPayload {
  id?: string; // Optional: If provided, use this ID (e.g., Foundry Actor ID)
  name: string;
  userId?: string;
}

interface AddCharacterToCrewPayload {
  crewId: string;
  characterId: string;
  userId?: string;
}

interface RemoveCharacterFromCrewPayload {
  crewId: string;
  characterId: string;
  userId?: string;
}

interface SetMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface AddMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface SpendMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface ResetMomentumPayload {
  crewId: string;
  userId?: string;
}

interface StartPlayerActionPayload {
  crewId: string;
  characterId: string;
  playerId: string;
  userId?: string;
}

interface CommitToRollPayload {
  crewId: string;
  userId?: string;
}

interface AbortPlayerActionPayload {
  crewId: string;
  userId?: string;
}

interface UpdateCrewNamePayload {
  crewId: string;
  name: string;
  userId?: string;
}

/**
 * Crew Slice
 */

const crewSlice = createSlice({
  name: 'crews',
  initialState,
  reducers: {
    createCrew: {
      reducer: (state, action: PayloadAction<Crew>) => {
        const crew = action.payload;
        state.byId[crew.id] = crew;
        // Only add to allIds if not already present (idempotent for replay)
        if (!state.allIds.includes(crew.id)) {
          state.allIds.push(crew.id);
        }

        // Log command to history
        state.history.push({
          type: 'crews/createCrew',
          payload: crew,
          timestamp: crew.createdAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: CreateCrewPayload) => {
        const timestamp = Date.now();
        const crew: Crew = {
          id: payload.id || generateId(), // Use provided ID or generate new one
          name: payload.name,
          characters: [],
          currentMomentum: DEFAULT_CONFIG.crew.startingMomentum, // 5
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        return { payload: crew };
      },
    },

    addCharacterToCrew: {
      reducer: (state, action: PayloadAction<AddCharacterToCrewPayload>) => {
        const { crewId, characterId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Only add if not already present (idempotent for replay)
        if (!crew.characters.includes(characterId)) {
          // Validate character not already in crew (redundant check, but keeps validation)
          validateCharacterNotInCrew(crew, characterId);
          crew.characters.push(characterId);
        }
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/addCharacterToCrew',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AddCharacterToCrewPayload) => {
        return { payload };
      },
    },

    removeCharacterFromCrew: {
      reducer: (state, action: PayloadAction<RemoveCharacterFromCrewPayload>) => {
        const { crewId, characterId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate character is in crew
        validateCharacterInCrew(crew, characterId);

        crew.characters = crew.characters.filter((id) => id !== characterId);
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/removeCharacterFromCrew',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: RemoveCharacterFromCrewPayload) => {
        return { payload };
      },
    },

    setMomentum: {
      reducer: (state, action: PayloadAction<SetMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate momentum value
        validateMomentumValue(amount);

        crew.currentMomentum = amount;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/setMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: SetMomentumPayload) => {
        return { payload };
      },
    },

    addMomentum: {
      reducer: (state, action: PayloadAction<AddMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate amount is non-negative
        validateMomentumAmount(amount);

        // Add momentum and cap at max (10)
        const newMomentum = crew.currentMomentum + amount;
        crew.currentMomentum = capMomentum(newMomentum);
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/addMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AddMomentumPayload) => {
        return { payload };
      },
    },

    spendMomentum: {
      reducer: (state, action: PayloadAction<SpendMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate sufficient momentum
        validateSufficientMomentum(crew.currentMomentum, amount);

        crew.currentMomentum -= amount;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/spendMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: SpendMomentumPayload) => {
        return { payload };
      },
    },

    resetMomentum: {
      reducer: (state, action: PayloadAction<ResetMomentumPayload>) => {
        const { crewId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Reset to starting value (5)
        crew.currentMomentum = DEFAULT_CONFIG.crew.startingMomentum;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/resetMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: ResetMomentumPayload) => {
        return { payload };
      },
    },

    /**
     * Prune command history
     *
     * Clears all command history, keeping only the current state snapshot.
     * This reduces memory/storage usage while maintaining current game state.
     */
    pruneHistory: (state) => {
      state.history = [];
    },

    /**
     * Prune orphaned command history
     *
     * Removes commands that reference crews that no longer exist in the current state.
     * This is useful for automatic cleanup after crew deletion while preserving:
     * 1. Commands for crews that still exist
     * 2. Deletion commands themselves (for audit trail)
     *
     * Used by auto-prune feature to reduce storage without losing current state or audit trail.
     *
     * @example
     * ```typescript
     * // Crew was created, modified, then deleted
     * // Before: [createCrew, addMomentum, deleteCrew]
     * // After: [deleteCrew]  // Only deletion command kept for audit
     * ```
     */
    /**
     * Cleanup orphaned crews
     * 
     * Removes crews that no longer exist in the Foundry world.
     */
    cleanupOrphanedCrews: (state, action: PayloadAction<{ validIds: string[] }>) => {
      const { validIds } = action.payload;
      const validIdSet = new Set(validIds);
      const crewsToRemove: string[] = [];

      // Find orphaned crews
      for (const crewId of state.allIds) {
        if (!validIdSet.has(crewId)) {
          crewsToRemove.push(crewId);
        }
      }

      // Remove them
      for (const crewId of crewsToRemove) {
        delete state.byId[crewId];
      }

      // Update allIds
      state.allIds = state.allIds.filter(id => !crewsToRemove.includes(id));

      if (crewsToRemove.length > 0) {
        logger.info(`Cleaned up ${crewsToRemove.length} orphaned crews`);
      }
    },

    pruneOrphanedHistory: (state) => {
      const currentCrewIds = new Set(state.allIds);

      state.history = state.history.filter((command) => {
        return !isOrphanedCommand(command, currentCrewIds);
      });
    },

    /**
     * Hydrate state from serialized snapshot
     *
     * Used when loading saved state from Foundry world settings.
     * Replaces entire state with the provided snapshot.
     */
    hydrateCrews: (state, action: PayloadAction<Record<string, Crew>>) => {
      const crews = action.payload;

      state.byId = crews;
      state.allIds = Object.keys(crews);
      state.history = []; // No history in snapshots
    },

    /**
     * Start a player action (widget lifecycle sync)
     *
     * Called when a player opens their action widget.
     * Only one action can be in progress per crew at a time.
     */
    startPlayerAction: (state, action: PayloadAction<StartPlayerActionPayload>) => {
      const { crewId, characterId, playerId } = action.payload;
      const crew = state.byId[crewId];

      if (!crew) {
        throw new Error(`Crew ${crewId} not found`);
      }

      // Check if action already in progress for a DIFFERENT character
      if (
        crew.activePlayerAction &&
        crew.activePlayerAction.characterId !== characterId
      ) {
        throw new Error(
          `Action already in progress for character ${crew.activePlayerAction.characterId}`
        );
      }

      // Set active player action (idempotent for same character)
      crew.activePlayerAction = {
        characterId,
        playerId,
        crewId,
        committedToRoll: false,
        startedAt: Date.now(),
      };
      crew.updatedAt = Date.now();

      // Log command to history for persistence
      state.history.push({
        type: 'crews/startPlayerAction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: playerId,
      });
    },

    /**
     * Commit to roll (widget lifecycle sync)
     *
     * Called when player clicks Roll. After this, only GM can abort.
     */
    commitToRoll: (state, action: PayloadAction<CommitToRollPayload>) => {
      const { crewId } = action.payload;
      const crew = state.byId[crewId];

      if (!crew) {
        throw new Error(`Crew ${crewId} not found`);
      }

      if (!crew.activePlayerAction) {
        throw new Error('No active player action to commit');
      }

      crew.activePlayerAction.committedToRoll = true;
      crew.updatedAt = Date.now();

      // Log command to history for persistence
      state.history.push({
        type: 'crews/commitToRoll',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Abort player action (widget lifecycle sync)
     *
     * Called when widget closes. Clears the active action.
     * Can be called by player (pre-commit) or GM (anytime).
     */
    abortPlayerAction: (state, action: PayloadAction<AbortPlayerActionPayload>) => {
      const { crewId } = action.payload;
      const crew = state.byId[crewId];

      if (!crew) {
        throw new Error(`Crew ${crewId} not found`);
      }

      // Clear active action (no-op if already null)
      crew.activePlayerAction = null;
      crew.updatedAt = Date.now();

      // Log command to history for persistence
      state.history.push({
        type: 'crews/abortPlayerAction',
        payload: action.payload,
        timestamp: Date.now(),
        version: 1,
        commandId: generateId(),
        userId: 'system',
      });
    },

    /**
     * Update crew name
     *
     * Syncs crew name from Foundry actor updates to Redux state.
     * This is a lightweight sync action that doesn't record to history
     * since it's syncing from Foundry's authoritative data.
     */
    updateCrewName: (state, action: PayloadAction<UpdateCrewNamePayload>) => {
      const { crewId, name } = action.payload;
      const crew = state.byId[crewId];

      if (!crew) {
        return; // Silently ignore if crew not found (could be during initialization)
      }

      // Only update if name actually changed
      if (crew.name !== name) {
        crew.name = name;
        crew.updatedAt = Date.now();
      }
    },
  },
});


export const {
  createCrew,
  addCharacterToCrew,
  removeCharacterFromCrew,
  setMomentum,
  addMomentum,
  spendMomentum,
  resetMomentum,
  pruneHistory: pruneCrewHistory,
  pruneOrphanedHistory: pruneOrphanedCrewHistory,
  cleanupOrphanedCrews,
  hydrateCrews,
  startPlayerAction,
  commitToRoll,
  abortPlayerAction,
  updateCrewName,
} = crewSlice.actions;

export { crewSlice };
export default crewSlice.reducer;
