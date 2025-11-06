/**
 * Resolution Helpers
 *
 * Application layer helpers for resolving actions and applying consequences.
 * No dice rolling - accepts dice results as input from Foundry.
 */

import type { Store } from '@reduxjs/toolkit';
import { DEFAULT_CONFIG } from '../config';
import { addMomentum } from '../slices/crewSlice';
import { createClock, addSegments } from '../slices/clockSlice';
import type {
  Position,
  Result,
  RollResult,
  ConsequenceResult,
  HarmConsequenceParams,
  HarmConsequenceResult,
} from '../types';

/**
 * Evaluate dice roll results
 *
 * @param dice - Array of die results (e.g., [3, 6, 2])
 * @param useLowest - For 0 dots: roll 2d6 and take lowest
 * @returns Roll result with evaluation
 */
export function evaluateRoll(dice: number[], useLowest = false): RollResult {
  if (dice.length === 0) {
    throw new Error('Must provide at least one die result');
  }

  let highestDie: number;

  if (useLowest) {
    // For 0 dots: take lowest die
    highestDie = Math.min(...dice);
  } else {
    // Normal: take highest die
    highestDie = Math.max(...dice);
  }

  // Count 6s for critical
  const sixes = dice.filter((d) => d === 6).length;

  let result: Result;

  if (sixes >= 2) {
    result = 'critical'; // Two or more 6s
  } else if (highestDie === 6) {
    result = 'success'; // Single 6
  } else if (highestDie >= 4) {
    result = 'partial'; // 4-5
  } else {
    result = 'failure'; // 1-3
  }

  return {
    result,
    highestDie,
    dice,
  };
}

/**
 * Resolve action consequence (momentum generation)
 *
 * Automatically generates momentum on failure/partial based on position.
 *
 * @param store - Redux store
 * @param params - Resolution parameters
 * @returns Consequence result with momentum generated
 */
export function resolveActionConsequence(
  store: Store,
  params: {
    crewId: string;
    position: Position;
    result: Result;
  }
): ConsequenceResult {
  const { crewId, position, result } = params;

  // Only generate momentum on failure/partial
  if (result === 'success' || result === 'critical') {
    return {
      result,
      momentumGenerated: 0,
    };
  }

  // Get momentum amount from config
  const momentum = DEFAULT_CONFIG.resolution.momentumOnConsequence[position];

  // Dispatch momentum addition
  store.dispatch(addMomentum({ crewId, amount: momentum }));

  return {
    result,
    momentumGenerated: momentum,
  };
}

/**
 * Apply harm consequence
 *
 * Creates or adds to harm clock based on position and effect.
 * Handles 4th harm clock replacement logic.
 *
 * @param store - Redux store
 * @param params - Harm consequence parameters
 * @returns Harm consequence result
 */
export function applyHarmConsequence(
  store: Store,
  params: HarmConsequenceParams
): HarmConsequenceResult {
  const { characterId, position, effect, harmType } = params;

  // Get harm segments from config
  const segments = DEFAULT_CONFIG.resolution.harmSegments[position][effect];
  console.log(`FitGD | applyHarmConsequence: characterId=${characterId}, harmType=${harmType}, position=${position}, effect=${effect}, segments=${segments}`);

  // Get existing harm clocks for character
  const state = store.getState() as any;
  const harmClocksKey = `harm:${characterId}`;
  const existingHarmClockIds = state.clocks.byTypeAndEntity[harmClocksKey] || [];
  const existingHarmClocks = existingHarmClockIds.map(
    (id: string) => state.clocks.byId[id]
  );
  console.log(`FitGD | Existing harm clocks for ${characterId}:`, existingHarmClocks.length, existingHarmClocks);

  // Check if clock already exists for this harm type
  const existingClock = existingHarmClocks.find(
    (clock: any) => clock.subtype === harmType
  );

  let clockId: string;

  if (existingClock) {
    // Add to existing clock
    console.log(`FitGD | Found existing clock ${existingClock.id}, adding ${segments} segments`);
    clockId = existingClock.id;
    store.dispatch(addSegments({ clockId, amount: segments }));
  } else {
    // Create new clock
    console.log(`FitGD | Creating new harm clock: entityId=${characterId}, harmType=${harmType}`);
    store.dispatch(
      createClock({
        entityId: characterId,
        clockType: 'harm',
        subtype: harmType,
      })
    );

    // Get the newly created clock ID (last one in allIds)
    const newState = store.getState() as any;
    clockId = newState.clocks.allIds[newState.clocks.allIds.length - 1];
    const newClock = newState.clocks.byId[clockId];
    console.log(`FitGD | Created clock ${clockId}, initial segments: ${newClock.segments}, maxSegments: ${newClock.maxSegments}`);

    // Add segments if any
    if (segments > 0) {
      console.log(`FitGD | Adding ${segments} segments to new clock ${clockId}`);
      store.dispatch(addSegments({ clockId, amount: segments }));
    }
  }

  // Check if dying (6/6)
  const finalState = store.getState() as any;
  const clock = finalState.clocks.byId[clockId];
  const isDying = clock.segments >= clock.maxSegments;
  console.log(`FitGD | Final clock state: ${clockId}, segments=${clock.segments}/${clock.maxSegments}, isDying=${isDying}`);

  return {
    clockId,
    segmentsAdded: segments,
    isDying,
  };
}
