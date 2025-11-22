/**
 * Character Types
 *
 * Low-change entity stored with full snapshot + command history.
 */

import { EquipmentRarity } from "./equipment";

/**
 * Trait category types
 */
export type TraitCategory = 'role' | 'background' | 'scar' | 'flashback' | 'grouped';

export interface Approaches {
  force: number;
  guile: number;
  focus: number;
  spirit: number;
}

export interface Character {
  id: string;
  name: string;
  traits: Trait[];
  approaches: Approaches;
  unallocatedApproachDots: number; // Dots not yet allocated (for milestones/rewards)
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

export interface Equipment {
  // Instance identity
  id: string;

  // Core equipment data (copied from template at creation, fully editable)
  name: string;
  rarity: EquipmentRarity;
  category: string; // e.g., 'weapon', 'armor', 'tool' - maps to equipmentCategories in config
  description: string;
  img?: string; // Optional: image path
  passive: boolean; // If true, can't be selected for actions (passive effects only)

  // Instance state
  equipped: boolean; // Is currently equipped?

  // Provenance (event sourcing metadata)
  acquiredAt: number; // Timestamp when acquired
  sourceItemId?: string; // Optional: Original template ID (for reference only)

  // Flexible metadata
  metadata?: Record<string, unknown>; // Custom fields (damage, range, etc.)
}
