/**
 * Redux Store Configuration
 *
 * Exports store setup utilities for consumers
 */

import { configureStore as rtk_configureStore } from '@reduxjs/toolkit';
import characterReducer from './slices/characterSlice';
import crewReducer from './slices/crewSlice';
import clockReducer from './slices/clockSlice';
import playerRoundStateReducer from './slices/playerRoundStateSlice';

/**
 * Root reducer combining all slices
 */
export const rootReducer = {
  characters: characterReducer,
  crews: crewReducer,
  clocks: clockReducer,
  playerRoundState: playerRoundStateReducer,
};

/**
 * Configure the Redux store with all FitGD reducers
 *
 * @example
 * ```typescript
 * import { configureStore, createGameAPI } from '@fitgd/core';
 *
 * const store = configureStore();
 * const game = createGameAPI(store);
 * ```
 */
export function configureStore() {
  return rtk_configureStore({
    reducer: rootReducer,
  });
}

/**
 * Root state type (inferred from store)
 */
export type RootState = ReturnType<ReturnType<typeof configureStore>['getState']>;

/**
 * App dispatch type
 */
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
