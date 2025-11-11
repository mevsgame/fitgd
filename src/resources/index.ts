import type { Store } from '@reduxjs/toolkit';
import type { Trait } from '../types';
import { addTrait, enableTrait, resetRally } from '../slices/characterSlice';
import { resetMomentum } from '../slices/crewSlice';
import {
  createClock,
  addSegments,
  clearSegments,
  deleteClock,
} from '../slices/clockSlice';
import {
  selectConsumableClockBySubtype,
  selectAddictionClockByCrew,
  selectStimsAvailable,
  selectConsumableAvailable,
} from '../selectors/clockSelectors';
import { isClockFilled } from '../validators/clockValidator';
import { DEFAULT_CONFIG } from '../config';
import { generateId } from '../utils/uuid';

/**
 * Resource Management Helpers
 *
 * Application layer functions for managing consumables and stims with proper validation.
 * These coordinate multiple slices (character, clock) and enforce game rules.
 */

export interface UseConsumableParams {
  crewId: string;
  characterId: string;
  consumableType: string; // e.g., 'frag_grenades', 'stims', 'medkits'
  depletionRoll: number; // d6 result (1-6)
  userId?: string;
}

export interface UseConsumableResult {
  clockId: string;
  segmentsAdded: number;
  newSegments: number;
  isFrozen: boolean; // True if this use filled/froze the clock
  tierDowngraded: boolean; // True if tier was downgraded
}

export interface UseStimParams {
  crewId: string;
  characterId: string;
  addictionRoll: number; // d6 result (1-6)
  userId?: string;
}

export interface UseStimResult {
  clockId: string;
  segmentsAdded: number;
  newSegments: number;
  isAddicted: boolean; // True if this use filled the addiction clock
  addictTraitId?: string; // ID of the "Addict" trait if added
}

/**
 * Use a consumable item (grenades, medkits, etc.)
 *
 * Validates that the consumable is not frozen, then adds depletion segments.
 * If the clock fills, it will be frozen and tier will be downgraded.
 *
 * @param store - Redux store
 * @param params - Consumable usage parameters
 * @returns Result with clock state
 * @throws Error if consumable is frozen/inaccessible
 */
export function useConsumable(
  store: Store,
  params: UseConsumableParams
): UseConsumableResult {
  const { crewId, characterId, consumableType, depletionRoll, userId } = params;

  // Validate depletion roll
  if (depletionRoll < 1 || depletionRoll > 6) {
    throw new Error(`Depletion roll must be 1-6 (got ${depletionRoll})`);
  }

  const state = store.getState();

  // Check if consumable is available (not frozen)
  const isAvailable = selectConsumableAvailable(state, crewId, consumableType);
  if (!isAvailable) {
    throw new Error(
      `Consumable "${consumableType}" is no longer accessible (depleted)`
    );
  }

  // Get or create consumable clock for this character
  // Note: Consumables are tracked per-character but frozen crew-wide
  let clock = selectConsumableClockBySubtype(state, characterId, consumableType);

  if (!clock) {
    // Create new consumable clock
    // Default to common (8 segments) unless specified in metadata
    store.dispatch(
      createClock({
        entityId: characterId,
        clockType: 'consumable',
        subtype: consumableType,
        rarity: 'common', // TODO: Should be passed as param or config
        tier: 'accessible',
        userId,
      })
    );

    // Refresh state after creation
    const newState = store.getState();
    clock = selectConsumableClockBySubtype(newState, characterId, consumableType);

    if (!clock) {
      throw new Error('Failed to create consumable clock');
    }
  }

  const clockId = clock.id;
  const previousSegments = clock.segments;

  // Add depletion segments
  store.dispatch(
    addSegments({
      clockId,
      amount: depletionRoll,
      userId,
    })
  );

  // Get updated clock state
  const updatedState = store.getState();
  const updatedClock = updatedState.clocks.byId[clockId];

  const isFrozen = updatedClock.metadata?.frozen === true;
  const tierDowngraded =
    previousSegments < updatedClock.maxSegments &&
    updatedClock.segments >= updatedClock.maxSegments &&
    updatedClock.metadata?.tier === 'inaccessible';

  return {
    clockId,
    segmentsAdded: depletionRoll,
    newSegments: updatedClock.segments,
    isFrozen,
    tierDowngraded,
  };
}

