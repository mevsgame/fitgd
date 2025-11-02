import type { Store } from '@reduxjs/toolkit';
import type { FoundryActor } from './types';
import {
  exportCharacterToFoundry,
  importCharacterFromFoundry,
  syncCharacterToFoundry,
} from './characterAdapter';
import {
  exportCrewToFoundry,
  importCrewFromFoundry,
  syncCrewToFoundry,
} from './crewAdapter';
import { createCharacter } from '../../slices/characterSlice';
import { createCrew } from '../../slices/crewSlice';

/**
 * Foundry VTT Adapter for FitGD
 *
 * Provides bridge between Redux state management and Foundry VTT's Actor/Item system.
 * Handles bidirectional sync: Redux ↔ Foundry
 *
 * NOTE: This implements FitGD rules (Momentum, harm clocks, Rally)
 *       NOT standard Blades in the Dark (stress, trauma)
 */

export interface FoundryAdapter {
  // Export to Foundry
  exportCharacter(characterId: string): FoundryActor | null;
  exportCrew(crewId: string): FoundryActor | null;
  exportAll(): { characters: FoundryActor[]; crews: FoundryActor[] };

  // Import from Foundry
  importCharacter(foundryActor: FoundryActor): string | null;
  importCrew(foundryActor: FoundryActor): string | null;

  // Sync (called after state changes)
  syncCharacter(characterId: string, foundryActor: any): void;
  syncCrew(crewId: string, foundryActor: any): void;

  // State serialization (for Foundry world persistence)
  exportState(): SerializedState;
  importState(state: SerializedState): void;

  // Command history (for replay/audit)
  exportHistory(): CommandHistory;
  replayCommands(commands: CommandHistory): void;
}

/**
 * Serialized state for Foundry persistence
 */
export interface SerializedState {
  characters: Record<string, any>;
  crews: Record<string, any>;
  clocks: Record<string, any>;
  timestamp: number;
  version: string;
}

/**
 * Command history for replay/audit
 */
export interface CommandHistory {
  characters: any[];
  crews: any[];
  clocks: any[];
}

/**
 * Create Foundry adapter instance
 */
export function createFoundryAdapter(store: Store): FoundryAdapter {
  return {
    // ===== Export to Foundry =====
    exportCharacter(characterId: string): FoundryActor | null {
      return exportCharacterToFoundry(store, characterId);
    },

    exportCrew(crewId: string): FoundryActor | null {
      return exportCrewToFoundry(store, crewId);
    },

    exportAll(): { characters: FoundryActor[]; crews: FoundryActor[] } {
      const state = store.getState();

      const characters = state.characters.allIds
        .map((id: string) => exportCharacterToFoundry(store, id))
        .filter((actor: FoundryActor | null): actor is FoundryActor => actor !== null);

      const crews = state.crews.allIds
        .map((id: string) => exportCrewToFoundry(store, id))
        .filter((actor: FoundryActor | null): actor is FoundryActor => actor !== null);

      return { characters, crews };
    },

    // ===== Import from Foundry =====
    importCharacter(foundryActor: FoundryActor): string | null {
      const character = importCharacterFromFoundry(foundryActor);
      if (!character) return null;

      // Dispatch to Redux (generates new ID)
      // TODO: Preserve Foundry ID - need importCharacter action that accepts ID
      const result = store.dispatch(
        createCharacter({
          name: character.name,
          traits: character.traits,
          actionDots: character.actionDots,
        })
      );

      // TODO: Import equipment and harm clocks separately

      return result.payload.id;
    },

    importCrew(foundryActor: FoundryActor): string | null {
      const crew = importCrewFromFoundry(foundryActor);
      if (!crew) return null;

      // Dispatch to Redux (generates new ID)
      // TODO: Preserve Foundry ID - need importCrew action that accepts ID
      const result = store.dispatch(
        createCrew({
          name: crew.name,
        })
      );

      // TODO: Import characters, clocks separately

      return result.payload.id;
    },

    // ===== Sync (bidirectional) =====
    syncCharacter(characterId: string, foundryActor: any): void {
      syncCharacterToFoundry(store, characterId, foundryActor);
    },

    syncCrew(crewId: string, foundryActor: any): void {
      syncCrewToFoundry(store, crewId, foundryActor);
    },

    // ===== State serialization =====
    exportState(): SerializedState {
      const state = store.getState();

      return {
        characters: state.characters.byId,
        crews: state.crews.byId,
        clocks: state.clocks.byId,
        timestamp: Date.now(),
        version: '1.0.0',
      };
    },

    importState(_serializedState: SerializedState): void {
      // TODO: Implement state hydration
      // This should replay commands or directly set state
      console.warn('importState not yet implemented');
    },

    // ===== Command history =====
    exportHistory(): CommandHistory {
      const state = store.getState();

      return {
        characters: state.characters.history,
        crews: state.crews.history,
        clocks: state.clocks.history,
      };
    },

    replayCommands(_history: CommandHistory): void {
      // TODO: Implement command replay
      // Dispatch each command in order to reconstruct state
      console.warn('replayCommands not yet implemented');
    },
  };
}

// Re-export types
export * from './types';
export { exportCharacterToFoundry, importCharacterFromFoundry } from './characterAdapter';
export { exportCrewToFoundry, importCrewFromFoundry } from './crewAdapter';
