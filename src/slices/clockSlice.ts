import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import {
  validateSegmentAmount,
  getMaxSegments,
  findClockWithFewestSegments,
  validateSingleAddictionClock,
  isClockFilled,
  validateConsumableMetadata,
  validateClockExists,
  validateProgressClockSize,
} from '../validators/clockValidator';
import type { Clock, ClockType, Command } from '../types';

/**
 * Clock Slice State
 *
 * Includes indexes for efficient querying.
 */
export interface ClockState {
  byId: Record<string, Clock>;
  allIds: string[];

  // Indexes for efficient lookups
  byEntityId: Record<string, string[]>;           // All clocks for an entity
  byType: Record<string, string[]>;               // All clocks of a type
  byTypeAndEntity: Record<string, string[]>;      // e.g., "harm:character-123"

  history: Command[];
}

const initialState: ClockState = {
  byId: {},
  allIds: [],
  byEntityId: {},
  byType: {},
  byTypeAndEntity: {},
  history: [],
};

/**
 * Payload Types
 */
interface CreateClockPayload {
  entityId: string;
  clockType: ClockType;
  subtype?: string;
  rarity?: 'common' | 'uncommon' | 'rare';
  tier?: 'accessible' | 'inaccessible';
  maxSegments?: number; // For progress clocks (4, 6, 8, or 12)
  category?: 'long-term-project' | 'threat' | 'personal-goal' | 'obstacle' | 'faction';
  description?: string;
  isCountdown?: boolean;
  userId?: string;
}

interface AddSegmentsPayload {
  clockId: string;
  amount: number;
  userId?: string;
}

interface ClearSegmentsPayload {
  clockId: string;
  amount: number;
  userId?: string;
}

interface SetSegmentsPayload {
  clockId: string;
  segments: number;
  userId?: string;
}

interface DeleteClockPayload {
  clockId: string;
  userId?: string;
}

interface UpdateMetadataPayload {
  clockId: string;
  metadata: Record<string, unknown>;
  userId?: string;
}

interface ChangeSubtypePayload {
  clockId: string;
  newSubtype: string;
  userId?: string;
}

/**
 * Helper: Add clock to indexes
 */
function addToIndexes(state: ClockState, clock: Clock): void {
  // Add to byEntityId
  if (!state.byEntityId[clock.entityId]) {
    state.byEntityId[clock.entityId] = [];
  }
  state.byEntityId[clock.entityId].push(clock.id);

  // Add to byType
  if (!state.byType[clock.clockType]) {
    state.byType[clock.clockType] = [];
  }
  state.byType[clock.clockType].push(clock.id);

  // Add to byTypeAndEntity
  const key = `${clock.clockType}:${clock.entityId}`;
  if (!state.byTypeAndEntity[key]) {
    state.byTypeAndEntity[key] = [];
  }
  state.byTypeAndEntity[key].push(clock.id);
}

/**
 * Helper: Remove clock from indexes
 */
function removeFromIndexes(state: ClockState, clock: Clock): void {
  // Remove from byEntityId
  if (state.byEntityId[clock.entityId]) {
    state.byEntityId[clock.entityId] = state.byEntityId[clock.entityId].filter(
      (id) => id !== clock.id
    );
    if (state.byEntityId[clock.entityId].length === 0) {
      delete state.byEntityId[clock.entityId];
    }
  }

  // Remove from byType
  if (state.byType[clock.clockType]) {
    state.byType[clock.clockType] = state.byType[clock.clockType].filter(
      (id) => id !== clock.id
    );
    if (state.byType[clock.clockType].length === 0) {
      delete state.byType[clock.clockType];
    }
  }

  // Remove from byTypeAndEntity
  const key = `${clock.clockType}:${clock.entityId}`;
  if (state.byTypeAndEntity[key]) {
    state.byTypeAndEntity[key] = state.byTypeAndEntity[key].filter(
      (id) => id !== clock.id
    );
    if (state.byTypeAndEntity[key].length === 0) {
      delete state.byTypeAndEntity[key];
    }
  }
}

/**
 * Helper: Get clocks by type and entity
 */
function getClocksByTypeAndEntity(
  state: ClockState,
  clockType: ClockType,
  entityId: string
): Clock[] {
  const key = `${clockType}:${entityId}`;
  const clockIds = state.byTypeAndEntity[key] || [];
  return clockIds.map((id) => state.byId[id]);
}

