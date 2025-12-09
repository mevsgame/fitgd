/**
 * Consequence Resolution Handler
 *
 * Manages the entire GM consequence configuration and application flow:
 * - Selecting consequence type (harm vs crew-clock)
 * - Selecting harm targets and clocks
 * - Selecting crew clocks
 * - Validating and applying consequences
 *
 * This handler encapsulates the complex multi-step consequence workflow
 * that was previously scattered across 6 methods in PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { ConsequenceTransaction, Position } from '@/types/playerRoundState';
import {
  selectEffectivePosition,
  selectConsequenceSeverity,
  selectMomentumGain,
} from '@/selectors/playerRoundStateSelectors';
import { asReduxId } from '../types/ids';

/**
 * Clock data for clock creation dialogs
 */
export interface ClockData {
  name: string;
  segments: number;
  description?: string;
  category?: string;
  isCountdown?: boolean;
}

/**
 * Configuration for consequence resolution operations
 */
export interface ConsequenceResolutionConfig {
  characterId: string;
  crewId: string | null;
  playerState: any; // PlayerRoundState from store
}

/**
 * Dialog callback signatures for testability
 */
export interface DialogCallbacks {
  onHarmTargetSelected?: (characterId: string) => Promise<void>;
  onHarmClockSelected?: (clockId: string) => Promise<void>;
  onCrewClockSelected?: (clockId: string) => Promise<void>;
}

/**
 * Consequence Resolution Handler
 *
 * Pure functions for consequence resolution workflow.
 * All methods operate on Redux state and return actions/validation results.
 *
 * @example
 * const handler = new ConsequenceResolutionHandler(config);
 * const isValid = handler.validateConsequence(transaction);
 * await handler.applyConsequence(transaction, state);
 */
export class ConsequenceResolutionHandler {
  constructor(private config: ConsequenceResolutionConfig) { }

  /**
   * Validate that a consequence transaction is fully configured
   *
   * @param transaction - The consequence transaction to validate
   * @returns true if transaction is ready to apply
   *
   * @example
   * if (!handler.validateConsequence(transaction)) {
   *   ui.notifications?.warn('Please select target character and harm clock');
   *   return;
   * }
   */
  validateConsequence(transaction: ConsequenceTransaction | null | undefined): boolean {
    if (!transaction) return false;

    if (transaction.consequenceType === 'harm') {
      return Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      return Boolean(transaction.crewClockId);
    }

    return false;
  }

  /**
   * Initialize a new consequence transaction
   *
   * @param consequenceType - 'harm' or 'crew-clock'
   * @returns Partial transaction with defaults set
   *
   * @example
   * const transaction = handler.initializeTransaction('harm');
   * // Returns: { consequenceType: 'harm', harmTargetCharacterId: characterId }
   */
  initializeTransaction(
    consequenceType: 'harm' | 'crew-clock'
  ): Partial<ConsequenceTransaction> {
    const transaction: Partial<ConsequenceTransaction> = {
      consequenceType,
    };

    // Default harm target to acting character
    if (consequenceType === 'harm') {
      transaction.harmTargetCharacterId = this.config.characterId;
    }

    return transaction;
  }

