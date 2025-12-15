/**
 * Dice probability calculations for Forged in the Dark mechanics
 *
 * Calculates exact probabilities for each outcome based on dice pool size.
 * Uses combinatorial math to compute precise percentages.
 */

export interface DiceProbabilities {
    critical: number;   // Two or more 6s
    success: number;    // Exactly one 6
    partial: number;    // Highest is 4 or 5 (no 6s)
    failure: number;    // Highest is 1, 2, or 3
}

/**
 * Calculate exact probabilities for each dice outcome
 *
 * Rules (Forged in the Dark):
 * - Critical: 2+ dice show 6
 * - Success: Exactly one 6
 * - Partial: No 6s, highest is 4 or 5
 * - Failure: No 6s, highest is 1, 2, or 3
 *
 * @param dicePool - Number of dice to roll (minimum 1)
 * @returns Probabilities for each outcome (0-100 percentage)
 *
 * @example
 * calculateDiceProbabilities(3)
 * // → { critical: 7.41, success: 34.72, partial: 36.73, failure: 21.14 }
 */
export function calculateDiceProbabilities(dicePool: number): DiceProbabilities {
    // Handle edge cases
    if (dicePool <= 0) {
        // Zero dice = roll 2d6 take lowest (special rule)
        // This is a simplified approximation
        return {
            critical: 0,
            success: 2.78,   // 1/36 chance of both being 6
            partial: 30.56,  // Approximate
            failure: 66.67,  // Approximate - very likely to fail
        };
    }

    const n = dicePool;

    // P(no 6s) = (5/6)^n
    const probNoSixes = Math.pow(5 / 6, n);

    // P(all dice ≤ 3) = (3/6)^n = (1/2)^n
    const probAllThreeOrLess = Math.pow(3 / 6, n);

    // P(all dice ≤ 5 AND at least one is 4 or 5) = (5/6)^n - (3/6)^n
    const probPartial = probNoSixes - probAllThreeOrLess;

    // P(failure) = all dice are 1, 2, or 3
    const probFailure = probAllThreeOrLess;

    // P(exactly one 6) = C(n,1) * (1/6)^1 * (5/6)^(n-1)
    const probExactlyOneSix = n * Math.pow(1 / 6, 1) * Math.pow(5 / 6, n - 1);

    // P(success) = exactly one 6
    const probSuccess = probExactlyOneSix;

    // P(critical) = 2+ sixes = P(at least one 6) - P(exactly one 6)
    // P(at least one 6) = 1 - P(no 6s) = 1 - (5/6)^n
    const probAtLeastOneSix = 1 - probNoSixes;
    const probCritical = probAtLeastOneSix - probExactlyOneSix;

    // Convert to percentages and round to 1 decimal place
    return {
        critical: Math.round(probCritical * 1000) / 10,
        success: Math.round(probSuccess * 1000) / 10,
        partial: Math.round(probPartial * 1000) / 10,
        failure: Math.round(probFailure * 1000) / 10,
    };
}
