import type { Crew } from '../types';
import { DEFAULT_CONFIG } from '../config/gameConfig';

/**
 * Crew Validator
 *
 * Validates all crew operations against game rules.
 */

/**
 * Validates momentum value is within allowed range (0-10)
 */
export function validateMomentumValue(momentum: number): void {
  const { minMomentum, maxMomentum } = DEFAULT_CONFIG.crew;

  if (momentum < minMomentum) {
    throw new Error(
      `Momentum cannot be less than ${minMomentum}, got ${momentum}`
    );
  }

  if (momentum > maxMomentum) {
    throw new Error(
      `Momentum cannot exceed ${maxMomentum}, got ${momentum}`
    );
  }

  if (!Number.isInteger(momentum)) {
    throw new Error(`Momentum must be an integer, got ${momentum}`);
  }
}

/**
 * Validates that crew has sufficient momentum to spend
 */
export function validateSufficientMomentum(
  currentMomentum: number,
  amount: number
): void {
  if (amount < 0) {
    throw new Error(`Cannot spend negative momentum, got ${amount}`);
  }

  if (amount > currentMomentum) {
    throw new Error(
      `Insufficient momentum. Have ${currentMomentum}, trying to spend ${amount}`
    );
  }
}

/**
 * Validates that amount to add is non-negative
 */
export function validateMomentumAmount(amount: number): void {
  if (amount < 0) {
    throw new Error(`Cannot add negative momentum, got ${amount}`);
  }

  if (!Number.isInteger(amount)) {
    throw new Error(`Momentum amount must be an integer, got ${amount}`);
  }
}

/**
 * Caps momentum at maximum value, returning capped value
 */
export function capMomentum(momentum: number): number {
  const { maxMomentum } = DEFAULT_CONFIG.crew;
  return Math.min(momentum, maxMomentum);
}

/**
 * Validates character ID exists in crew
 */
export function validateCharacterInCrew(
  crew: Crew,
  characterId: string
): void {
  if (!crew.characters.includes(characterId)) {
    throw new Error(
      `Character ${characterId} is not in crew ${crew.id}`
    );
  }
}

/**
 * Validates character ID is not already in crew
 */
export function validateCharacterNotInCrew(
  crew: Crew,
  characterId: string
): void {
  if (crew.characters.includes(characterId)) {
    throw new Error(
      `Character ${characterId} is already in crew ${crew.id}`
    );
  }
}