  /**
   * Create Redux action to set consequence type
   *
   * @param consequenceType - 'harm' or 'crew-clock'
   * @returns Redux action payload
   */
  createSetConsequenceTypeAction(consequenceType: 'harm' | 'crew-clock'): {
    type: string;
    payload: {
      characterId: string;
      transaction: Partial<ConsequenceTransaction>;
    };
  } {
    return {
      type: 'playerRoundState/setConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        transaction: this.initializeTransaction(consequenceType),
      },
    };
  }

  /**
   * Create Redux action to update harm target
   *
   * @param selectedCharacterId - The character to target
   * @returns Redux action payload
   */
  createSetHarmTargetAction(selectedCharacterId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        harmTargetCharacterId: string;
        harmClockId: undefined;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          harmTargetCharacterId: selectedCharacterId,
          // Clear clock selection when target changes
          harmClockId: undefined,
        },
      },
    };
  }

  /**
   * Create Redux action to select a harm clock
   *
   * @param clockId - The clock ID to select
   * @returns Redux action payload
   */
  createSetHarmClockAction(clockId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        harmClockId: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          harmClockId: clockId,
        },
      },
    };
  }

  /**
   * Create Redux action to create a new harm clock
   *
   * @param clockData - Clock configuration
   * @param targetCharacterId - Optional explicit target character ID (preferred over config)
   * @param generateId - Optional ID generator (for testing)
   * @returns Redux action payload
   */
  createNewHarmClockAction(
    clockData: ClockData,
    targetCharacterId?: string,
    generateId?: () => string
  ): {
    type: string;
    payload: {
      id: string;
      entityId: string;
      clockType: 'harm';
      subtype: string;
      maxSegments: number;
      segments: 0;
      metadata?: { description?: string };
    };
  } {
    const newClockId = generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator());
    // Use explicit parameter first, fall back to config's playerState
    const effectiveTargetId = targetCharacterId || this.config.playerState?.consequenceTransaction?.harmTargetCharacterId;

    if (!effectiveTargetId) {
      throw new Error('Cannot create harm clock: no target character selected');
    }

    return {
      type: 'clocks/createClock',
      payload: {
        id: newClockId,
        entityId: effectiveTargetId,
        clockType: 'harm',
        subtype: clockData.name,
        maxSegments: clockData.segments,
        segments: 0,
        metadata: clockData.description ? { description: clockData.description } : undefined,
      },
    };
  }

  /**
   * Create Redux action to update transaction with new harm clock
   *
   * @param newClockId - The newly created clock ID
   * @param clockName - The clock type name
   * @returns Redux action payload
   */
  createUpdateHarmClockInTransactionAction(
    newClockId: string,
    clockName: string
  ): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        harmClockId: string;
        newHarmClockType?: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          harmClockId: newClockId,
          newHarmClockType: clockName,
        },
      },
    };
  }

  /**
   * Create Redux action to select a crew clock
   *
   * @param clockId - The clock ID to select
   * @returns Redux action payload
   */
  createSetCrewClockAction(clockId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        crewClockId: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          crewClockId: clockId,
        },
      },
    };
  }

  /**
   * Create Redux action to create a new crew clock
   *
   * @param clockData - Clock configuration
   * @param generateId - Optional ID generator (for testing)
   * @returns Redux action payload
   */
  createNewCrewClockAction(
    clockData: ClockData,
    generateId?: () => string
  ): {
    type: string;
    payload: {
      id: string;
      entityId: string;
      clockType: 'progress';
      subtype: string;
      maxSegments: number;
      segments: 0;
      metadata: {
        category?: string;
        isCountdown?: boolean;
        description?: string;
      };
    };
  } {
    if (!this.config.crewId) {
      throw new Error('Cannot create crew clock: no crew assigned');
    }

    const newClockId = generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator());

    return {
      type: 'clocks/createClock',
      payload: {
        id: newClockId,
        entityId: this.config.crewId,
        clockType: 'progress',
        subtype: clockData.name,
        maxSegments: clockData.segments,
        segments: 0,
        metadata: {
          category: clockData.category,
          isCountdown: clockData.isCountdown,
          description: clockData.description,
        },
      },
    };
  }

  /**
   * Default ID generator for testing environments
   * @private
   */
  private _defaultIdGenerator(): string {
    return `clock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create Redux action to update transaction with new crew clock
   *
   * @param newClockId - The newly created clock ID
   * @returns Redux action payload
   */
  createUpdateCrewClockInTransactionAction(newClockId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        crewClockId: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          crewClockId: newClockId,
        },
      },
    };
  }

  /**
   * Calculate consequence segments based on position
   *
   * @param state - Redux state
   * @returns Number of segments to apply
   */
  calculateConsequenceSegments(state: RootState): number {
    const effectivePosition = selectEffectivePosition(state, this.config.characterId);
    return selectConsequenceSeverity(effectivePosition);
  }

  /**
   * Calculate momentum gain for a consequence
   *
   * @param state - Redux state
   * @returns Momentum to gain
   */
  calculateMomentumGain(state: RootState): number {
    const effectivePosition = selectEffectivePosition(state, this.config.characterId);
    return selectMomentumGain(effectivePosition);
  }

  /**
   * Create Redux action to apply harm to a clock
   *
   * @param transaction - The consequence transaction
   * @param segments - Number of segments to apply
   * @returns Redux action payload
   */
  createApplyHarmAction(transaction: ConsequenceTransaction, segments: number): {
    type: string;
    payload: {
      clockId: string;
      amount: number;
    };
  } {
    if (!transaction.harmClockId) {
      throw new Error('Cannot apply harm: no harm clock selected');
    }

    return {
      type: 'clocks/addSegments',
      payload: {
        clockId: transaction.harmClockId,
        amount: segments,
      },
    };
  }

  /**
   * Create Redux action to advance a crew clock
   *
   * @param transaction - The consequence transaction
   * @param segments - Number of segments to apply
   * @returns Redux action payload
   */
  createAdvanceCrewClockAction(transaction: ConsequenceTransaction, segments: number): {
    type: string;
    payload: {
      clockId: string;
      amount: number;
    };
  } {
    if (!transaction.crewClockId) {
      throw new Error('Cannot advance crew clock: no crew clock selected');
    }

    return {
      type: 'clocks/addSegments',
      payload: {
        clockId: transaction.crewClockId,
        amount: segments,
      },
    };
  }

  /**
   * Create Redux action to transition state during consequence application
   *
   * @param newState - The state to transition to
   * @returns Redux action payload
   */
  createTransitionStateAction(newState: string): {
    type: string;
    payload: {
      characterId: string;
      newState: string;
    };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState,
      },
    };
  }

  /**
   * Create Redux action to clear consequence transaction
   *
   * @returns Redux action payload
   */
  createClearConsequenceTransactionAction(): {
    type: string;
    payload: {
      characterId: string;
    };
  } {
    return {
      type: 'playerRoundState/clearConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
      },
    };
  }

  /**
   * Create action to toggle defensive success option
   *
   * @param enabled - Whether to enable defensive success
   * @returns Redux action to update consequence transaction
   */
  createToggleDefensiveSuccessAction(enabled: boolean): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        useDefensiveSuccess: boolean;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          useDefensiveSuccess: enabled,
        },
      },
    };
  }

  /**
   * Get the affected Redux ID for this character
   *
   * @param characterId - Optional override character ID
   * @returns Redux ID for Bridge API
   */
  getAffectedReduxId(characterId?: string): string {
    return asReduxId(characterId || this.config.characterId);
  }

  /**
   * Get affected Redux ID for crew
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedCrewReduxId(): string {
    if (!this.config.crewId) {
      throw new Error('No crew ID configured');
    }
    return asReduxId(this.config.crewId);
  }

  /**
   * Get effective position for consequence calculation
   *
   * @param state - Redux state
   * @returns Effective position
   */
  getEffectivePosition(state: RootState): Position {
    return selectEffectivePosition(state, this.config.characterId);
  }

  /**
   * Create batch action for consequence application and cleanup
   *
   * @returns Array of Redux actions to execute as batch
   */
  createConsequenceApplicationBatch(_transaction: ConsequenceTransaction): Array<{
    type: string;
    payload: any;
  }> {
    return [
      this.createClearConsequenceTransactionAction(),
      this.createTransitionStateAction('TURN_COMPLETE'),
      // Prune playerRoundState history after turn completes
      { type: 'playerRoundState/pruneHistory', payload: {} },
    ];
  }

  /**
   * Create batch action for final turn completion
   *
   * @returns Array of Redux actions to execute as batch
   */
  createTurnCompletionBatch(): Array<{
    type: string;
    payload: any;
  }> {
    return [this.createTransitionStateAction('IDLE_WAITING')];
  }

  /**
   * Create Redux action to set success clock operation
   *
   * @param operation - 'add' for progress clocks, 'reduce' for threat clocks
   * @returns Redux action payload
   */
  createSetSuccessClockOperationAction(operation: 'add' | 'reduce'): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        successClockOperation: 'add' | 'reduce';
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          successClockOperation: operation,
        },
      },
    };
  }

  /**
   * Create Redux action to select a success clock
   *
   * @param clockId - The clock ID to select
   * @returns Redux action payload
   */
  createSetSuccessClockAction(clockId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        successClockId: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          successClockId: clockId,
        },
      },
    };
  }

  /**
   * Create Redux action to create a new success clock
   *
   * @param clockData - Clock configuration
   * @param generateId - Optional ID generator (for testing)
   * @returns Redux action payload
   */
  createNewSuccessClockAction(
    clockData: ClockData,
    generateId?: () => string
  ): {
    type: string;
    payload: {
      id: string;
      entityId: string;
      clockType: 'progress';
      subtype: string;
      maxSegments: number;
      segments: 0;
      metadata: {
        category?: string;
        description?: string;
      };
    };
  } {
    if (!this.config.crewId) {
      throw new Error('Cannot create success clock: no crew assigned');
    }

    const newClockId = generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator());

    return {
      type: 'clocks/createClock',
      payload: {
        id: newClockId,
        entityId: this.config.crewId,
        clockType: 'progress',
        subtype: clockData.name,
        maxSegments: clockData.segments,
        segments: 0,
        metadata: {
          category: clockData.category,
          description: clockData.description,
        },
      },
    };
  }

  /**
   * Create Redux action to update transaction with new success clock
   *
   * @param newClockId - The newly created clock ID
   * @returns Redux action payload
   */
  createUpdateSuccessClockInTransactionAction(newClockId: string): {
    type: string;
    payload: {
      characterId: string;
      updates: {
        successClockId: string;
      };
    };
  } {
    return {
      type: 'playerRoundState/updateConsequenceTransaction',
      payload: {
        characterId: this.config.characterId,
        updates: {
          successClockId: newClockId,
        },
      },
    };
  }
}