/**
 * Use a stim to reroll
 *
 * Validates that stims are not locked (addiction clock not filled),
 * then adds addiction segments. If addiction fills, adds "Addict" trait.
 *
 * @param store - Redux store
 * @param params - Stim usage parameters
 * @returns Result with addiction state
 * @throws Error if stims are locked due to addiction
 */
export function useStim(
  store: Store,
  params: UseStimParams
): UseStimResult {
  const { crewId, characterId, addictionRoll, userId } = params;

  // Validate addiction roll
  if (addictionRoll < 1 || addictionRoll > 6) {
    throw new Error(`Addiction roll must be 1-6 (got ${addictionRoll})`);
  }

  const state = store.getState();

  // Check if stims are available (addiction clock not filled)
  const stimsAvailable = selectStimsAvailable(state, crewId);
  if (!stimsAvailable) {
    throw new Error('Stims are locked due to addiction');
  }

  // Get or create addiction clock
  let addictionClock = selectAddictionClockByCrew(state, crewId);

  if (!addictionClock) {
    // Create addiction clock
    store.dispatch(
      createClock({
        entityId: crewId,
        clockType: 'addiction',
        userId,
      })
    );

    // Refresh state
    const newState = store.getState();
    addictionClock = selectAddictionClockByCrew(newState, crewId);

    if (!addictionClock) {
      throw new Error('Failed to create addiction clock');
    }
  }

  const clockId = addictionClock.id;
  const previousSegments = addictionClock.segments;

  // Add addiction segments
  store.dispatch(
    addSegments({
      clockId,
      amount: addictionRoll,
      userId,
    })
  );

  // Get updated state
  const updatedState = store.getState();
  const updatedClock = updatedState.clocks.byId[clockId];

  // Check if addiction filled
  const isAddicted = isClockFilled(updatedClock);
  let addictTraitId: string | undefined;

  // If addiction just filled, add "Addict" trait to character
  if (
    isAddicted &&
    previousSegments < updatedClock.maxSegments &&
    updatedClock.segments >= updatedClock.maxSegments
  ) {
    const traitId = generateId();
    store.dispatch(
      addTrait({
        characterId,
        trait: {
          id: traitId,
          name: 'Addict',
          category: 'scar',
          disabled: false,
          description: 'Became addicted to combat stims',
          acquiredAt: Date.now(),
        },
        userId,
      })
    );
    addictTraitId = traitId;
  }

  return {
    clockId,
    segmentsAdded: addictionRoll,
    newSegments: updatedClock.segments,
    isAddicted,
    addictTraitId,
  };
}

/**
 * Reduce addiction clock by 2 segments (called during Momentum Reset)
 *
 * @param store - Redux store
 * @param crewId - Crew ID
 * @param userId - Optional user ID for audit trail
 * @returns New segment count, or null if no addiction clock exists
 */
export function reduceAddiction(
  store: Store,
  crewId: string,
  userId?: string
): number | null {
  const state = store.getState();
  const addictionClock = selectAddictionClockByCrew(state, crewId);

  if (!addictionClock) {
    return null; // No addiction clock to reduce
  }

  const reductionAmount = DEFAULT_CONFIG.clocks.addiction.resetReduction; // 2
  const amountToReduce = Math.min(addictionClock.segments, reductionAmount);

  if (amountToReduce > 0) {
    store.dispatch(
      clearSegments({
        clockId: addictionClock.id,
        amount: amountToReduce,
        userId,
      })
    );
  }

  const updatedState = store.getState();
  const updatedClock = updatedState.clocks.byId[addictionClock.id];

  return updatedClock.segments;
}

