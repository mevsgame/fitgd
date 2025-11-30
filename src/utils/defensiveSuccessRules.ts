/**
 * Defensive Success Rules
 *
 * Pure functions for calculating defensive success options.
 * Rules: vault/rules_primer.md - Defensive Success Option section
 */

import type { Position, Effect, RollOutcome } from '../types/playerRoundState';
import type { DefensiveSuccessValues } from '../types/resolution';
import { calculateConsequenceSeverity, calculateMomentumGain } from './playerRoundRules';

/**
 * Check if defensive success option is available
 *
 * Rules (vault/rules_primer.md):
 * - Only on partial success (4-5 result)
 * - Only when Effect ≥ Standard (not Limited)
 *
 * @param outcome - Roll outcome
 * @param effect - Current effect level
 * @returns true if defensive option available
 *
 * @example
 * isDefensiveSuccessAvailable('partial', 'standard') // true
 * isDefensiveSuccessAvailable('partial', 'limited') // false
 * isDefensiveSuccessAvailable('success', 'standard') // false
 */
export function isDefensiveSuccessAvailable(outcome: RollOutcome, effect: Effect): boolean {
  // Only on partial success
  if (outcome !== 'partial') return false;

  // Only if effect can be reduced (not already limited)
  if (effect === 'limited') return false;

  return true;
}

/**
 * Calculate reduced position for defensive success
 *
 * Reduces position by one step on the ladder:
 * impossible → desperate → risky → controlled → null (no consequence)
 *
 * @param position - Original position
 * @returns Reduced position (null = no consequence)
 *
 * @example
 * calculateDefensivePosition('desperate') // 'risky'
 * calculateDefensivePosition('controlled') // null
 */
export function calculateDefensivePosition(position: Position): Position | null {
  switch (position) {
    case 'impossible':
      return 'desperate';
    case 'desperate':
      return 'risky';
    case 'risky':
      return 'controlled';
    case 'controlled':
      return null; // No consequence at all
    default:
      return null;
  }
}

/**
 * Calculate reduced effect for defensive success
 *
 * Reduces effect by one tier:
 * spectacular → great → standard → limited → null (cannot reduce)
 *
 * @param effect - Original effect
 * @returns Reduced effect (null if already limited)
 *
 * @example
 * calculateDefensiveEffect('great') // 'standard'
 * calculateDefensiveEffect('limited') // null
 */
export function calculateDefensiveEffect(effect: Effect): Effect | null {
  switch (effect) {
    case 'spectacular':
      return 'great';
    case 'great':
      return 'standard';
    case 'standard':
      return 'limited';
    case 'limited':
      return null; // Cannot reduce further
    default:
      return null;
  }
}

/**
 * Calculate momentum gain for defensive success
 *
 * Rules (vault/rules_primer.md):
 * Momentum gain is ALWAYS based on ORIGINAL position, not reduced position
 *
 * @param originalPosition - Original position before reduction
 * @param _defensivePosition - Reduced position (ignored for momentum calc)
 * @returns Momentum gain from original position
 *
 * @example
 * calculateDefensiveMomentumGain('risky', 'controlled') // 2 (from risky)
 * calculateDefensiveMomentumGain('desperate', 'risky') // 4 (from desperate)
 */
export function calculateDefensiveMomentumGain(originalPosition: Position, _defensivePosition: Position | null): number {
  // ALWAYS use original position for momentum
  return calculateMomentumGain(originalPosition);
}

/**
 * Calculate complete defensive success values
 *
 * @param params - Calculation parameters
 * @returns Complete defensive success calculation
 *
 * @example
 * calculateDefensiveSuccessValues({
 *   position: 'risky',
 *   effect: 'standard',
 *   outcome: 'partial'
 * })
 * // Returns: {
 * //   available: true,
 * //   defensivePosition: 'controlled',
 * //   defensiveEffect: 'limited',
 * //   defensiveSegments: 1,
 * //   originalSegments: 2,
 * //   momentumGain: 2
 * // }
 */
export function calculateDefensiveSuccessValues(params: {
  position: Position;
  effect: Effect;
  outcome: RollOutcome;
}): DefensiveSuccessValues {
  const { position, effect, outcome } = params;

  // Check availability
  const available = isDefensiveSuccessAvailable(outcome, effect);

  if (!available) {
    return {
      available: false,
      originalPosition: position,
      defensivePosition: null,
      originalEffect: effect,
      defensiveEffect: null,
      defensiveSegments: 0,
      originalSegments: calculateConsequenceSeverity(position),
      momentumGain: calculateMomentumGain(position),
    };
  }

  // Calculate defensive values
  const defensivePosition = calculateDefensivePosition(position);
  const defensiveEffect = calculateDefensiveEffect(effect);
  const defensiveSegments = defensivePosition ? calculateConsequenceSeverity(defensivePosition) : 0;
  const originalSegments = calculateConsequenceSeverity(position);
  const momentumGain = calculateDefensiveMomentumGain(position, defensivePosition);

  return {
    available: true,
    originalPosition: position,
    defensivePosition,
    originalEffect: effect,
    defensiveEffect: defensiveEffect || 'limited', // Fallback to limited if null
    defensiveSegments,
    originalSegments,
    momentumGain,
  };
}
