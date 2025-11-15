/**
 * Character Types
 *
 * Low-change entity stored with full snapshot + command history.
 */

import { EquipmentTier, EquipmentAcquisition } from "./equipment";

/**
 * Trait category types
 */
export type TraitCategory = 'role' | 'background' | 'scar' | 'flashback' | 'grouped';

/**
 * Social action types (subset of ActionDots for Rally)
 */
export type SocialAction = 'command' | 'consort' | 'sway';

export interface Character {
  id: string;
  name: string;
  traits: Trait[];
  actionDots: ActionDots;
  unallocatedActionDots: number; // Dots not yet allocated (for milestones/rewards)
  equipment: Equipment[];
  rallyAvailable: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Trait {
  id: string;
  name: string;
  category: TraitCategory;
  disabled: boolean; // true when leaning into trait
  description?: string;
  acquiredAt: number;
}

export interface ActionDots {
  shoot: number;      // 0-4
  skirmish: number;
  skulk: number;
  wreck: number;
  finesse: number;
  survey: number;
  study: number;
  tech: number;
  attune: number;
  command: number;
  consort: number;
  sway: number;
}

export interface Equipment {
  // Instance identity
  id: string;

  // Core equipment data (copied from template at creation, fully editable)
  name: string;
  tier: EquipmentTier;
  category: string; // e.g., 'weapon', 'armor', 'tool'
  description: string;
  img?: string; // Optional: image path

  // Instance state
  equipped: boolean; // Is currently equipped?

  // Provenance (event sourcing metadata)
  acquiredAt: number; // Timestamp when acquired
  acquiredVia?: EquipmentAcquisition;
  sourceItemId?: string; // Optional: Original template ID (for reference only)

  // Flexible metadata
  metadata?: Record<string, unknown>; // Custom fields (damage, range, etc.)
}
