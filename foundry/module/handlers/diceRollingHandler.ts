/**
 * Dice Rolling Handler
 *
 * Manages the dice roll workflow:
 * - Validates action selection and momentum
 * - Creates roll outcome actions (batch)
 * - Determines state transitions based on outcome
 * - Calculates dice pool for rolls
 *
 * This handler encapsulates the complex 130+ line roll workflow that was
 * previously a single monolithic method in PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { DiceOutcome } from '@/utils/diceRules';
import { selectDicePool, selectMomentumCost } from '@/selectors/playerRoundStateSelectors';
import { asReduxId } from '../types/ids';

/**
 * Configuration for dice rolling operations
 */
export interface DiceRollingHandlerConfig {
  characterId: string;
  crewId: string | null;
}

/**
 * Result of roll validation
 */
export interface RollValidationResult {
  isValid: boolean;
  reason?: 'no-action-selected' | 'insufficient-momentum';
  momentumNeeded?: number;
  momentumAvailable?: number;
}

/**
 * Dice Rolling Handler
 *
 * Responsible for managing the dice roll workflow including:
 * - Validation (action selected, sufficient momentum)
 * - Dice pool calculation
 * - Roll outcome determination (success/partial/failure)
 * - State transitions based on outcome
 * - Redux action creation for roll results
 *
 * @example
 * const handler = new DiceRollingHandler(config);
 * const validation = handler.validateRoll(state, playerState, crew);
 * if (!validation.isValid) {
 *   ui.notifications?.error(validation.reason);
 *   return;
 * }
 *
 * const dicePool = handler.calculateDicePool(state);
 * const rollOutcomeActions = handler.createRollOutcomeActions(
 *   dicePool,
 *   rollResult,
 *   outcome
 * );
 */
export class DiceRollingHandler {
  constructor(private config: DiceRollingHandlerConfig) { }

  /**
   * Validate that a roll can be executed
   *
   * @param state - Redux state
   * @param playerState - Current player round state
   * @param crew - Current crew (if any)
   * @returns Validation result with reason if invalid
   *
   * @example
   * const result = handler.validateRoll(state, playerState, crew);
   * if (!result.isValid) {
   *   if (result.reason === 'insufficient-momentum') {
   *     ui.notifications?.error(`Need ${result.momentumNeeded}, have ${result.momentumAvailable}`);
   *   }
   * }
   */
  validateRoll(
    _state: RootState,
    playerState: PlayerRoundState | null | undefined,
    crew: any | null
  ): RollValidationResult {
    // Check action is selected
    if (!playerState?.selectedApproach) {
      return {
        isValid: false,
        reason: 'no-action-selected',
      };
    }

    // Check momentum cost
    const momentumCost = selectMomentumCost(playerState);
    if (crew && momentumCost > 0) {
      if (crew.currentMomentum < momentumCost) {
        return {
          isValid: false,
          reason: 'insufficient-momentum',
          momentumNeeded: momentumCost,
          momentumAvailable: crew.currentMomentum,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Calculate momentum cost for current action
   *
   * @param playerState - Current player state
   * @returns Momentum cost (0 if no cost)
   */
  calculateMomentumCost(playerState: PlayerRoundState | null | undefined): number {
    if (!playerState) return 0;
    return selectMomentumCost(playerState);
  }

  /**
   * Calculate dice pool for a roll
   *
   * @param state - Redux state
   * @returns Dice pool value (can be 0 for desperate rolls)
   */
  calculateDicePool(state: RootState): number {
    return selectDicePool(state, this.config.characterId);
  }

  /**
   * Create Redux action to set roll result
   *
   * @param dicePool - Number of dice rolled
   * @param rollResult - Array of roll values
   * @param outcome - The roll outcome (success/partial/failure/critical)
   * @returns Redux action payload
   */
  createSetRollResultAction(
    dicePool: number,
    rollResult: number[],
    outcome: DiceOutcome
  ): {
    type: string;
    payload: {
      characterId: string;
      dicePool: number;
      rollResult: number[];
      outcome: DiceOutcome;
    };
  } {
    return {
      type: 'playerRoundState/setRollResult',
      payload: {
        characterId: this.config.characterId,
        dicePool,
        rollResult,
        outcome,
      },
    };
  }

  /**
   * Create Redux action to clear GM approval
   *
   * @returns Redux action payload
   */
  createClearGmApprovalAction(): {
    type: string;
    payload: {
      characterId: string;
      approved: false;
    };
  } {
    return {
      type: 'playerRoundState/setGmApproved',
      payload: {
        characterId: this.config.characterId,
        approved: false,
      },
    };
  }

  /**
   * Create Redux action to transition state based on outcome
   *
   * @param outcome - The roll outcome
   * @returns Redux action payload
   */
  createOutcomeTransitionAction(outcome: DiceOutcome): {
    type: string;
    payload: {
      characterId: string;
      newState: string;
    };
  } {
    const newState =
      outcome === 'critical' || outcome === 'success' ? 'SUCCESS_COMPLETE' : 'GM_RESOLVING_CONSEQUENCE';

    return {
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.config.characterId,
        newState,
      },
    };
  }

  /**
   * Create transition to ROLLING state
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
   * Create batch of actions for roll outcome
   *
   * @param dicePool - Number of dice rolled
   * @param rollResult - Array of roll values
   * @param outcome - The roll outcome
   * @returns Array of Redux actions to execute as batch
   */
  createRollOutcomeBatch(
    dicePool: number,
    rollResult: number[],
    outcome: DiceOutcome
  ): Array<{ type: string; payload: any }> {
    return [
      this.createSetRollResultAction(dicePool, rollResult, outcome),
      this.createClearGmApprovalAction(),
      this.createOutcomeTransitionAction(outcome),
    ];
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
   * Check if roll outcome is success (includes critical)
   *
   * @param outcome - The roll outcome
   * @returns true if roll was successful
   */
  isSuccessfulOutcome(outcome: DiceOutcome): boolean {
    return outcome === 'success' || outcome === 'critical';
  }
}
