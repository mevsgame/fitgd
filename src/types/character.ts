/**
 * Character Types
 *
 * Low-change entity stored with full snapshot + command history.
 */

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
  category: 'role' | 'background' | 'scar' | 'flashback' | 'grouped';
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
  id: string;
  name: string;
  tier: 'accessible' | 'inaccessible' | 'epic';
  category: string; // e.g., 'weapon', 'armor', 'tool'
  description?: string;
}
