/**
 * Consequence Application Handler
 *
 * Orchestrates the complete consequence application workflow:
 * - Validates consequence transaction is complete
 * - Creates state transition actions (APPLYING_EFFECTS -> IDLE_WAITING)
 * - Calculates segments and momentum gains
 * - Creates Redux action batches for consequence application
 * - Returns UI notification messages
 *
 * This handler encapsulates the 75-line _onApproveConsequence method from PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { ConsequenceTransaction } from '@/types/playerRoundState';
import { selectEffectivePosition, selectConsequenceSeverity, selectMomentumGain } from '@/selectors/playerRoundStateSelectors';

/**
 * Configuration for consequence application
 */
export interface ConsequenceApplicationHandlerConfig {
  characterId: string;
  crewId: string | null;
}

/**
 * Result of consequence validation
 */
export interface ConsequenceValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Consequence application workflow result
 */
export interface ConsequenceApplicationResult {
  transitionToApplyingAction: {
    type: string;
    payload: { characterId: string; newState: 'APPLYING_EFFECTS' };
  };
  applyConsequenceAction: {
    type: string;
    payload: unknown;
  };
  clearTransactionAction: {
    type: string;
    payload: { characterId: string };
  };
  transitionToIdleAction: {
    type: string;
    payload: { characterId: string; newState: 'IDLE_WAITING' };
  };
  notificationMessage: string;
  momentumGain: number;
  characterIdToNotify?: string;
  crewIdToNotify?: string;
  isAddict: boolean;
}

/**
 * Consequence Application Handler
 *
 * Responsible for orchestrating consequence application workflow including:
 * - Validating consequence transaction completeness
 * - Creating state transition actions
 * - Calculating consequence severity and momentum
 * - Building Redux action batches for consequence application
 * - Generating UI notification messages
 *
 * @example
 * const handler = new ConsequenceApplicationHandler(config);
 *
 * // Validate consequence can be applied
 * const validation = handler.validateConsequence(transaction);
 * if (!validation.isValid) {
 *   ui.notifications?.warn(validation.errorMessage);
 *   return;
 * }
 *
 * // Get complete workflow actions
 * const workflow = handler.createConsequenceApplicationWorkflow(state, transaction);
 * workflow.actions.forEach(action => {
 *   await game.fitgd.bridge.execute(action);
 * });
 */
export class ConsequenceApplicationHandler {
  constructor(private config: ConsequenceApplicationHandlerConfig) {}

  /**
   * Validate that consequence transaction is complete
   *
   * @param transaction - The consequence transaction
   * @returns Validation result with error message if invalid
   *
   * @example
   * const result = handler.validateConsequence(transaction);
   * if (!result.isValid) {
   *   ui.notifications?.warn(result.errorMessage);
   * }
   */
  validateConsequence(transaction: ConsequenceTransaction | null | undefined): ConsequenceValidationResult {
    if (!transaction) {
      return { isValid: false, errorMessage: 'No consequence transaction active' };
    }

    if (transaction.consequenceType === 'harm') {
      const isValid = Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
      return {
        isValid,
        errorMessage: !isValid ? 'Please select target character and harm clock' : undefined,
      };
    } else if (transaction.consequenceType === 'crew-clock') {
      const isValid = Boolean(transaction.crewClockId);
      return {
        isValid,
        errorMessage: !isValid ? 'Please select a crew clock' : undefined,
      };
    }

    return { isValid: false, errorMessage: 'Unknown consequence type' };
  }

