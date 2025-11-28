/**
 * Bridge Spy/Mock
 *
 * Provides a spy wrapper around the Foundry-Redux Bridge to track all dispatches,
 * broadcasts, and sheet refreshes during testing.
 *
 * This is critical for verifying that:
 * - Actions are dispatched correctly
 * - Broadcasts happen (state propagates to other clients)
 * - Correct entities are refreshed
 * - Batching prevents race conditions
 *
 * Usage:
 * ```typescript
 * const { bridge, spy, reset } = createBridgeSpy(store);
 * game.fitgd.bridge = bridge;
 *
 * // Perform actions...
 * await widget._onRoll();
 *
 * // Verify
 * expect(spy.dispatches).toHaveLength(3);
 * expect(spy.broadcasts).toBe(1);
 * expect(spy.affectedIds).toContain('char-1');
 * ```
 */

import { vi } from 'vitest';
import type { Store } from '@reduxjs/toolkit';
import type { RootState } from '../../src/store';
import type { ReduxId } from '../../foundry/module/types/ids';

/* -------------------------------------------- */
/*  Type Definitions                            */
/* -------------------------------------------- */

export interface ReduxAction {
  type: string;
  payload?: any;
}

export interface ExecuteOptions {
  affectedReduxIds?: ReduxId[];
  force?: boolean;
  silent?: boolean;
}

export interface BridgeSpyData {
  /** All dispatched actions */
  dispatches: ReduxAction[];

  /** Number of broadcasts (saveImmediate calls) */
  broadcasts: number;

  /** All affected Redux IDs passed to execute/executeBatch */
  affectedIds: ReduxId[];

  /** Execute calls (single action dispatches) */
  executeCalls: Array<{
    action: ReduxAction;
    options?: ExecuteOptions;
    timestamp: number;
  }>;

  /** ExecuteBatch calls (multi-action batches) */
  batchCalls: Array<{
    actions: ReduxAction[];
    options?: ExecuteOptions;
    timestamp: number;
  }>;

  /** Tracks whether batches violate state transition rules */
  invalidBatches: Array<{
    actions: ReduxAction[];
    error: string;
  }>;
}

export interface BridgeSpy {
  /** Current spy data */
  data: BridgeSpyData;

  /** Reset spy data to initial state */
  reset: () => void;

  /** Get all actions of a specific type */
  getActionsByType: (type: string) => ReduxAction[];

  /** Get all state transitions */
  getStateTransitions: () => Array<{ from?: string; to: string; characterId: string }>;

  /** Check if an action was dispatched */
  hasAction: (type: string, payload?: Partial<any>) => boolean;

  /** Get broadcast count */
  getBroadcastCount: () => number;

  /** Get all affected IDs */
  getAffectedIds: () => ReduxId[];

  /** Get last dispatched action */
  getLastAction: () => ReduxAction | undefined;

  /** Get last batch */
  getLastBatch: () => ReduxAction[] | undefined;
}

export interface BridgeSpyResult {
  /** Mock bridge implementation with spy hooks */
  bridge: {
    execute: ReturnType<typeof vi.fn>;
    executeBatch: ReturnType<typeof vi.fn>;
    getState: () => RootState;
    getCharacter: (id: string) => any;
    getCrew: (id: string) => any;
    getClocks: (entityId: string, clockType?: string | null) => any[];
    getPlayerRoundState: (characterId: string) => any;
  };

  /** Spy interface for test assertions */
  spy: BridgeSpy;
}

/* -------------------------------------------- */
/*  Bridge Spy Factory                          */
/* -------------------------------------------- */

/**
 * Create a spy wrapper around the Foundry-Redux Bridge
 *
 * @param store - Redux store
 * @returns Bridge spy result with mock bridge and spy interface
 *
 * @example
 * ```typescript
 * const { bridge, spy } = createBridgeSpy(store);
 *
 * // Inject into global
 * game.fitgd.bridge = bridge;
 *
 * // Perform widget actions
 * await widget._onRoll();
 *
 * // Verify behavior
 * expect(spy.data.dispatches).toHaveLength(3);
 * expect(spy.data.broadcasts).toBe(1);
 * expect(spy.hasAction('playerRoundState/setRollResult')).toBe(true);
 * expect(spy.getStateTransitions()).toEqual([
 *   { characterId: 'char-1', to: 'ROLLING' },
 *   { characterId: 'char-1', to: 'GM_RESOLVING_CONSEQUENCE' },
 * ]);
 * ```
 */
