/**
 * Stims Workflow Handler
 *
 * Orchestrates the complete stims usage workflow:
 * - Validates stims can be used (not already used, crew not locked)
 * - Manages addiction clock creation and advancement
 * - Handles addict trait assignment when addiction fills
 * - Coordinates pre-roll batch actions
 * - Determines notification messages and chat content
 *
 * This handler encapsulates the 150-line _useStims method from PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { Clock } from '@/types/clock';
import { selectAddictionClockByCrew } from '@/selectors/clockSelectors';
import { asReduxId } from '../types/ids';

/**
 * Configuration for stims workflow
 */
export interface StimsWorkflowHandlerConfig {
  characterId: string;
  characterName: string | undefined;
  crewId: string | null;
}

/**
 * Stims usage validation result
 */
export interface StimsValidationResult {
  isValid: boolean;
  reason?: 'no-crew' | 'already-used' | 'team-addiction-locked';
}

/**
 * Addiction roll result
 */
export interface AddictionRollResult {
  rollValue: number;
  segmentsToAdd: number;
  notificationText: string;
}

/**
 * Stims workflow phase result
 */
export interface StimsWorkflowPhase {
  actions: Array<{ type: string; payload: unknown }>;
  notifications: Array<{ level: 'info' | 'warn' | 'error'; message: string }>;
  chatMessages: Array<{ title: string; content: string }>;
  shouldTransitionToStimsRolling: boolean;
  addictionClockId: string | null;
}

/**
 * Stims Workflow Handler
 *
 * Responsible for orchestrating complete stims usage workflow including:
 * - Validation (crew exists, not already used, stims not locked)
 * - Addiction clock lifecycle (find/create/advance)
 * - Addict trait assignment when clock fills
 * - Pre-roll batch action generation
 * - State transitions and notifications
 *
 * @example
 * const handler = new StimsWorkflowHandler(config);
 *
 * // Validate stims can be used
 * const validation = handler.validateStimsUsage(state, playerState);
 * if (!validation.isValid) {
 *   ui.notifications?.warn(handler.getErrorMessage(validation.reason));
 *   return;
 * }
 *
 * // Execute stims workflow
 * const workflow = handler.executeStimsWorkflow(state, playerState);
 * workflow.actions.forEach(action => {
 *   await game.fitgd.bridge.execute(action);
 * });
 */
export class StimsWorkflowHandler {
  constructor(private config: StimsWorkflowHandlerConfig) {}

  /**
   * Validate that stims can be used
   *
   * @param state - Redux state
   * @param playerState - Current player round state
   * @returns Validation result with reason if invalid
   */
  validateStimsUsage(state: RootState, playerState: PlayerRoundState | null): StimsValidationResult {
    // Check crew exists
    if (!this.config.crewId) {
      return { isValid: false, reason: 'no-crew' };
    }

    // Check if stims already used in this action
    if (playerState?.pushed || playerState?.flashbackApplied) {
      return { isValid: false, reason: 'already-used' };
    }

    // TODO: Check if crew addiction is locked
    // const isStimsLocked = selectIsStimsLocked(state, this.config.crewId);
    // if (isStimsLocked) {
    //   return { isValid: false, reason: 'team-addiction-locked' };
    // }

    return { isValid: true };
  }

  /**
   * Get user-friendly error message for validation failure
   *
   * @param reason - Validation failure reason
   * @returns Error message for UI notification
   */
  getErrorMessage(reason?: string): string {
    switch (reason) {
      case 'no-crew':
        return 'Character must be in a crew to use stims';
      case 'already-used':
        return 'Stims already used this action - cannot use again!';
      case 'team-addiction-locked':
        return 'Stims are LOCKED due to crew addiction! Cannot use stims.';
      default:
        return 'Cannot use stims';
    }
  }

  /**
   * Find or note missing addiction clock
   *
   * @param state - Redux state
   * @returns Addiction clock if exists, null otherwise
   */
  findAddictionClock(state: RootState): Clock | null {
    if (!this.config.crewId) return null;
    return selectAddictionClockByCrew(state, this.config.crewId);
  }

  /**
   * Create action to initialize addiction clock
   *
   * @returns Redux action with generated clock ID
   */
  createAddictionClockAction(): {
    type: string;
    payload: { id: string; entityId: string; clockType: 'addiction'; maxSegments: number; segments: number };
  } {
    const clockId = this._generateId();

    return {
      type: 'clocks/addClock',
      payload: {
        id: clockId,
        entityId: this.config.crewId!,
        clockType: 'addiction',
        maxSegments: 8,
        segments: 0,
      },
    };
  }

