/**
 * Defensive Success Tests
 *
 * Rules: vault/rules_primer.md - Defensive Success Option section
 * Feature allows trading Effect for reduced consequence on partial success
 *
 * Tests written FIRST (TDD) - these MUST fail initially
 */

import { describe, it, expect } from 'vitest';
import type { Position, Effect } from '../../src/types/playerRoundState';
import {
  isDefensiveSuccessAvailable,
  calculateDefensivePosition,
  calculateDefensiveEffect,
  calculateDefensiveMomentumGain,
  calculateDefensiveSuccessValues,
} from '../../src/utils/defensiveSuccessRules';

describe('Defensive Success - Availability', () => {
  it('should be available on partial success with Standard effect', () => {
    expect(isDefensiveSuccessAvailable('partial', 'standard')).toBe(true);
  });

  it('should be available on partial success with Great effect', () => {
    expect(isDefensiveSuccessAvailable('partial', 'great')).toBe(true);
  });

  it('should be available on partial success with Spectacular effect', () => {
    expect(isDefensiveSuccessAvailable('partial', 'spectacular')).toBe(true);
  });

  it('should NOT be available on partial success with Limited effect', () => {
    expect(isDefensiveSuccessAvailable('partial', 'limited')).toBe(false);
  });

  it('should NOT be available on full success', () => {
    expect(isDefensiveSuccessAvailable('success', 'standard')).toBe(false);
  });

  it('should NOT be available on failure', () => {
    expect(isDefensiveSuccessAvailable('failure', 'standard')).toBe(false);
  });

  it('should NOT be available on critical success', () => {
    expect(isDefensiveSuccessAvailable('critical', 'standard')).toBe(false);
  });
});

describe('Defensive Success - Position Reduction', () => {
  it('should reduce impossible to desperate', () => {
    expect(calculateDefensivePosition('impossible')).toBe('desperate');
  });

  it('should reduce desperate to risky', () => {
    expect(calculateDefensivePosition('desperate')).toBe('risky');
  });

  it('should reduce risky to controlled', () => {
    expect(calculateDefensivePosition('risky')).toBe('controlled');
  });

  it('should reduce controlled to null (no consequence)', () => {
    expect(calculateDefensivePosition('controlled')).toBeNull();
  });
});

describe('Defensive Success - Effect Reduction', () => {
  it('should reduce spectacular to great', () => {
    expect(calculateDefensiveEffect('spectacular')).toBe('great');
  });

  it('should reduce great to standard', () => {
    expect(calculateDefensiveEffect('great')).toBe('standard');
  });

  it('should reduce standard to limited', () => {
    expect(calculateDefensiveEffect('standard')).toBe('limited');
  });

  it('should return null for limited effect (cannot reduce)', () => {
    expect(calculateDefensiveEffect('limited')).toBeNull();
  });
});

describe('Defensive Success - Momentum Preservation', () => {
  it('should preserve risky momentum (+2) when reducing to controlled', () => {
    expect(calculateDefensiveMomentumGain('risky', 'controlled')).toBe(2);
  });

  it('should preserve desperate momentum (+4) when reducing to risky', () => {
    expect(calculateDefensiveMomentumGain('desperate', 'risky')).toBe(4);
  });

  it('should preserve impossible momentum (+6) when reducing to desperate', () => {
    expect(calculateDefensiveMomentumGain('impossible', 'desperate')).toBe(6);
  });

  it('should preserve controlled momentum (+1) when reducing to none', () => {
    expect(calculateDefensiveMomentumGain('controlled', null)).toBe(1);
  });
});

describe('Defensive Success - Complete Calculation', () => {
  it('should calculate defensive success for risky/standard partial', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'risky',
      effect: 'standard',
      outcome: 'partial',
    });

    expect(result.available).toBe(true);
    expect(result.defensivePosition).toBe('controlled');
    expect(result.defensiveEffect).toBe('limited');
    expect(result.defensiveSegments).toBe(1); // Controlled = 1 segment
    expect(result.originalSegments).toBe(2); // Risky = 2 segments
    expect(result.momentumGain).toBe(2); // Original risky position
  });

  it('should calculate no consequence when reducing from controlled', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'controlled',
      effect: 'standard',
      outcome: 'partial',
    });

    expect(result.available).toBe(true);
    expect(result.defensivePosition).toBeNull();
    expect(result.defensiveSegments).toBe(0); // No consequence
    expect(result.originalSegments).toBe(1); // Controlled = 1 segment
    expect(result.momentumGain).toBe(1); // Original controlled position
  });

  it('should calculate defensive for desperate/great partial', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'desperate',
      effect: 'great',
      outcome: 'partial',
    });

    expect(result.available).toBe(true);
    expect(result.defensivePosition).toBe('risky');
    expect(result.defensiveEffect).toBe('standard');
    expect(result.defensiveSegments).toBe(2); // Risky = 2 segments
    expect(result.originalSegments).toBe(4); // Desperate = 4 segments
    expect(result.momentumGain).toBe(4); // Original desperate position
  });
});

describe('Defensive Success - Edge Cases', () => {
  it('should handle impossible position reduction', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'impossible',
      effect: 'standard',
      outcome: 'partial',
    });

    expect(result.available).toBe(true);
    expect(result.defensivePosition).toBe('desperate');
    expect(result.defensiveSegments).toBe(4); // Desperate = 4
    expect(result.originalSegments).toBe(6); // Impossible = 6
    expect(result.momentumGain).toBe(6); // Original impossible
  });

  it('should mark unavailable when effect is limited', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'risky',
      effect: 'limited',
      outcome: 'partial',
    });

    expect(result.available).toBe(false);
  });

  it('should mark unavailable on success outcome', () => {
    const result = calculateDefensiveSuccessValues({
      position: 'risky',
      effect: 'standard',
      outcome: 'success',
    });

    expect(result.available).toBe(false);
  });
});
