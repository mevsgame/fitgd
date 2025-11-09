/**
 * @fitgd/core
 *
 * Event-sourced Redux state management for Forged in the Grimdark RPG system.
 *
 * Main exports:
 * - Types: Character, Crew, Clock, Command, GameConfig
 * - API: createGameAPI() factory function
 * - Config: DEFAULT_CONFIG
 */

// Types
export * from './types';

// Config
export { DEFAULT_CONFIG } from './config';

// API
export * from './api';

// Store
export { configureStore, rootReducer } from './store';
export type { RootState, AppDispatch } from './store';

// Selectors
export * from './selectors/playerRoundStateSelectors';

// Foundry Adapter
export { createFoundryAdapter } from './adapters/foundry';
export type { FoundryAdapter, SerializedState, CommandHistory } from './adapters/foundry';
export {
  getClockSVGPath,
  getClockRenderData,
  getClockHTML,
  getClockHandlebarsHelper,
  getClockClickValue,
  preloadClockAssets,
} from './adapters/foundry';

// Version
export const VERSION = '0.1.0';
