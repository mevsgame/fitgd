/**
 * Player Round State Selectors
 *
 * Memoized selectors for deriving computed values from player round state.
 * Pure Redux logic - no Foundry dependencies.
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { PlayerRoundState, Position, Effect } from '../types/playerRoundState';
import { DEFAULT_CONFIG } from '../config/gameConfig';

/**
 * Select player state by character ID
 */
export const selectPlayerState = (
  state: RootState,
  characterId: string
): PlayerRoundState | undefined => {
  return state.playerRoundState.byCharacterId[characterId];
};

/**
 * Select active player ID
 */
export const selectActivePlayerId = (state: RootState): string | null => {
  return state.playerRoundState.activeCharacterId;
};

/**
 * Check if character is the active player
 */
export const selectIsActivePlayer = (
  state: RootState,
  characterId: string
): boolean => {
  return state.playerRoundState.activeCharacterId === characterId;
};

/**
 * Calculate dice pool for a player's action
 *
 * Base: action dots
 * +1d: using relevant trait (selectedTraitId)
 * +1d: using relevant equipment (equippedForAction)
 * +1d: pushed (costs 1 Momentum)
 * +1d: flashback applied
 */
export const selectDicePool = createSelector(
  [
    (state: RootState, characterId: string) => state.characters.byId[characterId],
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (character, playerState) => {
    if (!character || !playerState?.selectedAction) {
      return 0;
    }

    // Base: action dots for selected action
    let pool = character.actionDots[playerState.selectedAction] || 0;

    // +1d if using a trait
    if (playerState.selectedTraitId) {
      pool += 1;
    }

    // +1d if using equipment (any equipment counts)
    if (playerState.equippedForAction && playerState.equippedForAction.length > 0) {
      pool += 1;
    }

    // +1d if pushed
    if (playerState.pushed) {
      pool += 1;
    }

    // +1d if flashback applied
    if (playerState.flashbackApplied) {
      pool += 1;
    }

    return pool;
  }
);

/**
 * Consequence Severity Table
 * Returns clock segments based on POSITION ONLY (not effect)
 *
 * IMPORTANT: Effect modifiers only apply to SUCCESS clocks (progress on success).
 * For consequences (harm/crew clocks), only position matters:
 * - Controlled: 1 segment
 * - Risky: 3 segments
 * - Desperate: 5 segments
 * - Impossible: 6 segments (fills harm clock completely, instant dying)
 *
 * This is a house rule deviation from Blades in the Dark.
 */
/**
 * Get consequence severity (clock segments) based on position only
 * Effect does NOT apply to consequences - only to success clocks
 * Uses harm segments from game config
 */
export const selectConsequenceSeverity = (
  position: Position
): number => {
  return DEFAULT_CONFIG.resolution.harmSegments[position] ?? 0;
};

/**
 * Momentum Gain Table
 * Based on position when accepting consequence
 */
export const MOMENTUM_GAIN_TABLE: Record<Position, number> = {
  controlled: 1,
  risky: 2,
  desperate: 4,
  impossible: 6,
};

/**
 * Get momentum gain for accepting a consequence at a given position
 */
export const selectMomentumGain = (position: Position): number => {
  return MOMENTUM_GAIN_TABLE[position] ?? 0;
};

/**
 * Success Clock Base Progress Table
 * Returns base segments based on POSITION only
 */
export const SUCCESS_CLOCK_BASE_TABLE: Record<Position, number> = {
  controlled: 1,
  risky: 3,
  desperate: 5,
  impossible: 6,
};

/**
 * Effect Modifier Table
 * Modifies success clock progress based on EFFECT level
 */
export const EFFECT_MODIFIER_TABLE: Record<Effect, number> = {
  limited: -1,
  standard: 0,
  great: 1,
  spectacular: 2,
};

/**
 * Calculate success clock progress based on position and effect
 * Formula: Base Progress (from position) + Effect Modifier
 *
 * Examples:
 * - Risky (3) + Great (+1) = 4 segments
 * - Desperate (5) + Spectacular (+2) = 7 segments
 * - Controlled (1) + Limited (-1) = 0 segments (minimum)
 */
export const selectSuccessClockProgress = (
  position: Position,
  effect: Effect
): number => {
  const baseProgress = SUCCESS_CLOCK_BASE_TABLE[position] ?? 0;
  const effectModifier = EFFECT_MODIFIER_TABLE[effect] ?? 0;
  return Math.max(0, baseProgress + effectModifier);
};

/**
 * Calculate momentum cost for an action
 */
export const selectMomentumCost = (playerState: PlayerRoundState | undefined): number => {
  if (!playerState) return 0;

  let cost = 0;

  // Push yourself: 1 Momentum
  if (playerState.pushed) {
    cost += 1;
  }

  // Trait transaction: 1 Momentum for position improvement
  if (playerState.traitTransaction) {
    cost += playerState.traitTransaction.momentumCost;
  }

  // Legacy flashback: varies by scope (for now, assume 1)
  // In future, this could be passed as a parameter
  if (playerState.flashbackApplied) {
    cost += 1;
  }

  return cost;
};

/**
 * Available Actions
 * What actions can the player take based on their current state?
 */
export type AvailableAction =
  | 'select_action'
  | 'toggle_push'
  | 'toggle_trait'
  | 'toggle_equipment'
  | 'apply_flashback'
  | 'commit_roll'
  | 'accept_consequence'
  | 'use_stims'
  | 'end_turn';

export const selectAvailableActions = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => state.characters.byId[characterId],
  ],
  (playerState, character): AvailableAction[] => {
    if (!playerState || !character) {
      return [];
    }

    const actions: AvailableAction[] = [];

    switch (playerState.state) {
      case 'DECISION_PHASE':
        actions.push('select_action', 'toggle_push', 'toggle_trait', 'toggle_equipment');
        if (playerState.selectedAction) {
          actions.push('commit_roll');
        }
        break;

      case 'CONSEQUENCE_CHOICE':
        actions.push('accept_consequence', 'use_stims');
        break;

      case 'SUCCESS_COMPLETE':
      case 'TURN_COMPLETE':
        actions.push('end_turn');
        break;

      // Other states have no user actions available
      default:
        break;
    }

    return actions;
  }
);

