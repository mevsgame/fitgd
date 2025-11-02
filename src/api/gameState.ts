import type { Command, GameConfig } from '../types';

/**
 * Serialized State for persistence
 */
export interface SerializedState {
  characters: Record<string, unknown>;
  crews: Record<string, unknown>;
  clocks: Record<string, unknown>;
  history: Command[];
}

/**
 * Game State API
 *
 * High-level API for state management, persistence, and configuration.
 */
export interface GameStateAPI {
  // Export/Import
  exportState(): SerializedState;
  importState(state: SerializedState): void;

  // Command History
  getCommandHistory(): Command[];
  replayCommands(commands: Command[]): void;

  // Undo/Redo (future feature)
  undo(): boolean;
  redo(): boolean;

  // Configuration
  getConfig(): GameConfig;
  setConfig(config: Partial<GameConfig>): void;
}