export function createBridgeSpy(store: Store<RootState>): BridgeSpyResult {
  // Initialize spy data
  const data: BridgeSpyData = {
    dispatches: [],
    broadcasts: 0,
    affectedIds: [],
    executeCalls: [],
    batchCalls: [],
    invalidBatches: [],
  };

  // Mock saveImmediate (broadcast function)
  const mockSaveImmediate = vi.fn(async () => {
    data.broadcasts++;
    // Simulate async broadcast delay
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  // Helper to track action dispatch
  const trackAction = (action: ReduxAction) => {
    data.dispatches.push({ ...action });
  };

  // Helper to track affected IDs
  const trackAffectedIds = (options?: ExecuteOptions) => {
    if (options?.affectedReduxIds) {
      data.affectedIds.push(...options.affectedReduxIds);
    }
  };

  // Helper to validate batches
  const validateBatch = (actions: ReduxAction[]): string | null => {
    // Check for multiple state transitions in a single batch
    const transitionActions = actions.filter(a => a.type === 'playerRoundState/transitionState');

    if (transitionActions.length > 1) {
      const states = transitionActions
        .map(a => a.payload?.newState)
        .filter(Boolean)
        .join(' → ');

      return `Cannot batch ${transitionActions.length} state transitions (${states}). All actions validate against the SAME initial state.`;
    }

    return null;
  };

  // Create mock bridge with spy hooks
  const bridge = {
    // Execute single action
    execute: vi.fn(async (action: ReduxAction, options?: ExecuteOptions) => {
      // Track call
      data.executeCalls.push({
        action: { ...action },
        options: options ? { ...options } : undefined,
        timestamp: Date.now(),
      });

      // Dispatch to Redux
      trackAction(action);
      store.dispatch(action);

      // Track affected IDs
      trackAffectedIds(options);

      // Broadcast (unless silent)
      if (!options?.silent) {
        await mockSaveImmediate();
      }
    }),

    // Execute batch of actions
    executeBatch: vi.fn(async (actions: ReduxAction[], options?: ExecuteOptions) => {
      // Validate batch
      const error = validateBatch(actions);
      if (error) {
        data.invalidBatches.push({ actions: [...actions], error });
        throw new Error(error);
      }

      // Track call
      data.batchCalls.push({
        actions: actions.map(a => ({ ...a })),
        options: options ? { ...options } : undefined,
        timestamp: Date.now(),
      });

      // Dispatch all actions
      for (const action of actions) {
        trackAction(action);
        store.dispatch(action);
      }

      // Track affected IDs
      trackAffectedIds(options);

      // Single broadcast for entire batch (unless silent)
      if (!options?.silent) {
        await mockSaveImmediate();
      }
    }),

    // Query methods (delegate to store)
    getState: () => store.getState(),

    getCharacter: (id: string) => {
      const state = store.getState();
      return state.characters.byId[id];
    },

    getCrew: (id: string) => {
      const state = store.getState();
      return state.crews.byId[id];
    },

    getClocks: (entityId: string, clockType: string | null = null) => {
      const state = store.getState();
      const clockIds = state.clocks.byEntityId[entityId] || [];
      let clocks = clockIds.map(id => state.clocks.byId[id]).filter(Boolean);

      if (clockType) {
        clocks = clocks.filter(clock => clock.clockType === clockType);
      }

      return clocks;
    },

    getPlayerRoundState: (characterId: string) => {
      const state = store.getState();
      return state.playerRoundState.byCharacterId[characterId];
    },
  };

  // Create spy interface
  const spy: BridgeSpy = {
    data,

    reset: () => {
      data.dispatches = [];
      data.broadcasts = 0;
      data.affectedIds = [];
      data.executeCalls = [];
      data.batchCalls = [];
      data.invalidBatches = [];
    },

    getActionsByType: (type: string) => {
      return data.dispatches.filter(a => a.type === type);
    },

    getStateTransitions: () => {
      return data.dispatches
        .filter(a => a.type === 'playerRoundState/transitionState')
        .map(a => ({
          characterId: a.payload?.characterId,
          to: a.payload?.newState,
        }));
    },

    hasAction: (type: string, payload?: Partial<any>) => {
      return data.dispatches.some(action => {
        if (action.type !== type) return false;

        if (payload) {
          return Object.keys(payload).every(
            key => action.payload?.[key] === payload[key]
          );
        }

        return true;
      });
    },

    getBroadcastCount: () => data.broadcasts,

    getAffectedIds: () => [...new Set(data.affectedIds)],

    getLastAction: () => {
      return data.dispatches.length > 0
        ? data.dispatches[data.dispatches.length - 1]
        : undefined;
    },

    getLastBatch: () => {
      return data.batchCalls.length > 0
        ? data.batchCalls[data.batchCalls.length - 1].actions
        : undefined;
    },
  };

  return { bridge, spy };
}

/* -------------------------------------------- */
/*  Utility Functions                           */
/* -------------------------------------------- */

/**
 * Wait for all broadcasts to complete
 *
 * Useful when testing async workflows that trigger multiple broadcasts.
 *
 * @example
 * ```typescript
 * await widget._onRoll();
 * await waitForBroadcasts();
 * expect(spy.data.broadcasts).toBe(2);
 * ```
 */
export async function waitForBroadcasts(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 10));
}

/**
 * Create a matcher for vitest expect assertions
 *
 * @example
 * ```typescript
 * expect(spy.data.dispatches).toContainAction('playerRoundState/setRollResult', {
 *   characterId: 'char-1',
 *   outcome: 'success',
 * });
 * ```
 */
export function toContainAction(
  dispatches: ReduxAction[],
  type: string,
  payload?: Partial<any>
): { pass: boolean; message: () => string } {
  const hasAction = dispatches.some(action => {
    if (action.type !== type) return false;

    if (payload) {
      return Object.keys(payload).every(
        key => action.payload?.[key] === payload[key]
      );
    }

    return true;
  });

  return {
    pass: hasAction,
    message: () =>
      hasAction
        ? `Expected dispatches NOT to contain action ${type}`
        : `Expected dispatches to contain action ${type} with payload ${JSON.stringify(payload)}`,
  };
}
