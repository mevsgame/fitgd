import { describe, it, expect } from 'vitest';
import {
  validateActionSelection,
  validatePositionEffect,
  validateRollEligibility,
  validateConsequenceAcceptance,
  validateStimsUsage,
  validateRallyUsage,
  validateStateConsistency,
  validatePlayerRoundState,
} from '../../src/validators/playerRoundValidator';
import { createInitialPlayerRoundState } from '../../src/types/playerRoundState';
import type { PlayerRoundState, Clock } from '../../src/types';

describe('playerRoundValidator', () => {
  describe('validateActionSelection', () => {
    it('should allow action selection in DECISION_PHASE', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateActionSelection(playerState, 'shoot');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject action selection outside DECISION_PHASE', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'ROLLING',
        stateEnteredAt: Date.now(),
      };

      const result = validateActionSelection(playerState, 'shoot');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cannot select'))).toBe(true);
    });

    it('should reject empty action name', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateActionSelection(playerState, '');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should reject undefined player state', () => {
      const result = validateActionSelection(undefined, 'shoot');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not found'))).toBe(true);
    });
  });

  describe('validatePositionEffect', () => {
    it('should allow valid position and effect in DECISION_PHASE', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const result = validatePositionEffect(playerState, 'risky', 'standard');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject without action selected', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validatePositionEffect(playerState, 'risky', 'standard');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('action'))).toBe(true);
    });

    it('should reject invalid position', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const result = validatePositionEffect(playerState, 'invalid' as any, 'standard');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('position'))).toBe(true);
    });

    it('should reject invalid effect', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const result = validatePositionEffect(playerState, 'risky', 'invalid' as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('effect'))).toBe(true);
    });

    it('should allow all valid positions', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const positions = ['controlled', 'risky', 'desperate', 'impossible'] as const;
      positions.forEach((pos) => {
        const result = validatePositionEffect(playerState, pos, 'standard');
        expect(result.valid).toBe(true);
      });
    });

    it('should allow all valid effects', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const effects = ['limited', 'standard', 'great', 'spectacular'] as const;
      effects.forEach((eff) => {
        const result = validatePositionEffect(playerState, 'risky', eff);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateRollEligibility', () => {
    it('should allow roll with sufficient momentum and full setup', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 5, 1);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject with insufficient momentum', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 0, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Insufficient'))).toBe(true);
    });

    it('should reject without action selected', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 5, 1);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('action'))).toBe(true);
    });

    it('should reject without position set', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 5, 1);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('position'))).toBe(true);
    });

    it('should reject without effect set', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 5, 1);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('effect'))).toBe(true);
    });

    it('should allow exactly sufficient momentum (edge case)', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateRollEligibility(playerState, 3, 3);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateConsequenceAcceptance', () => {
    it('should allow acceptance in GM_RESOLVING_CONSEQUENCE state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        consequenceType: 'harm',
        consequenceValue: 3,
        stateEnteredAt: Date.now(),
      };

      const result = validateConsequenceAcceptance(playerState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject outside GM_RESOLVING_CONSEQUENCE state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'ROLLING',
        consequenceType: 'harm',
        consequenceValue: 3,
        stateEnteredAt: Date.now(),
      };

      const result = validateConsequenceAcceptance(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cannot accept'))).toBe(true);
    });

    it('should reject without consequence type', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        consequenceValue: 3,
        stateEnteredAt: Date.now(),
      };

      const result = validateConsequenceAcceptance(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should reject without consequence value', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        consequenceType: 'harm',
        stateEnteredAt: Date.now(),
      };

      const result = validateConsequenceAcceptance(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('value'))).toBe(true);
    });
  });

  describe('validateStimsUsage', () => {
    it('should allow stims usage when addiction not filled', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        stateEnteredAt: Date.now(),
      };

      const addictionClock: Clock = {
        id: 'addict-1',
        entityId: 'crew-123',
        clockType: 'addiction',
        segments: 4,
        maxSegments: 8,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validateStimsUsage(playerState, addictionClock);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when addiction clock filled', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        stateEnteredAt: Date.now(),
      };

      const addictionClock: Clock = {
        id: 'addict-1',
        entityId: 'crew-123',
        clockType: 'addiction',
        segments: 8,
        maxSegments: 8,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = validateStimsUsage(playerState, addictionClock);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('locked'))).toBe(true);
    });

    it('should reject when already used stims', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'GM_RESOLVING_CONSEQUENCE',
        stimsUsedThisAction: true,
        stateEnteredAt: Date.now(),
      };

      const result = validateStimsUsage(playerState, undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Already'))).toBe(true);
    });

    it('should reject outside GM_RESOLVING_CONSEQUENCE state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'ROLLING',
        stateEnteredAt: Date.now(),
      };

      const result = validateStimsUsage(playerState, undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cannot use'))).toBe(true);
    });
  });

  describe('validateRallyUsage', () => {
    it('should allow rally in DECISION_PHASE with momentum 0-3', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateRallyUsage(playerState, true, 2);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow rally in IDLE_WAITING with momentum 0-3', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'IDLE_WAITING',
        stateEnteredAt: Date.now(),
      };

      const result = validateRallyUsage(playerState, true, 1);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when rally not available', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateRallyUsage(playerState, false, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not available'))).toBe(true);
    });

    it('should reject with momentum > 3', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        stateEnteredAt: Date.now(),
      };

      const result = validateRallyUsage(playerState, true, 4);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('0-3'))).toBe(true);
    });

    it('should reject outside DECISION_PHASE and IDLE_WAITING', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'ROLLING',
        stateEnteredAt: Date.now(),
      };

      const result = validateRallyUsage(playerState, true, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cannot rally'))).toBe(true);
    });
  });

  describe('validateStateConsistency', () => {
    it('should pass for valid DECISION_PHASE state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateStateConsistency(playerState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject DECISION_PHASE with roll result', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        rollResult: [6, 5, 4],
        stateEnteredAt: Date.now(),
      };

      const result = validateStateConsistency(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('roll result'))).toBe(true);
    });

    it('should reject consequence without consequence state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        consequenceType: 'harm',
        consequenceValue: 3,
        stateEnteredAt: Date.now(),
      };

      const result = validateStateConsistency(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('consequence'))).toBe(true);
    });

    it('should reject position/effect without action', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateStateConsistency(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('position'))).toBe(true);
    });

    it('should reject roll result without action', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'ROLLING',
        rollResult: [6, 5, 4],
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validateStateConsistency(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('action'))).toBe(true);
    });
  });

  describe('validatePlayerRoundState', () => {
    it('should pass for internally consistent state', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        selectedAction: 'shoot',
        position: 'risky',
        effect: 'standard',
        stateEnteredAt: Date.now(),
      };

      const result = validatePlayerRoundState(playerState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report all errors found', () => {
      const playerState: PlayerRoundState = {
        characterId: 'char-123',
        state: 'DECISION_PHASE',
        consequenceType: 'harm', // Wrong state for consequence
        consequenceValue: 3,
        stateEnteredAt: Date.now(),
      };

      const result = validatePlayerRoundState(playerState);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
