/**
 * Player Action Widget
 *
 * A persistent widget that appears when it's a player's turn in an encounter.
 * Drives the action resolution flow through the state machine.
 */

// @ts-check

/**
 * @typedef {import('../../dist/types').Character} Character
 * @typedef {import('../../dist/types').Crew} Crew
 * @typedef {import('../../dist/types').Clock} Clock
 * @typedef {import('../../dist/types').Trait} Trait
 * @typedef {import('../../dist/store').RootState} RootState
 * @typedef {import('../../dist/types/playerRoundState').PlayerRoundState} PlayerRoundState
 * @typedef {import('../../dist/types/playerRoundState').Position} Position
 * @typedef {import('../../dist/types/playerRoundState').Effect} Effect
 */

import {
  selectDicePool,
  selectConsequenceSeverity,
  selectMomentumGain,
  selectMomentumCost,
  selectCanUseRally,
  selectHarmClocksWithStatus,
  selectIsDying,
} from '../../dist/fitgd-core.es.js';
import { FlashbackTraitsDialog, refreshSheetsByReduxId } from '../dialogs.mjs';
import { ClockSelectionDialog, CharacterSelectionDialog, ClockCreationDialog, LeanIntoTraitDialog } from '../dialogs/index.mjs';

/* -------------------------------------------- */
/*  Player Action Widget Application            */
/* -------------------------------------------- */

/**
 * Player Action Widget
 *
 * A persistent UI widget that appears during combat encounters to guide a player
 * through their action resolution. Implements a state machine with the following phases:
 *
 * **DECISION_PHASE**: Player chooses action, position, effect, and any improvements
 * - Select action (based on character's action dots)
 * - Set position (Controlled/Risky/Desperate)
 * - Set effect (Limited/Standard/Great)
 * - Optional: Push yourself (extra die, improve position/effect)
 * - Optional: Use traits via flashback
 * - Optional: Equip consumables/items
 *
 * **ROLLING**: Dice are being rolled (async operation)
 * - Calculates dice pool from action dots + bonuses
 * - Handles 0-dot actions (roll 2d6 keep lowest)
 * - Evaluates outcome (critical/success/partial/failure)
 *
 * **AWAITING_APPROVAL**: GM must approve the roll before proceeding
 * - Shows roll result and improvements to GM
 * - GM can approve or modify outcome
 *
 * **CONSEQUENCE_CHOICE**: Player must handle consequences
 * - Success: No consequences, turn ends
 * - Failure: Take harm based on position
 * - Severe failure: Additional complications
 *
 * **COMPLETE**: Turn finished, widget closes
 *
 * The widget subscribes to Redux store changes for real-time updates across all clients
 * (GM sees player's decisions immediately, player sees GM's approval).
 *
 * @extends Application
 */
export class PlayerActionWidget extends Application {
  /**
   * Create a new Player Action Widget
   *
   * @param {string} characterId - Redux ID of the character taking their turn
   * @param {Object} options - Additional options passed to Application constructor
   */
  constructor(characterId, options = {}) {
    super(options);

    this.characterId = characterId;
    this.character = null;
    this.crew = null;
    this.playerState = null;
    this.storeUnsubscribe = null; // Will store the unsubscribe function
  }

  /** @override */
  async _render(force, options) {
    await super._render(force, options);

    // Subscribe to Redux store changes for real-time updates
    if (!this.storeUnsubscribe) {
      let previousState = game.fitgd.store.getState();

      this.storeUnsubscribe = game.fitgd.store.subscribe(() => {
        const currentState = game.fitgd.store.getState();
        const currentPlayerState = currentState.playerRoundState.byCharacterId[this.characterId];
        const previousPlayerState = previousState.playerRoundState.byCharacterId[this.characterId];

        // Only re-render if this character's state actually changed
        if (currentPlayerState !== previousPlayerState) {
          this.render(true); // Force full re-render to update template
        }

        previousState = currentState;
      });
    }
  }

