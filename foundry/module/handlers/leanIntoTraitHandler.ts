/**
 * Lean Into Trait Handler
 *
 * Manages lean into trait mechanics:
 * - Validates that character has available (non-disabled) traits
 * - Checks crew availability requirement
 *
 * This handler encapsulates the 18-line validation logic from PlayerActionWidget._onLeanIntoTrait.
 */

import type { Character } from '@/types/character';

/**
 * Configuration for lean into trait operations
 */
export interface LeanIntoTraitHandlerConfig {
  character: Character | null;
  crewId: string | null;
}

/**
 * Result of lean into trait validation
 */
export interface LeanIntoTraitValidationResult {
  isValid: boolean;
  reason?: 'no-crew' | 'no-available-traits';
}

/**
 * Lean Into Trait Handler
 *
 * Responsible for validating lean into trait eligibility including:
 * - Character must be in a crew
 * - Character must have at least one non-disabled trait
 *
 * @example
 * const handler = new LeanIntoTraitHandler({ character, crewId });
 * const validation = handler.validateLeanIntoTrait();
 * if (!validation.isValid) {
 *   ui.notifications?.warn('Cannot lean into trait: ' + validation.reason);
 * }
 */
export class LeanIntoTraitHandler {
  constructor(private config: LeanIntoTraitHandlerConfig) {}

  /**
   * Validate that lean into trait can be used
   *
   * @returns Validation result with reason if invalid
   *
   * @example
   * const result = handler.validateLeanIntoTrait();
   * if (!result.isValid) {
   *   ui.notifications?.warn('Cannot lean into trait: ' + result.reason);
   * }
   */
  validateLeanIntoTrait(): LeanIntoTraitValidationResult {
    // Check crew exists
    if (!this.config.crewId) {
      return {
        isValid: false,
        reason: 'no-crew',
      };
    }

    // Check if character has any available (non-disabled) traits
    const availableTraits = this.getAvailableTraits();
    if (availableTraits.length === 0) {
      return {
        isValid: false,
        reason: 'no-available-traits',
      };
    }

    return { isValid: true };
  }

  /**
   * Get available (non-disabled) traits for character
   *
   * @returns Array of available traits
   */
  getAvailableTraits() {
    if (!this.config.character) return [];
    return this.config.character.traits.filter(t => !t.disabled);
  }

  /**
   * Get number of available traits
   *
   * @returns Count of non-disabled traits
   */
  getAvailableTraitCount(): number {
    return this.getAvailableTraits().length;
  }

  /**
   * Get crew ID for context
   *
   * @returns Crew ID if configured, null otherwise
   */
  getCrewId(): string | null {
    return this.config.crewId;
  }
}
