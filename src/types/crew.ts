/**
 * Crew Types
 *
 * Low-change entity representing a team of characters.
 * Momentum is stored here as shared resource.
 */

export interface Crew {
  id: string;
  name: string;
  characters: string[]; // Character IDs
  currentMomentum: number; // 0-10, starts at 5
  createdAt: number;
  updatedAt: number;
}
