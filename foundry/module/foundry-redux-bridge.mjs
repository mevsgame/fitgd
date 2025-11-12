// @ts-check

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
 *
 * @typedef {import('../dist/store').RootState} RootState
 * @typedef {import('../dist/types').Character} Character
 * @typedef {import('../dist/types').Crew} Crew
 * @typedef {import('../dist/types').Clock} Clock
 * @typedef {import('../dist/types').PlayerRoundState} PlayerRoundState
 */

/**
 * Core Foundry-Redux Bridge
 *
 * Provides high-level operations that handle the full lifecycle:
 * 1. Dispatch Redux action
 * 2. Broadcast to all clients
 * 3. Refresh affected sheets
 */
export class FoundryReduxBridge {
  /**
   * Create a new Foundry-Redux Bridge instance
   *
   * @param {Object} store - Redux store instance (game.fitgd.store)
   * @param {Function} saveFunction - Broadcast function (game.fitgd.saveImmediate)
   */
  constructor(store, saveFunction) {
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
   * @returns {RootState} Current Redux state
   */
  getState() {
    return this.store.getState();
  }

  /**
   * Execute a single Redux action and propagate to all clients.
   *
   * @param {Object} action - Redux action to dispatch
   * @param {Object} options - Execution options
   * @param {string[]} options.affectedReduxIds - Character/crew IDs to refresh (auto-detected if not provided)
   * @param {boolean} options.force - Force full re-render (default: false)
   * @param {boolean} options.silent - Skip sheet refresh (default: false)
   * @returns {Promise<void>}
   */
  async execute(action, options = {}) {
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
   * @param {Object[]} actions - Array of Redux actions to dispatch
   * @param {Object} options - Execution options (same as execute())
   * @returns {Promise<void>}
   */
  async executeBatch(actions, options = {}) {
    const { affectedReduxIds, force = false, silent = false } = options;

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
   * Query a character by ID (auto-detects Redux vs Foundry ID).
   *
   * @param {string} id - Either Redux UUID or Foundry Actor ID
   * @returns {Character|null} Character state from Redux
   */
  getCharacter(id) {
    const reduxId = this._ensureReduxId(id, 'character');
    if (!reduxId) return null;

    const state = this.getState();
    return state.characters.byId[reduxId] || null;
  }

  /**
   * Query a crew by ID (auto-detects Redux vs Foundry ID).
   *
   * @param {string} id - Either Redux UUID or Foundry Actor ID
   * @returns {Crew|null} Crew state from Redux
   */
  getCrew(id) {
    const reduxId = this._ensureReduxId(id, 'crew');
    if (!reduxId) return null;

    const state = this.getState();
    return state.crews.byId[reduxId] || null;
  }

  /**
   * Query clocks for an entity.
   *
   * @param {string} entityId - Redux ID of character/crew
   * @param {string|null} clockType - Optional: filter by 'harm', 'consumable', 'addiction'
   * @returns {Clock[]} Array of clocks
   */
  getClocks(entityId, clockType = null) {
    const state = this.getState();
    const clockIds = state.clocks.byEntityId[entityId] || [];

    let clocks = clockIds.map(id => state.clocks.byId[id]).filter(Boolean);

    if (clockType) {
      clocks = clocks.filter(clock => clock.clockType === clockType);
    }

    return clocks;
  }

  /**
   * Get player round state for a character.
   *
   * @param {string} characterId - Redux ID of character
   * @returns {PlayerRoundState|null} Player round state
   */
  getPlayerRoundState(characterId) {
    const state = this.getState();
    return state.playerRoundState.byCharacterId[characterId] || null;
  }

  // ==================== INTERNAL HELPERS ====================

  /**
   * Validate entity ID (unified IDs: Foundry Actor ID === Redux ID)
   *
   * With unified IDs, this just validates that the ID is a valid string.
   * Kept for API compatibility but greatly simplified from the old version
   * which had to translate between Foundry Actor IDs and Redux UUIDs.
   *
   * @param {string} id - Entity ID to validate
   * @param {string} entityType - Entity type ('character' or 'crew') for error messages
   * @returns {string|null} The ID if valid, null otherwise
   * @private
   */
  _ensureReduxId(id, entityType) {
    if (!id || typeof id !== 'string') {
      console.warn(`[FoundryReduxBridge] Invalid ${entityType} ID:`, id);
      return null;
    }
    return id; // With unified IDs, no translation needed!
  }

  /**
   * Check if ID is valid (simplified with unified IDs)
   *
   * Previously checked if ID was a Redux UUID vs Foundry Actor ID.
   * With unified IDs, this just validates it's a non-empty string.
   * Kept for backwards compatibility.
   *
   * @param {string} id - ID to check
   * @returns {boolean} True if ID is valid
   * @private
   */
  _isReduxId(id) {
    return Boolean(id && typeof id === 'string');
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
   * @param {Object} action - Redux action to inspect
   * @returns {string[]} Array of Redux UUIDs that should have their sheets refreshed
   * @private
   */
  _extractAffectedIds(action) {
    const ids = new Set();
    const payload = action.payload || {};

    // Common patterns for entity IDs in payloads
    // Guard against null/undefined values
    if (payload.characterId && typeof payload.characterId === 'string') {
      ids.add(payload.characterId);
    }
    if (payload.crewId && typeof payload.crewId === 'string') {
      ids.add(payload.crewId);
    }
    if (payload.entityId && typeof payload.entityId === 'string') {
      ids.add(payload.entityId);
    }

    // For clock operations, also refresh the entity that owns the clock
    if (payload.clockId) {
      const state = this.getState();
      const clock = state.clocks.byId[payload.clockId];
      if (clock && clock.entityId) ids.add(clock.entityId);
    }

    // Filter out any null/undefined that may have snuck in
    return Array.from(ids).filter(id => id && typeof id === 'string');
  }

  /**
   * Extract affected Redux IDs from batch of actions
   *
   * Combines ID extraction across multiple actions to determine the complete
   * set of entities that need sheet refresh after a batch operation.
   *
   * @param {Object[]} actions - Array of Redux actions to inspect
   * @returns {string[]} Array of unique Redux UUIDs that should have their sheets refreshed
   * @private
   */
  _extractAffectedIdsFromBatch(actions) {
    const ids = new Set();

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
   * @param {string[]} reduxIds - Array of Redux UUIDs to refresh
   * @param {boolean} force - Whether to force full re-render (default: false)
   * @returns {void}
   * @private
   */
  _refreshSheets(ids, force = false) {
    const affectedIds = new Set(ids.filter(id => id));

    for (const app of Object.values(ui.windows)) {
      if (app.constructor.name === 'FitGDCharacterSheet' ||
          app.constructor.name === 'FitGDCrewSheet') {

        const actorId = app.actor?.id; // Unified IDs: actor.id === Redux ID

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
 * at game.fitgd.api for global access.
 *
 * @param {Object} store - Redux store
 * @param {Function} saveFunction - Function that broadcasts state (game.fitgd.saveImmediate)
 * @returns {FoundryReduxBridge}
 */
export function createFoundryReduxBridge(store, saveFunction) {
  return new FoundryReduxBridge(store, saveFunction);
}
