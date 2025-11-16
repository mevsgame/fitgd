/**
 * Use Trait Handler
 *
 * Manages trait transaction toggle logic:
 * - Clears existing trait transaction (toggle off)
 * - Validates position allows further improvement
 * - Determines if use trait action is valid
 *
 * This handler encapsulates the 31-line event handling from PlayerActionWidget._onUseTrait.
 */

import type { RootState } from '@/store';
import type { PlayerRoundState } from '@/types/playerRoundState';
import { asReduxId } from '../types/ids';

/**
 * Configuration for use trait operations
 */
export interface UseTraitHandlerConfig {
  characterId: string;
  crewId: string | null;
}

/**
 * Result of use trait validation
 */
export interface UseTraitValidationResult {
  isValid: boolean;
  reason?: 'no-crew' | 'position-controlled';
}

/**
 * Use Trait Handler
 *
 * Responsible for managing trait usage including:
 * - Clearing existing trait transactions (toggle off behavior)
 * - Validating position hasn't already been improved to Controlled
 * - Creating Redux actions for trait transaction clearing
 *
 * @example
 * const handler = new UseTraitHandler(config);
 * const validation = handler.validateUseTrait(playerState);
 * if (!validation.isValid) {
 *   ui.notifications?.warn('Cannot use trait: ' + validation.reason);
 *   return;
 * }
 *
 * // If trait is already selected, user is toggling off
 * if (playerState?.traitTransaction) {
 *   const action = handler.createClearTraitTransactionAction();
 *   await game.fitgd.bridge.execute(action);
 * }
 */
export class UseTraitHandler {
  constructor(private config: UseTraitHandlerConfig) {}

  /**
   * Validate that use trait can be used
   *
   * @param playerState - Current player round state
   * @returns Validation result with reason if invalid
   *
   * @example
   * const result = handler.validateUseTrait(playerState);
   * if (!result.isValid) {
   *   ui.notifications?.warn('Cannot use trait: ' + result.reason);
   * }
   */
  validateUseTrait(playerState: PlayerRoundState | null): UseTraitValidationResult {
    // Check crew exists
    if (!this.config.crewId) {
      return {
        isValid: false,
        reason: 'no-crew',
      };
    }

    // If trait is already selected, user is toggling off - this is always valid
    if (playerState?.traitTransaction) {
      return { isValid: true };
    }

    // Check if position is already controlled (can't improve further)
    if (playerState?.position === 'controlled') {
      return {
        isValid: false,
        reason: 'position-controlled',
      };
    }

    return { isValid: true };
  }

  /**
   * Create action to clear trait transaction (toggle off)
   *
   * @returns Redux action to clear trait transaction
   */
  createClearTraitTransactionAction(): {
    type: string;
    payload: { characterId: string };
  } {
    return {
      type: 'playerRoundState/clearTraitTransaction',
      payload: { characterId: this.config.characterId },
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
   * Get crew ID for context
   *
   * @returns Crew ID if configured, null otherwise
   */
  getCrewId(): string | null {
    return this.config.crewId;
  }

  /**
   * Check if trait transaction is active
   *
   * @param playerState - Current player round state
   * @returns true if trait transaction is active
   */
  hasActiveTraitTransaction(playerState: PlayerRoundState | null): boolean {
    return !!playerState?.traitTransaction;
  }
}