/**
 * Check if player can use rally
 * Requires:
 * - Character has rallyAvailable = true
 * - Crew Momentum is 0-3
 */
export const selectCanUseRally = createSelector(
  [
    (state: RootState, characterId: string) => state.characters.byId[characterId],
    (state: RootState, _characterId: string, crewId: string) => state.crews.byId[crewId],
  ],
  (character, crew) => {
    if (!character || !crew) {
      return false;
    }

    return (
      character.rallyAvailable === true &&
      crew.currentMomentum >= 0 &&
      crew.currentMomentum <= 3
    );
  }
);

/**
 * Check if crew can use stims
 * Requires addiction clock not filled
 */
export const selectCanUseStims = createSelector(
  [
    (state: RootState, crewId: string) => state.clocks.byTypeAndEntity[`addiction:${crewId}`],
    (state: RootState) => state.clocks.byId,
  ],
  (addictionClockIds, clocksById) => {
    if (!addictionClockIds || addictionClockIds.length === 0) {
      return true; // No addiction clock means stims available
    }

    const addictionClockId = addictionClockIds[0];
    const addictionClock = clocksById[addictionClockId];

    if (!addictionClock) {
      return true;
    }

    // Stims locked if addiction clock is filled
    return addictionClock.segments < addictionClock.maxSegments;
  }
);

/**
 * Get all harm clocks for a character with computed isDying flag
 */
export const selectHarmClocksWithStatus = createSelector(
  [
    (state: RootState, characterId: string) =>
      state.clocks.byTypeAndEntity[`harm:${characterId}`] || [],
    (state: RootState) => state.clocks.byId,
  ],
  (harmClockIds, clocksById) => {
    return harmClockIds.map((clockId) => {
      const clock = clocksById[clockId];
      return {
        ...clock,
        isDying: clock.segments >= clock.maxSegments,
      };
    });
  }
);

/**
 * Check if character is dying (any harm clock filled)
 */
export const selectIsDying = createSelector(
  [selectHarmClocksWithStatus],
  (harmClocks) => {
    return harmClocks.some((clock) => clock.isDying);
  }
);

/* -------------------------------------------- */
/*  Position/Effect Improvement Utilities       */
/* -------------------------------------------- */

/**
 * Improve position by one step (pure function)
 *
 * Position ladder: Impossible → Desperate → Risky → Controlled
 *
 * @param position - Current position
 * @returns Improved position (one step better)
 *
 * @example
 * improvePosition('desperate') // → 'risky'
 * improvePosition('controlled') // → 'controlled' (already at best)
 */
export function improvePosition(position: Position): Position {
  switch (position) {
    case 'impossible':
      return 'desperate';
    case 'desperate':
      return 'risky';
    case 'risky':
      return 'controlled';
    case 'controlled':
      return 'controlled'; // Already at best
    default:
      return position;
  }
}

/**
 * Improve effect by one level (pure function)
 *
 * Effect ladder: Limited → Standard → Great → Spectacular
 *
 * @param effect - Current effect
 * @returns Improved effect (one level better)
 *
 * @example
 * improveEffect('standard') // → 'great'
 * improveEffect('spectacular') // → 'spectacular' (already at best)
 */
export function improveEffect(effect: Effect): Effect {
  switch (effect) {
    case 'limited':
      return 'standard';
    case 'standard':
      return 'great';
    case 'great':
      return 'spectacular';
    case 'spectacular':
      return 'spectacular'; // Already at best
    default:
      return effect;
  }
}

/**
 * Calculate effective position for roll (ephemeral - does NOT mutate state)
 *
 * Applies trait transaction position improvement if applicable.
 * The improved position is only used for this roll's calculations and does NOT
 * modify the base position set by the GM.
 *
 * @param state - Redux state
 * @param characterId - Character ID
 * @returns Effective position for roll (with trait transaction improvements applied)
 *
 * @example
 * // Base position: desperate, trait transaction improves position
 * selectEffectivePosition(state, characterId) // → 'risky'
 *
 * // Base position: risky, no trait transaction
 * selectEffectivePosition(state, characterId) // → 'risky'
 */
export const selectEffectivePosition = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (playerState): Position => {
    const basePosition = playerState?.position || 'risky';

    // Check if trait transaction improves position
    if (playerState?.traitTransaction?.positionImprovement) {
      return improvePosition(basePosition);
    }

    return basePosition;
  }
);

/**
 * Calculate effective effect for roll (ephemeral - does NOT mutate state)
 *
 * Applies push effect improvement if applicable.
 * The improved effect is only used for this roll's success clock calculations
 * and does NOT modify the base effect set by the GM.
 *
 * @param state - Redux state
 * @param characterId - Character ID
 * @returns Effective effect for roll (with push improvements applied)
 *
 * @example
 * // Base effect: standard, pushed for effect
 * selectEffectiveEffect(state, characterId) // → 'great'
 *
 * // Base effect: standard, no push
 * selectEffectiveEffect(state, characterId) // → 'standard'
 */
export const selectEffectiveEffect = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (playerState): Effect => {
    const baseEffect = playerState?.effect || 'standard';

    // Check if Push (Effect) is active
    if (playerState?.pushed && playerState?.pushType === 'improved-effect') {
      return improveEffect(baseEffect);
    }

    return baseEffect;
  }
);
