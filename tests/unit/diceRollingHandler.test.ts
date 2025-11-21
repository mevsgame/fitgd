import { describe, it, expect, beforeEach } from 'vitest';
import { DiceRollingHandler } from '../../foundry/module/handlers/diceRollingHandler';
import type { PlayerRoundState } from '../../src/types/playerRoundState';
import type { RootState } from '../../src/store';
import { asReduxId } from '../../foundry/module/types/ids';

describe('DiceRollingHandler', () => {
  let handler: DiceRollingHandler;

  beforeEach(() => {
    handler = new DiceRollingHandler({
      characterId: 'char-123',
      crewId: 'crew-456',
    });
  });

  describe('validateRoll', () => {
    it('should pass validation when action is selected and momentum is sufficient', () => {
      const state = {} as RootState;
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: 'force',
        position: 'controlled',
        effect: 'standard',
      };
      const crew = { currentMomentum: 5 };

      const result = handler.validateRoll(state, playerState as PlayerRoundState, crew);

      expect(result.isValid).toBe(true);
    });

    it('should fail when no action is selected', () => {
      const state = {} as RootState;
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: undefined,
      };
      const crew = null;

      const result = handler.validateRoll(state, playerState as PlayerRoundState, crew);

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-action-selected');
    });

    it('should skip momentum validation if crew is null', () => {
      const state = {} as RootState;
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: 'force',
      };

      const result = handler.validateRoll(state, playerState as PlayerRoundState, null);

      // Should pass even with position/effect that would require momentum
      expect(result.isValid).toBe(true);
    });

    it('should pass when crew is null (no momentum cost)', () => {
      const state = {} as RootState;
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: 'force',
      };

      const result = handler.validateRoll(state, playerState as PlayerRoundState, null);

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateMomentumCost', () => {
    it('should return 0 for null playerState', () => {
      const cost = handler.calculateMomentumCost(null);
      expect(cost).toBe(0);
    });

    it('should return cost from selector', () => {
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: 'force',
        position: 'desperate',
        effect: 'standard',
      };
      const cost = handler.calculateMomentumCost(playerState as PlayerRoundState);
      expect(typeof cost).toBe('number');
    });
  });

  describe('calculateDicePool', () => {
    it('should return a number', () => {
      const state = {
        characters: { byId: {}, allIds: [] },
        crews: { byId: {}, allIds: [] },
        clocks: {
          byId: {},
          allIds: [],
          byEntityId: {},
          byType: {},
          byTypeAndEntity: {},
          history: [],
        },
        playerRoundState: {
          byCharacterId: {
            'char-123': {
              characterId: 'char-123',
              state: 'DECISION_PHASE',
              selectedApproach: 'force',
              position: 'controlled',
              effect: 'standard',
            },
          },
          history: [],
        },
        momentum: { value: 5, history: [] },
      } as unknown as RootState;

      const pool = handler.calculateDicePool(state);
      expect(typeof pool).toBe('number');
      expect(pool).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createSetRollResultAction', () => {
    it('should create roll result action', () => {
      const action = handler.createSetRollResultAction(4, [6, 4, 3, 2], 'success');

      expect(action.type).toBe('playerRoundState/setRollResult');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.dicePool).toBe(4);
      expect(action.payload.rollResult).toEqual([6, 4, 3, 2]);
      expect(action.payload.outcome).toBe('success');
    });
  });

  describe('createClearGmApprovalAction', () => {
    it('should create clear approval action', () => {
      const action = handler.createClearGmApprovalAction();

      expect(action.type).toBe('playerRoundState/setGmApproved');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.approved).toBe(false);
    });
  });

  describe('createOutcomeTransitionAction', () => {
    it('should transition to SUCCESS_COMPLETE for critical', () => {
      const action = handler.createOutcomeTransitionAction('critical');

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.newState).toBe('SUCCESS_COMPLETE');
    });

    it('should transition to SUCCESS_COMPLETE for success', () => {
      const action = handler.createOutcomeTransitionAction('success');

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.newState).toBe('SUCCESS_COMPLETE');
    });

    it('should transition to GM_RESOLVING_CONSEQUENCE for partial', () => {
      const action = handler.createOutcomeTransitionAction('partial');

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.newState).toBe('GM_RESOLVING_CONSEQUENCE');
    });

    it('should transition to GM_RESOLVING_CONSEQUENCE for failure', () => {
      const action = handler.createOutcomeTransitionAction('failure');

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.newState).toBe('GM_RESOLVING_CONSEQUENCE');
    });
  });

  describe('createTransitionToRollingAction', () => {
    it('should create ROLLING transition action', () => {
      const action = handler.createTransitionToRollingAction();

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.newState).toBe('ROLLING');
    });
  });

  describe('createRollOutcomeBatch', () => {
    it('should create batch with all required actions for success', () => {
      const batch = handler.createRollOutcomeBatch(4, [6, 4, 3, 2], 'success');

      expect(batch.length).toBe(3);
      expect(batch[0].type).toBe('playerRoundState/setRollResult');
      expect(batch[1].type).toBe('playerRoundState/setGmApproved');
      expect(batch[2].type).toBe('playerRoundState/transitionState');
      expect(batch[2].payload.newState).toBe('SUCCESS_COMPLETE');
    });

    it('should create batch with all required actions for failure', () => {
      const batch = handler.createRollOutcomeBatch(4, [3, 2, 1], 'failure');

      expect(batch.length).toBe(3);
      expect(batch[0].type).toBe('playerRoundState/setRollResult');
      expect(batch[1].type).toBe('playerRoundState/setGmApproved');
      expect(batch[2].type).toBe('playerRoundState/transitionState');
      expect(batch[2].payload.newState).toBe('GM_RESOLVING_CONSEQUENCE');
    });
  });

  describe('getAffectedReduxId', () => {
    it('should return properly formatted Redux ID', () => {
      const id = handler.getAffectedReduxId();

      expect(id).toBe(asReduxId('char-123'));
    });
  });

  describe('isSuccessfulOutcome', () => {
    it('should return true for success', () => {
      expect(handler.isSuccessfulOutcome('success')).toBe(true);
    });

    it('should return true for critical', () => {
      expect(handler.isSuccessfulOutcome('critical')).toBe(true);
    });

    it('should return false for partial', () => {
      expect(handler.isSuccessfulOutcome('partial')).toBe(false);
    });

    it('should return false for failure', () => {
      expect(handler.isSuccessfulOutcome('failure')).toBe(false);
    });
  });

  describe('integration scenario: full roll workflow', () => {
    it('should create all necessary actions for a complete roll', () => {
      // Start: validate roll
      const state = {} as RootState;
      const playerState: Partial<PlayerRoundState> = {
        selectedApproach: 'force',
        position: 'controlled',
        effect: 'standard',
      };
      const crew = { currentMomentum: 10 };

      const validation = handler.validateRoll(state, playerState as PlayerRoundState, crew);
      expect(validation.isValid).toBe(true);

      // Dice pool calculation
      const dicePool = 3;

      // Roll results
      const rollResult = [6, 4, 2];
      const outcome = 'success' as const;

      // Create batch
      const batch = handler.createRollOutcomeBatch(dicePool, rollResult, outcome);

      expect(batch.length).toBe(3);
      expect(batch[0].payload.dicePool).toBe(3);
      expect(batch[0].payload.rollResult).toEqual([6, 4, 2]);
      expect(batch[0].payload.outcome).toBe('success');
      expect(batch[2].payload.newState).toBe('SUCCESS_COMPLETE');
    });
  });
});



