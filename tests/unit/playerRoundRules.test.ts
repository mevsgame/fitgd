import { describe, it, expect } from 'vitest';
import {
  calculateConsequenceSeverity,
  calculateMomentumGain,
  calculateSuccessClockBase,
  getEffectModifier,
  calculateSuccessClockProgress,
  improvePosition,
  improveEffect,
} from '../../src/utils/playerRoundRules';
import type { Position, Effect } from '../../src/types/playerRoundState';

/**
 * Test suite for Player Round Game Rules
 *
 * Tests pure functions that calculate game rule values.
 * All tests are data-oriented (testing calculations, not state mutations).
 */

describe('playerRoundRules - Consequence Calculation', () => {
  describe('calculateConsequenceSeverity', () => {
    it('should return correct segments for each position', () => {
      expect(calculateConsequenceSeverity('controlled')).toBe(1);
      expect(calculateConsequenceSeverity('risky')).toBe(2);
      expect(calculateConsequenceSeverity('desperate')).toBe(4);
      expect(calculateConsequenceSeverity('impossible')).toBe(6);
    });

    it('should handle all position values', () => {
      const positions: Position[] = ['controlled', 'risky', 'desperate', 'impossible'];
      positions.forEach((position) => {
        const severity = calculateConsequenceSeverity(position);
        expect(severity).toBeGreaterThan(0);
        expect(severity).toBeLessThanOrEqual(6);
      });
    });

    it('should be consistent across multiple calls', () => {
      const position: Position = 'desperate';
      const result1 = calculateConsequenceSeverity(position);
      const result2 = calculateConsequenceSeverity(position);
      expect(result1).toBe(result2);
    });
  });

  describe('calculateMomentumGain', () => {
    it('should return correct momentum for each position', () => {
      expect(calculateMomentumGain('controlled')).toBe(1);
      expect(calculateMomentumGain('risky')).toBe(2);
      expect(calculateMomentumGain('desperate')).toBe(4);
      expect(calculateMomentumGain('impossible')).toBe(6);
    });

    it('should increase with riskier positions', () => {
      const controlled = calculateMomentumGain('controlled');
      const risky = calculateMomentumGain('risky');
      const desperate = calculateMomentumGain('desperate');
      const impossible = calculateMomentumGain('impossible');

      expect(controlled).toBeLessThan(risky);
      expect(risky).toBeLessThan(desperate);
      expect(desperate).toBeLessThan(impossible);
    });

    it('should reward risky positions with more momentum', () => {
      // Desperate is more dangerous than Risky, but should yield more momentum
      expect(calculateMomentumGain('desperate')).toBeGreaterThan(
        calculateMomentumGain('risky')
      );
      // Impossible (worst position) yields maximum momentum
      expect(calculateMomentumGain('impossible')).toBeGreaterThan(
        calculateMomentumGain('desperate')
      );
    });
  });
});

