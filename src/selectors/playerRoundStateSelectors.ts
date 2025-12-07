/**
 * Player Round State Selectors
 *
 * Memoized selectors for deriving computed values from player round state.
 * Pure Redux logic - no Foundry dependencies.
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { PlayerRoundState, Position, Effect } from '../types/playerRoundState';
import type { EquipmentEffect } from '../types/equipment';
import type { DefensiveSuccessValues } from '../types/resolution';
import { DEFAULT_CONFIG } from '../config/gameConfig';
import {
  calculateConsequenceSeverity,
  calculateMomentumGain,
  calculateSuccessClockProgress,
  improvePosition,
  improveEffect,
} from '../utils/playerRoundRules';
import {
  improvePosition as improvePositionBySteps,
  worsenPosition as worsenPositionBySteps,
  improveEffect as improveEffectBySteps,
  worsenEffect as worsenEffectBySteps,
} from '../utils/positionEffectHelpers';
import { calculateDefensiveSuccessValues } from '../utils/defensiveSuccessRules';

/**
 * Select player state by character ID
 */
export const selectPlayerState = (
  state: RootState,
  characterId: string
): PlayerRoundState | undefined => {
  return state.playerRoundState?.byCharacterId[characterId];
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
    if (!character || !playerState?.selectedApproach) {
      return 0;
    }

    // 1. Start with Primary Approach
    let pool = character.approaches[playerState.selectedApproach] || 0;

    // 2. Add Secondary Source (Synergy OR Equipment)
    // Note: rollMode defaults to 'equipment' if undefined for backward compatibility,
    // or we can default to 'standard'. Let's assume 'equipment' is the default flow if not specified,
    // but strictly checking the mode is safer.
    const mode = playerState.rollMode || 'equipment';

    if (mode === 'synergy' && playerState.secondaryApproach) {
      // Synergy: Add Secondary Approach Rating
      pool += character.approaches[playerState.secondaryApproach] || 0;
    } else if (mode === 'equipment') {
      // Equipment: Apply category-based effects
      if (playerState.equippedForAction && playerState.equippedForAction.length > 0) {
        const equipmentId = playerState.equippedForAction[0]; // First (primary) equipment item
        const item = character.equipment.find((e: any) => e.id === equipmentId);

        if (item && item.equipped) {
          // Get equipment modifiers
          const { diceBonus = 0, dicePenalty = 0 } = item.modifiers || {};
          pool += diceBonus;
          pool -= dicePenalty;
        }
      }
    }

    // 2.5 Add Passive Equipment (if approved by GM)
    if (playerState.approvedPassiveId) {
      const item = character.equipment.find((e: any) => e.id === playerState.approvedPassiveId);
      if (item && item.equipped) {
        const { diceBonus = 0, dicePenalty = 0 } = item.modifiers || {};
        pool += diceBonus;
        pool -= dicePenalty;
      }
    }

    // 3. Add Trait (+1d)
    if (playerState.selectedTraitId) {
      pool += 1;
    }

    // 4. Add Push (+1d)
    if (playerState.pushed && playerState.pushType === 'extra-die') {
      pool += 1;
    }

    // 5. Add Flashback (+1d)
    if (playerState.flashbackApplied) {
      pool += 1;
    }

    return pool;
  }
);

/**
 * Select cumulative equipment effects for a player's selected equipment
 *
 * Computes the total effects from all equipment items selected for the action,
 * combining dice bonuses/penalties, position modifiers, and effect modifiers.
 *
 * Rules (rules_primer.md):
 * - Only equipped items grant bonuses
 * - Equipment bonuses are variable and depend on category
 * - Includes: dice bonus, position modifier, effect modifier
 *
 * @returns EquipmentEffect with cumulative bonuses (all optional fields)
 *
 * @example
 * // Character has 2 equipped items for action, each with +1d
 * selectEquipmentEffects(state, characterId) // → { diceBonus: 2 }
 */
