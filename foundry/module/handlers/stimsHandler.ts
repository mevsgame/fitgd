/**
 * Stims Handler
 *
 * Manages the stims interrupt workflow:
 * - Validates that stims can be used
 * - Manages addiction clock lifecycle
 * - Handles addiction clock fill conditions (Addict trait)
 * - Orchestrates stims reroll workflow
 *
 * This handler encapsulates the complex 245+ line stims workflow that was
 * previously a single monolithic method in PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { Trait } from '@/types/character';
import type { Clock } from '@/types/clock';
import { DEFAULT_CONFIG } from '@/config/gameConfig';
import { logger } from '../../../src/utils/logger';
import { selectDicePool } from '@/selectors/playerRoundStateSelectors';
import { asReduxId, type ReduxId } from '../types/ids';

/**
 * Configuration for stims operations
 */
export interface StimsHandlerConfig {
  characterId: string;
  crewId: string | null;
  characterName?: string;
}

/**
 * Result of stims validation check
 */
export interface StimsValidationResult {
  isValid: boolean;
  reason?: 'no-crew' | 'already-used' | 'team-addiction-locked';
}

/**
 * Addiction clock state after stims use
 */
export interface AddictionClockResult {
  clockId: string;
  newSegments: number;
  maxSegments: number;
  isAddict: boolean; // True if addiction clock just filled
}

/**
 * Stims Handler
 *
 * Responsible for stims interrupt mechanics including:
 * - Validation (crew exists, not used yet, team not addiction-locked)
 * - Addiction clock management (find, create, advance)
 * - Addiction fill detection and Addict trait assignment
 * - State transitions for stims workflow
 * - Redux action creation
 *
 * @example
 * const handler = new StimsHandler(config);
 * const validation = handler.validateStimsUsage(state, playerState);
 * if (!validation.isValid) {
 *   ui.notifications?.error(validation.reason);
 *   return;
 * }
 *
 * const addictionResult = await handler.executeAddictionRoll(state);
 * if (addictionResult.isAddict) {
 *   // Character is now an Addict - stims locked for crew
 * }
 */
export class StimsHandler {
  constructor(private config: StimsHandlerConfig) { }

