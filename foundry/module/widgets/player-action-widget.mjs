/**
 * Player Action Widget
 *
 * A persistent widget that appears when it's a player's turn in an encounter.
 * Drives the action resolution flow through the state machine.
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

/* -------------------------------------------- */
/*  Player Action Widget Application            */
/* -------------------------------------------- */

export class PlayerActionWidget extends Application {
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
          console.log(`FitGD | Widget detected state change for ${this.characterId}, refreshing...`);
          this.render(false); // Soft refresh (no full re-render)
        }

        previousState = currentState;
      });

      console.log(`FitGD | Widget subscribed to store updates for ${this.characterId}`);
    }
  }

  /** @override */
  async close(options) {
    // Unsubscribe from store updates
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
      console.log(`FitGD | Widget unsubscribed from store updates for ${this.characterId}`);
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
      console.log(`FitGD | Widget found crew ${crewId} for character ${this.characterId}`);
    } else {
      console.warn(`FitGD | No crew found for character ${this.characterId}`);
      this.crew = null;
      this.crewId = null;
    }

    // Get player round state
    this.playerState = state.playerRoundState.byCharacterId[this.characterId];

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
      isSuccess: this.playerState?.state === 'SUCCESS_COMPLETE',
      isConsequenceChoice: this.playerState?.state === 'CONSEQUENCE_CHOICE',
      isConsequenceResolution: this.playerState?.state === 'CONSEQUENCE_RESOLUTION',

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
    html.find('[data-action="use-trait"]').click(this._onUseTrait.bind(this));
    html.find('[data-action="equipment"]').click(this._onEquipment.bind(this));
    html.find('[data-action="push-die"]').click(this._onTogglePushDie.bind(this));
    html.find('[data-action="push-effect"]').click(this._onTogglePushEffect.bind(this));

    // Roll button (simplified: no more commit-roll button)
    html.find('[data-action="roll"]').click(this._onRoll.bind(this));

    // Consequence buttons
    html.find('[data-action="use-stims"]').click(this._onUseStims.bind(this));
    html.find('[data-action="accept-consequences"]').click(this._onAcceptConsequences.bind(this));

    // Consequence type buttons
    html.find('[data-action="take-harm"]').click(this._onTakeHarm.bind(this));
    html.find('[data-action="advance-clock"]').click(this._onAdvanceClock.bind(this));

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

      game.fitgd.store.dispatch({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: newTrait,
        },
      });

      console.log(`FitGD | Created new trait: ${newTrait.name}`);

    } else if (transaction.mode === 'consolidate') {
      // Remove 3 traits and create consolidated trait
      const consolidation = transaction.consolidation;

      // Remove the 3 traits
      for (const traitId of consolidation.traitIdsToRemove) {
        game.fitgd.store.dispatch({
          type: 'characters/removeTrait',
          payload: {
            characterId: this.characterId,
            traitId,
          },
        });
      }

      // Create consolidated trait
      const consolidatedTrait = {
        id: foundry.utils.randomID(),
        name: consolidation.newTrait.name,
        description: consolidation.newTrait.description,
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      game.fitgd.store.dispatch({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: consolidatedTrait,
        },
      });

      console.log(`FitGD | Consolidated traits into: ${consolidatedTrait.name}`);
    }

    // Save immediately (critical state change)
    await game.fitgd.saveImmediate();

    // Re-render character sheet
    refreshSheetsByReduxId([this.characterId], true);
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

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle action selection change
   */
  async _onActionChange(event) {
    const action = event.currentTarget.value;

    // Dispatch Redux action
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setActionPlan',
      payload: {
        characterId: this.characterId,
        action,
        position: this.playerState?.position || 'risky',
        effect: this.playerState?.effect || 'standard',
      },
    });

    // Broadcast to all clients
    await game.fitgd.saveImmediate();

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

    // Dispatch Redux action
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setPosition',
      payload: {
        characterId: this.characterId,
        position,
      },
    });

    // Broadcast to all clients
    await game.fitgd.saveImmediate();

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

    // Dispatch Redux action
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setEffect',
      payload: {
        characterId: this.characterId,
        effect,
      },
    });

    // Broadcast to all clients
    await game.fitgd.saveImmediate();

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

    // Dispatch Redux action
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setGmApproved',
      payload: {
        characterId: this.characterId,
        approved: newApprovalState,
      },
    });

    // Broadcast to all clients
    await game.fitgd.saveImmediate();

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
      game.fitgd.store.dispatch({
        type: 'playerRoundState/clearTraitTransaction',
        payload: { characterId: this.characterId }
      });

      // Broadcast to all clients
      await game.fitgd.saveImmediate();

      // Refresh all widgets for this character
      refreshSheetsByReduxId([this.characterId], false);

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

    game.fitgd.store.dispatch({
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.characterId,
        pushed: !currentlyPushedDie,
        pushType: !currentlyPushedDie ? 'extra-die' : undefined,
      },
    });

    // Broadcast to all clients (GM needs to see this change)
    await game.fitgd.saveImmediate();

    // Refresh all widgets for this character
    refreshSheetsByReduxId([this.characterId], false);
  }

  /**
   * Handle Push (Effect) toggle
   */
  async _onTogglePushEffect(event) {
    event.preventDefault();

    const currentlyPushedEffect = this.playerState?.pushed && this.playerState?.pushType === 'improved-effect';

    // Just toggle the push flag - don't change effect directly
    // The improved effect will be computed for display and applied during roll
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.characterId,
        pushed: !currentlyPushedEffect,
        pushType: !currentlyPushedEffect ? 'improved-effect' : undefined,
      },
    });

    // Broadcast to all clients (GM needs to see this change)
    await game.fitgd.saveImmediate();

    // Refresh all widgets for this character
    refreshSheetsByReduxId([this.characterId], false);
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
        await this._applyTraitTransaction(playerState.traitTransaction);

        // NOTE: Position improvement is NOT applied to playerState
        // It's ephemeral and only affects this roll's consequence calculation
        // The GM's original position setting remains unchanged

        // CRITICAL: Broadcast trait changes
        await game.fitgd.saveImmediate();
      } catch (error) {
        console.error('FitGD | Error applying trait transaction:', error);
        ui.notifications.error(`Failed to apply trait changes: ${error.message}`);
        return;
      }
    }

    // Transition to ROLLING
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'ROLLING',
      },
    });

    this.render();

    // Calculate dice pool
    const state = game.fitgd.store.getState();
    const dicePool = selectDicePool(state, this.characterId);

    // Roll dice using Foundry dice roller
    const rollResult = await this._rollDice(dicePool);
    const outcome = this._calculateOutcome(rollResult);

    // Store roll result
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setRollResult',
      payload: {
        characterId: this.characterId,
        dicePool,
        rollResult,
        outcome,
      },
    });

    // Transition based on outcome
    if (outcome === 'critical' || outcome === 'success') {
      game.fitgd.store.dispatch({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'SUCCESS_COMPLETE',
        },
      });

      // Post to chat
      this._postSuccessToChat(outcome, rollResult);

      // Auto-close after delay
      setTimeout(() => {
        this._endTurn();
      }, 2000);
    } else {
      // Partial or failure - need consequences
      game.fitgd.store.dispatch({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'CONSEQUENCE_CHOICE',
        },
      });

      this.render();
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
   * Handle Use Stims button
   */
  _onUseStims(event) {
    event.preventDefault();
    // TODO: Implement stims flow
    ui.notifications.info('Stims - to be implemented');
  }

  /**
   * Handle Accept Consequences button
   */
  _onAcceptConsequences(event) {
    event.preventDefault();

    // Transition to CONSEQUENCE_RESOLUTION
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'CONSEQUENCE_RESOLUTION',
      },
    });

    this.render();
  }

  /**
   * Handle Take Harm button
   */
  async _onTakeHarm(event) {
    event.preventDefault();

    // CRITICAL: Use EFFECTIVE position/effect (with improvements applied)
    // These are ephemeral - the base position/effect in playerState remain unchanged
    const position = this._getEffectivePosition();
    const effect = this._getEffectiveEffect();

    // Calculate harm segments and momentum gain using effective values
    const segments = selectConsequenceSeverity(position, effect);
    const momentumGain = selectMomentumGain(position);

    // Transition to CONSEQUENCE_RESOLUTION
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'CONSEQUENCE_RESOLUTION',
      },
    });

    // Store consequence data
    game.fitgd.store.dispatch({
      type: 'playerRoundState/setConsequence',
      payload: {
        characterId: this.characterId,
        consequenceType: 'harm',
        consequenceValue: segments,
        momentumGain,
      },
    });

    this.render();

    // Apply harm - use harm API
    if (segments > 0) {
      try {
        await game.fitgd.api.harm.take({
          characterId: this.characterId,
          harmType: 'Physical Harm', // Default to physical
          position,
          effect,
        });
        ui.notifications.info(`Taking ${segments} harm. +${momentumGain} Momentum`);
      } catch (error) {
        console.error('FitGD | Error applying harm:', error);
        ui.notifications.error(`Failed to apply harm: ${error.message}`);
      }
    }

    // Add Momentum
    if (this.crewId) {
      game.fitgd.api.crew.addMomentum({ crewId: this.crewId, amount: momentumGain });
    }

    // Transition to APPLYING_EFFECTS then TURN_COMPLETE
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'APPLYING_EFFECTS',
      },
    });

    // Give a brief moment for UI to update, then complete turn
    setTimeout(async () => {
      game.fitgd.store.dispatch({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      });

      // Reset player state (clear all improvements, GM approval, etc.)
      game.fitgd.store.dispatch({
        type: 'playerRoundState/resetPlayerState',
        payload: {
          characterId: this.characterId,
        },
      });

      // Broadcast state changes
      await game.fitgd.saveImmediate();

      // Close widget after completing
      setTimeout(() => this.close(), 500);
    }, 500);
  }

  /**
   * Handle Advance Clock button
   */
  _onAdvanceClock(event) {
    event.preventDefault();
    // TODO: Implement clock advancement
    ui.notifications.info('Clock advancement - to be implemented');
    this._endTurn();
  }

  /**
   * Handle Cancel button
   */
  _onCancel(event) {
    event.preventDefault();

    // Reset to clean DECISION state
    game.fitgd.store.dispatch({
      type: 'playerRoundState/resetPlayerState',
      payload: { characterId: this.characterId },
    });

    // Set back to DECISION
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'DECISION_PHASE',
      },
    });

    this.render();
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
    // Transition to TURN_COMPLETE
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'TURN_COMPLETE',
      },
    });

    // Reset player state (clear all improvements, GM approval, etc.)
    game.fitgd.store.dispatch({
      type: 'playerRoundState/resetPlayerState',
      payload: {
        characterId: this.characterId,
      },
    });

    // Broadcast state changes
    await game.fitgd.saveImmediate();

    // Close widget
    this.close();

    // TODO: Advance combat turn order
  }
}