export const selectEquipmentEffects = createSelector(
  [
    (state: RootState, characterId: string) => state.characters?.byId[characterId],
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (character, playerState): EquipmentEffect => {
    if (!character || !playerState) {
      return {};
    }

    // Accumulate effects from all equipped items
    const effects: EquipmentEffect = {
      diceBonus: 0,
      dicePenalty: 0,
      effectBonus: 0,
      effectPenalty: 0,
      positionBonus: 0,
      positionPenalty: 0,
      criticalDiceBonus: 0,
      criticalEffectBonus: 0,
    };

    // Helper to apply item modifiers
    const applyItemModifiers = (itemId: string) => {
      const item = character.equipment.find(e => e.id === itemId);
      if (item && item.equipped) {
        const itemModifiers = item.modifiers || {};
        if (itemModifiers.diceBonus) effects.diceBonus! += itemModifiers.diceBonus;
        if (itemModifiers.dicePenalty) effects.dicePenalty! += itemModifiers.dicePenalty;
        if (itemModifiers.effectBonus) effects.effectBonus! += itemModifiers.effectBonus;
        if (itemModifiers.effectPenalty) effects.effectPenalty! += itemModifiers.effectPenalty;
        if (itemModifiers.positionBonus) effects.positionBonus! += itemModifiers.positionBonus;
        if (itemModifiers.positionPenalty) effects.positionPenalty! += itemModifiers.positionPenalty;
      }
    };

    // 1. Active/Consumable Equipment
    if (playerState.equippedForAction) {
      playerState.equippedForAction.forEach(applyItemModifiers);
    }

    // 2. Passive Equipment (if approved)
    if (playerState.approvedPassiveId) {
      applyItemModifiers(playerState.approvedPassiveId);
    }

    // Return only non-zero effects
    const result: EquipmentEffect = {};
    if (effects.diceBonus && effects.diceBonus > 0) result.diceBonus = effects.diceBonus;
    if (effects.dicePenalty && effects.dicePenalty > 0) result.dicePenalty = effects.dicePenalty;
    if (effects.effectBonus && effects.effectBonus > 0) result.effectBonus = effects.effectBonus;
    if (effects.effectPenalty && effects.effectPenalty > 0) result.effectPenalty = effects.effectPenalty;
    if (effects.positionBonus && effects.positionBonus > 0) result.positionBonus = effects.positionBonus;
    if (effects.positionPenalty && effects.positionPenalty > 0) result.positionPenalty = effects.positionPenalty;
    if (effects.criticalDiceBonus && effects.criticalDiceBonus > 0) result.criticalDiceBonus = effects.criticalDiceBonus;
    if (effects.criticalEffectBonus && effects.criticalEffectBonus > 0) result.criticalEffectBonus = effects.criticalEffectBonus;

    return result;
  }
);

/**
 * Calculate position after applying equipment modifiers
 *
 * Rules (rules_primer.md):
 * - Equipment can improve or worsen position by any number of steps
 * - Position modifiers are shown to player before roll
 *
 * @returns Effective position for roll (with equipment modifiers applied)
 * @example
 * // Base position: risky, equipment has positionBonus: 1
 * selectEquipmentModifiedPosition(state, characterId) // → 'controlled'
 */
export const selectEquipmentModifiedPosition = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => selectEquipmentEffects(state, characterId),
  ],
  (playerState, equipmentEffects): Position => {
    const basePosition = playerState?.position || 'risky';

    // Apply position modifiers from equipment
    let modifiedPosition = basePosition;

    // Apply positive modifiers (improvements)
    if (equipmentEffects.positionBonus && equipmentEffects.positionBonus > 0) {
      modifiedPosition = improvePositionBySteps(modifiedPosition, equipmentEffects.positionBonus);
    }

    // Apply negative modifiers (worsening)
    if (equipmentEffects.positionPenalty && equipmentEffects.positionPenalty > 0) {
      modifiedPosition = worsenPositionBySteps(modifiedPosition, equipmentEffects.positionPenalty);
    }

    return modifiedPosition;
  }
);

/**
 * Calculate effect after applying equipment modifiers
 *
 * Rules (rules_primer.md):
 * - Equipment can improve or worsen effect by any amount
 * - Effect modifiers are shown to player before roll
 *
 * @returns Effective effect for roll (with equipment modifiers applied)
 * @example
 * // Base effect: standard, equipment has effectBonus: 1
 * selectEquipmentModifiedEffect(state, characterId) // → 'great'
 */
export const selectEquipmentModifiedEffect = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => selectEquipmentEffects(state, characterId),
  ],
  (playerState, equipmentEffects): Effect => {
    const baseEffect = playerState?.effect || 'standard';

    // Apply effect modifiers from equipment
    let modifiedEffect = baseEffect;

    // Apply positive modifiers (improvements)
    if (equipmentEffects.effectBonus && equipmentEffects.effectBonus > 0) {
      modifiedEffect = improveEffectBySteps(modifiedEffect, equipmentEffects.effectBonus);
    }

    // Apply negative modifiers (worsening)
    if (equipmentEffects.effectPenalty && equipmentEffects.effectPenalty > 0) {
      modifiedEffect = worsenEffectBySteps(modifiedEffect, equipmentEffects.effectPenalty);
    }

    return modifiedEffect;
  }
);

