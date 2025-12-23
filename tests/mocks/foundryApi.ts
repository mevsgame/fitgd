/**
 * Foundry API Mock Factory
 *
 * Provides comprehensive mocks for Foundry VTT global APIs used by the Player Action Widget.
 * This allows testing widget logic without requiring a full Foundry environment.
 *
 * Usage:
 * ```typescript
 * const mockGame = createMockFoundryGame({ isGM: true });
 * (global as any).game = mockGame;
 * ```
 */

import { vi } from 'vitest';
import type { Store } from '@reduxjs/toolkit';
import type { RootState } from '../../src/store';
import type { Character } from '../../src/types/character';
import type { Crew } from '../../src/types/crew';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer from '../../src/slices/characterSlice';
import crewReducer from '../../src/slices/crewSlice';
import clockReducer from '../../src/slices/clockSlice';
import playerRoundStateReducer from '../../src/slices/playerRoundStateSlice';

/* -------------------------------------------- */
/*  Type Definitions                            */
/* -------------------------------------------- */

export interface MockUser {
  id: string;
  name: string;
  isGM: boolean;
}

export interface MockActor {
  id: string;
  name: string;
  type: 'character' | 'crew';
  data: any;
}

export interface MockActorCollection {
  get: (id: string) => MockActor | undefined;
  find: (predicate: (actor: MockActor) => boolean) => MockActor | undefined;
  filter: (predicate: (actor: MockActor) => boolean) => MockActor[];
  contents: MockActor[];
}

export interface MockBridge {
  execute: ReturnType<typeof vi.fn>;
  executeBatch: ReturnType<typeof vi.fn>;
  getState: () => RootState;
  getCharacter: (id: string) => Character | undefined;
  getCrew: (id: string) => Crew | undefined;
  getClocks: (entityId: string, clockType?: string | null) => any[];
  getPlayerRoundState: (characterId: string) => any;
}

