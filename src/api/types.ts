/**
 * API Type Definitions
 *
 * Type interfaces for the high-level game API
 */

import type { Trait, ActionDots, Equipment } from '../types';
import type { Position, Effect, ActionPushType, Result } from '../types/resolution';
import type { ProgressClockCategory } from '../types/clock';

/**
 * Character API - Character lifecycle and actions
 */
export interface CharacterAPI {
  create(params: {
    name: string;
    traits: Omit<Trait, 'id' | 'acquiredAt'>[];
    actionDots: ActionDots;
  }): string;

  leanIntoTrait(params: {
    characterId: string;
    traitId: string;
    crewId: string;
  }): { traitDisabled: boolean; momentumGained: number; newMomentum: number };

  useRally(params: {
    characterId: string;
    crewId: string;
    traitId?: string;
    momentumToSpend: number;
  }): {
    rallyUsed: boolean;
    traitReEnabled: boolean;
    momentumSpent: number;
    newMomentum: number;
  };

  advanceActionDots(params: {
    characterId: string;
    action: keyof ActionDots;
  }): number;

  groupTraits(params: {
    characterId: string;
    traitIds: [string, string, string];
    newTrait: Omit<Trait, 'id' | 'acquiredAt'>;
  }): string;

  addEquipment(params: {
    characterId: string;
    equipment: Omit<Equipment, 'id'>;
  }): string;

  removeEquipment(params: {
    characterId: string;
    equipmentId: string;
  }): void;

  getCharacter(characterId: string): any;
  getAvailableTraits(characterId: string): Trait[];
}

/**
 * Action API - Making rolls and spending Momentum
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
 * Resource API - Consumables and stims
 */
export interface ResourceAPI {
  useConsumable(params: {
    crewId: string;
    characterId: string;
    consumableType: string;
    depletionRoll: number;
  }): {
    clockId: string;
    segmentsAdded: number;
    newSegments: number;
    isFrozen: boolean;
    tierDowngraded: boolean;
  };

  useStim(params: {
    crewId: string;
    characterId: string;
    addictionRoll: number;
  }): {
    clockId: string;
    segmentsAdded: number;
    newSegments: number;
    isAddicted: boolean;
    addictTraitId?: string;
  };
}

/**
 * Crew API - Crew management and Momentum
 */
export interface CrewAPI {
  create(name: string): string;
  addCharacter(params: { crewId: string; characterId: string }): void;
  removeCharacter(params: { crewId: string; characterId: string }): void;
  setMomentum(params: { crewId: string; amount: number }): number;
  addMomentum(params: { crewId: string; amount: number }): number;
  performReset(crewId: string): {
    newMomentum: number;
    addictionReduced: number | null;
    charactersReset: {
      characterId: string;
      rallyReset: boolean;
      traitsReEnabled: number;
    }[];
  };
  getCrew(crewId: string): any;
  getMomentum(crewId: string): number;
}

/**
 * Harm API - Taking and recovering from harm
 */
export interface HarmAPI {
  take(params: {
    characterId: string;
    harmType: string;
    position: Position;
    effect: Effect;
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
 * Clock API - Managing progress/threat clocks
 */
export interface ClockAPI {
  createProgress(params: {
    entityId: string;
    name: string;
    segments: 4 | 6 | 8 | 12;
    category?: ProgressClockCategory;
    isCountdown?: boolean;
    description?: string;
  }): string;

  advance(params: {
    clockId: string;
    segments: number;
  }): {
    newSegments: number;
    isFilled: boolean;
  };

  reduce(params: {
    clockId: string;
    segments: number;
  }): {
    newSegments: number;
    isCleared: boolean;
  };

  delete(clockId: string): void;
}

/**
 * Query API - Game state queries
 */
export interface QueryAPI {
  canUseRally(params: { characterId: string; crewId: string }): boolean;
  canUseStim(crewId: string): boolean;
  canUseConsumable(params: { crewId: string; consumableType: string }): boolean;
  isDying(characterId: string): boolean;
  getMomentum(crewId: string): number;
  getAvailableTraits(characterId: string): Trait[];
  getHarmClocks(characterId: string): Array<{
    id: string;
    harmType: string;
    segments: number;
    maxSegments: number;
  }>;
  getProgressClocks(entityId: string): Array<{
    id: string;
    name: string;
    segments: number;
    maxSegments: number;
    category?: string;
    isCountdown?: boolean;
  }>;
}
