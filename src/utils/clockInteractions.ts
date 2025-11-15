/**
 * Clock Interaction Utilities
 *
 * Pure functions for calculating clock interactions based on roll context.
 * GM selects ONE clock to affect based on suggestions.
 */

import type { Clock } from '@/types/clock';
import type { Position, Effect } from '@/types/resolution';
import type {
  RollOutcome,
  InteractionDirection,
  InteractionContext,
  ClockWithSuggestion
} from '@/types/clockInteraction';

/**
 * Calculate segments for CONSEQUENCE clocks (harm, threat)
 *
 * Based on Position ONLY (effect doesn't apply to consequences).
 * Used when advancing harm/threat on failure/partial.
 *
 * @param position - Position level
 * @returns Number of segments to add
 */
export function calculateConsequenceSegments(position: Position): number {
  const table: Record<Position, number> = {
    controlled: 1,
    risky: 3,
    desperate: 5,
    impossible: 6
  };
  return table[position];
}

/**
 * Calculate segments for SUCCESS clocks (progress)
 *
 * Based on Position + Effect.
 * Used when advancing progress on success/critical.
 *
 * @param position - Position level
 * @param effect - Effect level
 * @returns Number of segments to add
 */
export function calculateProgressSegments(position: Position, effect: Effect): number {
  const baseSegments: Record<Position, number> = {
    controlled: 1,
    risky: 3,
    desperate: 5,
    impossible: 6
  };

  const effectModifier: Record<Effect, number> = {
    limited: -1,
    standard: 0,
    great: 1,
    spectacular: 2
  };

  const base = baseSegments[position];
  const modifier = effectModifier[effect];

  return Math.max(0, base + modifier);
}

/**
 * Calculate segments for REDUCING clocks
 *
 * Based on Effect (success quality matters when reducing harm/threat).
 * Used for Rally, medical treatment, defusing threats, etc.
 *
 * @param effect - Effect level
 * @returns Number of segments to remove
 */
export function calculateReductionSegments(effect: Effect): number {
  const table: Record<Effect, number> = {
    limited: 1,
    standard: 2,
    great: 4,
    spectacular: 6
  };
  return table[effect];
}

/**
 * Suggest clock interactions based on context
 *
 * Returns a list of clocks with suggested direction/amount.
 * GM selects ONE from the list (or none).
 *
 * @param context - Roll context
 * @param availableClocks - All clocks available for interaction
 * @returns List of clocks with suggestions
 */
export function suggestClockInteractions(
  context: InteractionContext,
  availableClocks: Clock[]
): ClockWithSuggestion[] {
  const suggestions: ClockWithSuggestion[] = [];

  // ===== FAILURE/PARTIAL: Suggest advancing consequence clocks =====
  if (context.outcome === 'failure' || context.outcome === 'partial') {
    // Suggest harm clocks (character-level consequences)
    const harmClocks = availableClocks.filter(c =>
      c.category === 'harm' &&
      c.ownerId === context.characterId
    );

    for (const clock of harmClocks) {
      suggestions.push({
        clock,
        suggestedDirection: 'advance',
        suggestedAmount: calculateConsequenceSegments(context.position),
        reasoning: `Character takes harm from ${context.outcome} at ${context.position} position`
      });
    }

    // Suggest threat clocks (crew/scene-level consequences)
    const threatClocks = availableClocks.filter(c =>
      c.category === 'threat' &&
      (c.ownerId === context.crewId || c.ownerType === 'scene')
    );

    for (const clock of threatClocks) {
      suggestions.push({
        clock,
        suggestedDirection: 'advance',
        suggestedAmount: calculateConsequenceSegments(context.position),
        reasoning: `Threat escalates from ${context.outcome}`
      });
    }
  }

  // ===== SUCCESS/CRITICAL: Context-dependent suggestions =====
  if (context.outcome === 'success' || context.outcome === 'critical') {
    // CONTEXT: Medical/Rally actions → suggest reducing harm
    if (context.actionType === 'medical' || context.actionType === 'rally') {
      const harmClocks = availableClocks.filter(c =>
        c.category === 'harm' &&
        c.ownerId === context.characterId
      );

      for (const clock of harmClocks) {
        suggestions.push({
          clock,
          suggestedDirection: 'reduce',
          suggestedAmount: calculateReductionSegments(context.effect),
          reasoning: `${context.actionType} action reduces harm`
        });
      }
    }

    // CONTEXT: Defuse/mitigate actions → suggest reducing threat
    else if (context.actionType === 'defuse' || context.actionType === 'mitigate') {
      const threatClocks = availableClocks.filter(c =>
        c.category === 'threat' &&
        (c.ownerId === context.crewId || c.ownerType === 'scene')
      );

      for (const clock of threatClocks) {
        suggestions.push({
          clock,
          suggestedDirection: 'reduce',
          suggestedAmount: calculateReductionSegments(context.effect),
          reasoning: `${context.actionType} action reduces threat`
        });
      }
    }

    // DEFAULT: Suggest advancing progress clocks
    else {
      const progressClocks = availableClocks.filter(c =>
        c.category === 'progress' &&
        (c.ownerId === context.characterId || c.ownerId === context.crewId)
      );

      for (const clock of progressClocks) {
        suggestions.push({
          clock,
          suggestedDirection: 'advance',
          suggestedAmount: calculateProgressSegments(context.position, context.effect),
          reasoning: `Progress from ${context.outcome} at ${context.position}/${context.effect}`
        });
      }
    }
  }

  return suggestions;
}

/**
 * Calculate segment amount based on context and direction
 *
 * Unified function for calculating amounts in any context.
 *
 * @param outcome - Roll outcome
 * @param position - Position level
 * @param effect - Effect level
 * @param direction - Interaction direction
 * @returns Number of segments
 */
export function calculateSegmentAmount(
  outcome: RollOutcome,
  position: Position,
  effect: Effect,
  direction: InteractionDirection
): number {
  if (direction === 'advance') {
    // Advancing consequence clocks (failure/partial)
    if (outcome === 'failure' || outcome === 'partial') {
      return calculateConsequenceSegments(position);
    }

    // Advancing success clocks (success/critical)
    if (outcome === 'success' || outcome === 'critical') {
      return calculateProgressSegments(position, effect);
    }

    return 0;
  }

  if (direction === 'reduce') {
    // Reduction based on effect (success quality matters)
    if (outcome === 'success' || outcome === 'critical') {
      return calculateReductionSegments(effect);
    }

    return 0;
  }

  return 0;
}

/**
 * Get interaction pattern for roll outcome
 *
 * Determines typical direction based on outcome.
 *
 * @param outcome - Roll outcome
 * @returns Typical interaction direction
 */
export function getTypicalDirection(outcome: RollOutcome): InteractionDirection | null {
  if (outcome === 'failure' || outcome === 'partial') {
    return 'advance'; // Consequences advance
  }

  if (outcome === 'success' || outcome === 'critical') {
    return 'advance'; // Progress advances (or reduce consequences with specific actions)
  }

  return null;
}