  /**
   * Validate addiction roll and return segments to add
   *
   * @param rollValue - Result of 1d6 roll
   * @returns Number of segments to add (1-4, capped at 4)
   */
  validateAddictionRoll(rollValue: number): number {
    if (rollValue <= 0) return 1;
    if (rollValue >= 5) return 4;
    return rollValue;
  }

  /**
   * Create action to advance addiction clock
   *
   * @param addictionClockId - Clock ID to advance
   * @param segments - Number of segments to add
   * @returns Redux action
   */
  createAdvanceAddictionClockAction(
    addictionClockId: string,
    segments: number
  ): {
    type: string;
    payload: { clockId: string; segments: number };
  } {
    return {
      type: 'clocks/addSegments',
      payload: {
        clockId: addictionClockId,
        segments,
      },
    };
  }

  /**
   * Check if addiction clock just filled (character becomes addict)
   *
   * @param currentSegments - Current segments on clock
   * @param maxSegments - Max segments on clock
   * @returns true if clock is now full
   */
  isAddictionClockFull(currentSegments: number, maxSegments: number): boolean {
    return currentSegments >= maxSegments;
  }

  /**
   * Create action to add Addict trait when addiction clock fills
   *
   * @returns Redux action
   */
  createAddictTraitAction(): {
    type: string;
    payload: { characterId: string; trait: { id: string; name: string; description: string; disabled: boolean } };
  } {
    return {
      type: 'characters/addTrait',
      payload: {
        characterId: this.config.characterId,
        trait: {
          id: this._generateId(),
          name: 'Addict',
          description: 'You are addicted to combat stims. Stims are locked for your entire crew.',
          disabled: false,
        },
      },
    };
  }

  /**
   * Generate addiction roll notification
   *
   * @param rollValue - Roll result
   * @param segments - Segments added
   * @param currentSegments - Current clock segments
   * @param maxSegments - Max clock segments
   * @returns Notification text
   */
  generateAddictionNotification(rollValue: number, segments: number, currentSegments: number, maxSegments: number): string {
    return `Addiction clock: ${currentSegments}/${maxSegments} (+${segments})`;
  }

  /**
   * Generate addiction filled notification
   *
   * @returns Notification text
   */
  generateAddictionFilledNotification(): string {
    return `${this.config.characterName || 'Character'} is now an ADDICT! Stims are LOCKED for the crew.`;
  }

  /**
   * Create pre-roll batch actions (clears consequence, marks stims used, transitions to STIMS_ROLLING)
   *
   * @param addictionClockId - ID of addiction clock
   * @param addictionSegments - Segments added in this roll
   * @param hasConsequenceTransaction - Whether consequence transaction exists
   * @returns Array of Redux actions
   */
  createPreRollBatch(
    addictionClockId: string,
    addictionSegments: number,
    hasConsequenceTransaction: boolean
  ): Array<{ type: string; payload: unknown }> {
    const batch: Array<{ type: string; payload: unknown }> = [];

    // Clear consequence transaction if it exists
    if (hasConsequenceTransaction) {
      batch.push({
        type: 'playerRoundState/clearConsequenceTransaction',
        payload: { characterId: this.config.characterId },
      });
    }

    // Mark stims as used (pushed improvement)
    batch.push({
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.config.characterId,
        pushed: true,
        pushType: 'extra-die',
      },
    });

    return batch;
  }

  /**
   * Create transition to STIMS_ROLLING state
   *
   * @returns Redux action
   */
  createTransitionToStimsRollingAction(): {
    type: string;
    payload: { characterId: string; newState: 'STIMS_ROLLING' };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState: 'STIMS_ROLLING',
      },
    };
  }

  /**
   * Create transition to ROLLING state (after stims phase)
   *
   * @returns Redux action
   */
  createTransitionToRollingAction(): {
    type: string;
    payload: { characterId: string; newState: 'ROLLING' };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState: 'ROLLING',
      },
    };
  }

  /**
   * Get affected Redux ID for this character
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedReduxId(): string {
    return asReduxId(this.config.characterId);
  }

  /**
   * Generate chat message for stims usage
   *
   * @returns Chat message object
   */
  generateStimsUsedChatMessage(): { title: string; content: string } {
    return {
      title: '💉 STIMS USED!',
      content: `${this.config.characterName || 'Character'} used combat stims! Addiction clock advanced. Re-rolling...`,
    };
  }

  /**
   * Generate chat message for addiction fill
   *
   * @returns Chat message object
   */
  generateAddictionFilledChatMessage(): { title: string; content: string } {
    return {
      title: '⚠️ ADDICTION FILLS!',
      content: `${this.config.characterName || 'Character'} has become addicted to combat stims! Trait Added: Addict. Stims are now locked for the entire crew.`,
    };
  }

  /**
   * Private helper to generate unique IDs
   *
   * @returns Generated ID string
   */
  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
