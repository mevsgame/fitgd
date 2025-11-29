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
import { stateTransitionValidator } from './middleware/stateTransitionValidator';

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
    middleware: (getDefaultMiddleware) => {
      // NOTE: Using 'as any' here is a workaround for a known Redux Toolkit typing issue.
      // The problem: Redux Toolkit's middleware type system has difficulty reconciling custom middlewares
      // with the tuple type returned by getDefaultMiddleware().concat().
      // This is not a code smell but rather a limitation in Redux Toolkit's type definitions.
      // See: https://github.com/reduxjs/redux-toolkit/issues/1808
      return getDefaultMiddleware().concat(stateTransitionValidator) as any;
    },
  });
}

/**
 * Root state type (inferred from store)
 */
export type RootState = {
  characters: ReturnType<typeof characterReducer>;
  crews: ReturnType<typeof crewReducer>;
  clocks: ReturnType<typeof clockReducer>;
  playerRoundState: ReturnType<typeof playerRoundStateReducer>;
};

/**
 * App dispatch type
 */
export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
