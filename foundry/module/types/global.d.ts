/**
 * Global type declarations for Foundry VTT integration
 *
 * Extends Foundry VTT types with custom game.fitgd namespace
 */

/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

import type { Store } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { GameAPI } from '@/api';
import type { FoundryAdapter } from '@/adapters/foundryAdapter';

/**
 * Foundry Redux Bridge API
 * Provides safe abstraction over Redux store operations
 */
export interface FoundryReduxBridge {
  /**
   * Execute a single Redux action with automatic broadcast and sheet refresh
   */
  execute(
    action: { type: string; payload?: unknown },
    options?: { affectedReduxIds?: string[] }
  ): Promise<void>;

  /**
   * Execute multiple Redux actions in a batch (single broadcast)
   */
  executeBatch(
    actions: Array<{ type: string; payload?: unknown }>,
    options?: { affectedReduxIds?: string[] }
  ): Promise<void>;

  /**
   * Get character by Redux ID
   */
  getCharacter(id: string): import('@/types/character').Character | undefined;

  /**
   * Get crew by Redux ID
   */
  getCrew(id: string): import('@/types/crew').Crew | undefined;

  /**
   * Get clocks for an entity
   */
  getClocks(entityId: string, clockType?: string): import('@/types/clock').Clock[];
}

/**
 * Socketlib socket interface
 */
export interface FitGDSocket {
  register(event: string, callback: Function): void;
  executeForOthers(event: string, data: unknown): Promise<unknown>;
  executeAsGM(event: string, data: unknown): Promise<unknown>;
  executeAsUser(event: string, userId: string, data: unknown): Promise<unknown>;
  executeForEveryone(event: string, data: unknown): Promise<unknown>;
}

/**
 * Global game.fitgd namespace
 */
export interface FitGDGame {
  /** Redux store instance */
  store: Store<RootState>;

  /** High-level game API */
  api: GameAPI;

  /** Foundry adapter for state persistence */
  foundry: FoundryAdapter;

  /** Foundry-Redux bridge for safe state changes */
  bridge: FoundryReduxBridge;

  /** socketlib socket for multiplayer sync */
  socket: FitGDSocket;

  /**
   * Save and broadcast state changes immediately
   * Must be called after any store.dispatch() to sync to other clients
   */
  saveImmediate(): Promise<void>;

  /** Debug function to test socket communication */
  testSocket?(): Promise<void>;

  /** Migration backup (temporary, only during migration) */
  __migrationBackup?: unknown;
}

// Extend Foundry's Game interface
declare global {
  interface Game {
    fitgd: FitGDGame;
  }

  // Socketlib global
  const socketlib: {
    registerSystem(systemId: string): FitGDSocket;
  };
}

// This file is a module (required for global augmentation)
export {};