describe('playerRoundRules - Success Clock Calculation', () => {
  describe('calculateSuccessClockBase', () => {
    it('should return correct base progress for each position', () => {
      expect(calculateSuccessClockBase('controlled')).toBe(1);
      expect(calculateSuccessClockBase('risky')).toBe(3);
      expect(calculateSuccessClockBase('desperate')).toBe(5);
      expect(calculateSuccessClockBase('impossible')).toBe(6);
    });

    it('should increase with riskier positions', () => {
      const controlled = calculateSuccessClockBase('controlled');
      const risky = calculateSuccessClockBase('risky');
      const desperate = calculateSuccessClockBase('desperate');

      expect(controlled).toBeLessThan(risky);
      expect(risky).toBeLessThan(desperate);
    });
  });

  describe('getEffectModifier', () => {
    it('should return correct modifier for each effect', () => {
      expect(getEffectModifier('limited')).toBe(-1);
      expect(getEffectModifier('standard')).toBe(0);
      expect(getEffectModifier('great')).toBe(1);
      expect(getEffectModifier('spectacular')).toBe(2);
    });

    it('should increase with better effects', () => {
      const limited = getEffectModifier('limited');
      const standard = getEffectModifier('standard');
      const great = getEffectModifier('great');
      const spectacular = getEffectModifier('spectacular');

      expect(limited).toBeLessThan(standard);
      expect(standard).toBeLessThan(great);
      expect(great).toBeLessThan(spectacular);
    });

    it('should allow negative modifiers for poor effects', () => {
      expect(getEffectModifier('limited')).toBeLessThan(0);
    });
  });

  describe('calculateSuccessClockProgress', () => {
    it('should combine base progress and effect modifier', () => {
      // Risky (3) + Great (+1) = 4
      expect(calculateSuccessClockProgress('risky', 'great')).toBe(4);
      // Desperate (5) + Spectacular (+2) = 7
      expect(calculateSuccessClockProgress('desperate', 'spectacular')).toBe(7);
      // Controlled (1) + Standard (0) = 1
      expect(calculateSuccessClockProgress('controlled', 'standard')).toBe(1);
    });

    it('should clamp minimum to 0 (no negative progress)', () => {
      // Controlled (1) + Limited (-1) = 0
      expect(calculateSuccessClockProgress('controlled', 'limited')).toBe(0);
      // Even with worst combination, result is >= 0
      const result = calculateSuccessClockProgress('controlled', 'limited');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should never return negative values', () => {
      const positions: Position[] = ['controlled', 'risky', 'desperate', 'impossible'];
      const effects: Effect[] = ['limited', 'standard', 'great', 'spectacular'];

      positions.forEach((pos) => {
        effects.forEach((eff) => {
          const result = calculateSuccessClockProgress(pos, eff);
          expect(result).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should handle all combinations of position and effect', () => {
      const positions: Position[] = ['controlled', 'risky', 'desperate', 'impossible'];
      const effects: Effect[] = ['limited', 'standard', 'great', 'spectacular'];

      const results = new Set<number>();
      positions.forEach((pos) => {
        effects.forEach((eff) => {
          const result = calculateSuccessClockProgress(pos, eff);
          expect(typeof result).toBe('number');
          results.add(result);
        });
      });

      // Should produce a range of values
      expect(results.size).toBeGreaterThan(1);
    });

    it('should reward better positions and effects', () => {
      const risky_standard = calculateSuccessClockProgress('risky', 'standard');
      const risky_great = calculateSuccessClockProgress('risky', 'great');
      const desperate_standard = calculateSuccessClockProgress('desperate', 'standard');
      const desperate_great = calculateSuccessClockProgress('desperate', 'great');

      expect(risky_great).toBeGreaterThan(risky_standard);
      expect(desperate_standard).toBeGreaterThan(risky_standard);
      expect(desperate_great).toBeGreaterThan(desperate_standard);
      expect(desperate_great).toBeGreaterThan(risky_great);
    });
  });
});

describe('playerRoundRules - Position Improvement', () => {
  describe('improvePosition', () => {
    it('should improve each position by one step', () => {
      expect(improvePosition('impossible')).toBe('desperate');
      expect(improvePosition('desperate')).toBe('risky');
      expect(improvePosition('risky')).toBe('controlled');
    });

    it('should not improve controlled position (already best)', () => {
      expect(improvePosition('controlled')).toBe('controlled');
    });

    it('should create valid position ladder progression', () => {
      let pos: Position = 'impossible';
      const ladder: Position[] = [pos];

      // Walk up the ladder
      while (pos !== 'controlled') {
        pos = improvePosition(pos);
        ladder.push(pos);
      }

      // Should have all positions in order
      expect(ladder).toEqual(['impossible', 'desperate', 'risky', 'controlled']);
    });

    it('should be consistent for same input', () => {
      const pos: Position = 'desperate';
      const result1 = improvePosition(pos);
      const result2 = improvePosition(pos);
      expect(result1).toBe(result2);
    });

    it('should handle all position values', () => {
      const positions: Position[] = ['controlled', 'risky', 'desperate', 'impossible'];
      positions.forEach((position) => {
        const improved = improvePosition(position);
        expect(improved).toBeDefined();
        expect(['controlled', 'risky', 'desperate', 'impossible']).toContain(improved);
      });
    });
  });

  describe('improveEffect', () => {
    it('should improve each effect by one level', () => {
      expect(improveEffect('limited')).toBe('standard');
      expect(improveEffect('standard')).toBe('great');
      expect(improveEffect('great')).toBe('spectacular');
    });

    it('should not improve spectacular effect (already best)', () => {
      expect(improveEffect('spectacular')).toBe('spectacular');
    });

    it('should create valid effect ladder progression', () => {
      let eff: Effect = 'limited';
      const ladder: Effect[] = [eff];

      // Walk up the ladder
      while (eff !== 'spectacular') {
        eff = improveEffect(eff);
        ladder.push(eff);
      }

      // Should have all effects in order
      expect(ladder).toEqual(['limited', 'standard', 'great', 'spectacular']);
    });

    it('should be consistent for same input', () => {
      const eff: Effect = 'standard';
      const result1 = improveEffect(eff);
      const result2 = improveEffect(eff);
      expect(result1).toBe(result2);
    });

    it('should handle all effect values', () => {
      const effects: Effect[] = ['limited', 'standard', 'great', 'spectacular'];
      effects.forEach((effect) => {
        const improved = improveEffect(effect);
        expect(improved).toBeDefined();
        expect(['limited', 'standard', 'great', 'spectacular']).toContain(improved);
      });
    });
  });
});

describe('playerRoundRules - Gameplay Scenarios', () => {
  it('should handle risky controlled success', () => {
    const position: Position = 'controlled';
    const effect: Effect = 'standard';
    const consequence = calculateConsequenceSeverity(position);
    const momentum = calculateMomentumGain(position);
    const clockProgress = calculateSuccessClockProgress(position, effect);

    expect(consequence).toBe(1);
    expect(momentum).toBe(1);
    expect(clockProgress).toBe(1);
  });

  it('should handle desperate attack with great effect', () => {
    const position: Position = 'desperate';
    const effect: Effect = 'great';
    const consequence = calculateConsequenceSeverity(position);
    const momentum = calculateMomentumGain(position);
    const clockProgress = calculateSuccessClockProgress(position, effect);

    expect(consequence).toBe(4); // Desperate = 4 segments
    expect(momentum).toBe(4); // Desperate = 4 momentum
    expect(clockProgress).toBe(6); // 5 + 1 = 6
  });

  it('should handle impossible position (instant dying)', () => {
    const position: Position = 'impossible';
    const consequence = calculateConsequenceSeverity(position);

    expect(consequence).toBe(6); // Fills harm clock (6 segments)
  });

  it('should handle limited effect reducing progress', () => {
    const base = calculateSuccessClockBase('risky');
    const modifier = getEffectModifier('limited');
    const progress = calculateSuccessClockProgress('risky', 'limited');

    expect(base).toBe(3);
    expect(modifier).toBe(-1);
    expect(progress).toBe(2); // 3 - 1
  });

  it('should improve desperate to risky action', () => {
    const original: Position = 'desperate';
    const improved = improvePosition(original);

    expect(improved).toBe('risky');
    expect(calculateConsequenceSeverity(original)).toBeGreaterThan(
      calculateConsequenceSeverity(improved)
    );
  });
});



