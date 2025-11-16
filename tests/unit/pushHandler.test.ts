/**
 * Tests for PushHandler
 *
 * Validates push mechanics (Push Yourself action):
 * - Push die toggle (+1d)
 * - Push effect toggle (Effect +1)
 * - State transitions
 * - Redux action creation
 */

import { describe, it, expect } from 'vitest';
import { PushHandler } from '../../foundry/module/handlers/pushHandler';
import type { PlayerRoundState } from '../../src/types/playerRoundState';

describe('PushHandler', () => {
  const mockPlayerState = (overrides?: Partial<PlayerRoundState>): PlayerRoundState => ({
    state: 'DECISION_PHASE',
    selectedAction: 'consort',
    position: 'risky',
    effect: 'standard',
    crewClockId: null,
    harmTargetCharacterId: null,
    harmClockId: null,
    consequenceType: null,
    consequenceTransaction: null,
    traitTransaction: null,
    pushed: false,
    pushType: undefined,
    flashbackApplied: false,
    selectedTraitId: null,
    equippedForAction: [],
    rollResult: null,
    rollOutcome: null,
    ...overrides,
  });

  describe('isPushDieActive', () => {
    it('should return true when push die is active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'extra-die',
      });

      expect(handler.isPushDieActive(playerState)).toBe(true);
    });

    it('should return false when push is not active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: false,
        pushType: undefined,
      });

      expect(handler.isPushDieActive(playerState)).toBe(false);
    });

    it('should return false when push effect is active instead', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'improved-effect',
      });

      expect(handler.isPushDieActive(playerState)).toBe(false);
    });

    it('should handle null player state', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      expect(handler.isPushDieActive(null)).toBe(false);
    });

    it('should handle undefined pushType', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: undefined,
      });

      expect(handler.isPushDieActive(playerState)).toBe(false);
    });
  });

  describe('isPushEffectActive', () => {
    it('should return true when push effect is active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'improved-effect',
      });

      expect(handler.isPushEffectActive(playerState)).toBe(true);
    });

    it('should return false when push is not active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: false,
        pushType: undefined,
      });

      expect(handler.isPushEffectActive(playerState)).toBe(false);
    });

    it('should return false when push die is active instead', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'extra-die',
      });

      expect(handler.isPushEffectActive(playerState)).toBe(false);
    });

    it('should handle null player state', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      expect(handler.isPushEffectActive(null)).toBe(false);
    });
  });

  describe('createTogglePushDieAction', () => {
    it('should enable push die when currently inactive', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: false,
        pushType: undefined,
      });

      const action = handler.createTogglePushDieAction(playerState);

      expect(action.type).toBe('playerRoundState/setImprovements');
      expect(action.payload.characterId).toBe('char-1');
      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('extra-die');
    });

    it('should disable push die when currently active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'extra-die',
      });

      const action = handler.createTogglePushDieAction(playerState);

      expect(action.type).toBe('playerRoundState/setImprovements');
      expect(action.payload.characterId).toBe('char-1');
      expect(action.payload.pushed).toBe(false);
      expect(action.payload.pushType).toBeUndefined();
    });

    it('should enable push die even if push effect is active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'improved-effect',
      });

      const action = handler.createTogglePushDieAction(playerState);

      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('extra-die');
    });

    it('should handle null player state (treated as inactive)', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const action = handler.createTogglePushDieAction(null);

      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('extra-die');
    });

    it('should include correct character ID', () => {
      const handler = new PushHandler({ characterId: 'my-char-123' });

      const action = handler.createTogglePushDieAction(mockPlayerState());

      expect(action.payload.characterId).toBe('my-char-123');
    });
  });

  describe('createTogglePushEffectAction', () => {
    it('should enable push effect when currently inactive', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: false,
        pushType: undefined,
      });

      const action = handler.createTogglePushEffectAction(playerState);

      expect(action.type).toBe('playerRoundState/setImprovements');
      expect(action.payload.characterId).toBe('char-1');
      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('improved-effect');
    });

    it('should disable push effect when currently active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'improved-effect',
      });

      const action = handler.createTogglePushEffectAction(playerState);

      expect(action.type).toBe('playerRoundState/setImprovements');
      expect(action.payload.characterId).toBe('char-1');
      expect(action.payload.pushed).toBe(false);
      expect(action.payload.pushType).toBeUndefined();
    });

    it('should enable push effect even if push die is active', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const playerState = mockPlayerState({
        pushed: true,
        pushType: 'extra-die',
      });

      const action = handler.createTogglePushEffectAction(playerState);

      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('improved-effect');
    });

    it('should handle null player state (treated as inactive)', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const action = handler.createTogglePushEffectAction(null);

      expect(action.payload.pushed).toBe(true);
      expect(action.payload.pushType).toBe('improved-effect');
    });

    it('should include correct character ID', () => {
      const handler = new PushHandler({ characterId: 'my-char-456' });

      const action = handler.createTogglePushEffectAction(mockPlayerState());

      expect(action.payload.characterId).toBe('my-char-456');
    });
  });

  describe('getAffectedReduxId', () => {
    it('should return character ID as Redux ID', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      expect(handler.getAffectedReduxId()).toBe('char-1');
    });

    it('should handle different character IDs', () => {
      const handler = new PushHandler({ characterId: 'special-id-xyz' });

      expect(handler.getAffectedReduxId()).toBe('special-id-xyz');
    });
  });

  describe('integration scenarios', () => {
    it('should handle push die toggle on/off cycle', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      // Start inactive
      let playerState = mockPlayerState();
      expect(handler.isPushDieActive(playerState)).toBe(false);

      // Toggle on
      const actionOn = handler.createTogglePushDieAction(playerState);
      expect(actionOn.payload.pushed).toBe(true);
      expect(actionOn.payload.pushType).toBe('extra-die');

      // Toggle off (simulate state update)
      playerState = mockPlayerState({ pushed: true, pushType: 'extra-die' });
      const actionOff = handler.createTogglePushDieAction(playerState);
      expect(actionOff.payload.pushed).toBe(false);
      expect(actionOff.payload.pushType).toBeUndefined();
    });

    it('should allow switching between push types', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      // Start with push die active
      let playerState = mockPlayerState({ pushed: true, pushType: 'extra-die' });
      expect(handler.isPushDieActive(playerState)).toBe(true);
      expect(handler.isPushEffectActive(playerState)).toBe(false);

      // Switch to push effect
      const switchAction = handler.createTogglePushEffectAction(playerState);
      expect(switchAction.payload.pushType).toBe('improved-effect');

      // Simulate new state
      playerState = mockPlayerState({ pushed: true, pushType: 'improved-effect' });
      expect(handler.isPushDieActive(playerState)).toBe(false);
      expect(handler.isPushEffectActive(playerState)).toBe(true);
    });

    it('should handle disable push completely', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      // Start with push effect active
      let playerState = mockPlayerState({ pushed: true, pushType: 'improved-effect' });

      // Disable it
      const disableAction = handler.createTogglePushEffectAction(playerState);
      expect(disableAction.payload.pushed).toBe(false);
      expect(disableAction.payload.pushType).toBeUndefined();

      // Verify new state
      playerState = mockPlayerState({ pushed: false, pushType: undefined });
      expect(handler.isPushDieActive(playerState)).toBe(false);
      expect(handler.isPushEffectActive(playerState)).toBe(false);
    });

    it('should return proper Redux IDs for batch operations', () => {
      const handler = new PushHandler({ characterId: 'char-1' });

      const dieAction = handler.createTogglePushDieAction(mockPlayerState());
      const effectAction = handler.createTogglePushEffectAction(mockPlayerState());
      const reduxId = handler.getAffectedReduxId();

      expect(reduxId).toBe('char-1');
      // Both actions should affect the same character
      expect(dieAction.payload.characterId).toBe(reduxId);
      expect(effectAction.payload.characterId).toBe(reduxId);
    });
  });
});
