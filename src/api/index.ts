/**
 * Game API
 *
 * Main API export combining all sub-APIs.
 * This is the primary interface for consumers (Foundry VTT, etc.)
 *
 * Usage:
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { createGameAPI } from '@fitgd/core';
 *
 * const store = configureStore({ ... });
 * const game = createGameAPI(store);
 *
 * // Player actions
 * const charId = game.character.create({ name, traits, actionDots });
 * game.character.leanIntoTrait({ characterId, traitId, crewId });
 * game.action.push({ crewId, type: 'extra-die' });
 *
 * // GM actions
 * game.crew.performReset(crewId);
 * game.harm.take({ characterId, harmType, position, effect });
 *
 * // Queries
 * const canRally = game.query.canUseRally({ characterId, crewId });
 * const momentum = game.query.getMomentum(crewId);
 * ```
 */

import type { Store } from '@reduxjs/toolkit';
import { createCharacterAPI } from './implementations/characterApi';
import { createActionAPI } from './implementations/actionApi';
import { createResourceAPI } from './implementations/resourceApi';
import { createCrewAPI } from './implementations/crewApi';
import { createHarmAPI } from './implementations/harmApi';
import { createClockAPI } from './implementations/clockApi';
import { createQueryAPI } from './implementations/queryApi';

/**
 * Complete Game API
 */
export interface GameAPI {
  character: ReturnType<typeof createCharacterAPI>;
  action: ReturnType<typeof createActionAPI>;
  resource: ReturnType<typeof createResourceAPI>;
  crew: ReturnType<typeof createCrewAPI>;
  harm: ReturnType<typeof createHarmAPI>;
  clock: ReturnType<typeof createClockAPI>;
  query: ReturnType<typeof createQueryAPI>;
}

/**
 * Create the complete game API
 *
 * @param store - Redux store instance
 * @returns Complete game API with all verbs
 *
 * @example
 * ```typescript
 * import { configureStore } from '@reduxjs/toolkit';
 * import { rootReducer } from './store/rootReducer';
 * import { createGameAPI } from '@fitgd/core';
 *
 * const store = configureStore({ reducer: rootReducer });
 * const game = createGameAPI(store);
 *
 * // Now use the API
 * const charId = game.character.create({
 *   name: 'Sergeant Kane',
 *   traits: [
 *     { name: 'Served with Elite Infantry', category: 'role', disabled: false },
 *     { name: 'Survived Hive Gangs', category: 'background', disabled: false }
 *   ],
 *   actionDots: { shoot: 3, command: 2, ... }
 * });
 * ```
 */
export function createGameAPI(store: Store): GameAPI {
  return {
    character: createCharacterAPI(store),
    action: createActionAPI(store),
    resource: createResourceAPI(store),
    crew: createCrewAPI(store),
    harm: createHarmAPI(store),
    clock: createClockAPI(store),
    query: createQueryAPI(store),
  };
}

// Re-export types
export type {
  CharacterAPI,
  ActionAPI,
  ResourceAPI,
  CrewAPI,
  HarmAPI,
  ClockAPI,
  QueryAPI,
} from './types';

// Re-export store utilities
export { configureStore, rootReducer } from '../store';
export type { RootState, AppDispatch } from '../store';

// Re-export Foundry adapter
export { createFoundryAdapter } from '../adapters/foundry';
export type { FoundryAdapter, FoundryActor } from '../adapters/foundry';
