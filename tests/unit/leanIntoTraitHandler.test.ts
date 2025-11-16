/**
 * Tests for LeanIntoTraitHandler
 *
 * Validates lean into trait mechanics:
 * - Crew availability checking
 * - Available traits validation
 * - Trait filtering (disabled vs enabled)
 */

import { describe, it, expect } from 'vitest';
import { LeanIntoTraitHandler } from '../../foundry/module/handlers/leanIntoTraitHandler';
import type { Character } from '../../src/types/character';

describe('LeanIntoTraitHandler', () => {
  // Test data
  const mockTrait1 = {
    id: 'trait-1',
    name: 'Daring',
    description: 'Bold and fearless',
    disabled: false,
  };

  const mockTrait2 = {
    id: 'trait-2',
    name: 'Careful',
    description: 'Methodical approach',
    disabled: false,
  };

  const mockDisabledTrait = {
    id: 'trait-3',
    name: 'Reckless',
    description: 'Throw caution to the wind',
    disabled: true,
  };

  const mockCharacter = (traits = [mockTrait1, mockTrait2]): Character => ({
    id: 'char-1',
    name: 'Test Character',
    traits,
    actionDots: {
      consort: 0,
      prowess: 0,
      finesse: 0,
      insight: 0,
      sway: 0,
      attune: 0,
      command: 0,
      craft: 0,
      study: 0,
      rig: 0,
      scrap: 0,
      wield: 0,
    },
    equipment: [],
    rallyAvailable: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  describe('validateLeanIntoTrait', () => {
    it('should return valid when character is in crew and has available traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter(),
        crewId: 'crew-1',
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return no-crew when character is not in crew', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter(),
        crewId: null,
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-crew');
    });

    it('should return no-available-traits when all traits are disabled', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockDisabledTrait]),
        crewId: 'crew-1',
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-available-traits');
    });

    it('should return no-available-traits when character has no traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([]),
        crewId: 'crew-1',
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-available-traits');
    });

    it('should return valid when character has mix of enabled and disabled traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockTrait1, mockDisabledTrait]),
        crewId: 'crew-1',
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle null character gracefully', () => {
      const handler = new LeanIntoTraitHandler({
        character: null,
        crewId: 'crew-1',
      });

      const result = handler.validateLeanIntoTrait();

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-available-traits');
    });
  });

  describe('getAvailableTraits', () => {
    it('should return only non-disabled traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockTrait1, mockDisabledTrait, mockTrait2]),
        crewId: 'crew-1',
      });

      const available = handler.getAvailableTraits();

      expect(available).toHaveLength(2);
      expect(available).toContainEqual(mockTrait1);
      expect(available).toContainEqual(mockTrait2);
    });

    it('should return empty array when all traits are disabled', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([
          { ...mockTrait1, disabled: true },
          { ...mockTrait2, disabled: true },
        ]),
        crewId: 'crew-1',
      });

      const available = handler.getAvailableTraits();

      expect(available).toHaveLength(0);
    });

    it('should return empty array when character is null', () => {
      const handler = new LeanIntoTraitHandler({
        character: null,
        crewId: 'crew-1',
      });

      const available = handler.getAvailableTraits();

      expect(available).toHaveLength(0);
    });

    it('should return all traits when none are disabled', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockTrait1, mockTrait2]),
        crewId: 'crew-1',
      });

      const available = handler.getAvailableTraits();

      expect(available).toHaveLength(2);
    });
  });

  describe('getAvailableTraitCount', () => {
    it('should return count of available (non-disabled) traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockTrait1, mockDisabledTrait, mockTrait2]),
        crewId: 'crew-1',
      });

      expect(handler.getAvailableTraitCount()).toBe(2);
    });

    it('should return 0 when all traits are disabled', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([
          { ...mockTrait1, disabled: true },
          { ...mockTrait2, disabled: true },
        ]),
        crewId: 'crew-1',
      });

      expect(handler.getAvailableTraitCount()).toBe(0);
    });

    it('should return 0 when character is null', () => {
      const handler = new LeanIntoTraitHandler({
        character: null,
        crewId: 'crew-1',
      });

      expect(handler.getAvailableTraitCount()).toBe(0);
    });

    it('should return correct count with single available trait', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter([mockTrait1]),
        crewId: 'crew-1',
      });

      expect(handler.getAvailableTraitCount()).toBe(1);
    });
  });

  describe('getCrewId', () => {
    it('should return crew ID when set', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter(),
        crewId: 'crew-1',
      });

      expect(handler.getCrewId()).toBe('crew-1');
    });

    it('should return null when crew ID is null', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter(),
        crewId: null,
      });

      expect(handler.getCrewId()).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should validate correctly for new character in crew with default traits', () => {
      const handler = new LeanIntoTraitHandler({
        character: mockCharacter(),
        crewId: 'crew-1',
      });

      expect(handler.validateLeanIntoTrait().isValid).toBe(true);
      expect(handler.getAvailableTraitCount()).toBe(2);
    });

    it('should handle character transition from solo to crew', () => {
      const character = mockCharacter();

      const soloHandler = new LeanIntoTraitHandler({
        character,
        crewId: null,
      });

      expect(soloHandler.validateLeanIntoTrait().isValid).toBe(false);

      const crewHandler = new LeanIntoTraitHandler({
        character,
        crewId: 'crew-1',
      });

      expect(crewHandler.validateLeanIntoTrait().isValid).toBe(true);
    });

    it('should correctly handle trait disabling mid-action', () => {
      const traits = [mockTrait1, mockTrait2];
      const character = mockCharacter(traits);

      const handler = new LeanIntoTraitHandler({
        character,
        crewId: 'crew-1',
      });

      // Initially valid
      expect(handler.validateLeanIntoTrait().isValid).toBe(true);

      // Simulate trait being disabled by creating new handler with updated character
      const updatedCharacter: Character = {
        ...character,
        traits: [{ ...mockTrait1, disabled: true }, { ...mockTrait2, disabled: true }],
      };

      const updatedHandler = new LeanIntoTraitHandler({
        character: updatedCharacter,
        crewId: 'crew-1',
      });

      // Now invalid
      expect(updatedHandler.validateLeanIntoTrait().isValid).toBe(false);
    });
  });
});
