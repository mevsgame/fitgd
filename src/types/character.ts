/**
 * Character Types
 *
 * Low-change entity stored with full snapshot + command history.
 */

export type { Equipment } from "./equipment";
import type { Equipment } from "./equipment";

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
  equipment: Equipment[];          // Full equipment objects (data + state: equipped, locked, consumed)
  loadLimit: number;               // Max slots character can equip (default 5)
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

