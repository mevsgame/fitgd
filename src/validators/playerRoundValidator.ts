/**
 * Player Round State Validators
 *
 * Business rule validation functions for player turn resolution.
 * All functions are pure and can be tested independently.
 *
 * Design: Extract validation logic from widget/reducer for reusability and testing.
 */

import type { PlayerRoundState, Position, Effect } from '../types/playerRoundState';
import type { Clock } from '../types/clock';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a player can select an action
 *
 * Requirements:
 * - Must be in DECISION_PHASE
 * - Action must be valid (non-empty string)
 *
 * @param playerState - Current player state
 * @param action - Selected action name
 * @returns Validation result
 *
 * @example
 * validateActionSelection(playerState, 'shoot')
 * // { valid: true, errors: [] }
 */
export function validateActionSelection(
  playerState: PlayerRoundState | undefined,
  action: string
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  if (playerState.state !== 'DECISION_PHASE') {
    errors.push(`Cannot select action in ${playerState.state} state`);
  }

  if (!action || action.trim().length === 0) {
    errors.push('Action name cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a player can set position and effect
 *
 * Requirements:
 * - Must be in DECISION_PHASE
 * - Action must already be selected
 * - Position and effect must be valid enum values
 *
 * @param playerState - Current player state
 * @param position - Position level
 * @param effect - Effect level
 * @returns Validation result
 *
 * @example
 * validatePositionEffect(playerState, 'risky', 'standard')
 * // { valid: true, errors: [] }
 */
export function validatePositionEffect(
  playerState: PlayerRoundState | undefined,
  position: Position,
  effect: Effect
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  if (playerState.state !== 'DECISION_PHASE') {
    errors.push(`Cannot set position/effect in ${playerState.state} state`);
  }

  if (!playerState.selectedApproach) {
    errors.push('Must select approach before setting position/effect');
  }

  const validPositions: Position[] = ['controlled', 'risky', 'desperate', 'impossible'];
  if (!validPositions.includes(position)) {
    errors.push(`Invalid position: ${position}`);
  }

  const validEffects: Effect[] = ['limited', 'standard', 'great', 'spectacular'];
  if (!validEffects.includes(effect)) {
    errors.push(`Invalid effect: ${effect}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a player can commit a roll
 *
 * Requirements:
 * - Must be in DECISION_PHASE
 * - Must have action, position, and effect selected
 * - Current momentum must be >= momentum cost
 *
 * @param playerState - Current player state
 * @param currentMomentum - Crew's current momentum
 * @param momentumCost - Total cost of this action
 * @returns Validation result
 *
 * @example
 * validateRollEligibility(playerState, 5, 2)
 * // { valid: true, errors: [] } if momentum >= cost
 */
export function validateRollEligibility(
  playerState: PlayerRoundState | undefined,
  currentMomentum: number,
  momentumCost: number
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  if (playerState.state !== 'DECISION_PHASE') {
    errors.push(`Cannot roll in ${playerState.state} state`);
  }

  if (!playerState.selectedApproach) {
    errors.push('Must select approach before rolling');
  }

  if (!playerState.position) {
    errors.push('Must set position before rolling');
  }

  if (!playerState.effect) {
    errors.push('Must set effect before rolling');
  }

  if (currentMomentum < momentumCost) {
    errors.push(
      `Insufficient momentum: need ${momentumCost}, have ${currentMomentum}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a player can accept a consequence
 *
 * Requirements:
 * - Must be in GM_RESOLVING_CONSEQUENCE state
 * - Must have consequence type and value set
 *
 * @param playerState - Current player state
 * @returns Validation result
 *
 * @example
 * validateConsequenceAcceptance(playerState)
 * // { valid: true, errors: [] }
 */
export function validateConsequenceAcceptance(
  playerState: PlayerRoundState | undefined
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  if (playerState.state !== 'GM_RESOLVING_CONSEQUENCE') {
    errors.push(`Cannot accept consequence in ${playerState.state} state`);
  }

  if (!playerState.consequenceType) {
    errors.push('Consequence type not set');
  }

  if (playerState.consequenceValue === undefined) {
    errors.push('Consequence value not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a player can use stims
 *
 * Requirements:
 * - Must be in GM_RESOLVING_CONSEQUENCE state
 * - Addiction clock must not be filled (if exists)
 * - Haven't already used stims this action
 *
 * @param playerState - Current player state
 * @param addictionClock - Addiction clock (if any)
 * @returns Validation result
 *
 * @example
 * validateStimsUsage(playerState, addictionClock)
 * // { valid: true, errors: [] } if not locked/used
 */
export function validateStimsUsage(
  playerState: PlayerRoundState | undefined,
  addictionClock: Clock | undefined
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  if (playerState.state !== 'GM_RESOLVING_CONSEQUENCE') {
    errors.push(`Cannot use stims in ${playerState.state} state`);
  }

  // Check if addiction clock is filled (stims locked)
  if (addictionClock && addictionClock.segments >= addictionClock.maxSegments) {
    errors.push('Stims locked: addiction clock is full');
  }

  // Check if already used stims this action
  if (playerState.stimsUsedThisAction) {
    errors.push('Already used stims for this action');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a player can use rally
 *
 * Requirements:
 * - Must be in DECISION_PHASE or IDLE_WAITING
 * - Character must have rally available
 * - Crew momentum must be 0-3
 *
 * @param playerState - Current player state
 * @param rallyAvailable - Whether character has rally available
 * @param crewMomentum - Current crew momentum
 * @returns Validation result
 *
 * @example
 * validateRallyUsage(playerState, true, 2)
 * // { valid: true, errors: [] }
 */
export function validateRallyUsage(
  playerState: PlayerRoundState | undefined,
  rallyAvailable: boolean,
  crewMomentum: number
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  const validStates = ['DECISION_PHASE', 'IDLE_WAITING'];
  if (!validStates.includes(playerState.state)) {
    errors.push(`Cannot rally in ${playerState.state} state`);
  }

  if (!rallyAvailable) {
    errors.push('Rally not available for this character');
  }

  if (crewMomentum < 0 || crewMomentum > 3) {
    errors.push(`Rally only available at 0-3 Momentum, currently at ${crewMomentum}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a character state is internally consistent
 *
 * Checks for impossible state combinations that shouldn't happen:
 * - Consequence data without being in consequence state
 * - Roll result without being in rolling/consequence state
 * - Position/effect without action selected
 *
 * @param playerState - Current player state
 * @returns Validation result
 *
 * @example
 * validateStateConsistency(playerState)
 * // { valid: true, errors: [] }
 */
export function validateStateConsistency(
  playerState: PlayerRoundState | undefined
): ValidationResult {
  const errors: string[] = [];

  if (!playerState) {
    errors.push('Player state not found');
    return { valid: false, errors };
  }

  // If in DECISION_PHASE, should not have roll result
  if (playerState.state === 'DECISION_PHASE' && playerState.rollResult) {
    errors.push('DECISION_PHASE should not have roll result');
  }

  // If have consequence, must be in consequence-related state
  if (playerState.consequenceType && playerState.consequenceValue !== undefined) {
    const consequenceStates = [
      'GM_RESOLVING_CONSEQUENCE',
      'APPLYING_EFFECTS',
      'STIMS_ROLLING',
    ];
    if (!consequenceStates.includes(playerState.state)) {
      errors.push(
        `Have consequence but in ${playerState.state} state (should be in: ${consequenceStates.join(', ')})`
      );
    }
  }

  // If have position/effect, should have action selected
  if ((playerState.position || playerState.effect) && !playerState.selectedApproach) {
    errors.push('Have position/effect but no approach selected');
  }

  // If have roll result, should have action/position/effect
  if (playerState.rollResult) {
    if (!playerState.selectedApproach) {
      errors.push('Have roll result but no approach selected');
    }
    if (!playerState.position) {
      errors.push('Have roll result but no position set');
    }
    if (!playerState.effect) {
      errors.push('Have roll result but no effect set');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive validation of entire player round state
 *
 * Combines multiple validators for complete integrity check.
 *
 * @param playerState - Current player state
 * @returns Validation result
 *
 * @example
 * validatePlayerRoundState(playerState)
 * // { valid: true, errors: [] } or { valid: false, errors: [...] }
 */
export function validatePlayerRoundState(
  playerState: PlayerRoundState | undefined
): ValidationResult {
  const allErrors: string[] = [];

  // Run all validators
  const consistencyResult = validateStateConsistency(playerState);
  allErrors.push(...consistencyResult.errors);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
