/**
 * Dice rolling rules and outcome calculations for Forged in the Dark
 *
 * This module contains pure functions for calculating dice roll outcomes
 * according to Blades in the Dark / Forged in the Dark rules.
 */

/**
 * Possible outcomes from a dice roll
 */
export type DiceOutcome = 'critical' | 'success' | 'partial' | 'failure';

/**
 * Calculate the outcome of a dice roll based on Forged in the Dark rules
 *
 * Rules:
 * - Critical: 2 or more 6s
 * - Success: At least one 6
 * - Partial: Highest die is 4 or 5
 * - Failure: Highest die is 1, 2, or 3
 *
 * @param rollResult - Array of dice values (typically d6 results)
 * @returns The outcome of the roll
 *
 * @example
 * calculateOutcome([6, 6, 3]) // 'critical' - two 6s
 * calculateOutcome([6, 4, 2]) // 'success' - one 6
 * calculateOutcome([5, 4, 3]) // 'partial' - highest is 5
 * calculateOutcome([3, 2, 1]) // 'failure' - highest is 3
 */
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  // Edge case: empty roll array (shouldn't happen in practice)
  if (rollResult.length === 0) {
    return 'failure';
  }

  const sixes = rollResult.filter((d) => d === 6).length;
  const highest = Math.max(...rollResult);

  if (sixes >= 2) return 'critical';
  if (highest === 6) return 'success';
  if (highest >= 4) return 'partial';
  return 'failure';
}
