/**
 * Consequence Resolution Handler Tests
 *
 * Comprehensive test suite for consequence transaction workflow:
 * - Validation of consequence transactions
 * - Transaction initialization
 * - Redux action creation
 * - State calculations (segments, momentum)
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConsequenceResolutionHandler,
  type ConsequenceResolutionConfig,
  type ClockData,
} from '../../foundry/module/handlers/consequenceResolutionHandler';
import type { ConsequenceTransaction } from '../../src/types/playerRoundState';
import type { RootState } from '../../src/store';
import { configureStore } from '../../src/store';
import playerRoundStateReducer, {
  setConsequenceTransaction,
} from '../../src/slices/playerRoundStateSlice';
import characterReducer from '../../src/slices/characterSlice';
import crewReducer from '../../src/slices/crewSlice';
import clockReducer from '../../src/slices/clockSlice';

describe('ConsequenceResolutionHandler', () => {
  let handler: ConsequenceResolutionHandler;
  let config: ConsequenceResolutionConfig;
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Setup store with all reducers
    store = configureStore();

    config = {
      characterId: 'char-123',
      crewId: 'crew-456',
      playerState: {
        characterId: 'char-123',
        consequenceTransaction: null,
      },
    };

    handler = new ConsequenceResolutionHandler(config);
  });

  /* -------------------------------------------- */
  /*  Validation Tests                            */
  /* -------------------------------------------- */

  describe('validateConsequence', () => {
    it('should reject null transaction', () => {
      expect(handler.validateConsequence(null)).toBe(false);
    });

    it('should reject undefined transaction', () => {
      expect(handler.validateConsequence(undefined)).toBe(false);
    });

    it('should reject harm consequence without target', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: undefined,
        harmClockId: 'clock-789',
      };
      expect(handler.validateConsequence(transaction)).toBe(false);
    });

    it('should reject harm consequence without clock', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: undefined,
      };
      expect(handler.validateConsequence(transaction)).toBe(false);
    });

    it('should accept valid harm consequence with both target and clock', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: 'clock-789',
      };
      expect(handler.validateConsequence(transaction)).toBe(true);
    });

    it('should reject crew-clock consequence without clock', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: undefined,
      };
      expect(handler.validateConsequence(transaction)).toBe(false);
    });

    it('should accept valid crew-clock consequence with clock', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: 'clock-999',
      };
      expect(handler.validateConsequence(transaction)).toBe(true);
    });

    it('should reject unknown consequence type', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'unknown' as any,
      };
      expect(handler.validateConsequence(transaction)).toBe(false);
    });
  });

  /* -------------------------------------------- */
  /*  Transaction Initialization Tests           */
  /* -------------------------------------------- */

  describe('initializeTransaction', () => {
    it('should initialize harm consequence with character default', () => {
      const transaction = handler.initializeTransaction('harm');

      expect(transaction.consequenceType).toBe('harm');
      expect(transaction.harmTargetCharacterId).toBe('char-123');
    });

    it('should initialize crew-clock consequence without defaults', () => {
      const transaction = handler.initializeTransaction('crew-clock');

      expect(transaction.consequenceType).toBe('crew-clock');
      expect(transaction.harmTargetCharacterId).toBeUndefined();
    });
  });

  /* -------------------------------------------- */
  /*  Redux Action Creation Tests                 */
  /* -------------------------------------------- */

  describe('createSetConsequenceTypeAction', () => {
    it('should create action for harm consequence type', () => {
      const action = handler.createSetConsequenceTypeAction('harm');

      expect(action.type).toBe('playerRoundState/setConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.transaction.consequenceType).toBe('harm');
      expect(action.payload.transaction.harmTargetCharacterId).toBe('char-123');
    });

    it('should create action for crew-clock consequence type', () => {
      const action = handler.createSetConsequenceTypeAction('crew-clock');

      expect(action.type).toBe('playerRoundState/setConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.transaction.consequenceType).toBe('crew-clock');
    });
  });

  describe('createSetHarmTargetAction', () => {
    it('should create action to set harm target', () => {
      const action = handler.createSetHarmTargetAction('char-999');

      expect(action.type).toBe('playerRoundState/updateConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.updates.harmTargetCharacterId).toBe('char-999');
      // Should clear existing clock when target changes
      expect(action.payload.updates.harmClockId).toBeUndefined();
    });
  });

  describe('createSetHarmClockAction', () => {
    it('should create action to set harm clock', () => {
      const action = handler.createSetHarmClockAction('clock-789');

      expect(action.type).toBe('playerRoundState/updateConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.updates.harmClockId).toBe('clock-789');
    });
  });

  describe('createSetCrewClockAction', () => {
    it('should create action to set crew clock', () => {
      const action = handler.createSetCrewClockAction('crew-clock-999');

      expect(action.type).toBe('playerRoundState/updateConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.updates.crewClockId).toBe('crew-clock-999');
    });
  });

  /* -------------------------------------------- */
  /*  Clock Creation Tests                        */
  /* -------------------------------------------- */

  describe('createNewHarmClockAction', () => {
    it('should create action to create new harm clock', () => {
      // Setup: ensure we have target character in transaction
      const configWithTarget = {
        ...config,
        playerState: {
          ...config.playerState,
          consequenceTransaction: {
            consequenceType: 'harm' as const,
            harmTargetCharacterId: 'char-999',
          },
        },
      };
      const handlerWithTarget = new ConsequenceResolutionHandler(configWithTarget);

      const clockData: ClockData = {
        name: 'Bleeding',
        segments: 6,
        description: 'Serious wound',
      };

      const action = handlerWithTarget.createNewHarmClockAction(clockData, () => 'test-clock-id');

      expect(action.type).toBe('clocks/createClock');
      expect(action.payload.clockType).toBe('harm');
      expect(action.payload.subtype).toBe('Bleeding');
      expect(action.payload.maxSegments).toBe(6);
      expect(action.payload.segments).toBe(0);
      expect(action.payload.entityId).toBe('char-999');
      expect(action.payload.metadata?.description).toBe('Serious wound');
      expect(action.payload.id).toBe('test-clock-id');
    });

    it('should throw error if no target character selected', () => {
      const clockData: ClockData = {
        name: 'Bleeding',
        segments: 6,
      };

      expect(() => handler.createNewHarmClockAction(clockData, () => 'test-id')).toThrow(
        /no target character selected/i
      );
    });

    it('should handle clock without description', () => {
      const configWithTarget = {
        ...config,
        playerState: {
          ...config.playerState,
          consequenceTransaction: {
            consequenceType: 'harm' as const,
            harmTargetCharacterId: 'char-999',
          },
        },
      };
      const handlerWithTarget = new ConsequenceResolutionHandler(configWithTarget);

      const clockData: ClockData = {
        name: 'Bleeding',
        segments: 6,
      };

      const action = handlerWithTarget.createNewHarmClockAction(clockData, () => 'test-id');

      expect(action.payload.metadata).toBeUndefined();
    });
  });

  describe('createNewCrewClockAction', () => {
    it('should create action to create new crew clock', () => {
      const clockData: ClockData = {
        name: 'Rival Faction Alert',
        segments: 8,
        category: 'faction',
        isCountdown: true,
        description: 'They know where we are',
      };

      const action = handler.createNewCrewClockAction(clockData, () => 'test-crew-clock-id');

      expect(action.type).toBe('clocks/createClock');
      expect(action.payload.clockType).toBe('progress');
      expect(action.payload.subtype).toBe('Rival Faction Alert');
      expect(action.payload.maxSegments).toBe(8);
      expect(action.payload.segments).toBe(0);
      expect(action.payload.entityId).toBe('crew-456');
      expect(action.payload.metadata.category).toBe('faction');
      expect(action.payload.metadata.isCountdown).toBe(true);
      expect(action.payload.metadata.description).toBe('They know where we are');
      expect(action.payload.id).toBe('test-crew-clock-id');
    });

    it('should throw error if no crew ID configured', () => {
      const configNoCrew = { ...config, crewId: null };
      const handlerNoCrew = new ConsequenceResolutionHandler(configNoCrew);

      const clockData: ClockData = {
        name: 'Test Clock',
        segments: 6,
      };

      expect(() => handlerNoCrew.createNewCrewClockAction(clockData, () => 'test-id')).toThrow(/no crew assigned/i);
    });

    it('should handle clock with minimal metadata', () => {
      const clockData: ClockData = {
        name: 'Simple Clock',
        segments: 4,
      };

      const action = handler.createNewCrewClockAction(clockData, () => 'test-id');

      expect(action.payload.metadata.category).toBeUndefined();
      expect(action.payload.metadata.isCountdown).toBeUndefined();
      expect(action.payload.metadata.description).toBeUndefined();
    });
  });

  /* -------------------------------------------- */
  /*  Consequence Application Tests               */
  /* -------------------------------------------- */

  describe('createApplyHarmAction', () => {
    it('should create action to apply harm', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: 'clock-789',
      };

      const action = handler.createApplyHarmAction(transaction, 2);

      expect(action.type).toBe('clocks/addSegments');
      expect(action.payload.clockId).toBe('clock-789');
      expect(action.payload.amount).toBe(2);
    });

    it('should throw error if no harm clock in transaction', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: undefined,
      };

      expect(() => handler.createApplyHarmAction(transaction, 2)).toThrow(
        /no harm clock selected/i
      );
    });
  });

  describe('createAdvanceCrewClockAction', () => {
    it('should create action to advance crew clock', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: 'crew-clock-999',
      };

      const action = handler.createAdvanceCrewClockAction(transaction, 3);

      expect(action.type).toBe('clocks/addSegments');
      expect(action.payload.clockId).toBe('crew-clock-999');
      expect(action.payload.amount).toBe(3);
    });

    it('should throw error if no crew clock in transaction', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: undefined,
      };

      expect(() => handler.createAdvanceCrewClockAction(transaction, 3)).toThrow(
        /no crew clock selected/i
      );
    });
  });

  /* -------------------------------------------- */
  /*  State Transition Tests                      */
  /* -------------------------------------------- */

  describe('createTransitionStateAction', () => {
    it('should create state transition action', () => {
      const action = handler.createTransitionStateAction('APPLYING_EFFECTS');

      expect(action.type).toBe('playerRoundState/transitionState');
      expect(action.payload.characterId).toBe('char-123');
      expect(action.payload.newState).toBe('APPLYING_EFFECTS');
    });
  });

  describe('createClearConsequenceTransactionAction', () => {
    it('should create action to clear consequence transaction', () => {
      const action = handler.createClearConsequenceTransactionAction();

      expect(action.type).toBe('playerRoundState/clearConsequenceTransaction');
      expect(action.payload.characterId).toBe('char-123');
    });
  });

  /* -------------------------------------------- */
  /*  Batch Action Tests                          */
  /* -------------------------------------------- */

  describe('createConsequenceApplicationBatch', () => {
    it('should create batch of actions for consequence application', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: 'crew-clock-999',
      };

      const batch = handler.createConsequenceApplicationBatch(transaction);

      expect(batch).toHaveLength(2);
      expect(batch[0].type).toBe('playerRoundState/clearConsequenceTransaction');
      expect(batch[1].type).toBe('playerRoundState/transitionState');
      expect(batch[1].payload.newState).toBe('TURN_COMPLETE');
    });
  });

  describe('createTurnCompletionBatch', () => {
    it('should create batch of actions for turn completion', () => {
      const batch = handler.createTurnCompletionBatch();

      expect(batch).toHaveLength(1);
      expect(batch[0].type).toBe('playerRoundState/transitionState');
      expect(batch[0].payload.newState).toBe('IDLE_WAITING');
    });
  });

  /* -------------------------------------------- */
  /*  Redux ID Tests                              */
  /* -------------------------------------------- */

  describe('getAffectedReduxId', () => {
    it('should return Redux ID for character', () => {
      const id = handler.getAffectedReduxId();
      expect(id).toContain('char-123');
    });

    it('should override with provided character ID', () => {
      const id = handler.getAffectedReduxId('char-override');
      expect(id).toContain('char-override');
    });
  });

  describe('getAffectedCrewReduxId', () => {
    it('should return Redux ID for crew', () => {
      const id = handler.getAffectedCrewReduxId();
      expect(id).toContain('crew-456');
    });

    it('should throw error if no crew configured', () => {
      const configNoCrew = { ...config, crewId: null };
      const handlerNoCrew = new ConsequenceResolutionHandler(configNoCrew);

      expect(() => handlerNoCrew.getAffectedCrewReduxId()).toThrow(/no crew ID/i);
    });
  });

  /* -------------------------------------------- */
  /*  Edge Cases and Error Handling               */
  /* -------------------------------------------- */

  describe('edge cases', () => {
    it('should handle consequence with empty string clock ID', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: '',
      };

      // Empty string is falsy, should fail validation
      expect(handler.validateConsequence(transaction)).toBe(false);
    });

    it('should handle consequence with all fields populated', () => {
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: 'clock-789',
        crewClockId: 'crew-clock-999', // Extra field shouldn't affect validation
      };

      expect(handler.validateConsequence(transaction)).toBe(true);
    });

    it('should create harm clock action with custom ID generator', () => {
      const configWithTarget = {
        ...config,
        playerState: {
          ...config.playerState,
          consequenceTransaction: {
            consequenceType: 'harm' as const,
            harmTargetCharacterId: 'char-999',
          },
        },
      };
      const handlerWithTarget = new ConsequenceResolutionHandler(configWithTarget);

      const clockData: ClockData = {
        name: 'Test Clock',
        segments: 6,
      };

      const action = handlerWithTarget.createNewHarmClockAction(clockData, () => 'custom-id');

      // Should use provided ID generator
      expect(action.payload.id).toBe('custom-id');
    });
  });

  /* -------------------------------------------- */
  /*  Integration Tests                           */
  /* -------------------------------------------- */

  describe('integration scenarios', () => {
    it('should handle full harm consequence workflow', () => {
      // Step 1: Initialize harm consequence
      const init = handler.createSetConsequenceTypeAction('harm');
      expect(init.payload.transaction.harmTargetCharacterId).toBe('char-123');

      // Step 2: Select target
      const setTarget = handler.createSetHarmTargetAction('char-999');
      expect(setTarget.payload.updates.harmTargetCharacterId).toBe('char-999');

      // Step 3: Create and select clock
      const configWithTarget = {
        ...config,
        playerState: {
          ...config.playerState,
          consequenceTransaction: {
            consequenceType: 'harm' as const,
            harmTargetCharacterId: 'char-999',
          },
        },
      };
      const handlerWithTarget = new ConsequenceResolutionHandler(configWithTarget);

      const clockData: ClockData = {
        name: 'Bleeding',
        segments: 6,
      };
      const createClock = handlerWithTarget.createNewHarmClockAction(clockData, () => 'test-id');
      expect(createClock.type).toBe('clocks/createClock');

      // Step 4: Validate complete transaction
      const transaction: ConsequenceTransaction = {
        consequenceType: 'harm',
        harmTargetCharacterId: 'char-999',
        harmClockId: 'clock-789',
      };
      expect(handler.validateConsequence(transaction)).toBe(true);

      // Step 5: Create batch to apply consequence
      const batch = handler.createConsequenceApplicationBatch(transaction);
      expect(batch.length).toBeGreaterThan(0);
    });

    it('should handle full crew-clock consequence workflow', () => {
      // Step 1: Initialize crew-clock consequence
      const init = handler.createSetConsequenceTypeAction('crew-clock');
      expect(init.payload.transaction.consequenceType).toBe('crew-clock');

      // Step 2: Create and select crew clock
      const clockData: ClockData = {
        name: 'Heat from Job',
        segments: 8,
        category: 'heat',
      };
      const createClock = handler.createNewCrewClockAction(clockData, () => 'test-id');
      expect(createClock.payload.entityId).toBe('crew-456');

      // Step 3: Validate complete transaction
      const transaction: ConsequenceTransaction = {
        consequenceType: 'crew-clock',
        crewClockId: 'crew-clock-999',
      };
      expect(handler.validateConsequence(transaction)).toBe(true);

      // Step 4: Create batch to apply consequence
      const batch = handler.createConsequenceApplicationBatch(transaction);
      expect(batch.length).toBeGreaterThan(0);
    });
  });
});



