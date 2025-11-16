/**
 * Player Round Game Rules Utilities
 *
 * Pure functions for calculating game rule values.
 * No dependencies on Redux state or Foundry.
 * All calculations are deterministic and testable.
 */

import type { Position, Effect } from '../types/playerRoundState';
import { DEFAULT_CONFIG } from '../config/gameConfig';

/**
 * Calculate consequence severity (harm/crew clock segments) based on position
 *
 * Returns base consequence severity without effect modifiers.
 * Effect modifiers are applied separately when resolving harm consequences.
 *
 * @param position - The position at which the consequence is accepted
 * @returns Number of segments to apply to the clock (base value)
 *
 * @example
 * calculateConsequenceSeverity('controlled') // → 1
 * calculateConsequenceSeverity('desperate') // → 4
 */
export function calculateConsequenceSeverity(position: Position): number {
  return DEFAULT_CONFIG.resolution.consequenceSegmentsBase[position] ?? 0;
}

/**
 * Calculate momentum gain for accepting a consequence
 *
 * Better positions (riskier) yield more momentum.
 * This represents the crew's "lucky break" from a tight spot.
 *
 * @param position - The position at which the consequence is accepted
 * @returns Momentum gained for the crew
 *
 * @example
 * calculateMomentumGain('controlled') // → 1
 * calculateMomentumGain('desperate') // → 4
 */
export function calculateMomentumGain(position: Position): number {
  return DEFAULT_CONFIG.resolution.momentumOnConsequence[position] ?? 0;
}

/**
 * Calculate base progress for a success clock
 *
 * Base progress is determined by position alone.
 * Effect modifiers apply on top of this base.
 *
 * @param position - The position at which the action is taken
 * @returns Base segments for success clock
 *
 * @example
 * calculateSuccessClockBase('risky') // → 3
 * calculateSuccessClockBase('desperate') // → 5
 */
export function calculateSuccessClockBase(position: Position): number {
  return DEFAULT_CONFIG.resolution.successClockBase[position] ?? 0;
}

/**
 * Get effect modifier for success clock calculation
 *
 * Modifies the base progress from position.
 * Can be negative (limited effect reduces progress).
 *
 * @param effect - The effect level of the action
 * @returns Modifier to add to base progress (can be negative)
 *
 * @example
 * getEffectModifier('limited') // → -1
 * getEffectModifier('great') // → 1
 * getEffectModifier('spectacular') // → 2
 */
export function getEffectModifier(effect: Effect): number {
  return DEFAULT_CONFIG.resolution.effectModifier[effect] ?? 0;
}

/**
 * Calculate total success clock progress
 *
 * Formula: Base Progress (from position) + Effect Modifier
 * Result is clamped to minimum 0 segments.
 *
 * @param position - The position for the action
 * @param effect - The effect level for the action
 * @returns Total segments of progress for success clock
 *
 * @example
 * calculateSuccessClockProgress('controlled', 'limited') // → 0 (1 - 1)
 * calculateSuccessClockProgress('risky', 'great') // → 4 (3 + 1)
 * calculateSuccessClockProgress('desperate', 'spectacular') // → 7 (5 + 2)
 */
export function calculateSuccessClockProgress(
  position: Position,
  effect: Effect
): number {
  const baseProgress = calculateSuccessClockBase(position);
  const effectModifier = getEffectModifier(effect);
  return Math.max(0, baseProgress + effectModifier);
}

/**
 * Improve position by one step
 *
 * Position ladder: Impossible → Desperate → Risky → Controlled
 * "Controlled" is the best position and cannot be improved further.
 *
 * @param position - Current position
 * @returns Improved position (one step better), or same if already at best
 *
 * @example
 * improvePosition('impossible') // → 'desperate'
 * improvePosition('desperate') // → 'risky'
 * improvePosition('controlled') // → 'controlled' (already at best)
 */
export function improvePosition(position: Position): Position {
  switch (position) {
    case 'impossible':
      return 'desperate';
    case 'desperate':
      return 'risky';
    case 'risky':
      return 'controlled';
    case 'controlled':
      return 'controlled'; // Already at best
    default:
      return position;
  }
}

/**
 * Improve effect by one level
 *
 * Effect ladder: Limited → Standard → Great → Spectacular
 * "Spectacular" is the best effect and cannot be improved further.
 *
 * @param effect - Current effect
 * @returns Improved effect (one level better), or same if already at best
 *
 * @example
 * improveEffect('limited') // → 'standard'
 * improveEffect('standard') // → 'great'
 * improveEffect('spectacular') // → 'spectacular' (already at best)
 */
export function improveEffect(effect: Effect): Effect {
  switch (effect) {
    case 'limited':
      return 'standard';
    case 'standard':
      return 'great';
    case 'great':
      return 'spectacular';
    case 'spectacular':
      return 'spectacular'; // Already at best
    default:
      return effect;
  }
}
