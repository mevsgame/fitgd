/**
 * Foundry VTT Type Definitions for FitGD
 *
 * These types represent how our Redux state maps to Foundry's Actor/Item system.
 * NOTE: FitGD uses different mechanics than standard Blades in the Dark!
 */

import { ProgressClockCategory } from "@/types";
import { EquipmentTier } from "@/types/equipment";
import { TraitCategory } from "@/types/character";

/**
 * Base Foundry Actor data structure
 */
export interface FoundryActor {
  _id: string;
  name: string;
  type: 'character' | 'crew';
  img?: string;
  system: FoundryCharacterData | FoundryCrewData;
  items?: FoundryItem[];
  prototypeToken?: {
    actorLink?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Character Actor system data (FitGD rules, NOT Blades!)
 */
export interface FoundryCharacterData {
  // Approaches (5 starting dots, 0-2 per approach at creation)
  approaches: {
    force: ActionRating;
    guile: ActionRating;
    focus: ActionRating;
    spirit: ActionRating;
  };

  // Unallocated action dots (for character creation and GM rewards)
  unallocatedActionDots?: number;

  // Rally (available at 0-3 Momentum)
  rally: {
    available: boolean;
  };

  // Load Limit (max slots for equipped items, default 5)
  loadLimit?: number;

  // Harm Clocks (derived from Redux clocks, max 3)
  harm: HarmClockData[];

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * Action rating with value and XP
 */
export interface ActionRating {
  value: number; // 0-4
  xp?: number; // Future: advancement tracking
}

/**
 * Harm clock display data (derived from Redux)
 */
export interface HarmClockData {
  id: string;
  type: string; // "Physical Harm", "Morale Harm", etc.
  segments: number; // 0-6
  maxSegments: number; // Always 6 for harm
  color: ClockColor; // For visual rendering
}

/**
 * Clock color mapping (from Blades Foundry VTT assets)
 */
export type ClockColor = 'red' | 'grey' | 'blue' | 'yellow' | 'green' | 'white' | 'black';

/**
 * Crew Actor system data (FitGD rules)
 */
export interface FoundryCrewData {
  // Momentum (0-10, starts at 5) - NOT stress!
  momentum: {
    value: number;
    max: number; // Always 10
  };

  // Character members (references to character Actor IDs)
  characters: string[];

  // Addiction Clock (derived from Redux, 8 segments)
  addiction: {
    segments: number;
    maxSegments: number; // Always 8
    color: ClockColor; // yellow
  } | null;



  // Progress Clocks (derived from Redux)
  progressClocks: ProgressClockData[];

  // Metadata
  createdAt: number;
  updatedAt: number;
}



/**
 * Progress clock display data
 */
export interface ProgressClockData {
  id: string;
  name: string;
  segments: number;
  maxSegments: number; // 4, 6, 8, or 12
  category?: ProgressClockCategory;
  isCountdown?: boolean;
  description?: string;
  color: ClockColor; // blue for progress, red for threats
}

/**
 * Foundry Item (Trait or Equipment)
 */
export interface FoundryItem {
  _id: string;
  name: string;
  type: 'trait' | 'equipment';
  img?: string;
  system: FoundryTraitData | FoundryEquipmentData;
}

/**
 * Trait item data
 */
export interface FoundryTraitData {
  category: TraitCategory;
  disabled: boolean; // Leaned into
  description?: string;
  acquiredAt: number;
}

/**
 * Equipment item data
 */
export interface FoundryEquipmentData {
  category: string; // 'weapon', 'armor', 'tool', etc.
  description?: string;
  rarity: EquipmentTier;
  tags: string[];
}

/**
 * Clock color mapping for FitGD mechanics
 */
export const FITGD_CLOCK_COLORS: Record<string, ClockColor> = {
  // Harm clocks
  physical_harm: 'red',
  morale_harm: 'grey',

  // Resource clocks
  addiction: 'yellow',

  // Progress clocks
  progress: 'blue',
  threat: 'red',
  personal_goal: 'white',
  faction: 'black',
};
