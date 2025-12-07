import type { Crew } from '../types';

/**
 * Crew API
 *
 * High-level API for crew and momentum operations.
 * Validates stim/consumable use against clock states.
 */
export interface CrewAPI {
  // Creation
  createCrew(name: string): string;

  // Members
  addCharacter(crewId: string, characterId: string): void;
  removeCharacter(crewId: string, characterId: string): void;

  // Momentum
  setMomentum(crewId: string, amount: number): void;
  addMomentum(crewId: string, amount: number): void;
  spendMomentum(crewId: string, amount: number): void;
  resetMomentum(crewId: string): void;

  // Resources (validated against clocks)
  canUseStim(crewId: string): boolean;
  useStim(crewId: string, characterId: string): void;


  // Queries
  getCrew(crewId: string): Crew | null;
  getCurrentMomentum(crewId: string): number;
}
