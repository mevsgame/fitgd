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
import { createCharacter, pruneCharacterHistory, hydrateCharacters, cleanupOrphanedCharacters } from '../../slices/characterSlice';
import { createCrew, pruneCrewHistory, hydrateCrews, cleanupOrphanedCrews } from '../../slices/crewSlice';
import { logger } from '../../utils/logger';
import { pruneClockHistory, hydrateClocks, cleanupOrphanedClocks } from '../../slices/clockSlice';
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
  cleanupOrphanedClocks(validEntityIds: string[]): void;
  cleanupOrphanedCharacters(validEntityIds: string[]): void;
  cleanupOrphanedCrews(validEntityIds: string[]): void;
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
  playerRoundState: any[];  // NEW: Player round state history
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
          approaches: character.approaches,
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

    importState(serializedState: SerializedState): void {
      logger.info('Importing state from snapshot');
      logger.info(`Snapshot timestamp: ${new Date(serializedState.timestamp).toISOString()}`);
      logger.info(`Snapshot version: ${serializedState.version}`);

      // Hydrate each slice with the serialized data
      store.dispatch(hydrateCharacters(serializedState.characters));
      store.dispatch(hydrateCrews(serializedState.crews));
      store.dispatch(hydrateClocks(serializedState.clocks));

      const state = store.getState();
      logger.info(
        `State hydrated - ${state.characters.allIds.length} characters, ` +
        `${state.crews.allIds.length} crews, ` +
        `${state.clocks.allIds.length} clocks`
      );
    },

    // ===== Command history =====
    exportHistory(): CommandHistory {
      const state = store.getState();

      return {
        characters: state.characters.history,
        crews: state.crews.history,
        clocks: state.clocks.history,
        playerRoundState: state.playerRoundState.history || [],
      };
    },

    replayCommands(history: CommandHistory): void {
      logger.info('Replaying commands from history');
      logger.info(`Character commands: ${history.characters.length}`);
      logger.info(`Crew commands: ${history.crews.length}`);
      logger.info(`Clock commands: ${history.clocks.length}`);

      // Replay all commands in order by timestamp
      const allCommands = [
        ...history.characters,
        ...history.crews,
        ...history.clocks,
        ...(history.playerRoundState || []),
      ].sort((a, b) => a.timestamp - b.timestamp);

      logger.info(`Total commands to replay: ${allCommands.length}`);

      // Dispatch each command to reconstruct state
      let successCount = 0;
      let skippedCount = 0;

      for (const command of allCommands) {
        try {
          store.dispatch({
            type: command.type,
            payload: command.payload,
            meta: { command },
          });
          successCount++;
        } catch (error) {
          // Check if this is an expected error (operation on deleted entity)
          const isEntityNotFoundError = error instanceof Error &&
            (error.message.includes('not found') ||
              error.message.includes('does not exist'));

          if (isEntityNotFoundError) {
            // This is expected - commands for deleted entities can safely be skipped
            logger.warn(`Skipped command ${command.type} for deleted entity (${error.message})`);
            skippedCount++;
          } else {
            // Unexpected error - log as error
            logger.error(`Error replaying command ${command.type}:`, error);
          }
        }
      }

      logger.info(`Command replay complete: ${successCount} applied, ${skippedCount} skipped (deleted entities)`);
    },

    // ===== History management =====
    getHistoryStats(): HistoryStats {
      const state = store.getState();
      return selectHistoryStats(state);
    },

    pruneAllHistory(): void {
      logger.info('Pruning all command history');

      const statsBefore = this.getHistoryStats();
      logger.info(`History before pruning: ${statsBefore.totalCommands} commands (~${statsBefore.estimatedSizeKB}KB)`);

      // Dispatch prune actions to all slices
      store.dispatch(pruneCharacterHistory());
      store.dispatch(pruneCrewHistory());
      store.dispatch(pruneClockHistory());

      const statsAfter = this.getHistoryStats();
      logger.info(`History after pruning: ${statsAfter.totalCommands} commands (~${statsAfter.estimatedSizeKB}KB)`);
      logger.info('History pruning complete - current state snapshot retained');
    },

    cleanupOrphanedClocks(validEntityIds: string[]): void {
      logger.info('Cleaning up orphaned clocks');
      store.dispatch(cleanupOrphanedClocks({ validEntityIds }));
    },

    cleanupOrphanedCharacters(validEntityIds: string[]): void {
      console.log('FitGD | Cleaning up orphaned characters');
      store.dispatch(cleanupOrphanedCharacters({ validIds: validEntityIds }));
    },

    cleanupOrphanedCrews(validEntityIds: string[]): void {
      console.log('FitGD | Cleaning up orphaned crews');
      store.dispatch(cleanupOrphanedCrews({ validIds: validEntityIds }));
    },
  };
}

// Re-export types
export * from './types';
export { exportCharacterToFoundry, importCharacterFromFoundry } from './characterAdapter';
export { exportCrewToFoundry, importCrewFromFoundry } from './crewAdapter';

// Re-export clock renderer utilities
export {
  getClockSVGPath,
  getClockRenderData,
  getClockHTML,
  getClockHandlebarsHelper,
  getClockClickValue,
  preloadClockAssets,
} from './clockRenderer';
