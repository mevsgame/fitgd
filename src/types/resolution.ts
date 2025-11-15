/**
 * Resolution Types
 *
 * Types for position, effect, and roll resolution.
 */

export type Position = 'controlled' | 'risky' | 'desperate' | 'impossible';
export type Effect = 'limited' | 'standard' | 'great' | 'spectacular';
export type Result = 'failure' | 'partial' | 'success' | 'critical';
export type ActionPushType = 'extra-die' | 'improved-position' | 'improved-effect';

export interface RollResult {
  result: Result;
  highestDie: number;
  dice: number[];
}

export interface ResolveActionParams {
  characterId: string;
  crewId: string;
  action: string; // keyof ActionDots
  position: Position;
  effect: Effect;
  diceResults: number[];
}

export interface ConsequenceResult {
  result: Result;
  momentumGenerated: number;
}

export interface HarmConsequenceParams {
  characterId: string;
  position: Position;
  effect: Effect;
  harmType: string; // e.g., "Physical Harm", "Shaken Morale"
}

export interface HarmConsequenceResult {
  clockId: string;
  segmentsAdded: number;
  isDying: boolean;
}
