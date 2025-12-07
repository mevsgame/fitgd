import type { Clock } from '../types';

/**
 * Clock API
 *
 * High-level API for clock operations (harm, addiction).
 * Abstract entity with type-specific behavior.
 */
export interface ClockAPI {
  // Creation
  createHarmClock(characterId: string, subtype: string): string;
  createAddictionClock(crewId: string): string;

  // Manipulation
  addSegments(clockId: string, amount: number): void;
  clearSegments(clockId: string, amount: number): void;
  deleteClock(clockId: string): void;

  // Queries
  getClock(clockId: string): Clock | null;
  getHarmClocks(characterId: string): Clock[];
  isClockFilled(clockId: string): boolean;
}