  /** @override */
  async close(options) {
    // Unsubscribe from store updates
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    return super.close(options);
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'player-action-widget'],
      template: 'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html',
      width: 600,
      height: 'auto',
      minimizable: false,
      resizable: false,
      title: 'Your Turn',
      popOut: true,
    });
  }

  /** @override */
  get id() {
    return `player-action-widget-${this.characterId}`;
  }

  /**
   * Get template data for rendering the widget
   *
   * Fetches character, crew, and player round state from Redux store,
   * calculates derived values (dice pool, improvements, state flags),
   * and prepares all data needed by the Handlebars template.
   *
   * @param {Object} options - Render options
   * @returns {Promise<Object>} Template data with character, crew, playerState, and UI flags
   * @override
   */
  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options);

    // Get character from Redux store
    this.character = game.fitgd.api.character.getCharacter(this.characterId);
    if (!this.character) {
      ui.notifications.error('Character not found');
      return data;
    }

    // Get crew (assuming character is in a crew)
    const state = game.fitgd.store.getState();
    const crewId = Object.values(state.crews.byId)
      .find(crew => crew.characters.includes(this.characterId))?.id;

    if (crewId) {
      this.crew = game.fitgd.api.crew.getCrew(crewId);
      this.crewId = crewId; // Store crewId separately for easy access
    } else {
      this.crew = null;
      this.crewId = null;
    }

    // Get player round state
    this.playerState = state.playerRoundState.byCharacterId[this.characterId];

    console.log('FitGD | Widget getData() - Current state:', this.playerState?.state, 'isGM:', game.user.isGM);

    // Build data for template
    return {
      ...data,
      character: this.character,
      crew: this.crew,
      crewId: this.crewId,
      playerState: this.playerState,

      // State flags (ROLL_CONFIRM state removed)
      isDecisionPhase: this.playerState?.state === 'DECISION_PHASE',
      isRolling: this.playerState?.state === 'ROLLING',
      isStimsRolling: this.playerState?.state === 'STIMS_ROLLING',
      isStimsLocked: this.playerState?.state === 'STIMS_LOCKED',
      isSuccess: this.playerState?.state === 'SUCCESS_COMPLETE',
      isConsequenceChoice: this.playerState?.state === 'CONSEQUENCE_CHOICE',
      isGMResolvingConsequence: this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE',

      // Available actions
      actions: Object.keys(this.character.actionDots),

      // Harm clocks (for display) - using selector
      harmClocks: selectHarmClocksWithStatus(state, this.characterId),
      isDying: selectIsDying(state, this.characterId),

      // Current momentum
      momentum: this.crew?.currentMomentum || 0,
      maxMomentum: 10,

      // Rally availability - using selector
      canRally: this.crewId ? selectCanUseRally(state, this.characterId, this.crewId) : false,

      // Computed dice pool - using selector
      dicePool: selectDicePool(state, this.characterId),

      // Momentum cost - using selector
      momentumCost: selectMomentumCost(this.playerState),

      // Computed improvements preview
      improvements: this._computeImprovements(),

      // Improved position (if trait improves it)
      improvedPosition: this._computeImprovedPosition(),

      // Improved effect (if Push Effect is active)
      improvedEffect: this._computeImprovedEffect(),

      // GM controls
      isGM: game.user.isGM,

      // Stims availability
      stimsLocked: this._areStimsLocked(state),

      // Consequence transaction data (for GM_RESOLVING_CONSEQUENCE state)
      ...(this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE' ? this._getConsequenceData(state) : {}),
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Action selection
    html.find('.action-select').change(this._onActionChange.bind(this));

    // GM position/effect controls
    html.find('.position-select').change(this._onPositionChange.bind(this));
    html.find('.effect-select').change(this._onEffectChange.bind(this));

    // GM approve roll button
    html.find('[data-action="approve-roll"]').click(this._onApproveRoll.bind(this));

    // Prepare action buttons
    html.find('[data-action="rally"]').click(this._onRally.bind(this));
    html.find('[data-action="lean-into-trait"]').click(this._onLeanIntoTrait.bind(this));
    html.find('[data-action="use-trait"]').click(this._onUseTrait.bind(this));
    html.find('[data-action="equipment"]').click(this._onEquipment.bind(this));
    html.find('[data-action="push-die"]').click(this._onTogglePushDie.bind(this));
    html.find('[data-action="push-effect"]').click(this._onTogglePushEffect.bind(this));

    // Roll button (simplified: no more commit-roll button)
    html.find('[data-action="roll"]').click(this._onRoll.bind(this));

    // Consequence buttons
    html.find('[data-action="use-stims"]').click(this._onUseStims.bind(this));
    html.find('[data-action="accept-consequences"]').click(this._onAcceptConsequences.bind(this));

    // GM consequence configuration buttons
    html.find('[data-action="select-consequence-type"]').click(this._onSelectConsequenceType.bind(this));
    html.find('[data-action="select-harm-target"]').click(this._onSelectHarmTarget.bind(this));
    html.find('[data-action="select-harm-clock"]').click(this._onSelectHarmClock.bind(this));
    html.find('[data-action="select-crew-clock"]').click(this._onSelectCrewClock.bind(this));
    html.find('[name="crew-clock-segments"]').change(this._onCrewClockSegmentsChange.bind(this));
    html.find('[data-action="approve-consequence"]').click(this._onApproveConsequence.bind(this));

    // Player stims button (from GM phase)
    html.find('[data-action="use-stims-gm-phase"]').click(this._onUseStimsGMPhase.bind(this));

    // Cancel button (back button removed - no more ROLL_CONFIRM state)
    html.find('[data-action="cancel"]').click(this._onCancel.bind(this));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply trait transaction to character
   * @param {TraitTransaction} transaction - The transaction to apply
   */
  async _applyTraitTransaction(transaction) {
    const actions = [];

    if (transaction.mode === 'existing') {
      // No character changes needed for using existing trait
      console.log(`FitGD | Using existing trait: ${transaction.selectedTraitId}`);

    } else if (transaction.mode === 'new') {
      // Create new flashback trait
      const newTrait = {
        id: foundry.utils.randomID(),
        name: transaction.newTrait.name,
        description: transaction.newTrait.description,
        category: 'flashback',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: newTrait,
        },
      });

      console.log(`FitGD | Will create new trait: ${newTrait.name}`);

    } else if (transaction.mode === 'consolidate') {
      // Remove 3 traits and create consolidated trait
      const consolidation = transaction.consolidation;

      // Queue removal of the 3 traits
      for (const traitId of consolidation.traitIdsToRemove) {
        actions.push({
          type: 'characters/removeTrait',
          payload: {
            characterId: this.characterId,
            traitId,
          },
        });
      }

      // Queue creation of consolidated trait
      const consolidatedTrait = {
        id: foundry.utils.randomID(),
        name: consolidation.newTrait.name,
        description: consolidation.newTrait.description,
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: consolidatedTrait,
        },
      });

      console.log(`FitGD | Will consolidate traits into: ${consolidatedTrait.name}`);
    }

    // Execute all trait changes as a batch (single broadcast, prevents render race)
    if (actions.length > 0) {
      await game.fitgd.bridge.executeBatch(actions, {
        affectedReduxIds: [this.characterId],
        force: true, // Force full re-render to show new traits
      });
    }
  }

  /**
   * Compute improved position (if trait transaction improves it)
   */
  _computeImprovedPosition() {
    if (!this.playerState?.traitTransaction?.positionImprovement) {
      return this.playerState?.position || 'risky';
    }

    const currentPosition = this.playerState.position || 'risky';

    // Improve position by one step
    if (currentPosition === 'desperate') return 'risky';
    if (currentPosition === 'risky') return 'controlled';

    // Already controlled, no improvement
    return currentPosition;
  }

  /**
   * Compute improved effect (if Push Effect is active)
   */
  _computeImprovedEffect() {
    const baseEffect = this.playerState?.effect || 'standard';

    // Check if Push (Effect) is active
    if (this.playerState?.pushed && this.playerState?.pushType === 'improved-effect') {
      // Improve effect by one level
      if (baseEffect === 'limited') return 'standard';
      if (baseEffect === 'standard') return 'great';
      // Already great, can't improve further
      return baseEffect;
    }

    // No improvement, return base effect
    return baseEffect;
  }

  /**
   * Compute EFFECTIVE position for roll calculation (ephemeral)
   * This does NOT change the stored position, only used for dice/consequence calculations
   */
  _getEffectivePosition() {
    const basePosition = this.playerState?.position || 'risky';

    // Check if trait transaction improves position
    if (this.playerState?.traitTransaction?.positionImprovement) {
      if (basePosition === 'desperate') return 'risky';
      if (basePosition === 'risky') return 'controlled';
      // Already controlled
      return basePosition;
    }

    return basePosition;
  }

  /**
   * Compute EFFECTIVE effect for consequence calculation (ephemeral)
   * This does NOT change the stored effect, only used for consequence calculations
   */
  _getEffectiveEffect() {
    const baseEffect = this.playerState?.effect || 'standard';

    // Check if Push (Effect) is active
    if (this.playerState?.pushed && this.playerState?.pushType === 'improved-effect') {
      if (baseEffect === 'limited') return 'standard';
      if (baseEffect === 'standard') return 'great';
      // Already great
      return baseEffect;
    }

    return baseEffect;
  }

  /**
   * Compute improvements preview text
   */
  _computeImprovements() {
    if (!this.playerState) return [];

    const improvements = [];

    // Trait transaction (new system)
    if (this.playerState.traitTransaction) {
      const transaction = this.playerState.traitTransaction;

      if (transaction.mode === 'existing') {
        const trait = this.character.traits.find(t => t.id === transaction.selectedTraitId);
        if (trait) {
          improvements.push(`Using trait: '${trait.name}' (Position +1) [1M]`);
        }
      } else if (transaction.mode === 'new') {
        improvements.push(`Creating new trait: '${transaction.newTrait.name}' (Position +1) [1M]`);
      } else if (transaction.mode === 'consolidate') {
        const traitNames = transaction.consolidation.traitIdsToRemove
          .map(id => this.character.traits.find(t => t.id === id)?.name)
          .filter(Boolean);
        improvements.push(`Consolidating: ${traitNames.join(', ')} → '${transaction.consolidation.newTrait.name}' (Position +1) [1M]`);
      }
    }

    // Legacy trait improvement (fallback)
    if (this.playerState.selectedTraitId && !this.playerState.traitTransaction) {
      const trait = this.character.traits.find(t => t.id === this.playerState.selectedTraitId);
      if (trait) {
        improvements.push(`Using '${trait.name}' trait`);
      }
    }

    // Equipment improvements
    if (this.playerState.equippedForAction?.length > 0) {
      const equipment = this.character.equipment.filter(e =>
        this.playerState.equippedForAction.includes(e.id)
      );
      equipment.forEach(eq => {
        improvements.push(`Using ${eq.name}`);
      });
    }

    // Push improvement
    if (this.playerState.pushed) {
      const pushLabel = this.playerState.pushType === 'extra-die' ? '+1d' : 'Effect +1';
      improvements.push(`Push Yourself (${pushLabel}) [1M]`);
    }

    // Flashback (legacy)
    if (this.playerState.flashbackApplied) {
      improvements.push('Flashback applied');
    }

    return improvements;
  }

  /**
   * Check if stims are locked for this character's crew
   * @param {RootState} state - Redux state
   * @returns {boolean} True if any character in crew has filled addiction clock
   * @private
   */
  _areStimsLocked(state) {
    if (!this.crewId) return false;

    const crew = state.crews.byId[this.crewId];
    if (!crew) return false;

    // Check if ANY character in crew has filled addiction clock
    for (const characterId of crew.characters) {
      const characterAddictionClock = Object.values(state.clocks.byId).find(
        clock => clock.entityId === characterId && clock.clockType === 'addiction'
      );
      if (characterAddictionClock && characterAddictionClock.segments >= characterAddictionClock.maxSegments) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get consequence transaction data for template
   * Resolves IDs to objects and computes derived values
   *
   * @param {RootState} state - Redux state
   * @returns {Object} Consequence data for template
   * @private
   */
  _getConsequenceData(state) {
    const transaction = this.playerState?.consequenceTransaction;

    if (!transaction) {
      return {
        consequenceTransaction: null,
        harmTargetCharacter: null,
        selectedHarmClock: null,
        selectedCrewClock: null,
        calculatedHarmSegments: null,
        calculatedMomentumGain: null,
        effectivePosition: this._getEffectivePosition(),
        effectiveEffect: this._getEffectiveEffect(),
        consequenceConfigured: false,
      };
    }

    // Resolve harm target character
    let harmTargetCharacter = null;
    if (transaction.harmTargetCharacterId) {
      harmTargetCharacter = state.characters.byId[transaction.harmTargetCharacterId];
    }

    // Resolve selected harm clock
    let selectedHarmClock = null;
    if (transaction.harmClockId) {
      selectedHarmClock = state.clocks.byId[transaction.harmClockId];
    }

    // Resolve selected crew clock
    let selectedCrewClock = null;
    if (transaction.crewClockId) {
      selectedCrewClock = state.clocks.byId[transaction.crewClockId];
    }

    // Calculate harm segments and momentum gain using effective position
    // Note: Effect does NOT apply to consequences - only to success clocks
    const effectivePosition = this._getEffectivePosition();
    const effectiveEffect = this._getEffectiveEffect();
    const calculatedHarmSegments = selectConsequenceSeverity(effectivePosition);
    const calculatedMomentumGain = selectMomentumGain(effectivePosition);

    // Determine if consequence is fully configured
    let consequenceConfigured = false;
    if (transaction.consequenceType === 'harm') {
      // Harm is configured if: target selected AND clock selected
      consequenceConfigured = Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      // Crew clock is configured if: clock selected AND segments > 0
      consequenceConfigured = Boolean(transaction.crewClockId && transaction.crewClockSegments > 0);
    }

    return {
      consequenceTransaction: transaction,
      harmTargetCharacter,
      selectedHarmClock,
      selectedCrewClock,
      calculatedHarmSegments,
      calculatedMomentumGain,
      effectivePosition,
      effectiveEffect,
      consequenceConfigured,
    };
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle action selection change
   */
  async _onActionChange(event) {
    const action = event.currentTarget.value;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          action,
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      },
      { affectedReduxIds: [this.characterId], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    const actionName = action.charAt(0).toUpperCase() + action.slice(1);
    ChatMessage.create({
      content: `<strong>${this.character.name}</strong> selected action: <strong>${actionName}</strong>`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM position change
   */
  async _onPositionChange(event) {
    const position = event.currentTarget.value;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setPosition',
        payload: {
          characterId: this.characterId,
          position,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    ChatMessage.create({
      content: `GM set position to <strong>${position.charAt(0).toUpperCase() + position.slice(1)}</strong> for ${this.character.name}`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM effect change
   */
  async _onEffectChange(event) {
    const effect = event.currentTarget.value;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setEffect',
        payload: {
          characterId: this.characterId,
          effect,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    ChatMessage.create({
      content: `GM set effect to <strong>${effect.charAt(0).toUpperCase() + effect.slice(1)}</strong> for ${this.character.name}`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM approve roll button
   */
  async _onApproveRoll(event) {
    event.preventDefault();

    // Toggle approval state
    const currentlyApproved = this.playerState?.gmApproved || false;
    const newApprovalState = !currentlyApproved;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setGmApproved',
        payload: {
          characterId: this.characterId,
          approved: newApprovalState,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    if (newApprovalState) {
      ChatMessage.create({
        content: `<strong>GM approved ${this.character.name}'s action plan!</strong> ✅<br>Player may now roll.`,
        speaker: ChatMessage.getSpeaker(),
      });
    } else {
      ChatMessage.create({
        content: `GM revoked approval for ${this.character.name}'s action plan.`,
        speaker: ChatMessage.getSpeaker(),
      });
    }
  }

  /**
   * Handle Rally button
   */
  _onRally(event) {
    event.preventDefault();
    // TODO: Open Rally dialog
    ui.notifications.info('Rally dialog - to be implemented');
  }

  /**
   * Handle Lean Into Trait button
   */
  async _onLeanIntoTrait(event) {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications.warn('Character must be in a crew to lean into trait');
      return;
    }

    // Check if character has any available (non-disabled) traits
    const availableTraits = this.character.traits.filter(t => !t.disabled);
    if (availableTraits.length === 0) {
      ui.notifications.warn('No available traits - all traits are currently disabled');
      return;
    }

    // Open lean into trait dialog
    const dialog = new LeanIntoTraitDialog(this.characterId, this.crewId);
    dialog.render(true);
  }

  /**
   * Handle Use Trait button (merged flashback + traits)
   */
  async _onUseTrait(event) {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications.warn('Character must be in a crew to use trait');
      return;
    }

    // If trait transaction already exists, cancel it (toggle off)
    if (this.playerState?.traitTransaction) {
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/clearTraitTransaction',
          payload: { characterId: this.characterId }
        },
        { affectedReduxIds: [this.characterId], force: false }
      );

      ui.notifications.info('Trait flashback canceled');
      return;
    }

    // Check if position is already controlled (can't improve further)
    if (this.playerState?.position === 'controlled') {
      ui.notifications.warn('Position is already Controlled - cannot improve further');
      return;
    }

    // Open flashback traits dialog
    const dialog = new FlashbackTraitsDialog(this.characterId, this.crewId);
    dialog.render(true);
  }

  /**
   * Handle Equipment button
   */
  _onEquipment(event) {
    event.preventDefault();
    // TODO: Open Equipment dialog
    ui.notifications.info('Equipment dialog - to be implemented');
  }

  /**
   * Handle Push (+1d) toggle
   */
  async _onTogglePushDie(event) {
    event.preventDefault();

    const currentlyPushedDie = this.playerState?.pushed && this.playerState?.pushType === 'extra-die';

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setImprovements',
        payload: {
          characterId: this.characterId,
          pushed: !currentlyPushedDie,
          pushType: !currentlyPushedDie ? 'extra-die' : undefined,
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );
  }

  /**
   * Handle Push (Effect) toggle
   */
  async _onTogglePushEffect(event) {
    event.preventDefault();

    const currentlyPushedEffect = this.playerState?.pushed && this.playerState?.pushType === 'improved-effect';

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setImprovements',
        payload: {
          characterId: this.characterId,
          pushed: !currentlyPushedEffect,
          pushType: !currentlyPushedEffect ? 'improved-effect' : undefined,
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );
  }

  /**
   * Handle Roll Action button (DECISION -> ROLLING)
   * Simplified: removed ROLL_CONFIRM intermediate state
   */
  async _onRoll(event) {
    event.preventDefault();

    // Validate action is selected
    if (!this.playerState?.selectedAction) {
      ui.notifications.warn('Please select an action first');
      return;
    }

    // Get current state BEFORE any mutations
    const state = game.fitgd.store.getState();
    const playerState = state.playerRoundState.byCharacterId[this.characterId];

    // Calculate pending momentum cost (using selector)
    const momentumCost = selectMomentumCost(playerState);

    // Validate sufficient momentum BEFORE committing
    if (this.crewId && momentumCost > 0) {
      const crew = game.fitgd.api.crew.getCrew(this.crewId);
      if (crew.currentMomentum < momentumCost) {
        ui.notifications.error(`Insufficient Momentum! Need ${momentumCost}, have ${crew.currentMomentum}`);
        return;
      }

      // Spend momentum NOW (before rolling)
      try {
        game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: momentumCost });
      } catch (error) {
        ui.notifications.error(`Failed to spend Momentum: ${error.message}`);
        return;
      }
    }

    // Apply trait transaction (if exists)
    if (playerState?.traitTransaction) {
      try {
        // Apply trait changes (create/consolidate traits)
        // _applyTraitTransaction uses Bridge API and broadcasts internally
        await this._applyTraitTransaction(playerState.traitTransaction);

        // NOTE: Position improvement is NOT applied to playerState
        // It's ephemeral and only affects this roll's consequence calculation
        // The GM's original position setting remains unchanged
      } catch (error) {
        console.error('FitGD | Error applying trait transaction:', error);
        ui.notifications.error(`Failed to apply trait changes: ${error.message}`);
        return;
      }
    }

    // Transition to ROLLING using Bridge API
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'ROLLING',
        },
      },
      { affectedReduxIds: [this.characterId], silent: true } // Silent: subscription handles render
    );

    // NOTE: Bridge API handles broadcast automatically
    // Redux subscription will handle rendering (no manual this.render() call)

    // Calculate dice pool (state declared at top of function)
    const dicePool = selectDicePool(state, this.characterId);

    // Roll dice using Foundry dice roller
    const rollResult = await this._rollDice(dicePool);
    const outcome = this._calculateOutcome(rollResult);

    // CRITICAL: Batch all roll outcome state changes together
    // This prevents render race conditions by ensuring single broadcast
    const rollOutcomeActions = [
      {
        type: 'playerRoundState/setRollResult',
        payload: {
          characterId: this.characterId,
          dicePool,
          rollResult,
          outcome,
        },
      },
      {
        type: 'playerRoundState/setGmApproved',
        payload: {
          characterId: this.characterId,
          approved: false, // Clear GM approval (consumed by roll)
        },
      },
    ];

    // Add state transition based on outcome
    if (outcome === 'critical' || outcome === 'success') {
      rollOutcomeActions.push({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'SUCCESS_COMPLETE',
        },
      });
    } else {
      // Partial or failure - go directly to GM_RESOLVING_CONSEQUENCE (skip CONSEQUENCE_CHOICE)
      rollOutcomeActions.push({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'GM_RESOLVING_CONSEQUENCE',
        },
      });
    }

    // Execute all roll outcome actions as a batch (single broadcast)
    await game.fitgd.bridge.executeBatch(rollOutcomeActions, {
      affectedReduxIds: [this.characterId],
      force: false,
    });

    // Post success to chat if applicable
    if (outcome === 'critical' || outcome === 'success') {
      this._postSuccessToChat(outcome, rollResult);

      // Auto-close after delay
      setTimeout(() => {
        this._endTurn();
      }, 2000);
    }
  }

  /**
   * Roll dice and return results using Foundry's Roll class
   */
  async _rollDice(dicePool) {
    let roll;
    let results;

    if (dicePool === 0) {
      // Roll 2d6, take lowest (desperate roll)
      roll = await new Roll('2d6kl').evaluate();
      results = [roll.total];
    } else {
      // Roll Nd6
      roll = await new Roll(`${dicePool}d6`).evaluate();
      results = roll.dice[0].results.map(r => r.result).sort((a, b) => b - a);
    }

    // Post roll to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: game.actors.get(this.characterId) }),
      flavor: `${this.character.name} - ${this.playerState.selectedAction} action`,
    });

    return results;
  }

  /**
   * Calculate outcome from roll results
   */
  _calculateOutcome(rollResult) {
    const sixes = rollResult.filter(d => d === 6).length;
    const highest = Math.max(...rollResult);

    if (sixes >= 2) return 'critical';
    if (highest === 6) return 'success';
    if (highest >= 4) return 'partial';
    return 'failure';
  }

  /**
   * Handle Use Stims button (from CONSEQUENCE_CHOICE state)
   */
  async _onUseStims(event) {
    event.preventDefault();
    await this._useStims();
  }

  /**
   * Handle Accept Consequences button (CONSEQUENCE_CHOICE -> GM_RESOLVING_CONSEQUENCE)
   */
  async _onAcceptConsequences(event) {
    event.preventDefault();

    console.log('FitGD | Player accepted consequences, transitioning to GM_RESOLVING_CONSEQUENCE');

    // Transition to GM_RESOLVING_CONSEQUENCE state
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'GM_RESOLVING_CONSEQUENCE',
        },
      },
      { affectedReduxIds: [this.characterId], force: true } // Force re-render
    );

    console.log('FitGD | Transitioned to GM_RESOLVING_CONSEQUENCE');
  }

  /* -------------------------------------------- */
  /*  GM Consequence Configuration Handlers       */
  /* -------------------------------------------- */

  /**
   * Handle consequence type selection (harm vs crew-clock)
   */
  async _onSelectConsequenceType(event) {
    event.preventDefault();
    const consequenceType = event.currentTarget.dataset.type;

    // Build transaction with defaults
    const transaction = {
      consequenceType,
    };

    // Default harm target to acting character
    if (consequenceType === 'harm') {
      transaction.harmTargetCharacterId = this.characterId;
    }

    // Set consequence type (creates or updates transaction)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setConsequenceTransaction',
        payload: {
          characterId: this.characterId,
          transaction,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );
  }

  /**
   * Handle harm target selection button
   */
  async _onSelectHarmTarget(event) {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications.warn('Character must be in a crew');
      return;
    }

    // Open CharacterSelectionDialog
    const dialog = new CharacterSelectionDialog(
      this.crewId,
      this.characterId,
      async (selectedCharacterId) => {
        // Update transaction with selected target
        await game.fitgd.bridge.execute(
          {
            type: 'playerRoundState/updateConsequenceTransaction',
            payload: {
              characterId: this.characterId,
              updates: {
                harmTargetCharacterId: selectedCharacterId,
                // Clear clock selection when target changes
                harmClockId: undefined,
              },
            },
          },
          { affectedReduxIds: [this.characterId], silent: true }
        );
      }
    );

    dialog.render(true);
  }

  /**
   * Handle harm clock selection button
   */
  async _onSelectHarmClock(event) {
    event.preventDefault();

    const transaction = this.playerState?.consequenceTransaction;
    const targetCharacterId = transaction?.harmTargetCharacterId;

    if (!targetCharacterId) {
      ui.notifications.warn('Select target character first');
      return;
    }

    // Open ClockSelectionDialog for harm clocks
    const dialog = new ClockSelectionDialog(
      targetCharacterId,
      'harm',
      async (clockId) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new harm clock
            const creationDialog = new ClockCreationDialog(
              targetCharacterId,
              'harm',
              async (clockData) => {
                // Create clock via Bridge API
                const newClockId = foundry.utils.randomID();

                // Validate IDs before passing to Bridge API
                if (!targetCharacterId) {
                  console.error('FitGD | Cannot create clock: targetCharacterId is null/undefined');
                  ui.notifications.error('Internal error: target character ID is missing');
                  return;
                }

                await game.fitgd.bridge.execute(
                  {
                    type: 'clocks/createClock',
                    payload: {
                      id: newClockId,
                      entityId: targetCharacterId,
                      clockType: 'harm',
                      subtype: clockData.name,
                      maxSegments: clockData.segments,
                      segments: 0,
                      metadata: clockData.description ? { description: clockData.description } : undefined,
                    },
                  },
                  { affectedReduxIds: [targetCharacterId], silent: true }
                );

                // Update transaction with new clock
                await game.fitgd.bridge.execute(
                  {
                    type: 'playerRoundState/updateConsequenceTransaction',
                    payload: {
                      characterId: this.characterId,
                      updates: {
                        harmClockId: newClockId,
                        newHarmClockType: clockData.name,
                      },
                    },
                  },
                  { affectedReduxIds: [this.characterId], silent: true }
                );
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected
            await game.fitgd.bridge.execute(
              {
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                  characterId: this.characterId,
                  updates: {
                    harmClockId: clockId,
                  },
                },
              },
              { affectedReduxIds: [this.characterId], silent: true }
            );
          }
        } catch (error) {
          console.error('FitGD | Error in harm clock selection:', error);
          ui.notifications.error(`Error creating clock: ${error.message}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle crew clock selection button
   */
  async _onSelectCrewClock(event) {
    event.preventDefault();

    const crewId = this.crewId;

    if (!crewId) {
      ui.notifications.warn('Character must be in a crew');
      return;
    }

    // Open ClockSelectionDialog for crew clocks (non-harm)
    const dialog = new ClockSelectionDialog(
      crewId,
      'crew',
      async (clockId) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new crew clock
            const creationDialog = new ClockCreationDialog(
              crewId,
              'progress',
              async (clockData) => {
                // Create clock via Bridge API
                const newClockId = foundry.utils.randomID();

                // Validate IDs before passing to Bridge API
                if (!crewId) {
                  console.error('FitGD | Cannot create clock: crewId is null/undefined');
                  ui.notifications.error('Internal error: crew ID is missing');
                  return;
                }

                await game.fitgd.bridge.execute(
                  {
                    type: 'clocks/createClock',
                    payload: {
                      id: newClockId,
                      entityId: crewId,
                      clockType: 'progress', // Generic crew clock
                      subtype: clockData.name,
                      maxSegments: clockData.segments,
                      segments: 0,
                      metadata: {
                        category: clockData.category,
                        isCountdown: clockData.isCountdown,
                        description: clockData.description,
                      },
                    },
                  },
                  { affectedReduxIds: [crewId], silent: true }
                );

                // Update transaction with new clock
                await game.fitgd.bridge.execute(
                  {
                    type: 'playerRoundState/updateConsequenceTransaction',
                    payload: {
                      characterId: this.characterId,
                      updates: {
                        crewClockId: newClockId,
                        crewClockSegments: 1, // Default to 1 segment
                      },
                    },
                  },
                  { affectedReduxIds: [this.characterId], silent: true }
                );
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected
            await game.fitgd.bridge.execute(
              {
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                  characterId: this.characterId,
                  updates: {
                    crewClockId: clockId,
                    crewClockSegments: 1, // Default to 1 segment
                  },
                },
              },
              { affectedReduxIds: [this.characterId], silent: true }
            );
          }
        } catch (error) {
          console.error('FitGD | Error in crew clock selection:', error);
          ui.notifications.error(`Error creating clock: ${error.message}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle crew clock segments input change
   */
  async _onCrewClockSegmentsChange(event) {
    event.preventDefault();
    const segments = parseInt(event.currentTarget.value, 10) || 1;

    // Update transaction with new segment count
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/updateConsequenceTransaction',
        payload: {
          characterId: this.characterId,
          updates: {
            crewClockSegments: segments,
          },
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );
  }

  /**
   * Handle GM approve consequence button
   */
  async _onApproveConsequence(event) {
    event.preventDefault();

    const transaction = this.playerState?.consequenceTransaction;
    if (!transaction) {
      ui.notifications.error('No consequence configured');
      return;
    }

    // Validate transaction is complete
    if (transaction.consequenceType === 'harm') {
      if (!transaction.harmTargetCharacterId || !transaction.harmClockId) {
        ui.notifications.warn('Please select target character and harm clock');
        return;
      }
    } else if (transaction.consequenceType === 'crew-clock') {
      if (!transaction.crewClockId || !transaction.crewClockSegments) {
        ui.notifications.warn('Please select clock and segments');
        return;
      }
    }

    // Transition to APPLYING_EFFECTS to apply the consequence
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'APPLYING_EFFECTS',
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );

    // Apply the consequence (harm or clock)
    await this._applyConsequenceTransaction(transaction);

    // Add momentum gain
    const effectivePosition = this._getEffectivePosition();
    const momentumGain = selectMomentumGain(effectivePosition);
    if (this.crewId && momentumGain > 0) {
      game.fitgd.api.crew.addMomentum({ crewId: this.crewId, amount: momentumGain });
      await game.fitgd.saveImmediate(); // TODO: Refactor to Bridge API
    }

    // Clear transaction and transition through proper state machine
    // APPLYING_EFFECTS → TURN_COMPLETE → IDLE_WAITING
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/clearConsequenceTransaction',
        payload: { characterId: this.characterId },
      },
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      },
    ], {
      affectedReduxIds: [this.characterId],
      silent: true,
    });

    // Transition to IDLE_WAITING (complete the turn)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'IDLE_WAITING',
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );

    // Close widget after brief delay
    setTimeout(() => this.close(), 500);
  }

  /**
   * Apply consequence transaction (harm or crew clock)
   * @param {ConsequenceTransaction} transaction
   */
  async _applyConsequenceTransaction(transaction) {
    if (transaction.consequenceType === 'harm') {
      // Apply harm to selected clock
      // Note: Effect does NOT apply to consequences - only position matters
      const effectivePosition = this._getEffectivePosition();
      const segments = selectConsequenceSeverity(effectivePosition);

      await game.fitgd.bridge.execute(
        {
          type: 'clocks/addSegments',
          payload: {
            clockId: transaction.harmClockId,
            amount: segments,
          },
        },
        { affectedReduxIds: [transaction.harmTargetCharacterId], silent: true }
      );

      ui.notifications.info(`Applied ${segments} harm`);

    } else if (transaction.consequenceType === 'crew-clock') {
      // Advance crew clock using standardized position-based values
      const effectivePosition = this._getEffectivePosition();
      const segments = selectConsequenceSeverity(effectivePosition);

      await game.fitgd.bridge.execute(
        {
          type: 'clocks/addSegments',
          payload: {
            clockId: transaction.crewClockId,
            amount: segments,
          },
        },
        { affectedReduxIds: [this.crewId], silent: true }
      );

      ui.notifications.info(`Advanced crew clock by ${segments} segments (${effectivePosition})`);
    }
  }

  /**
   * Handle player using stims from GM phase
   */
  async _onUseStimsGMPhase(event) {
    event.preventDefault();
    await this._useStims();
  }

  /**
   * Shared stims logic (can be called from CONSEQUENCE_CHOICE or GM_RESOLVING_CONSEQUENCE)
   * Validates addiction status, advances addiction clock, and sets up reroll
   */
  async _useStims() {
    if (!this.crewId) {
      ui.notifications.error('Character must be in a crew to use stims');
      return;
    }

    // Check if already used stims this action
    if (this.playerState?.stimsUsedThisAction) {
      ui.notifications.warn('Stims already used this action - cannot use again!');
      return;
    }

    const state = game.fitgd.store.getState();
    const crew = state.crews.byId[this.crewId];

    // Check if ANY character in crew has filled addiction clock (team-wide lock)
    let teamAddictionLocked = false;
    for (const characterId of crew.characters) {
      const characterAddictionClock = Object.values(state.clocks.byId).find(
        clock => clock.entityId === characterId && clock.clockType === 'addiction'
      );
      if (characterAddictionClock && characterAddictionClock.segments >= characterAddictionClock.maxSegments) {
        teamAddictionLocked = true;
        break;
      }
    }

    if (teamAddictionLocked) {
      ui.notifications.error('Stims are LOCKED due to crew addiction! Cannot use stims.');
      // UI should prevent this from being clicked, but catching it here as a safety check
      return;
    }

    // Find this character's addiction clock
    const addictionClock = Object.values(state.clocks.byId).find(
      clock => clock.entityId === this.characterId && clock.clockType === 'addiction'
    );

    // Create addiction clock if it doesn't exist
    let addictionClockId = addictionClock?.id;
    if (!addictionClock) {
      addictionClockId = foundry.utils.randomID();
      await game.fitgd.bridge.execute(
        {
          type: 'clocks/createClock',
          payload: {
            id: addictionClockId,
            entityId: this.characterId, // Per-character, not per-crew
            clockType: 'addiction',
            subtype: 'Addiction',
            maxSegments: 8,
            segments: 0,
          },
        },
        { affectedReduxIds: [this.characterId], silent: true }
      );

      ui.notifications.info('Addiction clock created');
    }

    // Roll d6 to determine addiction advance
    const addictionRoll = await new Roll('1d6').evaluate();
    const addictionAmount = addictionRoll.total;

    // Post addiction roll to chat
    await addictionRoll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `${this.character.name} - Addiction Roll (Stims)`,
    });

    // Advance addiction clock by roll result
    await game.fitgd.bridge.execute(
      {
        type: 'clocks/addSegments',
        payload: {
          clockId: addictionClockId,
          amount: addictionAmount,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );

    // Get updated clock state
    const updatedState = game.fitgd.store.getState();
    const updatedClock = updatedState.clocks.byId[addictionClockId];
    const newSegments = updatedClock.segments;

    ui.notifications.warn(`Addiction clock: ${newSegments}/${updatedClock.maxSegments} (+${addictionAmount})`);

    // Check if addiction clock just filled
    if (newSegments >= updatedClock.maxSegments) {
      // Add "Addict" trait to character
      const addictTrait = {
        id: foundry.utils.randomID(),
        name: 'Addict',
        description: 'Addicted to combat stims. Stims are now locked for the entire crew.',
        category: 'scar',
        disabled: false,
        acquiredAt: Date.now(),
      };

      await game.fitgd.bridge.execute(
        {
          type: 'characters/addTrait',
          payload: {
            characterId: this.characterId,
            trait: addictTrait,
          },
        },
        { affectedReduxIds: [this.characterId], force: true }
      );

      ui.notifications.error(`${this.character.name} is now an ADDICT! Stims are LOCKED for the crew.`);

      // Post to chat
      ChatMessage.create({
        content: `<div class="fitgd-addiction-warning">
          <h3>⚠️ ADDICTION FILLS!</h3>
          <p><strong>${this.character.name}</strong> has become addicted to combat stims!</p>
          <p>Trait Added: <strong>Addict</strong></p>
          <p><em>Stims are now locked for the entire crew.</em></p>
        </div>`,
        speaker: ChatMessage.getSpeaker(),
      });
    }

    // Mark stims used this action
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setStimsUsed',
        payload: {
          characterId: this.characterId,
          used: true,
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );

    // Clear consequence transaction (if any)
    if (this.playerState?.consequenceTransaction) {
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/clearConsequenceTransaction',
          payload: { characterId: this.characterId },
        },
        { affectedReduxIds: [this.characterId], silent: true }
      );
    }

    // Transition to STIMS_ROLLING state (brief visual state)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'STIMS_ROLLING',
        },
      },
      { affectedReduxIds: [this.characterId], silent: true }
    );

    ui.notifications.info('Stims used! Re-rolling with same plan...');

    // Post to chat
    ChatMessage.create({
      content: `<div class="fitgd-stims-use">
        <h3>💉 STIMS USED!</h3>
        <p><strong>${this.character.name}</strong> used combat stims!</p>
        <p><em>Addiction clock advanced. Re-rolling...</em></p>
      </div>`,
      speaker: ChatMessage.getSpeaker(),
    });

    // Brief delay to show STIMS_ROLLING state, then re-roll
    setTimeout(async () => {
      // Transition to ROLLING
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'ROLLING',
          },
        },
        { affectedReduxIds: [this.characterId], silent: true }
      );

      // Get current state to preserve dice pool and plan
      const currentState = game.fitgd.store.getState();
      const playerState = currentState.playerRoundState.byCharacterId[this.characterId];
      const dicePool = selectDicePool(currentState, this.characterId);

      console.log('FitGD | Stims reroll - dice pool:', dicePool, 'action:', playerState.selectedAction);

      // Roll dice using Foundry dice roller (same as original roll)
      const rollResult = await this._rollDice(dicePool);
      const outcome = this._calculateOutcome(rollResult);

      // Batch roll outcome state changes
      const rollOutcomeActions = [
        {
          type: 'playerRoundState/setRollResult',
          payload: {
            characterId: this.characterId,
            dicePool,
            rollResult,
            outcome,
          },
        },
      ];

      // Add state transition based on outcome
      if (outcome === 'critical' || outcome === 'success') {
        rollOutcomeActions.push({
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'SUCCESS_COMPLETE',
          },
        });
      } else {
        // Partial or failure - go back to GM_RESOLVING_CONSEQUENCE
        rollOutcomeActions.push({
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'GM_RESOLVING_CONSEQUENCE',
          },
        });
      }

      // Execute all roll outcome actions as a batch
      await game.fitgd.bridge.executeBatch(rollOutcomeActions, {
        affectedReduxIds: [this.characterId],
        force: false,
      });

      // Post success to chat if applicable
      if (outcome === 'critical' || outcome === 'success') {
        this._postSuccessToChat(outcome, rollResult);

        // Auto-close after delay
        setTimeout(() => {
          this._endTurn();
        }, 2000);
      }
    }, 500);
  }

  /* Legacy handlers removed - consequence resolution now handled through GM_RESOLVING_CONSEQUENCE flow */

  /**
   * Handle Cancel button
   */
  async _onCancel(event) {
    event.preventDefault();

    // Batch reset and transition to DECISION state
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/resetPlayerState',
        payload: { characterId: this.characterId },
      },
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'DECISION_PHASE',
        },
      }
    ], {
      affectedReduxIds: [this.characterId],
      silent: true, // Silent: subscription handles render
    });
  }

  /**
   * Post success message to chat
   */
  _postSuccessToChat(outcome, rollResult) {
    const outcomeText = outcome === 'critical' ? 'Critical Success!' : 'Success!';
    const diceText = rollResult.join(', ');

    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: this.character.name }),
      content: `
        <div class="fitgd-roll-result">
          <h3>${outcomeText}</h3>
          <p>Rolled: ${diceText}</p>
          <p>Action: ${this.playerState.selectedAction}</p>
        </div>
      `,
    });
  }

  /**
   * End turn and close widget
   */
  async _endTurn() {
    // Batch transition to TURN_COMPLETE and reset player state
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      },
      {
        type: 'playerRoundState/resetPlayerState',
        payload: {
          characterId: this.characterId,
        },
      }
    ], {
      affectedReduxIds: [this.characterId],
      silent: true, // Silent: subscription handles render
    });

    // Close widget
    this.close();

    // TODO: Advance combat turn order
  }
}
