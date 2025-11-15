/**
 * Clock Query Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getClocksByCategory,
  getClocksByOwner,
  getHarmClocks,
  getThreatClocks,
  getProgressClocks,
  getConsequenceClocks,
  getSuccessClocks,
  isClockFilled,
  isClockEmpty,
  isCharacterDying,
  getTotalHarmSegments,
  getClockFillPercentage
} from '@/utils/clockQueries';
import type { Clock } from '@/types/clock';

describe('clockQueries', () => {
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
      id: 'harm-2',
      category: 'harm',
      ownerId: 'char-1',
      ownerType: 'character',
      name: 'Shaken Morale',
      entityId: 'char-1',
      clockType: 'harm',
      segments: 6,
      maxSegments: 6,
      metadata: { harmType: 'morale' },
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

  describe('getClocksByCategory', () => {
    it('should get all harm clocks', () => {
      const harmClocks = getClocksByCategory(sampleClocks, 'harm');
      expect(harmClocks).toHaveLength(2);
      expect(harmClocks.every(c => c.category === 'harm')).toBe(true);
    });

    it('should get all threat clocks', () => {
      const threatClocks = getClocksByCategory(sampleClocks, 'threat');
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].id).toBe('threat-1');
    });

    it('should get all progress clocks', () => {
      const progressClocks = getClocksByCategory(sampleClocks, 'progress');
      expect(progressClocks).toHaveLength(1);
      expect(progressClocks[0].id).toBe('progress-1');
    });
  });

  describe('getClocksByOwner', () => {
    it('should get all clocks for character', () => {
      const charClocks = getClocksByOwner(sampleClocks, 'char-1');
      expect(charClocks).toHaveLength(2);
      expect(charClocks.every(c => c.ownerId === 'char-1')).toBe(true);
    });

    it('should get harm clocks for character', () => {
      const harmClocks = getClocksByOwner(sampleClocks, 'char-1', 'harm');
      expect(harmClocks).toHaveLength(2);
      expect(harmClocks.every(c => c.category === 'harm')).toBe(true);
    });

    it('should get all clocks for crew', () => {
      const crewClocks = getClocksByOwner(sampleClocks, 'crew-1');
      expect(crewClocks).toHaveLength(2);
      expect(crewClocks.every(c => c.ownerId === 'crew-1')).toBe(true);
    });
  });

  describe('getHarmClocks', () => {
    it('should get harm clocks for character', () => {
      const harmClocks = getHarmClocks(sampleClocks, 'char-1');
      expect(harmClocks).toHaveLength(2);
      expect(harmClocks[0].name).toBe('Physical Harm');
      expect(harmClocks[1].name).toBe('Shaken Morale');
    });

    it('should return empty array for character with no harm', () => {
      const harmClocks = getHarmClocks(sampleClocks, 'char-2');
      expect(harmClocks).toHaveLength(0);
    });
  });

  describe('getThreatClocks', () => {
    it('should get threat clocks for crew', () => {
      const threatClocks = getThreatClocks(sampleClocks, 'crew-1');
      expect(threatClocks).toHaveLength(1);
      expect(threatClocks[0].name).toBe('Enemy Reinforcements');
    });
  });

  describe('getProgressClocks', () => {
    it('should get progress clocks for crew', () => {
      const progressClocks = getProgressClocks(sampleClocks, 'crew-1');
      expect(progressClocks).toHaveLength(1);
      expect(progressClocks[0].name).toBe('Infiltrate Vault');
    });
  });

  describe('getConsequenceClocks', () => {
    it('should get both harm and threat clocks', () => {
      const conseqClocks = getConsequenceClocks(sampleClocks, 'char-1', 'crew-1');
      expect(conseqClocks).toHaveLength(3);
      expect(conseqClocks.filter(c => c.category === 'harm')).toHaveLength(2);
      expect(conseqClocks.filter(c => c.category === 'threat')).toHaveLength(1);
    });
  });

  describe('getSuccessClocks', () => {
    it('should get progress clocks', () => {
      const successClocks = getSuccessClocks(sampleClocks, 'char-1', 'crew-1');
      expect(successClocks).toHaveLength(1);
      expect(successClocks[0].category).toBe('progress');
    });
  });

  describe('isClockFilled', () => {
    it('should return true for filled clock', () => {
      const filledClock = sampleClocks.find(c => c.id === 'harm-2')!;
      expect(isClockFilled(filledClock)).toBe(true);
    });

    it('should return false for partial clock', () => {
      const partialClock = sampleClocks.find(c => c.id === 'harm-1')!;
      expect(isClockFilled(partialClock)).toBe(false);
    });
  });

  describe('isClockEmpty', () => {
    it('should return true for empty clock', () => {
      const emptyClock: Clock = {
        ...sampleClocks[0],
        segments: 0
      };
      expect(isClockEmpty(emptyClock)).toBe(true);
    });

    it('should return false for non-empty clock', () => {
      expect(isClockEmpty(sampleClocks[0])).toBe(false);
    });
  });

  describe('isCharacterDying', () => {
    it('should return true if character has filled harm clock', () => {
      expect(isCharacterDying(sampleClocks, 'char-1')).toBe(true);
    });

    it('should return false if character has no filled harm clocks', () => {
      expect(isCharacterDying(sampleClocks, 'char-2')).toBe(false);
    });
  });

  describe('getTotalHarmSegments', () => {
    it('should sum all harm segments for character', () => {
      const total = getTotalHarmSegments(sampleClocks, 'char-1');
      expect(total).toBe(9); // 3 + 6
    });

    it('should return 0 for character with no harm', () => {
      const total = getTotalHarmSegments(sampleClocks, 'char-2');
      expect(total).toBe(0);
    });
  });

  describe('getClockFillPercentage', () => {
    it('should calculate fill percentage correctly', () => {
      const clock = sampleClocks.find(c => c.id === 'harm-1')!;
      expect(getClockFillPercentage(clock)).toBe(50); // 3/6 = 50%
    });

    it('should return 100 for filled clock', () => {
      const clock = sampleClocks.find(c => c.id === 'harm-2')!;
      expect(getClockFillPercentage(clock)).toBe(100); // 6/6 = 100%
    });

    it('should return 0 for empty clock', () => {
      const clock: Clock = {
        ...sampleClocks[0],
        segments: 0
      };
      expect(getClockFillPercentage(clock)).toBe(0);
    });
  });
});
