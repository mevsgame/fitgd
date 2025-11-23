/**
 * Type Exports
 *
 * Central export point for all TypeScript types.
 */

export * from './character';
export * from './crew';
export * from './clock';
export * from './command';
export * from './config';
export * from './equipment';
export * from './resolution';
export * from './playerRoundState';

/**
 * Redux Action Union Type
 *
 * Union of all possible Redux action types from all slices.
 * This enables type-safe action dispatch and prevents typos in action types.
 *
 * @example
 * ```typescript
 * import type { GameAction } from './types';
 *
 * function dispatch(action: GameAction) {
 *   // TypeScript will enforce that action is a valid Redux action
 * }
 * ```
 */
import type { characterSlice } from '../slices/characterSlice';
import type { crewSlice } from '../slices/crewSlice';
import type { clockSlice } from '../slices/clockSlice';
import type { playerRoundStateSlice } from '../slices/playerRoundStateSlice';

export type GameAction =
  | ReturnType<typeof characterSlice.actions[keyof typeof characterSlice.actions]>
  | ReturnType<typeof crewSlice.actions[keyof typeof crewSlice.actions]>
  | ReturnType<typeof clockSlice.actions[keyof typeof clockSlice.actions]>
  | ReturnType<typeof playerRoundStateSlice.actions[keyof typeof playerRoundStateSlice.actions]>;