export interface PerformMomentumResetParams {
  crewId: string;
  userId?: string;
}

export interface MomentumResetResult {
  crewId: string;
  newMomentum: number;
  addictionReduced: number | null; // Segments reduced, or null if no addiction clock
  charactersReset: {
    characterId: string;
    rallyReset: boolean;
    traitsReEnabled: number; // Count of traits re-enabled
    harmClocksRecovered: number; // Count of 6/6 harm clocks reduced to 5/6
  }[];
}

/**
 * Perform a complete Momentum Reset
 *
 * A Momentum Reset marks the end of a dramatic "act" and resets:
 * 1. Crew Momentum to 5
 * 2. Addiction clock reduced by 2 segments
 * 3. Rally availability reset for all characters
 * 4. All disabled traits re-enabled for all characters
 * 5. All 6/6 harm clocks recovered to 5/6
 *
 * @param store - Redux store
 * @param params - Reset parameters
 * @returns Result with all changes made
 */
export function performMomentumReset(
  store: Store,
  params: PerformMomentumResetParams
): MomentumResetResult {
  const { crewId, userId } = params;

  const state = store.getState();
  const crew = state.crews.byId[crewId];

  if (!crew) {
    throw new Error(`Crew ${crewId} not found`);
  }

  // 1. Reset Momentum to 5
  store.dispatch(resetMomentum({ crewId, userId }));

  // 2. Reduce addiction clock by 2
  const addictionSegments = reduceAddiction(store, crewId, userId);

  // 3, 4, & 5. Reset rally, re-enable traits, and recover harm clocks for all characters in crew
  const characterResults = crew.characters.map((characterId: string) => {
    const character = state.characters.byId[characterId];

    if (!character) {
      return {
        characterId,
        rallyReset: false,
        traitsReEnabled: 0,
        harmClocksRecovered: 0,
      };
    }

    // Reset rally
    store.dispatch(resetRally({ characterId, userId }));

    // Re-enable all disabled traits
    const disabledTraits = character.traits.filter((t: Trait) => t.disabled);
    disabledTraits.forEach((trait: Trait) => {
      store.dispatch(
        enableTrait({
          characterId,
          traitId: trait.id,
          userId,
        })
      );
    });

    // Recover harm clocks based on new reset rules
    const currentState = store.getState();
    const harmClockIds = currentState.clocks.byTypeAndEntity[`harm:${characterId}`] || [];
    let harmClocksRecovered = 0;

    harmClockIds.forEach((clockId: string) => {
      const clock = currentState.clocks.byId[clockId];
      if (clock && clock.segments > 0) {
        if (clock.segments >= clock.maxSegments) {
          // Full clock (6/6): reduce by 1 to make it 5/6
          store.dispatch(
            clearSegments({
              clockId,
              amount: 1,
              userId,
            })
          );
          harmClocksRecovered++;
        } else {
          // Partial clock: reduce by 2 (minimum 0)
          const amountToReduce = Math.min(clock.segments, 2);
          store.dispatch(
            clearSegments({
              clockId,
              amount: amountToReduce,
              userId,
            })
          );
          harmClocksRecovered++;

          // If clock reaches 0 after reduction, delete it
          const updatedState = store.getState();
          const updatedClock = updatedState.clocks.byId[clockId];
          if (updatedClock && updatedClock.segments === 0) {
            store.dispatch(
              deleteClock({
                clockId,
                userId,
              })
            );
          }
        }
      }
    });

    return {
      characterId,
      rallyReset: true,
      traitsReEnabled: disabledTraits.length,
      harmClocksRecovered,
    };
  });

  const updatedState = store.getState();
  const updatedCrew = updatedState.crews.byId[crewId];

  return {
    crewId,
    newMomentum: updatedCrew.currentMomentum,
    addictionReduced: addictionSegments,
    charactersReset: characterResults,
  };
}
