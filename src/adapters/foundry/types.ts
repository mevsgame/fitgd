/**
 * Foundry VTT Type Definitions for FitGD
 *
 * These types represent how our Redux state maps to Foundry's Actor/Item system.
 * NOTE: FitGD uses different mechanics than standard Blades in the Dark!
 */

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
  // Action Dots (12 starting, 0-4 per action)
  actions: {
    shoot: ActionRating;
    skirmish: ActionRating;
    skulk: ActionRating;
    wreck: ActionRating;
    finesse: ActionRating;
    survey: ActionRating;
    study: ActionRating;
    tech: ActionRating;
    attune: ActionRating;
    command: ActionRating;
    consort: ActionRating;
    sway: ActionRating;
  };

  // Rally (available at 0-3 Momentum)
  rally: {
    available: boolean;
  };

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

  // Consumable Clocks (derived from Redux)
  consumables: ConsumableClockData[];

  // Progress Clocks (derived from Redux)
  progressClocks: ProgressClockData[];

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * Consumable clock display data
 */
export interface ConsumableClockData {
  id: string;
  type: string; // e.g., "frag_grenades", "stims"
  segments: number;
  maxSegments: number; // 4, 6, or 8 based on rarity
  rarity: 'common' | 'uncommon' | 'rare';
  tier: 'accessible' | 'inaccessible';
  frozen: boolean;
  color: ClockColor; // green
}

/**
 * Progress clock display data
 */
export interface ProgressClockData {
  id: string;
  name: string;
  segments: number;
  maxSegments: number; // 4, 6, 8, or 12
  category?: 'long-term-project' | 'threat' | 'personal-goal' | 'obstacle' | 'faction';
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
  category: 'role' | 'background' | 'scar' | 'flashback' | 'grouped';
  disabled: boolean; // Leaned into
  description?: string;
  acquiredAt: number;
}

/**
 * Equipment item data
 */
export interface FoundryEquipmentData {
  tier: 'accessible' | 'inaccessible' | 'epic';
  category: string; // 'weapon', 'armor', 'tool', etc.
  description?: string;
}

/**
 * Clock color mapping for FitGD mechanics
 */
export const FITGD_CLOCK_COLORS: Record<string, ClockColor> = {
  // Harm clocks
  physical_harm: 'red',
  morale_harm: 'grey',

  // Resource clocks
  consumable: 'green',
  addiction: 'yellow',

  // Progress clocks
  progress: 'blue',
  threat: 'red',
  personal_goal: 'white',
  faction: 'black',
};
