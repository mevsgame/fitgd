/**
 * Player Round State Selectors
 *
 * Memoized selectors for deriving computed values from player round state.
 * Pure Redux logic - no Foundry dependencies.
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { PlayerRoundState, Position, Effect } from '../types/playerRoundState';

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
 * Returns harm segments based on position and effect
 *
 * Based on Blades in the Dark / Forged in the Dark:
 * - Position (controlled/risky/desperate) determines base harm
 * - Effect (limited/standard/great) modifies severity
 */
export const CONSEQUENCE_TABLE: Record<Position, Record<Effect, number>> = {
  controlled: {
    limited: 0,   // No harm
    standard: 1,  // 1 segment
    great: 2,     // 2 segments
  },
  risky: {
    limited: 1,   // 1 segment
    standard: 2,  // 2 segments
    great: 3,     // 3 segments
  },
  desperate: {
    limited: 2,   // 2 segments
    standard: 4,  // 4 segments (dying on single clock)
    great: 6,     // 6 segments (instant dying)
  },
};

/**
 * Get harm segments for a position/effect combination
 */
export const selectConsequenceSeverity = (
  position: Position,
  effect: Effect
): number => {
  return CONSEQUENCE_TABLE[position]?.[effect] ?? 0;
};

/**
 * Momentum Gain Table
 * Based on position when accepting consequence
 */
export const MOMENTUM_GAIN_TABLE: Record<Position, number> = {
  controlled: 1,
  risky: 2,
  desperate: 4,
};

/**
 * Get momentum gain for accepting a consequence at a given position
 */
export const selectMomentumGain = (position: Position): number => {
  return MOMENTUM_GAIN_TABLE[position] ?? 0;
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

      case 'ROLL_CONFIRM':
        actions.push('commit_roll', 'apply_flashback');
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