/**
 * Get consequence severity (clock segments) based on position only
 * Returns base value; effect modifiers are applied separately during harm resolution
 * Uses harm segments from game config
 *
 * @example
 * selectConsequenceSeverity('desperate') // → 4 (base, effect modifiers applied elsewhere)
 */
export const selectConsequenceSeverity = calculateConsequenceSeverity;

/**
 * Get momentum gain for accepting a consequence at a given position
 *
 * @example
 * selectMomentumGain('desperate') // → 4
 */
export const selectMomentumGain = calculateMomentumGain;

/**
 * Calculate success clock progress based on position and effect
 * Formula: Base Progress (from position) + Effect Modifier
 *
 * Examples:
 * - Risky (3) + Great (+1) = 4 segments
 * - Desperate (5) + Spectacular (+2) = 7 segments
 * - Controlled (1) + Limited (-1) = 0 segments (minimum)
 *
 * @example
 * selectSuccessClockProgress('risky', 'great') // → 4
 */
export const selectSuccessClockProgress = calculateSuccessClockProgress;

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
        if (playerState.selectedApproach) {
          actions.push('commit_roll');
        }
        break;

      case 'GM_RESOLVING_CONSEQUENCE':
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

const EMPTY_ARRAY: string[] = [];

/**
 * Get all harm clocks for a character with computed isDying flag
 */
export const selectHarmClocksWithStatus = createSelector(
  [
    (state: RootState, characterId: string) =>
      state.clocks.byTypeAndEntity[`harm:${characterId}`] || EMPTY_ARRAY,
    (state: RootState) => state.clocks.byId,
  ],
  (harmClockIds, clocksById) => {
    return harmClockIds.map((clockId: any) => {
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
    return harmClocks.some((clock: any) => clock.isDying);
  }
);

/* -------------------------------------------- */
/*  Position/Effect Improvement Utilities       */
/* -------------------------------------------- */

/**
 * Re-export utilities from playerRoundRules for backward compatibility
 * See src/utils/playerRoundRules.ts for pure function implementations
 */
export { improvePosition, improveEffect } from '../utils/playerRoundRules';

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
    (state: RootState, characterId: string) => selectEquipmentModifiedPosition(state, characterId),
  ],
  (playerState, equipmentModifiedPosition): Position => {
    // Start from the position ALREADY modified by equipment
    const basePosition = equipmentModifiedPosition;

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
 * Also applies Defensive Success effect reduction for Partial Success outcomes.
 * The improved/reduced effect is only used for this roll's success clock calculations
 * and does NOT modify the base effect set by the GM.
 *
 * @param state - Redux state
 * @param characterId - Character ID
 * @returns Effective effect for roll (with push improvements and defensive success reductions applied)
 *
 * @example
 * // Base effect: standard, pushed for effect
 * selectEffectiveEffect(state, characterId) // → 'great'
 *
 * // Base effect: standard, defensive success chosen (Partial Success)
 * selectEffectiveEffect(state, characterId) // → 'limited'
 *
 * // Base effect: standard, no push, no defensive success
 * selectEffectiveEffect(state, characterId) // → 'standard'
 */
export const selectEffectiveEffect = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => selectEquipmentModifiedEffect(state, characterId),
  ],
  (playerState, equipmentModifiedEffect): Effect => {
    // Start from the effect ALREADY modified by equipment
    let effectiveEffect = equipmentModifiedEffect;

    // Check if Push (Effect) is active - IMPROVES effect
    if (playerState?.pushed && playerState?.pushType === 'improved-effect') {
      effectiveEffect = improveEffect(effectiveEffect);
    }

    // NOTE: Defensive Success effect reduction is handled in consequenceDataResolver
    // during final consequence calculation, not here. This prevents circular dependency
    // where toggling defensive success would reduce effect, making it unavailable.

    return effectiveEffect;
  }
);

/**
 * Select defensive success values for current player state
 *
 * Computes whether defensive success option is available and what the values would be.
 * Only available on partial success with effect ≥ standard.
 */
export const selectDefensiveSuccessValues = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => selectEffectivePosition(state, characterId),
    (state: RootState, characterId: string) => selectEffectiveEffect(state, characterId),
  ],
  (playerState, effectivePosition, effectiveEffect): DefensiveSuccessValues => {
    const outcome = playerState?.outcome || 'failure';

    return calculateDefensiveSuccessValues({
      position: effectivePosition,
      effect: effectiveEffect,
      outcome,
    });
  }
);

/**
 * Export tables for testing and UI
 */
export const CONSEQUENCE_TABLE = DEFAULT_CONFIG.resolution.consequenceSegmentsBase;
export const MOMENTUM_GAIN_TABLE = DEFAULT_CONFIG.resolution.momentumOnConsequence;
