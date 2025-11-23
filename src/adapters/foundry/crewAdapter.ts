import type { Store } from '@reduxjs/toolkit';
import type { Crew } from '../../types';
import type {
  FoundryActor,
  FoundryCrewData,
  ConsumableClockData,
  ProgressClockData,
  ClockColor,
} from './types';
import { FITGD_CLOCK_COLORS } from './types';
import { EquipmentRarity } from '@/types/equipment';

/**
 * Crew Adapter
 *
 * Converts Redux Crew state to Foundry Actor format
 * FitGD rules: Momentum (NOT stress), addiction, consumables
 */

/**
 * Export crew as Foundry Actor
 */
export function exportCrewToFoundry(store: Store, crewId: string): FoundryActor | null {
  const state = store.getState();
  const crew = state.crews.byId[crewId];

  if (!crew) {
    return null;
  }

  // Get addiction clock (crew-wide, 8 segments)
  const addictionClock = getCrewAddictionClock(store, crewId);

  // Get consumable clocks
  const consumableClocks = getCrewConsumableClocks(store, crewId);

  // Get progress clocks
  const progressClocks = getCrewProgressClocks(store, crewId);

  const foundryActor: FoundryActor = {
    _id: crew.id,
    name: crew.name,
    type: 'crew',
    system: {
      momentum: {
        value: crew.currentMomentum,
        max: 10, // FitGD: Always 10 max Momentum
      },
      characters: crew.characters,
      addiction: addictionClock,
      consumables: consumableClocks,
      progressClocks: progressClocks,
      createdAt: crew.createdAt,
      updatedAt: crew.updatedAt,
    },
    prototypeToken: {
      actorLink: true,
    },
  };

  return foundryActor;
}

/**
 * Import Foundry Actor to Redux Crew state
 */
export function importCrewFromFoundry(foundryActor: FoundryActor): Crew | null {
  if (foundryActor.type !== 'crew') {
    return null;
  }

  const system = foundryActor.system as FoundryCrewData;

  const crew: Crew = {
    id: foundryActor._id,
    name: foundryActor.name,
    characters: system.characters,
    currentMomentum: system.momentum.value,
    createdAt: system.createdAt,
    updatedAt: system.updatedAt,
  };

  return crew;
}

/**
 * Get addiction clock for crew (derived from Redux clocks)
 */
function getCrewAddictionClock(
  store: Store,
  crewId: string
): { segments: number; maxSegments: number; color: ClockColor } | null {
  const state = store.getState();
  const addictionClocksKey = `addiction:${crewId}`;
  const addictionClockIds = state.clocks.byTypeAndEntity[addictionClocksKey] || [];

  if (addictionClockIds.length === 0) {
    return null;
  }

  const clock = state.clocks.byId[addictionClockIds[0]]; // Only one addiction clock per crew

  return {
    segments: clock.segments,
    maxSegments: clock.maxSegments, // Always 8
    color: FITGD_CLOCK_COLORS.addiction,
  };
}

/**
 * Get consumable clocks for crew
 */
function getCrewConsumableClocks(store: Store, crewId: string): ConsumableClockData[] {
  const state = store.getState();
  const consumableClocksKey = `consumable:${crewId}`;
  const consumableClockIds = state.clocks.byTypeAndEntity[consumableClocksKey] || [];

  return consumableClockIds.map((clockId: string) => {
    const clock = state.clocks.byId[clockId];
    const metadata = clock.metadata || {};

    return {
      id: clock.id,
      type: clock.subtype || 'Consumable',
      segments: clock.segments,
      maxSegments: clock.maxSegments,
      rarity: (metadata.rarity as EquipmentRarity),
      frozen: (metadata.frozen as boolean) || false,
      color: FITGD_CLOCK_COLORS.consumable,
    };
  });
}

/**
 * Get progress clocks for crew
 */
function getCrewProgressClocks(store: Store, crewId: string): ProgressClockData[] {
  const state = store.getState();
  const progressClocksKey = `progress:${crewId}`;
  const progressClockIds = state.clocks.byTypeAndEntity[progressClocksKey] || [];

  return progressClockIds.map((clockId: string) => {
    const clock = state.clocks.byId[clockId];
    const metadata = clock.metadata || {};

    return {
      id: clock.id,
      name: clock.subtype || 'Progress',
      segments: clock.segments,
      maxSegments: clock.maxSegments,
      category: metadata.category as any,
      isCountdown: metadata.isCountdown as boolean,
      description: metadata.description as string,
      color: getProgressClockColor(metadata.category as string, metadata.isCountdown as boolean),
    };
  });
}

/**
 * Determine progress clock color based on category
 */
function getProgressClockColor(category?: string, isCountdown?: boolean): ClockColor {
  if (isCountdown || category === 'threat') {
    return FITGD_CLOCK_COLORS.threat; // Red for threats/countdowns
  }

  if (category === 'personal-goal') {
    return FITGD_CLOCK_COLORS.personal_goal; // White
  }

  if (category === 'faction') {
    return FITGD_CLOCK_COLORS.faction; // Black
  }

  // Default: blue for progress
  return FITGD_CLOCK_COLORS.progress;
}

/**
 * Sync crew changes to Foundry Actor
 */
export function syncCrewToFoundry(
  store: Store,
  crewId: string,
  foundryActor: any // Actual Foundry Actor instance
): void {
  const exportedData = exportCrewToFoundry(store, crewId);
  if (!exportedData) return;

  foundryActor.update({
    name: exportedData.name,
    system: exportedData.system,
  });
}
