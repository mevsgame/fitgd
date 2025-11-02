import { describe, it, expect } from 'vitest';
import {
  mockCharacter_SergeantKane,
  mockCharacter_Rookie,
  mockCrew_StrikeTeamAlpha,
  mockClock_PhysicalHarm,
  mockClock_ConsumableGrenades,
  mockClock_Addiction,
} from '../fixtures';

describe('Test Fixtures', () => {
  describe('Characters', () => {
    it('should have valid Sergeant Kane fixture', () => {
      expect(mockCharacter_SergeantKane).toBeDefined();
      expect(mockCharacter_SergeantKane.name).toBe('Sergeant Kane');
      expect(mockCharacter_SergeantKane.traits).toHaveLength(2);
      expect(mockCharacter_SergeantKane.rallyAvailable).toBe(true);
    });

    it('should have valid action dots (total 12)', () => {
      const total = Object.values(mockCharacter_SergeantKane.actionDots).reduce(
        (sum, dots) => sum + dots,
        0
      );
      expect(total).toBe(12);
    });

    it('should have valid Rookie Davis fixture', () => {
      expect(mockCharacter_Rookie).toBeDefined();
      expect(mockCharacter_Rookie.name).toBe('Rookie Davis');
      expect(mockCharacter_Rookie.traits).toHaveLength(2);
    });
  });

  describe('Crews', () => {
    it('should have valid Strike Team Alpha fixture', () => {
      expect(mockCrew_StrikeTeamAlpha).toBeDefined();
      expect(mockCrew_StrikeTeamAlpha.name).toBe('Strike Team Alpha');
      expect(mockCrew_StrikeTeamAlpha.currentMomentum).toBe(5);
      expect(mockCrew_StrikeTeamAlpha.characters).toHaveLength(2);
    });
  });

  describe('Clocks', () => {
    it('should have valid harm clock fixture', () => {
      expect(mockClock_PhysicalHarm).toBeDefined();
      expect(mockClock_PhysicalHarm.clockType).toBe('harm');
      expect(mockClock_PhysicalHarm.maxSegments).toBe(6);
      expect(mockClock_PhysicalHarm.segments).toBe(3);
    });

    it('should have valid consumable clock fixture', () => {
      expect(mockClock_ConsumableGrenades).toBeDefined();
      expect(mockClock_ConsumableGrenades.clockType).toBe('consumable');
      expect(mockClock_ConsumableGrenades.metadata?.rarity).toBe('common');
      expect(mockClock_ConsumableGrenades.maxSegments).toBe(8);
    });

    it('should have valid addiction clock fixture', () => {
      expect(mockClock_Addiction).toBeDefined();
      expect(mockClock_Addiction.clockType).toBe('addiction');
      expect(mockClock_Addiction.maxSegments).toBe(8);
    });
  });
});
