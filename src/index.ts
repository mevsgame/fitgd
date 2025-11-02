/**
 * @fitgd/core
 *
 * Event-sourced Redux state management for Forged in the Grimdark RPG system.
 *
 * Main exports:
 * - Types: Character, Crew, Clock, Command, GameConfig
 * - API: createGameAPI() factory function
 * - Config: DEFAULT_CONFIG
 */

// Types
export * from './types';

// Config
export { DEFAULT_CONFIG } from './config';

// API
export * from './api';

// Version
export const VERSION = '0.1.0';
