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
import { createCharacter, pruneHistory as pruneCharacterHistory } from '../../slices/characterSlice';
import { createCrew, pruneCrewHistory } from '../../slices/crewSlice';
import { pruneClockHistory } from '../../slices/clockSlice';
import { selectHistoryStats } from '../../selectors/historySelectors';
import type { HistoryStats } from '../../selectors/historySelectors';

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

  // History management
  getHistoryStats(): HistoryStats;
  pruneAllHistory(): void;
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

    replayCommands(history: CommandHistory): void {
      console.log('FitGD | Replaying commands from history');
      console.log(`FitGD | Character commands: ${history.characters.length}`);
      console.log(`FitGD | Crew commands: ${history.crews.length}`);
      console.log(`FitGD | Clock commands: ${history.clocks.length}`);

      // Replay all commands in order by timestamp
      const allCommands = [
        ...history.characters,
        ...history.crews,
        ...history.clocks,
      ].sort((a, b) => a.timestamp - b.timestamp);

      console.log(`FitGD | Total commands to replay: ${allCommands.length}`);

      // Dispatch each command to reconstruct state
      for (const command of allCommands) {
        try {
          store.dispatch({
            type: command.type,
            payload: command.payload,
            meta: { command },
          });
        } catch (error) {
          console.error(`FitGD | Error replaying command ${command.type}:`, error);
        }
      }

      console.log('FitGD | Command replay complete');
    },

    // ===== History management =====
    getHistoryStats(): HistoryStats {
      const state = store.getState();
      return selectHistoryStats(state);
    },

    pruneAllHistory(): void {
      console.log('FitGD | Pruning all command history');

      const statsBefore = this.getHistoryStats();
      console.log(`FitGD | History before pruning: ${statsBefore.totalCommands} commands (~${statsBefore.estimatedSizeKB}KB)`);

      // Dispatch prune actions to all slices
      store.dispatch(pruneCharacterHistory());
      store.dispatch(pruneCrewHistory());
      store.dispatch(pruneClockHistory());

      const statsAfter = this.getHistoryStats();
      console.log(`FitGD | History after pruning: ${statsAfter.totalCommands} commands (~${statsAfter.estimatedSizeKB}KB)`);
      console.log('FitGD | History pruning complete - current state snapshot retained');
    },
  };
}

// Re-export types
export * from './types';
export { exportCharacterToFoundry, importCharacterFromFoundry } from './characterAdapter';
export { exportCrewToFoundry, importCrewFromFoundry } from './crewAdapter';
