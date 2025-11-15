/**
 * Clock Interaction Types
 *
 * Types for context-based clock interactions (GM-selected).
 */

import type { Clock } from './clock';
import type { Position, Effect } from './resolution';

/**
 * Roll outcome
 */
export type RollOutcome = 'critical' | 'success' | 'partial' | 'failure';

/**
 * Interaction direction
 */
export type InteractionDirection = 'advance' | 'reduce';

/**
 * Action type (for context-aware suggestions)
 */
export type ActionType =
  | 'normal'      // Standard action
  | 'rally'       // Rally action (reduces harm)
  | 'medical'     // Medical treatment (reduces harm)
  | 'defuse'      // Defusing threat (reduces threat)
  | 'mitigate'    // Mitigating danger (reduces threat)
  | 'stealth'     // Stealth action
  | 'combat'      // Combat action
  | 'social'      // Social action
  | 'investigate' // Investigation
  | string;       // Custom action types

/**
 * Interaction context - what happened in the game
 */
export interface InteractionContext {
  // Roll result
  outcome: RollOutcome;
  position: Position;
  effect: Effect;

  // Action context
  actionType?: ActionType;
  actionDescription?: string;  // Narrative description

  // Who was involved
  characterId: string;
  crewId: string;

  // Optional: dice roll data
  dicePool?: number;
  rollResult?: number[];
}

/**
 * Single clock interaction (GM selects ONE clock)
 */
export interface ClockInteraction {
  clockId: string;
  direction: InteractionDirection;
  amount: number;
  context?: string;  // Why this interaction? (for logging/display)
}

/**
 * Clock with suggested interaction (helper for GM UI)
 */
export interface ClockWithSuggestion {
  clock: Clock;
  suggestedDirection?: InteractionDirection;
  suggestedAmount?: number;
  reasoning?: string;
}