/**
 * Helper: Get clocks by type and subtype
 */
function getClocksByTypeAndSubtype(
  state: ClockState,
  clockType: ClockType,
  subtype: string
): Clock[] {
  const typeClocks = state.byType[clockType] || [];
  return typeClocks
    .map((id) => state.byId[id])
    .filter((clock) => clock.subtype === subtype);
}

/**
 * Clock Slice
 */
const clockSlice = createSlice({
  name: 'clocks',
  initialState,
  reducers: {
    createClock: {
      reducer: (state, action: PayloadAction<Clock>) => {
        const clock = action.payload;

        // Special handling for harm clocks (max 3 per character)
        if (clock.clockType === 'harm') {
          const existingHarmClocks = getClocksByTypeAndEntity(
            state,
            'harm',
            clock.entityId
          );

          // If already have 3 harm clocks, replace one with fewest segments
          if (existingHarmClocks.length >= 3) {
            const clockToReplace = findClockWithFewestSegments(existingHarmClocks);
            if (clockToReplace) {
              // Replace: change subtype but keep segments
              clockToReplace.subtype = clock.subtype;
              clockToReplace.updatedAt = clock.createdAt;

              // Log command to history
              state.history.push({
                type: 'clocks/createClock',
                payload: { ...clock, replaced: clockToReplace.id },
                timestamp: clock.createdAt,
                version: 1,
                commandId: generateId(),
                userId: undefined,
              });

              return; // Don't create new clock
            }
          }
        }

        // Special handling for addiction clocks (only one per crew)
        if (clock.clockType === 'addiction') {
          const existingAddictionClocks = getClocksByTypeAndEntity(
            state,
            'addiction',
            clock.entityId
          );
          validateSingleAddictionClock(existingAddictionClocks);
        }

        // Add clock to store
        state.byId[clock.id] = clock;
        state.allIds.push(clock.id);
        addToIndexes(state, clock);

        // Log command to history
        state.history.push({
          type: 'clocks/createClock',
          payload: clock,
          timestamp: clock.createdAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: CreateClockPayload) => {
        const timestamp = Date.now();

        // Type-specific validation and metadata
        if (payload.clockType === 'consumable') {
          validateConsumableMetadata(payload.rarity, payload.tier);
        }

        if (payload.clockType === 'progress') {
          if (!payload.maxSegments) {
            throw new Error('Progress clocks require maxSegments (4, 6, 8, or 12)');
          }
          validateProgressClockSize(payload.maxSegments);
        }

        const maxSegments = getMaxSegments(
          payload.clockType,
          payload.rarity,
          payload.maxSegments
        );

        // Build metadata based on clock type
        let metadata: Record<string, unknown> | undefined;

        if (payload.clockType === 'consumable') {
          metadata = {
            rarity: payload.rarity,
            tier: payload.tier,
            frozen: false,
          };
        } else if (payload.clockType === 'progress') {
          metadata = {
            category: payload.category,
            isCountdown: payload.isCountdown,
            description: payload.description,
          };
        }

        const clock: Clock = {
          id: generateId(),
          entityId: payload.entityId,
          clockType: payload.clockType,
          subtype: payload.subtype,
          segments: 0,
          maxSegments,
          metadata,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        return { payload: clock };
      },
    },

    addSegments: {
      reducer: (state, action: PayloadAction<AddSegmentsPayload>) => {
        const { clockId, amount } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);
        validateSegmentAmount(amount);

        const wasFilled = isClockFilled(clock);
        const oldSegments = clock.segments;

        // Cap segments at maxSegments instead of throwing error
        // This allows harm to "fill" the clock when overflow would occur
        const newSegments = clock.segments + amount;
        clock.segments = Math.min(newSegments, clock.maxSegments);
        clock.updatedAt = Date.now();

        // Log if we capped the overflow
        if (newSegments > clock.maxSegments) {
          console.log(
            `FitGD | Clock ${clockId} capped at max: ` +
            `tried to add ${amount} to ${oldSegments}/${clock.maxSegments}, ` +
            `capped to ${clock.segments}/${clock.maxSegments}`
          );
        }

        // Special handling for consumable clocks when filled
        if (
          clock.clockType === 'consumable' &&
          !wasFilled &&
          isClockFilled(clock)
        ) {
          // Freeze this clock
          if (clock.metadata) {
            clock.metadata.frozen = true;

            // Downgrade tier
            if (clock.metadata.tier === 'accessible') {
              clock.metadata.tier = 'inaccessible';
            }
          }

          // Freeze all other clocks of same subtype
          if (clock.subtype) {
            const relatedClocks = getClocksByTypeAndSubtype(
              state,
              'consumable',
              clock.subtype
            );

            relatedClocks.forEach((relatedClock) => {
              if (relatedClock.id !== clock.id && relatedClock.metadata) {
                relatedClock.metadata.frozen = true;
                relatedClock.updatedAt = Date.now();
              }
            });
          }
        }

        // Log command to history
        state.history.push({
          type: 'clocks/addSegments',
          payload: action.payload,
          timestamp: clock.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AddSegmentsPayload) => {
        return { payload };
      },
    },

    clearSegments: {
      reducer: (state, action: PayloadAction<ClearSegmentsPayload>) => {
        const { clockId, amount } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);
        validateSegmentAmount(amount);

        // Reduce segments, min 0
        clock.segments = Math.max(0, clock.segments - amount);
        clock.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'clocks/clearSegments',
          payload: action.payload,
          timestamp: clock.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: ClearSegmentsPayload) => {
        return { payload };
      },
    },

    setSegments: {
      reducer: (state, action: PayloadAction<SetSegmentsPayload>) => {
        const { clockId, segments } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);

        // Validate segments range
        if (segments < 0 || segments > clock.maxSegments) {
          throw new Error(
            `Invalid segments value ${segments}. Must be between 0 and ${clock.maxSegments}`
          );
        }

        clock.segments = segments;
        clock.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'clocks/setSegments',
          payload: action.payload,
          timestamp: clock.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: SetSegmentsPayload) => {
        return { payload };
      },
    },

    deleteClock: {
      reducer: (state, action: PayloadAction<DeleteClockPayload>) => {
        const { clockId } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);

        // Remove from indexes
        removeFromIndexes(state, clock);

        // Remove from store
        delete state.byId[clockId];
        state.allIds = state.allIds.filter((id) => id !== clockId);

        // Log command to history
        state.history.push({
          type: 'clocks/deleteClock',
          payload: action.payload,
          timestamp: Date.now(),
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: DeleteClockPayload) => {
        return { payload };
      },
    },

    updateMetadata: {
      reducer: (state, action: PayloadAction<UpdateMetadataPayload>) => {
        const { clockId, metadata } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);

        // Merge metadata
        clock.metadata = { ...clock.metadata, ...metadata };
        clock.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'clocks/updateMetadata',
          payload: action.payload,
          timestamp: clock.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: UpdateMetadataPayload) => {
        return { payload };
      },
    },

    changeSubtype: {
      reducer: (state, action: PayloadAction<ChangeSubtypePayload>) => {
        const { clockId, newSubtype } = action.payload;
        const clock = state.byId[clockId];

        validateClockExists(clock, clockId);

        clock.subtype = newSubtype;
        clock.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'clocks/changeSubtype',
          payload: action.payload,
          timestamp: clock.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: ChangeSubtypePayload) => {
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
     * Hydrate state from serialized snapshot
     *
     * Used when loading saved state from Foundry world settings.
     * Replaces entire state with the provided snapshot and rebuilds indexes.
     */
    hydrateClocks: (state, action: PayloadAction<Record<string, Clock>>) => {
      const clocks = action.payload;

      // Reset state
      state.byId = clocks;
      state.allIds = Object.keys(clocks);
      state.history = [];

      // Rebuild indexes
      state.byEntityId = {};
      state.byType = {};
      state.byTypeAndEntity = {};

      for (const clock of Object.values(clocks)) {
        addToIndexes(state, clock);
      }
    },
  },
});

export const {
  createClock,
  addSegments,
  clearSegments,
  setSegments,
  deleteClock,
  updateMetadata,
  changeSubtype,
  pruneHistory: pruneClockHistory,
  hydrateClocks,
} = clockSlice.actions;

export default clockSlice.reducer;
