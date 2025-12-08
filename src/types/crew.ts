/**
 * Crew Types
 *
 * Low-change entity representing a team of characters.
 * Momentum is stored here as shared resource.
 */

/**
 * Tracks an active player action for widget lifecycle synchronization.
 * Only one action can be in progress per crew at a time.
 */
export interface ActivePlayerAction {
  /** Character taking the action */
  characterId: string;
  /** Foundry user ID who owns this action */
  playerId: string;
  /** Crew this action belongs to */
  crewId: string;
  /** Once true, player cannot close widget - only GM can abort */
  committedToRoll: boolean;
  /** Timestamp when action started (for debugging) */
  startedAt: number;
}

export interface Crew {
  id: string;
  name: string;
  characters: string[]; // Character IDs
  currentMomentum: number; // 0-10, starts at 5
  createdAt: number;
  updatedAt: number;
  /** Currently active player action, if any */
  activePlayerAction?: ActivePlayerAction | null;
}