  /**
   * Validate that stims can be used
   *
   * @param state - Redux state
   * @param playerState - Current player round state
   * @returns Validation result with reason if invalid
   *
   * @example
   * const result = handler.validateStimsUsage(state, playerState);
   * if (!result.isValid) {
   *   ui.notifications?.warn(`Cannot use stims: ${result.reason}`);
   * }
   */
  validateStimsUsage(
    state: RootState,
    playerState: any
  ): StimsValidationResult {
    // Check crew exists
    if (!this.config.crewId) {
      return {
        isValid: false,
        reason: 'no-crew',
      };
    }

    // Check if already used stims this action
    if (playerState?.stimsUsedThisAction) {
      return {
        isValid: false,
        reason: 'already-used',
      };
    }

    // Check if ANY character in crew has filled addiction clock (team-wide lock)
    const crew = state.crews.byId[this.config.crewId];
    if (crew) {
      for (const characterId of crew.characters) {
        const characterAddictionClock = Object.values(state.clocks.byId).find(
          clock => clock.entityId === characterId && clock.clockType === 'addiction'
        );
        if (
          characterAddictionClock &&
          characterAddictionClock.segments >= characterAddictionClock.maxSegments
        ) {
          return {
            isValid: false,
            reason: 'team-addiction-locked',
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Find or identify addiction clock for character
   *
   * @param state - Redux state
   * @returns Addiction clock if exists, null otherwise
   */
  findAddictionClock(state: RootState): Clock | null {
    const addictionClock = Object.values(state.clocks.byId).find(
      clock => clock.entityId === this.config.characterId && clock.clockType === 'addiction'
    );
    return addictionClock || null;
  }

  /**
   * Create Redux action to create addiction clock
   *
   * @param generateId - Optional ID generator (for testing)
   * @returns Redux action payload
   */
  createAddictionClockAction(generateId?: () => string): {
    type: string;
    payload: {
      id: string;
      entityId: string;
      clockType: 'addiction';
      subtype: 'Addiction';
      maxSegments: number;
      segments: 0;
    };
  } {
    const newClockId = generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator());

    return {
      type: 'clocks/createClock',
      payload: {
        id: newClockId,
        entityId: this.config.characterId,
        clockType: 'addiction',
        subtype: 'Addiction',
        maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
        segments: 0,
      },
    };
  }

  /**
   * Create Redux action to advance addiction clock
   *
   * @param clockId - The addiction clock ID
   * @param amount - Number of segments to add
   * @returns Redux action payload
   */
  createAdvanceAddictionClockAction(clockId: string, amount: number): {
    type: string;
    payload: {
      clockId: string;
      amount: number;
    };
  } {
    return {
      type: 'clocks/addSegments',
      payload: {
        clockId,
        amount,
      },
    };
  }

  /**
   * Create Redux action to add Addict trait to character
   *
   * @param generateId - Optional ID generator (for testing)
   * @returns Redux action payload
   */
  createAddictTraitAction(generateId?: () => string): {
    type: string;
    payload: {
      characterId: string;
      trait: Trait;
    };
  } {
    const traitId = generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator());

    const addictTrait: Trait = {
      id: traitId,
      name: 'Addict',
      description: 'Addicted to combat stims. Stims are now locked for the entire crew.',
      category: 'scar',
      disabled: false,
      acquiredAt: Date.now(),
    };

    return {
      type: 'characters/addTrait',
      payload: {
        characterId: this.config.characterId,
        trait: addictTrait,
      },
    };
  }

  /**
   * Create Redux action to mark stims as used this action
   *
   * @returns Redux action payload
   */
  createMarkStimsUsedAction(): {
    type: string;
    payload: {
      characterId: string;
      used: true;
    };
  } {
    return {
      type: 'playerRoundState/setStimsUsed',
      payload: {
        characterId: this.config.characterId,
        used: true,
      },
    };
  }

  /**
   * Create Redux action to clear consequence transaction (if any)
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
   * Create Redux action to transition to STIMS_ROLLING state
   *
   * @returns Redux action payload
   */
  createTransitionToStimsRollingAction(): {
    type: string;
    payload: {
      characterId: string;
      newState: 'STIMS_ROLLING';
    };
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
   * Create Redux action to transition to ROLLING state for reroll
   *
   * @returns Redux action payload
   */
  createTransitionToRollingAction(): {
    type: string;
    payload: {
      characterId: string;
      newState: 'ROLLING';
    };
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
   * Create batch of actions for successful stims use pre-roll
   *
   * @param clockId - The addiction clock ID
   * @param addictionAmount - Number of segments to add
   * @param hasConsequenceTransaction - Whether to clear consequence transaction
   * @returns Array of Redux actions to execute as batch
   */
  createPreRollBatch(
    clockId: string,
    addictionAmount: number,
    hasConsequenceTransaction: boolean
  ): Array<{ type: string; payload: any }> {
    const actions: Array<{ type: string; payload: any }> = [
      this.createAdvanceAddictionClockAction(clockId, addictionAmount),
      this.createMarkStimsUsedAction(),
    ];

    if (hasConsequenceTransaction) {
      actions.push(this.createClearConsequenceTransactionAction());
    }

    actions.push(this.createTransitionToStimsRollingAction());

    return actions;
  }

  /**
   * Check if addiction clock is now full (character is addict)
   *
   * @param currentSegments - Current segments in clock
   * @param maxSegments - Max segments in clock
   * @returns true if clock is full
   */
  isAddictionClockFull(currentSegments: number, maxSegments: number): boolean {
    return currentSegments >= maxSegments;
  }

  /**
   * Roll addiction amount (1d6)
   *
   * Note: This should be called from widget with Foundry Roll API
   * The actual dice roll happens in the widget, this validates the amount
   *
   * @param rollAmount - The amount rolled (1-6)
   * @returns The amount to apply
   */
  validateAddictionRoll(rollAmount: number): number {
    // Validate roll is in range 1-6
    if (rollAmount < 1 || rollAmount > 6) {
      logger.warn(`Invalid addiction roll amount: ${rollAmount}, defaulting to 1`);
      return 1;
    }
    return rollAmount;
  }

  /**
   * Get affected Redux ID for this character
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedReduxId(): ReduxId {
    return asReduxId(this.config.characterId);
  }

  /**
   * Get affected Redux ID for crew
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedCrewReduxId(): ReduxId {
    if (!this.config.crewId) {
      throw new Error('No crew ID configured');
    }
    return asReduxId(this.config.crewId);
  }

  /**
   * Calculate new dice pool for stims reroll
   *
   * @param state - Redux state
   * @returns Dice pool to use for reroll
   */
  calculateRerollDicePool(state: RootState): number {
    return selectDicePool(state, this.config.characterId);
  }

  /**
   * Get character name for notifications
   *
   * @returns Character name or 'Character'
   */
  getCharacterName(): string {
    return this.config.characterName || 'Character';
  }

  /**
   * Default ID generator for testing environments
   * @private
   */
  private _defaultIdGenerator(): string {
    return `stims-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
