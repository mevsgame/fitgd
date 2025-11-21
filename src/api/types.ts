/**
 * API Types
 *
 * Type interfaces for the high-level game API
 */

import type { Trait, Approaches, Equipment } from '../types';
import type { Position, Effect, ActionPushType, Result } from '../types/resolution';
import type { ProgressClockCategory } from '../types/clock';

/**
 * Character API Interface
 */
export interface CharacterAPI {
  create(params: { name: string; traits: Trait[]; approaches: Approaches }): string;
  addTrait(characterId: string, trait: Trait): void;
  removeTrait(characterId: string, traitId: string): void;
  updateTraitName(characterId: string, traitId: string, name: string): void;
  disableTrait(characterId: string, traitId: string): void;
  enableTrait(characterId: string, traitId: string): void;
  groupTraits(characterId: string, traitIds: string[], newTrait: Partial<Trait>): Promise<void>;
  setApproach(params: { characterId: string; approach: keyof Approaches; dots: number }): void;
  advanceApproach(params: { characterId: string; approach: keyof Approaches }): void;
  addUnallocatedDots(params: { characterId: string; amount: number }): Promise<void>;
  addEquipment(characterId: string, equipment: Equipment): void;
  removeEquipment(characterId: string, equipmentId: string): void;
  leanIntoTrait(params: {
    characterId: string;
    traitId: string;
    crewId: string;
  }): { traitDisabled: boolean; momentumGained: number; newMomentum: number };
  useRally(params: {
    characterId: string;
    crewId: string;
    traitId: string;
    momentumToSpend: number;
  }): { rallyUsed: boolean; traitReEnabled: boolean; momentumSpent: number; newMomentum: number };
  resetRally(characterId: string): Promise<void>;
  getCharacter(characterId: string): any; // Returns Character state
  getAvailableTraits(characterId: string): Trait[];
  canUseRally(characterId: string): boolean;
}

/**
 * Crew API Interface
 */
export interface CrewAPI {
  create(params: { name: string }): string;
  addCharacter(crewId: string, characterId: string): void;
  removeCharacter(crewId: string, characterId: string): void;
  setMomentum(crewId: string, amount: number): void;
  addMomentum(crewId: string, amount: number): void;
  spendMomentum(crewId: string, amount: number): void;
  resetMomentum(crewId: string): void;
  getCrew(crewId: string): any; // Returns Crew state
  getCurrentMomentum(crewId: string): number;
}

/**
 * Action API Interface
 */
export interface ActionAPI {
  push(params: {
    crewId: string;
    type: ActionPushType;
  }): { momentumSpent: number; newMomentum: number; pushType: string };

  flashback(params: {
    crewId: string;
    characterId: string;
    trait: Omit<Trait, 'id' | 'acquiredAt' | 'category'>;
  }): { traitId: string; momentumSpent: number; newMomentum: number };

  applyConsequences(params: {
    crewId: string;
    characterId: string;
    position: Position;
    effect: Effect;
    result: Result;
    harmType?: string;
  }): {
    momentumGenerated: number;
    newMomentum: number;
    harmApplied?: {
      clockId: string;
      segmentsAdded: number;
      isDying: boolean;
    };
  };
}

/**
 * Harm API Interface
 */
export interface HarmAPI {
  take(params: {
    characterId: string;
    harmType: string;
    position: Position;
  }): {
    clockId: string;
    segmentsAdded: number;
    newSegments: number;
    isDying: boolean;
  };

  recover(params: {
    characterId: string;
    clockId: string;
    segments: number;
  }): {
    segmentsCleared: number;
    newSegments: number;
    clockCleared: boolean;
  };

  convertToScar(params: {
    characterId: string;
    clockId: string;
    trait: Omit<Trait, 'id' | 'acquiredAt' | 'category'>;
  }): { traitId: string; clockDeleted: boolean };
}

/**
 * Clock API Interface
 */
export interface ClockAPI {
  create(params: {
    entityId: string;
    type: ProgressClockCategory;
    subtype?: string;
    name?: string;
    segments: number;
  }): string;

  addSegments(clockId: string, amount: number): void;
  clearSegments(clockId: string, amount: number): void;
  delete(clockId: string): void;
  getClock(clockId: string): any; // Returns Clock state
  getClocksForEntity(entityId: string): any[];
}

/**
 * Resource API Interface
 */
export interface ResourceAPI {
  useConsumable(params: {
    crewId: string;
    characterId: string;
    consumableType: string;
    depletionRoll: number;
  }): any; // Returns UseConsumableResult
  useStim(params: {
    crewId: string;
    characterId: string;
    addictionRoll: number;
  }): any; // Returns UseStimResult
}

/**
 * Query API Interface
 */
export interface QueryAPI {
  canUseRally(params: { characterId: string; crewId: string }): boolean;
  canUseStim(crewId: string): boolean;
  canUseConsumable(params: { crewId: string; consumableType: string }): boolean;
  isDying(characterId: string): boolean;
  getMomentum(crewId: string): number;
  getAvailableTraits(characterId: string): Trait[];
  getHarmClocks(characterId: string): any[];
  getProgressClocks(entityId: string): any[];
  getAddictionClock(crewId: string): any;
  getConsumableClocks(crewId: string): any[];
}

/**
 * Game API Interface (Main Entry Point)
 */
export interface GameAPI {
  character: CharacterAPI;
  crews: CrewAPI;
  actions: ActionAPI;
  harm: HarmAPI;
  resource: ResourceAPI;
  clocks: ClockAPI;
  query: QueryAPI;
}
