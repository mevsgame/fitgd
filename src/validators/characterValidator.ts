import { DEFAULT_CONFIG } from '../config';
import type { Approaches, Trait, Character } from '../types';

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
 * Calculate total approach dots
 */
export function calculateTotalApproachDots(approaches: Approaches): number {
  return Object.values(approaches).reduce((sum: number, dots: number) => sum + dots, 0);
}

/**
 * Validate starting approaches for character creation
 * Allows allocation from 0 up to 5 total dots (flexible for character creation UI)
 */
export function validateStartingApproaches(approaches: Approaches): void {
  const config = DEFAULT_CONFIG;
  const total = calculateTotalApproachDots(approaches);

  // Allow any allocation from 0 to 5 dots (user can allocate freely during creation)
  if (total > config.character.startingApproachDots) {
    throw new CharacterValidationError(
      `Character cannot have more than ${config.character.startingApproachDots} approach dots at creation (got ${total})`
    );
  }

  // Check that no single approach exceeds max at creation
  const maxAtCreation = config.character.maxDotsAtCreation;
  for (const [approach, dots] of Object.entries(approaches)) {
    if (dots > maxAtCreation) {
      throw new CharacterValidationError(
        `Approach '${approach}' cannot have more than ${maxAtCreation} dots at character creation (got ${dots})`
      );
    }

    if (dots < 0) {
      throw new CharacterValidationError(
        `Approach '${approach}' cannot have negative dots (got ${dots})`
      );
    }
  }
}

/**
 * Validate approach dots value (generic check)
 */
export function validateApproachDots(dots: number): void {
  const config = DEFAULT_CONFIG;

  if (dots < 0) {
    throw new CharacterValidationError(
      `Approach dots cannot be negative (got ${dots})`
    );
  }

  if (dots > config.character.maxDotsPerApproach) {
    throw new CharacterValidationError(
      `Approach dots cannot exceed ${config.character.maxDotsPerApproach} (got ${dots})`
    );
  }
}

/**
 * Validate approach dots value (for specific approach)
 */
export function validateApproach(_approach: keyof Approaches, dots: number): void {
  validateApproachDots(dots);
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
 * Validate trait addition
 */
export function validateTraitAddition(character: Character, trait: Trait): void {
  // Check for duplicate ID
  if (character.traits.some(t => t.id === trait.id)) {
    throw new CharacterValidationError(`Trait with ID ${trait.id} already exists`);
  }

  // Check for duplicate name (optional, but good practice)
  if (character.traits.some(t => t.name === trait.name)) {
    throw new CharacterValidationError(`Trait '${trait.name}' already exists`);
  }

  // Check max count
  if (DEFAULT_CONFIG.character.maxTraitCount !== undefined) {
    if (character.traits.length >= DEFAULT_CONFIG.character.maxTraitCount) {
      throw new CharacterValidationError(
        `Cannot add trait: Max traits (${DEFAULT_CONFIG.character.maxTraitCount}) reached`
      );
    }
  }
}

/**
 * Validate trait removal
 */
export function validateTraitRemoval(character: Character, traitId: string): void {
  const trait = character.traits.find(t => t.id === traitId);
  if (!trait) {
    throw new CharacterValidationError(`Trait ${traitId} not found`);
  }

  // Prevent removing last role/background if required (optional rule, but safe)
  // For now, we allow removal as long as it exists.
}

/**
 * Validate trait update
 */
export function validateTraitUpdate(
  character: Character,
  traitId: string,
  updates: Partial<Trait>
): void {
  const trait = character.traits.find(t => t.id === traitId);
  if (!trait) {
    throw new CharacterValidationError(`Trait ${traitId} not found`);
  }

  if (updates.name && updates.name.trim().length === 0) {
    throw new CharacterValidationError('Trait name cannot be empty');
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
 * Validate approach dot advancement
 */
export function validateApproachAdvancement(
  character: Character,
  approach: keyof Approaches
): void {
  const config = DEFAULT_CONFIG;
  const currentDots = character.approaches[approach];
  const newDots = currentDots + 1;

  if (newDots > config.character.maxDotsPerApproach) {
    throw new CharacterValidationError(
      `Approach '${approach}' cannot exceed ${config.character.maxDotsPerApproach} dots (currently at ${currentDots})`
    );
  }
}
