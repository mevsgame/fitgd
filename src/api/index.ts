/**
 * Game API
 *
 * Main API export combining all sub-APIs.
 * This is the primary interface for consumers (Foundry VTT, etc.)
 */

import type { CharacterAPI } from './character';
import type { CrewAPI } from './crew';
import type { ClockAPI } from './clock';
import type { GameStateAPI } from './gameState';

export interface GameAPI {
  character: CharacterAPI;
  crew: CrewAPI;
  clock: ClockAPI;
  gameState: GameStateAPI;
}

export * from './character';
export * from './crew';
export * from './clock';
export * from './gameState';

// Factory function placeholder (will be implemented in Phase 6)
export function createGameAPI(/* config?: Partial<GameConfig> */): GameAPI {
  throw new Error('createGameAPI not yet implemented - Phase 6');
}
