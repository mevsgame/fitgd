/**
 * Foundry-Redux Bridge API
 *
 * This is the ONLY interface Foundry code should use to interact with Redux.
 *
 * CRITICAL RULES:
 * - Foundry code should NEVER call store.dispatch() directly
 * - Foundry code should NEVER call saveImmediate() directly
 * - Foundry code should NEVER call refreshSheetsByReduxId() directly
 * - Use this API instead - it handles dispatch → broadcast → refresh automatically
 *
 * WHY THIS EXISTS:
 * The pattern "dispatch → broadcast → refresh" must happen together or state
 * won't propagate to other clients. By using this API, you can't forget.
 */

import type { Store, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { Clock } from '@/types/clock';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { ReduxId } from './types/ids';
import { isValidId } from './types/ids';

/**
 * Redux action shape
 */
export interface ReduxAction extends UnknownAction {
  type: string;
  payload?: Record<string, unknown>;
}

/**
 * Options for execute() and executeBatch() operations
 */
export interface ExecuteOptions {
  /** Character/crew IDs to refresh (auto-detected if not provided) */
  affectedReduxIds?: ReduxId[];
  /** Force full re-render (default: false) */
  force?: boolean;
  /** Skip sheet refresh (default: false) */
  silent?: boolean;
}

/**
 * Core Foundry-Redux Bridge
 *
 * Provides high-level operations that handle the full lifecycle:
 * 1. Dispatch Redux action
 * 2. Broadcast to all clients
 * 3. Refresh affected sheets
 */
export class FoundryReduxBridge {
  private readonly store: Store<RootState>;
  private readonly saveImmediate: () => Promise<void>;

  /**
   * Create a new Foundry-Redux Bridge instance
   *
   * @param store - Redux store instance (game.fitgd.store)
   * @param saveFunction - Broadcast function (game.fitgd.saveImmediate)
   */
  constructor(store: Store<RootState>, saveFunction: () => Promise<void>) {
    this.store = store;
    this.saveImmediate = saveFunction;
  }

  /**
   * Get current Redux state (read-only access)
   *
   * Use this sparingly - prefer using the specific query methods below
   * (getCharacter, getCrew, getClocks, getPlayerRoundState) as they provide
   * better type safety and ID conversion.
   *
   * @returns Current Redux state
   */
  getState(): RootState {
    return this.store.getState();
  }

  /**
   * Execute a single Redux action and propagate to all clients.
   *
   * @param action - Redux action to dispatch
   * @param options - Execution options
   * @returns Promise that resolves when complete
   */
  async execute(action: ReduxAction, options: ExecuteOptions = {}): Promise<void> {
    const { affectedReduxIds, force = false, silent = false } = options;

    // Dispatch to Redux
    this.store.dispatch(action);

    // Broadcast to all clients
    await this.saveImmediate();

    // Refresh affected sheets (unless silent)
    if (!silent) {
      const idsToRefresh = affectedReduxIds || this._extractAffectedIds(action);
      if (idsToRefresh.length > 0) {
        this._refreshSheets(idsToRefresh, force);
      }
    }
  }

  /**
   * Execute multiple Redux actions as a batch and propagate to all clients.
   *
   * CRITICAL: This ensures only ONE broadcast happens for multiple state changes,
   * preventing render race conditions.
   *
   * @param actions - Array of Redux actions to dispatch
   * @param options - Execution options (same as execute())
   * @returns Promise that resolves when complete
   */
  async executeBatch(actions: ReduxAction[], options: ExecuteOptions = {}): Promise<void> {
    const { affectedReduxIds, force = false, silent = false } = options;

    // VALIDATION: Prevent batching multiple state transitions
    // All actions in a batch validate against the SAME initial state, so sequential
    // transitions (e.g., A → B → C) will fail validation. See docs/redux-batching-rules.md
    const transitionActions = actions.filter(a => a.type === 'playerRoundState/transitionState');

    if (transitionActions.length > 1) {
      const states = transitionActions
        .map(a => (a.payload as any)?.newState)
        .filter(Boolean)
        .join(' → ');

      throw new Error(
        `Cannot batch ${transitionActions.length} state transitions (${states}). ` +
        `All actions validate against the SAME initial state. ` +
        `Split into separate dispatches or use a single transition. ` +
        `See docs/redux-batching-rules.md for details.`
      );
    }

    // Dispatch all actions synchronously (single Redux transaction)
    for (const action of actions) {
      this.store.dispatch(action);
    }

    // Single broadcast with complete state
    await this.saveImmediate();

    // Refresh affected sheets (unless silent)
    if (!silent) {
      const idsToRefresh = affectedReduxIds || this._extractAffectedIdsFromBatch(actions);
      if (idsToRefresh.length > 0) {
        this._refreshSheets(idsToRefresh, force);
      }
    }
  }

  /**
   * Query a character by ID.
   *
   * @param id - Redux ID (unified with Foundry Actor ID after migration)
   * @returns Character state from Redux, or undefined if not found
   */
  getCharacter(id: ReduxId): Character | undefined {
    const reduxId = this._ensureReduxId(id, 'character');
    if (!reduxId) return undefined;

    const state = this.getState();
    return state.characters.byId[reduxId];
  }

  /**
   * Query a crew by ID.
   *
   * @param id - Redux ID (unified with Foundry Actor ID after migration)
   * @returns Crew state from Redux, or undefined if not found
   */
  getCrew(id: ReduxId): Crew | undefined {
    const reduxId = this._ensureReduxId(id, 'crew');
    if (!reduxId) return undefined;

    const state = this.getState();
    return state.crews.byId[reduxId];
  }

  /**
   * Query clocks for an entity.
   *
   * @param entityId - Redux ID of character/crew
   * @param clockType - Optional: filter by 'harm', 'consumable', 'addiction', 'progress'
   * @returns Array of clocks
   */
  getClocks(entityId: ReduxId, clockType: string | null = null): Clock[] {
    const state = this.getState();
    const clockIds = state.clocks.byEntityId[entityId] || [];

    let clocks = clockIds
      .map(id => state.clocks.byId[id])
      .filter((clock): clock is Clock => Boolean(clock));

    if (clockType) {
      clocks = clocks.filter(clock => clock.clockType === clockType);
    }

    return clocks;
  }

  /**
   * Get player round state for a character.
   *
   * @param characterId - Redux ID of character
   * @returns Player round state, or undefined if not found
   */
  getPlayerRoundState(characterId: ReduxId): PlayerRoundState | undefined {
    const state = this.getState();
    return state.playerRoundState.byCharacterId[characterId];
  }

  // ==================== INTERNAL HELPERS ====================

  /**
   * Validate entity ID (unified IDs: Foundry Actor ID === Redux ID)
   *
   * With unified IDs, this just validates that the ID is a valid string.
   * Kept for API compatibility but greatly simplified from the old version
   * which had to translate between Foundry Actor IDs and Redux UUIDs.
   *
   * @param id - Entity ID to validate
   * @param entityType - Entity type ('character' or 'crew') for error messages
   * @returns The ID if valid, null otherwise
   * @private
   */
  private _ensureReduxId(id: ReduxId, entityType: string): ReduxId | null {
    if (!isValidId(id)) {
      console.warn(`[FoundryReduxBridge] Invalid ${entityType} ID:`, id);
      return null;
    }
    return id; // With unified IDs, no translation needed!
  }

  /**
   * Extract affected Redux IDs from action payload
   *
   * Automatically detects which characters/crews are affected by a Redux action
   * by inspecting common payload patterns (characterId, crewId, entityId, clockId).
   *
   * For clock operations, resolves the clock's entityId so the owning character/crew
   * sheet gets refreshed automatically.
   *
   * @param action - Redux action to inspect
   * @returns Array of Redux IDs that should have their sheets refreshed
   * @private
   */
  private _extractAffectedIds(action: ReduxAction): ReduxId[] {
    const ids = new Set<ReduxId>();
    const payload = action.payload || {};

    // Common patterns for entity IDs in payloads
    // Guard against null/undefined values
    if (payload.characterId && typeof payload.characterId === 'string') {
      ids.add(payload.characterId as ReduxId);
    }
    if (payload.crewId && typeof payload.crewId === 'string') {
      ids.add(payload.crewId as ReduxId);
    }
    if (payload.entityId && typeof payload.entityId === 'string') {
      ids.add(payload.entityId as ReduxId);
    }

    // For clock operations, also refresh the entity that owns the clock
    if (payload.clockId) {
      const state = this.getState();
      const clock = state.clocks.byId[payload.clockId as string];
      if (clock?.entityId) {
        ids.add(clock.entityId as ReduxId);
      }
    }

    // Filter out any null/undefined that may have snuck in
    return Array.from(ids).filter((id): id is ReduxId => isValidId(id));
  }

  /**
   * Extract affected Redux IDs from batch of actions
   *
   * Combines ID extraction across multiple actions to determine the complete
   * set of entities that need sheet refresh after a batch operation.
   *
   * @param actions - Array of Redux actions to inspect
   * @returns Array of unique Redux IDs that should have their sheets refreshed
   * @private
   */
  private _extractAffectedIdsFromBatch(actions: ReduxAction[]): ReduxId[] {
    const ids = new Set<ReduxId>();

    for (const action of actions) {
      const actionIds = this._extractAffectedIds(action);
      actionIds.forEach(id => ids.add(id));
    }

    return Array.from(ids);
  }

  /**
   * Refresh all open sheets for the given Redux IDs
   *
   * Iterates through all open Foundry windows and refreshes any character/crew
   * sheets that match the provided Redux IDs. This is the safe alternative to
   * trying to use `game.actors.get(reduxId)` which fails silently.
   *
   * @param reduxIds - Array of Redux IDs to refresh
   * @param force - Whether to force full re-render (default: false)
   * @private
   */
  private _refreshSheets(ids: ReduxId[], force = false): void {
    const affectedIds = new Set(ids.filter(id => isValidId(id)));

    for (const app of Object.values(ui.windows)) {
      if (app.constructor.name === 'FitGDCharacterSheet' ||
        app.constructor.name === 'FitGDCrewSheet') {

        const actorId = (app as any).actor?.id as ReduxId | undefined; // Unified IDs: actor.id === Redux ID

        if (actorId && affectedIds.has(actorId)) {
          app.render(force);
        }
      }
    }
  }
}

// ==================== CONVENIENCE EXPORTS ====================

/**
 * Create a Foundry-Redux Bridge instance.
 *
 * This should be called once during Foundry initialization and stored
 * at game.fitgd.bridge for global access.
 *
 * @param store - Redux store
 * @param saveFunction - Function that broadcasts state (game.fitgd.saveImmediate)
 * @returns FoundryReduxBridge instance
 */
export function createFoundryReduxBridge(
  store: Store<RootState>,
  saveFunction: () => Promise<void>
): FoundryReduxBridge {
  return new FoundryReduxBridge(store, saveFunction);
}
