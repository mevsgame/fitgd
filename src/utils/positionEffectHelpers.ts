/**
 * Position and Effect Helpers
 *
 * Utility functions for modifying Position and Effect levels
 * based on equipment or trait effects.
 */

import type { Position, Effect } from '../types/resolution';

const POSITION_ORDER = ['controlled', 'risky', 'desperate', 'impossible'] as const;
const EFFECT_ORDER = ['limited', 'standard', 'great', 'spectacular'] as const;

/**
 * Worsen position by N steps
 * controlled → risky → desperate → impossible
 *
 * @param current - Current position
 * @param steps - Number of steps to worsen
 * @returns New position (capped at impossible)
 *
 * @example
 * worsenPosition('controlled', 1) // 'risky'
 * worsenPosition('risky', 2) // 'impossible'
 */
export function worsenPosition(current: Position, steps: number): Position {
  const index = POSITION_ORDER.indexOf(current);
  const newIndex = Math.min(index + steps, POSITION_ORDER.length - 1);
  return POSITION_ORDER[newIndex];
}

/**
 * Improve position by N steps
 * impossible → desperate → risky → controlled
 *
 * @param current - Current position
 * @param steps - Number of steps to improve
 * @returns New position (capped at controlled)
 *
 * @example
 * improvePosition('desperate', 1) // 'risky'
 * improvePosition('risky', 2) // 'controlled'
 */
export function improvePosition(current: Position, steps: number): Position {
  const index = POSITION_ORDER.indexOf(current);
  const newIndex = Math.max(index - steps, 0);
  return POSITION_ORDER[newIndex];
}

/**
 * Worsen effect by N levels
 * spectacular → great → standard → limited
 *
 * @param current - Current effect
 * @param steps - Number of steps to worsen
 * @returns New effect (capped at limited)
 *
 * @example
 * worsenEffect('standard', 1) // 'limited'
 * worsenEffect('great', 2) // 'limited'
 */
export function worsenEffect(current: Effect, steps: number): Effect {
  const index = EFFECT_ORDER.indexOf(current);
  const newIndex = Math.max(index - steps, 0);
  return EFFECT_ORDER[newIndex];
}

/**
 * Improve effect by N levels
 * limited → standard → great → spectacular
 *
 * @param current - Current effect
 * @param steps - Number of steps to improve
 * @returns New effect (capped at spectacular)
 *
 * @example
 * improveEffect('limited', 1) // 'standard'
 * improveEffect('great', 2) // 'spectacular'
 */
export function improveEffect(current: Effect, steps: number): Effect {
  const index = EFFECT_ORDER.indexOf(current);
  const newIndex = Math.min(index + steps, EFFECT_ORDER.length - 1);
  return EFFECT_ORDER[newIndex];
}
