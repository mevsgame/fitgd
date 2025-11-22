import type { Store } from '@reduxjs/toolkit';
import type { Trait, Equipment } from '../types';
import { addTrait, enableTrait, resetRally, unlockAllEquipment, replenishConsumables, autoEquipItems } from '../slices/characterSlice';
import { resetMomentum } from '../slices/crewSlice';
import {
  createClock,
  addSegments,
  clearSegments,
  deleteClock,
} from '../slices/clockSlice';
import {
  selectAddictionClockByCharacter,
  selectStimsAvailable,
} from '../selectors/clockSelectors';
import { isClockFilled } from '../validators/clockValidator';
import { generateId } from '../utils/uuid';

/**
 * Resource Management Helpers
 *
 * Application layer functions for managing stims and momentum resets with proper validation.
 * These coordinate multiple slices (character, clock) and enforce game rules.
 */


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
  const { characterId, addictionRoll, userId } = params;

  // Validate addiction roll
  if (addictionRoll < 1 || addictionRoll > 6) {
    throw new Error(`Addiction roll must be 1-6 (got ${addictionRoll})`);
  }

  const state = store.getState();

  // Check if stims are available (no addiction clocks frozen)
  const stimsAvailable = selectStimsAvailable(state);
  if (!stimsAvailable) {
    throw new Error('Stims are locked due to addiction');
  }

  // Get or create addiction clock for this character
  let addictionClock = selectAddictionClockByCharacter(state, characterId);

  if (!addictionClock) {
    // Create addiction clock (per-character)
    store.dispatch(
      createClock({
        entityId: characterId,
        clockType: 'addiction',
        userId,
      })
    );

    // Refresh state
    const newState = store.getState();
    addictionClock = selectAddictionClockByCharacter(newState, characterId);

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

export interface PerformMomentumResetParams {
  crewId: string;
  userId?: string;
}

export interface MomentumResetResult {
  crewId: string;
  newMomentum: number;
  charactersReset: {
    characterId: string;
    rallyReset: boolean;
    traitsReEnabled: number; // Count of traits re-enabled
    harmClocksRecovered: number; // Count of harm clocks recovered
    addictionClocksRecovered: number; // Count of addiction clocks recovered
    equipmentUnlocked: number; // Count of locked items unlocked
    consumablesReplenished: number; // Count of consumables replenished
    itemsAutoEquipped: number; // Count of items with autoEquip flag re-equipped
  }[];
}

/**
 * Perform a complete Momentum Reset
 *
 * A Momentum Reset marks the end of a dramatic "act" and resets:
 * 1. Crew Momentum to 5
 * 2. Rally availability reset for all characters
 * 3. All disabled traits re-enabled for all characters
 * 4. All harm clocks recovered (full: -1 segment, partial: -2 segments, 0: deleted)
 * 5. All addiction clocks (per-character) recovered (full: -1 segment, partial: -2 segments, 0: deleted)
 * 6. Equipment lifecycle reset for all characters:
 *    - All locked items unlocked (locked: false)
 *    - All consumables replenished (depleted: false)
 *    - All items with autoEquip: true re-equipped (equipped: true, locked: false)
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

  // 2, 3, 4, & 5. Reset rally, re-enable traits, recover harm clocks, and recover addiction clocks for all characters in crew
  const characterResults = crew.characters.map((characterId: string) => {
    const character = state.characters.byId[characterId];

    if (!character) {
      return {
        characterId,
        rallyReset: false,
        traitsReEnabled: 0,
        harmClocksRecovered: 0,
        addictionClocksRecovered: 0,
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

    // Recover addiction clocks (per-character) based on new reset rules
    const addictionClockIds = currentState.clocks.byTypeAndEntity[`addiction:${characterId}`] || [];
    let addictionClocksRecovered = 0;

    addictionClockIds.forEach((clockId: string) => {
      const clock = currentState.clocks.byId[clockId];
      if (clock && clock.segments > 0) {
        if (clock.segments >= clock.maxSegments) {
          // Full clock (8/8): reduce by 1 to make it 7/8
          store.dispatch(
            clearSegments({
              clockId,
              amount: 1,
              userId,
            })
          );
          addictionClocksRecovered++;
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
          addictionClocksRecovered++;

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

    // Equipment lifecycle reset
    const lockedItems = character.equipment.filter((e: Equipment) => e.locked);
    const depletedConsumables = character.equipment.filter((e: Equipment) => e.depleted);
    const autoEquipItemsList = character.equipment.filter((e: Equipment) => e.autoEquip);

    // Unlock all equipment
    store.dispatch(
      unlockAllEquipment({
        characterId,
        userId,
      })
    );

    // Replenish consumables
    store.dispatch(
      replenishConsumables({
        characterId,
        userId,
      })
    );

    // Auto-equip flagged items
    store.dispatch(
      autoEquipItems({
        characterId,
        userId,
      })
    );

    return {
      characterId,
      rallyReset: true,
      traitsReEnabled: disabledTraits.length,
      harmClocksRecovered,
      addictionClocksRecovered,
      equipmentUnlocked: lockedItems.length,
      consumablesReplenished: depletedConsumables.length,
      itemsAutoEquipped: autoEquipItemsList.length,
    };
  });

  const updatedState = store.getState();
  const updatedCrew = updatedState.crews.byId[crewId];

  return {
    crewId,
    newMomentum: updatedCrew.currentMomentum,
    charactersReset: characterResults,
  };
}
