/**
 * Character Types
 *
 * Low-change entity stored with full snapshot + command history.
 */

import { EquipmentTier } from "./equipment";

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
  type: 'equipment' | 'consumable' | 'augmentation'; // Equipment type determines mechanics
  tier: EquipmentTier; // 'common' | 'rare' | 'epic' - determines acquisition cost
  category: string; // e.g., 'weapon', 'armor', 'tool' - maps to equipmentCategories in config
  description: string;
  img?: string; // Optional: image path
  passive: boolean; // If true, can't be selected for actions (passive effects only)
  tags?: string[]; // Optional: tags for categorization or bonus effects

  // Instance state
  equipped: boolean; // Is currently equipped?
  locked: boolean; // If true, cannot be unequipped (item has been used in session and is locked until Momentum Reset)
  depleted: boolean; // If true, consumable has been used (still takes load, visual indicator)
  autoEquip?: boolean; // If true, automatically re-equip after Momentum Reset (default: false)

  // Provenance (event sourcing metadata)
  acquiredAt: number; // Timestamp when acquired
  acquiredVia?: 'starting' | 'flashback' | 'earned'; // How was this item acquired?
  sourceItemId?: string; // Optional: Original template ID (for reference only)

  // Flexible metadata
  metadata?: Record<string, unknown>; // Custom fields (damage, range, etc.)
}
