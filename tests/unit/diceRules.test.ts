import { describe, it, expect } from 'vitest';
import { calculateOutcome, type DiceOutcome } from '@/utils/diceRules';

describe('diceRules', () => {
  describe('calculateOutcome', () => {
    describe('Critical outcomes (2+ sixes)', () => {
      it('should return critical for exactly 2 sixes', () => {
        const result = calculateOutcome([6, 6, 3]);
        expect(result).toBe('critical');
      });

      it('should return critical for 3 sixes', () => {
        const result = calculateOutcome([6, 6, 6]);
        expect(result).toBe('critical');
      });

      it('should return critical for 4 sixes', () => {
        const result = calculateOutcome([6, 6, 6, 6]);
        expect(result).toBe('critical');
      });

      it('should return critical for 2 sixes with low dice', () => {
        const result = calculateOutcome([6, 6, 1, 2]);
        expect(result).toBe('critical');
      });

      it('should return critical for 2 sixes with mid-range dice', () => {
        const result = calculateOutcome([6, 6, 4, 5]);
        expect(result).toBe('critical');
      });
    });

    describe('Success outcomes (one 6)', () => {
      it('should return success for exactly one 6 with low dice', () => {
        const result = calculateOutcome([6, 3, 2]);
        expect(result).toBe('success');
      });

      it('should return success for one 6 with mid-range dice', () => {
        const result = calculateOutcome([6, 4, 5]);
        expect(result).toBe('success');
      });

      it('should return success for one 6 with all 1s', () => {
        const result = calculateOutcome([6, 1, 1]);
        expect(result).toBe('success');
      });

      it('should return success for single die showing 6', () => {
        const result = calculateOutcome([6]);
        expect(result).toBe('success');
      });

      it('should return success for one 6 at different positions', () => {
        expect(calculateOutcome([6, 2, 3])).toBe('success');
        expect(calculateOutcome([2, 6, 3])).toBe('success');
        expect(calculateOutcome([2, 3, 6])).toBe('success');
      });
    });

    describe('Partial outcomes (highest 4-5)', () => {
      it('should return partial for highest die of 5', () => {
        const result = calculateOutcome([5, 3, 2]);
        expect(result).toBe('partial');
      });

      it('should return partial for highest die of 4', () => {
        const result = calculateOutcome([4, 3, 2]);
        expect(result).toBe('partial');
      });

      it('should return partial for all 5s', () => {
        const result = calculateOutcome([5, 5, 5]);
        expect(result).toBe('partial');
      });

      it('should return partial for all 4s', () => {
        const result = calculateOutcome([4, 4, 4]);
        expect(result).toBe('partial');
      });

      it('should return partial for mixed 4s and 5s', () => {
        const result = calculateOutcome([5, 4, 4]);
        expect(result).toBe('partial');
      });

      it('should return partial for single die showing 5', () => {
        const result = calculateOutcome([5]);
        expect(result).toBe('partial');
      });

      it('should return partial for single die showing 4', () => {
        const result = calculateOutcome([4]);
        expect(result).toBe('partial');
      });

      it('should return partial for 5 with low dice', () => {
        const result = calculateOutcome([5, 1, 2, 3]);
        expect(result).toBe('partial');
      });
    });

    describe('Failure outcomes (highest 1-3)', () => {
      it('should return failure for highest die of 3', () => {
        const result = calculateOutcome([3, 2, 1]);
        expect(result).toBe('failure');
      });

      it('should return failure for highest die of 2', () => {
        const result = calculateOutcome([2, 1, 1]);
        expect(result).toBe('failure');
      });

      it('should return failure for highest die of 1', () => {
        const result = calculateOutcome([1, 1, 1]);
        expect(result).toBe('failure');
      });

      it('should return failure for all 3s', () => {
        const result = calculateOutcome([3, 3, 3]);
        expect(result).toBe('failure');
      });

      it('should return failure for all 2s', () => {
        const result = calculateOutcome([2, 2, 2]);
        expect(result).toBe('failure');
      });

      it('should return failure for single die showing 3', () => {
        const result = calculateOutcome([3]);
        expect(result).toBe('failure');
      });

      it('should return failure for single die showing 2', () => {
        const result = calculateOutcome([2]);
        expect(result).toBe('failure');
      });

      it('should return failure for single die showing 1', () => {
        const result = calculateOutcome([1]);
        expect(result).toBe('failure');
      });
    });

    describe('Edge cases', () => {
      it('should return failure for empty roll array', () => {
        const result = calculateOutcome([]);
        expect(result).toBe('failure');
      });

      it('should handle large dice pools correctly (critical)', () => {
        const result = calculateOutcome([6, 6, 5, 4, 3, 2, 1]);
        expect(result).toBe('critical');
      });

      it('should handle large dice pools correctly (success)', () => {
        const result = calculateOutcome([6, 5, 4, 3, 2, 1]);
        expect(result).toBe('success');
      });

      it('should handle large dice pools correctly (partial)', () => {
        const result = calculateOutcome([5, 4, 3, 2, 1]);
        expect(result).toBe('partial');
      });

      it('should handle large dice pools correctly (failure)', () => {
        const result = calculateOutcome([3, 2, 1, 1, 1]);
        expect(result).toBe('failure');
      });
    });

    describe('Priority rules (critical > success > partial > failure)', () => {
      it('should prioritize critical over success when 2+ sixes present', () => {
        // Even with multiple 6s, critical takes precedence
        const result = calculateOutcome([6, 6, 6]);
        expect(result).toBe('critical');
      });

      it('should prioritize success over partial when one 6 and high dice', () => {
        // Even with 5s present, one 6 means success
        const result = calculateOutcome([6, 5, 5]);
        expect(result).toBe('success');
      });

      it('should prioritize partial over failure when 4-5 and low dice', () => {
        // Even with 1s present, highest 4-5 means partial
        const result = calculateOutcome([5, 1, 1]);
        expect(result).toBe('partial');
      });
    });

    describe('Real-world scenarios', () => {
      it('should calculate outcome for desperate position roll (1 die)', () => {
        expect(calculateOutcome([6])).toBe('success');
        expect(calculateOutcome([5])).toBe('partial');
        expect(calculateOutcome([3])).toBe('failure');
      });

      it('should calculate outcome for risky position roll (2 dice)', () => {
        expect(calculateOutcome([6, 6])).toBe('critical');
        expect(calculateOutcome([6, 3])).toBe('success');
        expect(calculateOutcome([5, 4])).toBe('partial');
        expect(calculateOutcome([3, 2])).toBe('failure');
      });

      it('should calculate outcome for controlled position roll (3 dice)', () => {
        expect(calculateOutcome([6, 6, 1])).toBe('critical');
        expect(calculateOutcome([6, 4, 2])).toBe('success');
        expect(calculateOutcome([5, 3, 1])).toBe('partial');
        expect(calculateOutcome([3, 2, 1])).toBe('failure');
      });

      it('should calculate outcome for pushed roll (extra die)', () => {
        // Risky + Push = 3 dice
        expect(calculateOutcome([6, 6, 4])).toBe('critical');
        expect(calculateOutcome([6, 5, 3])).toBe('success');
        expect(calculateOutcome([5, 4, 2])).toBe('partial');
        expect(calculateOutcome([3, 2, 1])).toBe('failure');
      });

      it('should calculate outcome for assistance (extra dice)', () => {
        // Desperate + 2 assists = 3 dice
        expect(calculateOutcome([6, 6, 2])).toBe('critical');
        expect(calculateOutcome([6, 4, 1])).toBe('success');
        expect(calculateOutcome([4, 3, 2])).toBe('partial');
        expect(calculateOutcome([3, 1, 1])).toBe('failure');
      });
    });

    describe('Type safety', () => {
      it('should return DiceOutcome type', () => {
        const result: DiceOutcome = calculateOutcome([6, 6]);
        expect(result).toBe('critical');
      });

      it('should accept number array', () => {
        const rolls: number[] = [6, 5, 4];
        const result = calculateOutcome(rolls);
        expect(result).toBe('success');
      });
    });
  });
});
