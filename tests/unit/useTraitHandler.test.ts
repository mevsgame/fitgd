/**
 * Tests for UseTraitHandler
 *
 * Validates use trait mechanics:
 * - Crew requirement validation
 * - Position-based improvement validation
 * - Trait transaction toggle logic
 * - Redux action creation
 */

import { describe, it, expect } from 'vitest';
import { UseTraitHandler } from '../../foundry/module/handlers/useTraitHandler';
import type { PlayerRoundState } from '../../src/types/playerRoundState';

describe('UseTraitHandler', () => {
  const mockPlayerState = (overrides?: Partial<PlayerRoundState>): PlayerRoundState => ({
    characterId: 'char-1',
    state: 'DECISION_PHASE',
    selectedApproach: 'spirit',
    position: 'risky',
    effect: 'standard',
    consequenceType: undefined,
    consequenceTransaction: undefined,
    traitTransaction: undefined,
    pushed: false,
    pushType: undefined,
    flashbackApplied: false,
    selectedTraitId: undefined,
    equippedForAction: [],
    outcome: undefined,
    stateEnteredAt: Date.now(),
    ...overrides,
  });

  const mockTraitTransaction = {
    mode: 'existing' as const,
    selectedTraitId: 'trait-1',
    positionImprovement: false,
    momentumCost: 0,
  };

  describe('validateUseTrait', () => {
    it('should return valid when in crew with no trait transaction and position not controlled', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const result = handler.validateUseTrait(mockPlayerState());

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return valid when trait transaction exists (toggle off scenario)', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const playerState = mockPlayerState({
        traitTransaction: mockTraitTransaction,
      });

      const result = handler.validateUseTrait(playerState);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return no-crew when not in crew', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: null,
      });

      const result = handler.validateUseTrait(mockPlayerState());

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-crew');
    });

    it('should return position-controlled when position is already controlled', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const playerState = mockPlayerState({
        position: 'controlled',
      });

      const result = handler.validateUseTrait(playerState);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('position-controlled');
    });

    it('should allow toggle off even when position is controlled', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const playerState = mockPlayerState({
        position: 'controlled',
        traitTransaction: mockTraitTransaction,
      });

      const result = handler.validateUseTrait(playerState);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should handle null player state', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const result = handler.validateUseTrait(null);

      // null playerState with valid crew should be valid (position defaults to non-controlled)
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prioritize no-crew error over position-controlled', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: null,
      });

      const playerState = mockPlayerState({
        position: 'controlled',
      });

      const result = handler.validateUseTrait(playerState);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-crew');
    });
  });

  describe('createClearTraitTransactionAction', () => {
    it('should create valid Redux action to clear trait transaction', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const action = handler.createClearTraitTransactionAction();

      expect(action.type).toBe('playerRoundState/clearTraitTransaction');
      expect(action.payload.characterId).toBe('char-1');
    });

    it('should include correct character ID in payload', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-123',
        crewId: 'crew-1',
      });

      const action = handler.createClearTraitTransactionAction();

      expect(action.payload.characterId).toBe('char-123');
    });
  });

  describe('getAffectedReduxId', () => {
    it('should return Redux ID for character', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const id = handler.getAffectedReduxId();

      expect(id).toBe('char-1');
    });

    it('should handle different character IDs', () => {
      const handler = new UseTraitHandler({
        characterId: 'my-special-id-123',
        crewId: 'crew-1',
      });

      const id = handler.getAffectedReduxId();

      expect(id).toBe('my-special-id-123');
    });
  });

  describe('getCrewId', () => {
    it('should return crew ID when set', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      expect(handler.getCrewId()).toBe('crew-1');
    });

    it('should return null when crew ID is null', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: null,
      });

      expect(handler.getCrewId()).toBeNull();
    });
  });

  describe('hasActiveTraitTransaction', () => {
    it('should return true when trait transaction exists', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const playerState = mockPlayerState({
        traitTransaction: mockTraitTransaction,
      });

      expect(handler.hasActiveTraitTransaction(playerState)).toBe(true);
    });

    it('should return false when trait transaction is null', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const playerState = mockPlayerState({
        traitTransaction: undefined,
      });

      expect(handler.hasActiveTraitTransaction(playerState)).toBe(false);
    });

    it('should return false when player state is null', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      expect(handler.hasActiveTraitTransaction(null)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete use trait workflow (toggle on)', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      // Initial state: no trait transaction
      const initialState = mockPlayerState();
      const validation1 = handler.validateUseTrait(initialState);
      expect(validation1.isValid).toBe(true);
      expect(handler.hasActiveTraitTransaction(initialState)).toBe(false);

      // User opens trait dialog (external) and applies trait
      // Then validate again with new transaction
      const afterToggleOn = mockPlayerState({
        traitTransaction: mockTraitTransaction,
      });
      expect(handler.hasActiveTraitTransaction(afterToggleOn)).toBe(true);
    });

    it('should handle complete use trait workflow (toggle off)', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      // State with active trait transaction
      const stateWithTrait = mockPlayerState({
        traitTransaction: mockTraitTransaction,
      });

      expect(handler.hasActiveTraitTransaction(stateWithTrait)).toBe(true);
      expect(handler.validateUseTrait(stateWithTrait).isValid).toBe(true);

      // Create clear action
      const clearAction = handler.createClearTraitTransactionAction();
      expect(clearAction.type).toBe('playerRoundState/clearTraitTransaction');
    });

    it('should prevent improvement when position is controlled', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const controlledState = mockPlayerState({
        position: 'controlled',
      });

      const result = handler.validateUseTrait(controlledState);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('position-controlled');
    });

    it('should allow multiple toggle operations', () => {
      const handler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      // Toggle on
      const stateAfterOn = mockPlayerState({
        traitTransaction: mockTraitTransaction,
      });
      expect(handler.validateUseTrait(stateAfterOn).isValid).toBe(true);
      const action1 = handler.createClearTraitTransactionAction();
      expect(action1.type).toBe('playerRoundState/clearTraitTransaction');

      // Toggle off
      const stateAfterOff = mockPlayerState({
        traitTransaction: undefined,
      });
      expect(handler.validateUseTrait(stateAfterOff).isValid).toBe(true);
    });

    it('should require crew for use trait action', () => {
      const soloHandler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: null,
      });

      expect(soloHandler.validateUseTrait(mockPlayerState()).isValid).toBe(false);

      const crewHandler = new UseTraitHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      expect(crewHandler.validateUseTrait(mockPlayerState()).isValid).toBe(true);
    });
  });
});



