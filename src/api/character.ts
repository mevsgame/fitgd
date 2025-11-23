import type { Character, Trait, Approaches, Equipment } from '../types';

/**
 * Character API
 *
 * High-level API for character operations.
 * Abstracts Redux implementation details.
 */
export interface CharacterAPI {
  // Creation
  create(params: {
    name: string;
    traits: Trait[];
    approaches: Approaches;
  }): string;

  // Traits
  addTrait(characterId: string, trait: Trait): void;
  removeTrait(characterId: string, traitId: string): void;
  updateTraitName(characterId: string, traitId: string, name: string): void;
  disableTrait(characterId: string, traitId: string): void;
  enableTrait(characterId: string, traitId: string): void;
  groupTraits(characterId: string, traitIds: [string, string, string], newTrait: Trait): void;

  // Approaches
  setApproach(params: { characterId: string; approach: keyof Approaches; dots: number }): void;
  advanceApproach(params: { characterId: string; approach: keyof Approaches }): void;
  addUnallocatedDots(params: { characterId: string; amount: number }): void;

  // Equipment
  addEquipment(characterId: string, equipment: Equipment): void;
  removeEquipment(characterId: string, equipmentId: string): void;

  // Rally
  useRally(characterId: string): void;
  resetRally(characterId: string): void;

  // Queries
  getCharacter(characterId: string): Character | null;
  getAvailableTraits(characterId: string): Trait[];
  canUseRally(characterId: string): boolean;
}
