/**
 * Clock Interaction Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateConsequenceSegments,
  calculateProgressSegments,
  calculateReductionSegments,
  calculateSegmentAmount,
  suggestClockInteractions,
  getTypicalDirection
} from '@/utils/clockInteractions';
import type { Clock } from '@/types/clock';
import type { InteractionContext } from '@/types/clockInteraction';

describe('clockInteractions', () => {
  describe('calculateConsequenceSegments', () => {
    it('should calculate controlled consequence (1 segment)', () => {
      expect(calculateConsequenceSegments('controlled')).toBe(1);
    });

    it('should calculate risky consequence (3 segments)', () => {
      expect(calculateConsequenceSegments('risky')).toBe(3);
    });

    it('should calculate desperate consequence (5 segments)', () => {
      expect(calculateConsequenceSegments('desperate')).toBe(5);
    });

    it('should calculate impossible consequence (6 segments)', () => {
      expect(calculateConsequenceSegments('impossible')).toBe(6);
    });
  });

  describe('calculateProgressSegments', () => {
    it('should calculate risky/standard (3 segments)', () => {
      expect(calculateProgressSegments('risky', 'standard')).toBe(3);
    });

    it('should calculate risky/great (4 segments)', () => {
      expect(calculateProgressSegments('risky', 'great')).toBe(4); // 3 + 1
    });

    it('should calculate desperate/standard (5 segments)', () => {
      expect(calculateProgressSegments('desperate', 'standard')).toBe(5);
    });

    it('should calculate desperate/spectacular (7 segments)', () => {
      expect(calculateProgressSegments('desperate', 'spectacular')).toBe(7); // 5 + 2
    });

    it('should calculate controlled/limited (0 segments minimum)', () => {
      expect(calculateProgressSegments('controlled', 'limited')).toBe(0); // 1 - 1 = 0
    });

    it('should not go below 0', () => {
      expect(calculateProgressSegments('controlled', 'limited')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateReductionSegments', () => {
    it('should calculate limited reduction (1 segment)', () => {
      expect(calculateReductionSegments('limited')).toBe(1);
    });

    it('should calculate standard reduction (2 segments)', () => {
      expect(calculateReductionSegments('standard')).toBe(2);
    });

    it('should calculate great reduction (4 segments)', () => {
      expect(calculateReductionSegments('great')).toBe(4);
    });

    it('should calculate spectacular reduction (6 segments)', () => {
      expect(calculateReductionSegments('spectacular')).toBe(6);
    });
  });

  describe('calculateSegmentAmount', () => {
    it('should calculate failure advance (consequence)', () => {
      const amount = calculateSegmentAmount('failure', 'risky', 'standard', 'advance');
      expect(amount).toBe(3); // Risky consequence
    });

    it('should calculate success advance (progress)', () => {
      const amount = calculateSegmentAmount('success', 'risky', 'great', 'advance');
      expect(amount).toBe(4); // Risky + Great
    });

    it('should calculate success reduce (effect-based)', () => {
      const amount = calculateSegmentAmount('success', 'controlled', 'great', 'reduce');
      expect(amount).toBe(4); // Great effect reduction
    });

    it('should return 0 for invalid combinations', () => {
      const amount = calculateSegmentAmount('failure', 'risky', 'standard', 'reduce');
      expect(amount).toBe(0); // Can't reduce on failure
    });
  });

  describe('getTypicalDirection', () => {
    it('should return advance for failure', () => {
      expect(getTypicalDirection('failure')).toBe('advance');
    });

    it('should return advance for partial', () => {
      expect(getTypicalDirection('partial')).toBe('advance');
    });

    it('should return advance for success', () => {
      expect(getTypicalDirection('success')).toBe('advance');
    });

    it('should return advance for critical', () => {
      expect(getTypicalDirection('critical')).toBe('advance');
    });
  });

  describe('suggestClockInteractions', () => {
    const sampleClocks: Clock[] = [
      {
        id: 'harm-1',
        category: 'harm',
        ownerId: 'char-1',
        ownerType: 'character',
        name: 'Physical Harm',
        entityId: 'char-1',
        clockType: 'harm',
        segments: 3,
        maxSegments: 6,
        metadata: { harmType: 'physical' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'threat-1',
        category: 'threat',
        ownerId: 'crew-1',
        ownerType: 'crew',
        name: 'Enemy Reinforcements',
        entityId: 'crew-1',
        clockType: 'progress',
        segments: 4,
        maxSegments: 8,
        metadata: { threatCategory: 'enemy-reinforcements' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'progress-1',
        category: 'progress',
        ownerId: 'crew-1',
        ownerType: 'crew',
        name: 'Infiltrate Vault',
        entityId: 'crew-1',
        clockType: 'progress',
        segments: 5,
        maxSegments: 8,
        metadata: { progressCategory: 'extended-action' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    describe('failure/partial suggestions', () => {
      it('should suggest advancing harm on failure', () => {
        const context: InteractionContext = {
          outcome: 'failure',
          position: 'risky',
          effect: 'standard',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const harmSuggestion = suggestions.find(s => s.clock.id === 'harm-1');
        expect(harmSuggestion).toBeDefined();
        expect(harmSuggestion?.suggestedDirection).toBe('advance');
        expect(harmSuggestion?.suggestedAmount).toBe(3); // Risky
      });

      it('should suggest advancing threat on failure', () => {
        const context: InteractionContext = {
          outcome: 'failure',
          position: 'desperate',
          effect: 'standard',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const threatSuggestion = suggestions.find(s => s.clock.id === 'threat-1');
        expect(threatSuggestion).toBeDefined();
        expect(threatSuggestion?.suggestedDirection).toBe('advance');
        expect(threatSuggestion?.suggestedAmount).toBe(5); // Desperate
      });

      it('should suggest both harm and threat on partial', () => {
        const context: InteractionContext = {
          outcome: 'partial',
          position: 'risky',
          effect: 'standard',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        expect(suggestions.length).toBeGreaterThanOrEqual(2);
        expect(suggestions.some(s => s.clock.category === 'harm')).toBe(true);
        expect(suggestions.some(s => s.clock.category === 'threat')).toBe(true);
      });
    });

    describe('success with progress', () => {
      it('should suggest advancing progress on success (normal action)', () => {
        const context: InteractionContext = {
          outcome: 'success',
          position: 'risky',
          effect: 'great',
          actionType: 'normal',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const progressSuggestion = suggestions.find(s => s.clock.id === 'progress-1');
        expect(progressSuggestion).toBeDefined();
        expect(progressSuggestion?.suggestedDirection).toBe('advance');
        expect(progressSuggestion?.suggestedAmount).toBe(4); // Risky + Great
      });

      it('should suggest advancing progress on critical', () => {
        const context: InteractionContext = {
          outcome: 'critical',
          position: 'desperate',
          effect: 'spectacular',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const progressSuggestion = suggestions.find(s => s.clock.id === 'progress-1');
        expect(progressSuggestion).toBeDefined();
        expect(progressSuggestion?.suggestedAmount).toBe(7); // Desperate + Spectacular
      });
    });

    describe('success with Rally/Medical', () => {
      it('should suggest reducing harm on Rally success', () => {
        const context: InteractionContext = {
          outcome: 'success',
          position: 'controlled',
          effect: 'standard',
          actionType: 'rally',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const harmSuggestion = suggestions.find(s => s.clock.id === 'harm-1');
        expect(harmSuggestion).toBeDefined();
        expect(harmSuggestion?.suggestedDirection).toBe('reduce');
        expect(harmSuggestion?.suggestedAmount).toBe(2); // Standard effect
      });

      it('should suggest reducing harm on medical success with great effect', () => {
        const context: InteractionContext = {
          outcome: 'success',
          position: 'controlled',
          effect: 'great',
          actionType: 'medical',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const harmSuggestion = suggestions.find(s => s.clock.id === 'harm-1');
        expect(harmSuggestion).toBeDefined();
        expect(harmSuggestion?.suggestedDirection).toBe('reduce');
        expect(harmSuggestion?.suggestedAmount).toBe(4); // Great effect
      });
    });

    describe('success with Defuse/Mitigate', () => {
      it('should suggest reducing threat on defuse success', () => {
        const context: InteractionContext = {
          outcome: 'success',
          position: 'desperate',
          effect: 'great',
          actionType: 'defuse',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const threatSuggestion = suggestions.find(s => s.clock.id === 'threat-1');
        expect(threatSuggestion).toBeDefined();
        expect(threatSuggestion?.suggestedDirection).toBe('reduce');
        expect(threatSuggestion?.suggestedAmount).toBe(4); // Great effect
      });

      it('should suggest reducing threat on mitigate success', () => {
        const context: InteractionContext = {
          outcome: 'success',
          position: 'risky',
          effect: 'standard',
          actionType: 'mitigate',
          characterId: 'char-1',
          crewId: 'crew-1'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        const threatSuggestion = suggestions.find(s => s.clock.id === 'threat-1');
        expect(threatSuggestion).toBeDefined();
        expect(threatSuggestion?.suggestedDirection).toBe('reduce');
        expect(threatSuggestion?.suggestedAmount).toBe(2); // Standard effect
      });
    });

    describe('empty suggestions', () => {
      it('should return empty array when no matching clocks', () => {
        const context: InteractionContext = {
          outcome: 'failure',
          position: 'risky',
          effect: 'standard',
          characterId: 'char-999', // Non-existent character
          crewId: 'crew-999'
        };

        const suggestions = suggestClockInteractions(context, sampleClocks);

        expect(suggestions).toHaveLength(0);
      });
    });
  });
});
