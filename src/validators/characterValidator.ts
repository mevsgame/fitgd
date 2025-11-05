import { DEFAULT_CONFIG } from '../config';
import type { ActionDots, Trait, Character } from '../types';

/**
 * Character Validation
 *
 * Validates character creation and modification according to game rules.
 */

export class CharacterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterValidationError';
  }
}

/**
 * Validate starting traits for character creation
 */
export function validateStartingTraits(traits: Trait[]): void {
  const config = DEFAULT_CONFIG;

  if (traits.length !== config.character.startingTraitCount) {
    throw new CharacterValidationError(
      `Character must start with exactly ${config.character.startingTraitCount} traits (got ${traits.length})`
    );
  }

  // Check for at least one role and one background
  const hasRole = traits.some((t) => t.category === 'role');
  const hasBackground = traits.some((t) => t.category === 'background');

  if (!hasRole) {
    throw new CharacterValidationError(
      'Character must have at least one role trait'
    );
  }

  if (!hasBackground) {
    throw new CharacterValidationError(
      'Character must have at least one background trait'
    );
  }
}

/**
 * Calculate total action dots
 */
export function calculateTotalActionDots(actionDots: ActionDots): number {
  return Object.values(actionDots).reduce((sum, dots) => sum + dots, 0);
}

/**
 * Validate starting action dots for character creation
 * Allows allocation from 0 up to 12 total dots (flexible for character creation UI)
 */
export function validateStartingActionDots(actionDots: ActionDots): void {
  const config = DEFAULT_CONFIG;
  const total = calculateTotalActionDots(actionDots);

  // Allow any allocation from 0 to 12 dots (user can allocate freely during creation)
  if (total > config.character.startingActionDots) {
    throw new CharacterValidationError(
      `Character cannot have more than ${config.character.startingActionDots} action dots at creation (got ${total})`
    );
  }

  // Check that no single action exceeds max at creation
  const maxAtCreation = config.character.maxActionDotsAtCreation;
  for (const [action, dots] of Object.entries(actionDots)) {
    if (dots > maxAtCreation) {
      throw new CharacterValidationError(
        `Action '${action}' cannot have more than ${maxAtCreation} dots at character creation (got ${dots})`
      );
    }

    if (dots < 0) {
      throw new CharacterValidationError(
        `Action '${action}' cannot have negative dots (got ${dots})`
      );
    }
  }
}

/**
 * Validate action dots value (for advancement)
 */
export function validateActionDots(action: keyof ActionDots, dots: number): void {
  const config = DEFAULT_CONFIG;

  if (dots < 0) {
    throw new CharacterValidationError(
      `Action dots cannot be negative (got ${dots})`
    );
  }

  if (dots > config.character.maxActionDotsPerAction) {
    throw new CharacterValidationError(
      `Action '${action}' cannot have more than ${config.character.maxActionDotsPerAction} dots (got ${dots})`
    );
  }
}

/**
 * Validate trait count (if max configured)
 */
export function validateTraitCount(character: Character): void {
  const config = DEFAULT_CONFIG;

  if (config.character.maxTraitCount !== undefined) {
    if (character.traits.length > config.character.maxTraitCount) {
      throw new CharacterValidationError(
        `Character cannot have more than ${config.character.maxTraitCount} traits (got ${character.traits.length})`
      );
    }
  }
}

/**
 * Validate trait grouping
 */
export function validateTraitGrouping(
  character: Character,
  traitIds: string[]
): void {
  if (traitIds.length !== 3) {
    throw new CharacterValidationError(
      `Trait grouping requires exactly 3 traits (got ${traitIds.length})`
    );
  }

  // Verify all traits exist
  for (const traitId of traitIds) {
    const trait = character.traits.find((t) => t.id === traitId);
    if (!trait) {
      throw new CharacterValidationError(
        `Trait ${traitId} not found on character`
      );
    }
  }
}

/**
 * Validate action dot advancement
 */
export function validateActionDotAdvancement(
  character: Character,
  action: keyof ActionDots
): void {
  const config = DEFAULT_CONFIG;
  const currentDots = character.actionDots[action];
  const newDots = currentDots + 1;

  if (newDots > config.character.maxActionDotsPerAction) {
    throw new CharacterValidationError(
      `Action '${action}' cannot exceed ${config.character.maxActionDotsPerAction} dots (currently at ${currentDots})`
    );
  }
}