export interface MockApi {
  character: {
    create: ReturnType<typeof vi.fn>;
    getCharacter: (id: string) => Character | undefined;
    addTrait: ReturnType<typeof vi.fn>;
    removeTrait: ReturnType<typeof vi.fn>;
    updateApproaches: ReturnType<typeof vi.fn>;
  };
  crew: {
    create: ReturnType<typeof vi.fn>;
    getCrew: (id: string) => Crew | undefined;
    addMomentum: ReturnType<typeof vi.fn>;
    spendMomentum: ReturnType<typeof vi.fn>;
  };
  clock: {
    create: ReturnType<typeof vi.fn>;
    advance: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
}

export interface MockSocket {
  register: ReturnType<typeof vi.fn>;
  executeAsGM: ReturnType<typeof vi.fn>;
  executeForEveryone: ReturnType<typeof vi.fn>;
  executeForOthers: ReturnType<typeof vi.fn>;
}

export interface MockFoundryGame {
  fitgd: {
    store: Store<RootState>;
    bridge: MockBridge;
    api: MockApi;
    socket: MockSocket;
    saveImmediate: ReturnType<typeof vi.fn>;
  };
  user?: MockUser;
  users?: {
    get: (id: string) => MockUser | undefined;
    contents: MockUser[];
  };
  actors: MockActorCollection;
  i18n: {
    localize: (key: string) => string;
    format: (key: string, data?: Record<string, string>) => string;
  };
}

export interface MockFoundryOptions {
  /** Is the current user a GM? */
  isGM?: boolean;
  /** User ID (defaults to 'test-user-id') */
  userId?: string;
  /** User name (defaults to 'Test User') */
  userName?: string;
  /** Initial Redux state */
  initialState?: Partial<RootState>;
  /** Mock actors to populate actors collection */
  actors?: MockActor[];
}

/* -------------------------------------------- */
/*  Mock Factory Functions                      */
/* -------------------------------------------- */

/**
 * Create a mock Redux store for testing
 *
 * @param initialState - Optional initial state to hydrate store
 * @returns Configured Redux store
 */
export function createMockStore(initialState?: Partial<RootState>): Store<RootState> {
  const defaultState: RootState = {
    characters: {
      byId: {},
      allIds: [],
      history: [],
    },
    crews: {
      byId: {},
      allIds: [],
      history: [],
    },
    clocks: {
      byId: {},
      allIds: [],
      byEntityId: {},
      byType: {},
      byTypeAndEntity: {},
      history: [],
    },
    playerRoundState: {
      byCharacterId: {},
      history: [],
    },
    ...initialState,
  };

  const store = configureStore({
    reducer: {
      characters: characterReducer,
      crews: crewReducer,
      clocks: clockReducer,
      playerRoundState: playerRoundStateReducer,
    },
    preloadedState: defaultState,
  });

  return store;
}

/**
 * Create a mock Bridge API
 *
 * @param store - Redux store to use
 * @param saveImmediate - Mock save function
 * @returns Mock bridge API
 */
export function createMockBridge(
  store: Store<RootState>,
  saveImmediate: ReturnType<typeof vi.fn>
): MockBridge {
  return {
    execute: vi.fn(async (action: any, _options?: any) => {
      store.dispatch(action);
      await saveImmediate();
    }),

    executeBatch: vi.fn(async (actions: any[], _options?: any) => {
      for (const action of actions) {
        store.dispatch(action);
      }
      await saveImmediate();
    }),

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
}

/**
 * Create a mock high-level API
 *
 * @param store - Redux store to use
 * @returns Mock API
 */
export function createMockApi(store: Store<RootState>): MockApi {
  return {
    character: {
      create: vi.fn(),
      getCharacter: (id: string) => {
        const state = store.getState();
        return state.characters.byId[id];
      },
      addTrait: vi.fn(),
      removeTrait: vi.fn(),
      updateApproaches: vi.fn(),
    },
    crew: {
      create: vi.fn(),
      getCrew: (id: string) => {
        const state = store.getState();
        return state.crews.byId[id];
      },
      addMomentum: vi.fn((payload: { crewId: string; amount: number }) => {
        store.dispatch({
          type: 'crews/addMomentum',
          payload,
        });
      }),
      spendMomentum: vi.fn((payload: { crewId: string; amount: number }) => {
        store.dispatch({
          type: 'crews/spendMomentum',
          payload,
        });
      }),
    },
    clock: {
      create: vi.fn(),
      advance: vi.fn(),
      reset: vi.fn(),
    },
  };
}

/**
 * Create a mock actor collection
 *
 * @param actors - Array of mock actors
 * @returns Mock actor collection
 */
export function createMockActorCollection(actors: MockActor[] = []): MockActorCollection {
  return {
    get: (id: string) => actors.find(a => a.id === id),
    find: (predicate: (actor: MockActor) => boolean) => actors.find(predicate),
    filter: (predicate: (actor: MockActor) => boolean) => actors.filter(predicate),
    contents: actors,
  };
}

/**
 * Create a complete mock Foundry game environment
 *
 * @param options - Configuration options
 * @returns Mock Foundry game object
 *
 * @example
 * ```typescript
 * const mockGame = createMockFoundryGame({
 *   isGM: true,
 *   initialState: {
 *     characters: {
 *       byId: { 'char-1': createMockCharacter() },
 *       allIds: ['char-1'],
 *     },
 *   },
 * });
 *
 * (global as any).game = mockGame;
 * ```
 */
export function createMockFoundryGame(options: MockFoundryOptions = {}): MockFoundryGame {
  const {
    isGM = false,
    userId = 'test-user-id',
    userName = 'Test User',
    initialState,
    actors = [],
  } = options;

  const store = createMockStore(initialState);
  const saveImmediate = vi.fn(async () => {
    // Simulate broadcast delay
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  const bridge = createMockBridge(store, saveImmediate);
  const api = createMockApi(store);

  // Create socket mock that resolves RPC calls successfully
  const socket: MockSocket = {
    register: vi.fn(),
    executeAsGM: vi.fn(async () => ({ success: true, lastConfirmedRequestId: 'mock-req' })),
    executeForEveryone: vi.fn(async () => { }),
    executeForOthers: vi.fn(async () => { }),
  };

  return {
    fitgd: {
      store,
      bridge,
      api,
      socket,
      saveImmediate,
    },
    user: {
      id: userId,
      name: userName,
      isGM,
    },
    users: {
      get: (id: string) => {
        if (id === userId) {
          return {
            id: userId,
            name: userName,
            isGM,
          };
        }
        return undefined;
      },
      contents: [
        {
          id: userId,
          name: userName,
          isGM,
        },
      ],
    },
    actors: createMockActorCollection(actors),
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data?: Record<string, string>) => {
        let result = key;
        if (data) {
          for (const [k, v] of Object.entries(data)) {
            result = result.replace(`{${k}}`, v);
          }
        }
        return result;
      },
    },
  };
}

/* -------------------------------------------- */
/*  Test Data Factories                         */
/* -------------------------------------------- */

/**
 * Create a mock character for testing
 *
 * @param overrides - Properties to override
 * @returns Mock character
 */
export function createMockCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test-char-id',
    name: 'Test Character',
    approaches: {
      force: 2,
      guile: 1,
      focus: 1,
      spirit: 1,
    },
    traits: [],
    equipment: [],
    loadLimit: 6,
    rallyAvailable: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock crew for testing
 *
 * @param overrides - Properties to override
 * @returns Mock crew
 */
export function createMockCrew(overrides: Partial<Crew> = {}): Crew {
  return {
    id: 'test-crew-id',
    name: 'Test Crew',
    characters: [],
    currentMomentum: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock actor for the actors collection
 *
 * @param character - Character data
 * @returns Mock actor
 */
export function createMockActor(character: Character): MockActor {
  return {
    id: character.id,
    name: character.name,
    type: 'character',
    data: character,
  };
}
