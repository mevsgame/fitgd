/**
 * Factory for creating and managing Player Action Widget handlers
 *
 * Implements lazy initialization: handlers are created only when first requested,
 * reducing overhead and improving testability.
 *
 * All handlers share the same characterId/crewId context for the action.
 */

import type { Character } from '../../../src/types/character';
import { ConsequenceResolutionHandler } from '../handlers/consequenceResolutionHandler';
import { StimsHandler } from '../handlers/stimsHandler';
import { DiceRollingHandler } from '../handlers/diceRollingHandler';
import { TraitHandler } from '../handlers/traitHandler';
import { RallyHandler } from '../handlers/rallyHandler';
import { TraitImprovementHandler } from '../handlers/traitImprovementHandler';
import { ConsequenceDataResolver } from '../handlers/consequenceDataResolver';
import { LeanIntoTraitHandler } from '../handlers/leanIntoTraitHandler';
import { UseTraitHandler } from '../handlers/useTraitHandler';
import { PushHandler } from '../handlers/pushHandler';
import { ConsequenceApplicationHandler } from '../handlers/consequenceApplicationHandler';
import { StimsWorkflowHandler } from '../handlers/stimsWorkflowHandler';

/**
 * Manager for lazily initializing Player Action handlers
 *
 * Benefits:
 * - Handlers created only when needed (not on every render)
 * - Consistent initialization context across all handlers
 * - Easy to mock for testing
 * - Centralized dependency management
 */
export class PlayerActionHandlerFactory {
  private characterId: string;
  private crewId: string | null;
  private character: Character | null;

  // Lazy-initialized handler cache
  private handlers: Map<string, any> = new Map();

  constructor(
    characterId: string,
    crewId: string | null,
    character: Character | null = null
  ) {
    this.characterId = characterId;
    this.crewId = crewId;
    this.character = character;
  }

  /**
   * Update character reference (called from getData when character loads)
   * Used by handlers that need character data
   */
  setCharacter(character: Character | null): void {
    this.character = character;
    // Invalidate handlers that use character data
    this.handlers.delete('traitImprovement');
    this.handlers.delete('leanIntoTrait');
  }

  /**
   * Get or create ConsequenceResolutionHandler
   * Lazy-initialized on first call
   */
  getConsequenceHandler(): ConsequenceResolutionHandler {
    if (!this.handlers.has('consequence')) {
      this.handlers.set('consequence', new ConsequenceResolutionHandler({
        characterId: this.characterId,
        crewId: this.crewId,
        playerState: null, // Will be set by widget
      }));
    }
    return this.handlers.get('consequence')!;
  }

  /**
   * Get or create StimsHandler
   */
  getStimsHandler(): StimsHandler {
    if (!this.handlers.has('stims')) {
      this.handlers.set('stims', new StimsHandler({
        characterId: this.characterId,
        crewId: this.crewId,
        characterName: this.character?.name,
      }));
    }
    return this.handlers.get('stims')!;
  }

  /**
   * Get or create DiceRollingHandler
   */
  getDiceRollingHandler(): DiceRollingHandler {
    if (!this.handlers.has('diceRolling')) {
      this.handlers.set('diceRolling', new DiceRollingHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('diceRolling')!;
  }

  /**
   * Get or create TraitHandler
   */
  getTraitHandler(): TraitHandler {
    if (!this.handlers.has('trait')) {
      this.handlers.set('trait', new TraitHandler({
        characterId: this.characterId,
        characterName: this.character?.name,
      }));
    }
    return this.handlers.get('trait')!;
  }

  /**
   * Get or create RallyHandler
   */
  getRallyHandler(): RallyHandler {
    if (!this.handlers.has('rally')) {
      this.handlers.set('rally', new RallyHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('rally')!;
  }

  /**
   * Get or create TraitImprovementHandler
   */
  getTraitImprovementHandler(): TraitImprovementHandler {
    if (!this.handlers.has('traitImprovement')) {
      this.handlers.set('traitImprovement', new TraitImprovementHandler({
        character: this.character,
      }));
    }
    return this.handlers.get('traitImprovement')!;
  }

  /**
   * Get or create ConsequenceDataResolver
   */
  getConsequenceDataResolver(): ConsequenceDataResolver {
    if (!this.handlers.has('consequenceDataResolver')) {
      this.handlers.set('consequenceDataResolver', new ConsequenceDataResolver({
        characterId: this.characterId,
      }));
    }
    return this.handlers.get('consequenceDataResolver')!;
  }

  /**
   * Get or create LeanIntoTraitHandler
   */
  getLeanIntoTraitHandler(): LeanIntoTraitHandler {
    if (!this.handlers.has('leanIntoTrait')) {
      this.handlers.set('leanIntoTrait', new LeanIntoTraitHandler({
        character: this.character,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('leanIntoTrait')!;
  }

  /**
   * Get or create UseTraitHandler
   */
  getUseTraitHandler(): UseTraitHandler {
    if (!this.handlers.has('useTrait')) {
      this.handlers.set('useTrait', new UseTraitHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('useTrait')!;
  }

  /**
   * Get or create PushHandler
   */
  getPushHandler(): PushHandler {
    if (!this.handlers.has('push')) {
      this.handlers.set('push', new PushHandler({
        characterId: this.characterId,
      }));
    }
    return this.handlers.get('push')!;
  }

  /**
   * Get or create ConsequenceApplicationHandler
   */
  getConsequenceApplicationHandler(): ConsequenceApplicationHandler {
    if (!this.handlers.has('consequenceApplication')) {
      this.handlers.set('consequenceApplication', new ConsequenceApplicationHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('consequenceApplication')!;
  }

  /**
   * Get or create StimsWorkflowHandler
   */
  getStimsWorkflowHandler(): StimsWorkflowHandler {
    if (!this.handlers.has('stimsWorkflow')) {
      this.handlers.set('stimsWorkflow', new StimsWorkflowHandler({
        characterId: this.characterId,
        characterName: this.character?.name,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('stimsWorkflow')!;
  }

  /**
   * Clear all cached handlers (call on widget close or character change)
   */
  reset(): void {
    this.handlers.clear();
  }
}
