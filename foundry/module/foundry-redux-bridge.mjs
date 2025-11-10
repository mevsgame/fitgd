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

/**
 * Core Foundry-Redux Bridge
 *
 * Provides high-level operations that handle the full lifecycle:
 * 1. Dispatch Redux action
 * 2. Broadcast to all clients
 * 3. Refresh affected sheets
 */
export class FoundryReduxBridge {
  constructor(store, saveFunction) {
    this.store = store;
    this.saveImmediate = saveFunction;
  }

  /**
   * Get current state (read-only).
   *
   * Use this sparingly - prefer using the specific query methods below.
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
   * @returns {Object|null} Character state from Redux
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
   * @returns {Object|null} Crew state from Redux
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
   * @param {string} clockType - Optional: filter by 'harm', 'consumable', 'addiction'
   * @returns {Object[]} Array of clocks
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
   * @returns {Object|null} Player round state
   */
  getPlayerRoundState(characterId) {
    const state = this.getState();
    return state.playerRoundState.byCharacterId[characterId] || null;
  }

  // ==================== INTERNAL HELPERS ====================

  /**
   * Convert Foundry Actor ID to Redux ID if needed.
   *
   * @private
   */
  _ensureReduxId(id, entityType) {
    // If it's already a Redux ID (UUID format), return as-is
    if (this._isReduxId(id)) {
      return id;
    }

    // It's a Foundry Actor ID - look up Redux ID from flags
    const actor = game.actors.get(id);
    if (!actor) {
      console.warn(`[FoundryReduxBridge] Actor not found: ${id}`);
      return null;
    }

    const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
    if (!reduxId) {
      console.warn(`[FoundryReduxBridge] Actor ${id} has no Redux ID flag`);
      return null;
    }

    return reduxId;
  }

  /**
   * Check if ID is a Redux UUID vs Foundry Actor ID.
   *
   * @private
   */
  _isReduxId(id) {
    // Redux IDs are UUIDs, Foundry Actor IDs contain dots
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Extract affected Redux IDs from action payload.
   *
   * @private
   */
  _extractAffectedIds(action) {
    const ids = new Set();
    const payload = action.payload || {};

    // Common patterns for entity IDs in payloads
    if (payload.characterId) ids.add(payload.characterId);
    if (payload.crewId) ids.add(payload.crewId);
    if (payload.entityId) ids.add(payload.entityId);

    // For clock operations, also refresh the entity that owns the clock
    if (payload.clockId) {
      const state = this.getState();
      const clock = state.clocks.byId[payload.clockId];
      if (clock) ids.add(clock.entityId);
    }

    return Array.from(ids);
  }

  /**
   * Extract affected Redux IDs from batch of actions.
   *
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
   * Refresh all open sheets for the given Redux IDs.
   *
   * @private
   */
  _refreshSheets(reduxIds, force = false) {
    const affectedReduxIds = new Set(reduxIds.filter(id => id));

    for (const app of Object.values(ui.windows)) {
      if (app.constructor.name === 'FitGDCharacterSheet' ||
          app.constructor.name === 'FitGDCrewSheet') {

        const reduxId = app.actor?.getFlag('forged-in-the-grimdark', 'reduxId');

        if (reduxId && affectedReduxIds.has(reduxId)) {
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