  /**
   * Create transition action to APPLYING_EFFECTS state
   *
   * @returns Redux action
   */
  createTransitionToApplyingAction(): {
    type: string;
    payload: { characterId: string; newState: 'APPLYING_EFFECTS' };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState: 'APPLYING_EFFECTS',
      },
    };
  }

  /**
   * Create action to apply harm consequence
   *
   * @param transaction - Consequence transaction
   * @param segments - Number of segments to apply
   * @returns Redux action
   */
  createApplyHarmAction(
    transaction: ConsequenceTransaction,
    segments: number
  ): {
    type: string;
    payload: unknown;
  } {
    return {
      type: 'clocks/addSegments',
      payload: {
        clockId: transaction.harmClockId,
        segments,
      },
    };
  }

  /**
   * Create action to advance crew clock
   *
   * @param transaction - Consequence transaction
   * @param segments - Number of segments to advance
   * @returns Redux action
   */
  createAdvanceCrewClockAction(
    transaction: ConsequenceTransaction,
    segments: number
  ): {
    type: string;
    payload: unknown;
  } {
    return {
      type: 'clocks/addSegments',
      payload: {
        clockId: transaction.crewClockId,
        segments,
      },
    };
  }

  /**
   * Create action to clear consequence transaction
   *
   * @returns Redux action
   */
  createClearTransactionAction(): {
    type: string;
    payload: { characterId: string };
  } {
    return {
      type: 'playerRoundState/clearConsequenceTransaction',
      payload: { characterId: this.config.characterId },
    };
  }

  /**
   * Create transition action to IDLE_WAITING state
   *
   * @returns Redux action
   */
  createTransitionToIdleAction(): {
    type: string;
    payload: { characterId: string; newState: 'IDLE_WAITING' };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState: 'IDLE_WAITING',
      },
    };
  }

  /**
   * Calculate consequence severity based on position
   *
   * @param state - Redux state
   * @returns Number of segments to apply
   */
  calculateConsequenceSegments(state: RootState): number {
    const position = selectEffectivePosition(state, this.config.characterId);
    return selectConsequenceSeverity(position);
  }

  /**
   * Calculate momentum gain based on position
   *
   * @param state - Redux state
   * @returns Momentum to gain
   */
  calculateMomentumGain(state: RootState): number {
    const position = selectEffectivePosition(state, this.config.characterId);
    return selectMomentumGain(position);
  }

  /**
   * Generate notification message for consequence application
   *
   * @param transaction - Consequence transaction
   * @returns Human-readable notification message
   */
  generateNotificationMessage(transaction: ConsequenceTransaction | null, _segments: number): string {
    if (!transaction) return 'Consequence applied';

    const severityText = selectConsequenceSeverity(
      selectEffectivePosition({ characters: {}, crews: {}, clocks: {} } as any, this.config.characterId)
    );
    const consequenceType = transaction.consequenceType === 'harm' ? 'harm clock' : 'crew clock';

    return `Applied ${severityText} harm (${consequenceType})`;
  }

  /**
   * Get affected Redux IDs for this character and crew
   *
   * @param transaction - Consequence transaction
   * @returns Object with character and optional crew IDs
   */
  getAffectedIds(transaction: ConsequenceTransaction | null): {
    characterId: string;
    targetId?: string;
  } {
    if (!transaction) {
      return { characterId: this.config.characterId };
    }

    const targetId = transaction.consequenceType === 'harm' ? transaction.harmTargetCharacterId : this.config.crewId;

    return {
      characterId: this.config.characterId,
      targetId: targetId || undefined,
    };
  }

  /**
   * Create complete consequence application workflow
   *
   * @param state - Redux state
   * @param transaction - Consequence transaction
   * @returns Workflow with all actions and metadata
   */
  createConsequenceApplicationWorkflow(
    state: RootState,
    transaction: ConsequenceTransaction
  ): ConsequenceApplicationResult {
    const segments = this.calculateConsequenceSegments(state);
    const momentumGain = this.calculateMomentumGain(state);
    const isHarm = transaction.consequenceType === 'harm';

    return {
      transitionToApplyingAction: this.createTransitionToApplyingAction(),
      applyConsequenceAction: isHarm
        ? this.createApplyHarmAction(transaction, segments)
        : this.createAdvanceCrewClockAction(transaction, segments),
      clearTransactionAction: this.createClearTransactionAction(),
      transitionToIdleAction: this.createTransitionToIdleAction(),
      notificationMessage: this.generateNotificationMessage(transaction, segments),
      momentumGain,
      characterIdToNotify: isHarm ? transaction.harmTargetCharacterId : undefined,
      crewIdToNotify: this.config.crewId || undefined,
      isAddict: false,
    };
  }
}
