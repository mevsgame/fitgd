/**
 * Clock Migration Tests
 */

import { describe, it, expect } from 'vitest';
import { migrateClockToTyped, isClockMigrated, migrateAllClocks } from '@/utils/clockMigration';
import type { Clock } from '@/types/clock';

describe('clockMigration', () => {
  describe('migrateClockToTyped', () => {
    it('should migrate harm clock with Physical subtype', () => {
      const oldClock: Clock = {
        id: 'clock-1',
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm',
        segments: 3,
        maxSegments: 6,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // New fields will be added by migration
        category: 'harm' as any,
        ownerId: 'char-1',
        ownerType: 'character',
        name: 'Physical Harm'
      };

      const migrated = migrateClockToTyped(oldClock);

      expect(migrated.category).toBe('harm');
      expect(migrated.ownerId).toBe('char-1');
      expect(migrated.ownerType).toBe('character');
      expect(migrated.name).toBe('Physical Harm');
      expect(migrated.metadata.harmType).toBe('physical');
    });

    it('should migrate harm clock with Morale subtype', () => {
      const oldClock: Clock = {
        id: 'clock-2',
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Shaken Morale',
        segments: 2,
        maxSegments: 6,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'harm' as any,
        ownerId: 'char-1',
        ownerType: 'character',
        name: 'Shaken Morale'
      };

      const migrated = migrateClockToTyped(oldClock);

      expect(migrated.category).toBe('harm');
      expect(migrated.metadata.harmType).toBe('morale');
    });

    it('should migrate progress clock with isCountdown to threat', () => {
      const oldClock: Clock = {
        id: 'clock-3',
        entityId: 'crew-1',
        clockType: 'progress',
        subtype: 'Enemy Reinforcements',
        segments: 4,
        maxSegments: 8,
        metadata: {
          isCountdown: true,
          category: 'threat'
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'threat' as any,
        ownerId: 'crew-1',
        ownerType: 'crew',
        name: 'Enemy Reinforcements'
      };

      const migrated = migrateClockToTyped(oldClock);

      expect(migrated.category).toBe('threat');
      expect(migrated.ownerType).toBe('crew');
      expect(migrated.metadata.threatCategory).toBe('enemy-reinforcements');
    });

    it('should migrate progress clock without isCountdown', () => {
      const oldClock: Clock = {
        id: 'clock-4',
        entityId: 'crew-1',
        clockType: 'progress',
        subtype: 'Infiltrate Vault',
        segments: 5,
        maxSegments: 8,
        metadata: {
          category: 'long-term-project'
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'progress' as any,
        ownerId: 'crew-1',
        ownerType: 'crew',
        name: 'Infiltrate Vault'
      };

      const migrated = migrateClockToTyped(oldClock);

      expect(migrated.category).toBe('progress');
      expect(migrated.metadata.progressCategory).toBe('long-term-project');
    });

    it('should migrate addiction clock', () => {
      const oldClock: Clock = {
        id: 'clock-5',
        entityId: 'crew-1',
        clockType: 'addiction',
        segments: 6,
        maxSegments: 8,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'addiction' as any,
        ownerId: 'crew-1',
        ownerType: 'crew',
        name: 'Addiction'
      };

      const migrated = migrateClockToTyped(oldClock);

      expect(migrated.category).toBe('addiction');
      expect(migrated.ownerType).toBe('crew');
      expect(migrated.name).toBe('Addiction');
    });

    it('should preserve old fields for backward compatibility', () => {
      const oldClock: Clock = {
        id: 'clock-1',
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm',
        segments: 3,
        maxSegments: 6,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'harm' as any,
        ownerId: 'char-1',
        ownerType: 'character',
        name: 'Physical Harm'
      };

      const migrated = migrateClockToTyped(oldClock);

      // Old fields should be preserved
      expect(migrated.entityId).toBe('char-1');
      expect(migrated.clockType).toBe('harm');
      expect(migrated.subtype).toBe('Physical Harm');
    });
  });

  describe('isClockMigrated', () => {
    it('should return true for migrated clock', () => {
      const clock: Clock = {
        id: 'clock-1',
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
      };

      expect(isClockMigrated(clock)).toBe(true);
    });

    it('should return false for non-migrated clock', () => {
      const clock: Clock = {
        id: 'clock-1',
        entityId: 'char-1',
        clockType: 'harm',
        subtype: 'Physical Harm',
        segments: 3,
        maxSegments: 6,
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Missing new fields
        category: undefined as any,
        ownerId: undefined as any,
        ownerType: undefined as any,
        name: undefined as any
      };

      expect(isClockMigrated(clock)).toBe(false);
    });
  });

  describe('migrateAllClocks', () => {
    it('should migrate all non-migrated clocks', () => {
      const clocks: Record<string, Clock> = {
        'clock-1': {
          id: 'clock-1',
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical Harm',
          segments: 3,
          maxSegments: 6,
          metadata: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          category: undefined as any,
          ownerId: undefined as any,
          ownerType: undefined as any,
          name: undefined as any
        },
        'clock-2': {
          id: 'clock-2',
          category: 'threat',
          ownerId: 'crew-1',
          ownerType: 'crew',
          name: 'Alarm',
          entityId: 'crew-1',
          clockType: 'progress',
          segments: 5,
          maxSegments: 8,
          metadata: { threatCategory: 'alarm-level' },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      };

      const migrated = migrateAllClocks(clocks);

      expect(isClockMigrated(migrated['clock-1'])).toBe(true);
      expect(isClockMigrated(migrated['clock-2'])).toBe(true);
      expect(migrated['clock-1'].category).toBe('harm');
      expect(migrated['clock-2'].category).toBe('threat');
    });
  });
});
