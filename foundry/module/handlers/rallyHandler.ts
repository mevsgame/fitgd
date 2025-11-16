/**
 * Rally Handler
 *
 * Manages rally mechanics:
 * - Validates rally eligibility (has crew, has teammates)
 * - Calculates momentum cost
 * - Creates rally state transition actions
 * - Determines rally outcome
 *
 * This handler encapsulates the 24-line rally event logic from PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { Crew } from '@/types/crew';
import { selectCanUseRally, selectMomentumCost } from '@/selectors/characterSelectors';
import { asReduxId } from '../types/ids';

/**
 * Configuration for rally operations
 */
export interface RallyHandlerConfig {
  characterId: string;
  crewId: string | null;
}

/**
 * Result of rally validation
 */
export interface RallyValidationResult {
  isValid: boolean;
  reason?: 'no-crew' | 'no-teammates' | 'already-rallied';
}

/**
 * Rally Handler
 *
 * Responsible for rally mechanics including:
 * - Validation (crew exists, has teammates, not already rallied)
 * - Momentum cost calculation
 * - Rally state transitions
 * - Redux action creation
 *
 * @example
 * const handler = new RallyHandler(config);
 * const validation = handler.validateRally(crew);
 * if (!validation.isValid) {
 *   ui.notifications?.warn(validation.reason);
 *   return;
 * }
 */
export class RallyHandler {
  constructor(private config: RallyHandlerConfig) {}

  /**
   * Validate that rally can be used
   *
   * @param crew - Current crew (if any)
   * @returns Validation result with reason if invalid
   *
   * @example
   * const result = handler.validateRally(crew);
   * if (!result.isValid) {
   *   ui.notifications?.warn('Cannot rally: ' + result.reason);
   * }
   */
  validateRally(crew: Crew | null): RallyValidationResult {
    // Check crew exists
    if (!this.config.crewId || !crew) {
      return {
        isValid: false,
        reason: 'no-crew',
      };
    }

    // Check if crew has other members
    const teammates = crew.characters.filter(id => id !== this.config.characterId);
    if (teammates.length === 0) {
      return {
        isValid: false,
        reason: 'no-teammates',
      };
    }

    return { isValid: true };
  }

  /**
   * Create Redux action to transition to RALLYING state
   *
   * @returns Redux action payload
   */
  createTransitionToRallyingAction(): {
    type: string;
    payload: {
      characterId: string;
      newState: 'RALLYING';
    };
  } {
    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState: 'RALLYING',
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
   * Get crew ID for context
   *
   * @returns Crew ID if configured, null otherwise
   */
  getCrewId(): string | null {
    return this.config.crewId;
  }

  /**
   * Get teammates count in crew
   *
   * @param crew - Current crew
   * @returns Number of teammates (excluding self)
   */
  getTeammatesCount(crew: Crew | null): number {
    if (!crew) return 0;
    return crew.characters.filter(id => id !== this.config.characterId).length;
  }
}
