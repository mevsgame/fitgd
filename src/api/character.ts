import type { Character, Trait, ActionDots, Equipment } from '../types';

/**
 * Character API
 *
 * High-level API for character operations.
 * Abstracts Redux implementation details.
 */
export interface CharacterAPI {
  // Creation
  createCharacter(name: string, traits: Trait[], actionDots: ActionDots): string;

  // Traits
  addTrait(characterId: string, trait: Trait): void;
  disableTrait(characterId: string, traitId: string): void;
  enableTrait(characterId: string, traitId: string): void;
  groupTraits(characterId: string, traitIds: [string, string, string], newTrait: Trait): void;

  // Action Dots
  setActionDots(characterId: string, action: keyof ActionDots, dots: number): void;

  // Equipment
  addEquipment(characterId: string, equipment: Equipment): void;
  removeEquipment(characterId: string, equipmentId: string): void;

  // Rally
  useRally(characterId: string): void;
  resetRally(characterId: string): void;

  // Queries
  getCharacter(characterId: string): Character | null;
  getCharacterTraits(characterId: string): Trait[];
  canUseRally(characterId: string): boolean;
}
