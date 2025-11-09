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

      // State flags
      isDecisionPhase: this.playerState?.state === 'DECISION_PHASE',
      isRollConfirm: this.playerState?.state === 'ROLL_CONFIRM',
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
    html.find('[data-action="flashback"]').click(this._onFlashback.bind(this));
    html.find('[data-action="equipment"]').click(this._onEquipment.bind(this));
    html.find('[data-action="traits"]').click(this._onTraits.bind(this));
    html.find('[data-action="push"]').click(this._onTogglePush.bind(this));

    // Roll button
    html.find('[data-action="roll"]').click(this._onRoll.bind(this));
    html.find('[data-action="commit-roll"]').click(this._onCommitRoll.bind(this));

    // Consequence buttons
    html.find('[data-action="use-stims"]').click(this._onUseStims.bind(this));
    html.find('[data-action="accept-consequences"]').click(this._onAcceptConsequences.bind(this));

    // Consequence type buttons
    html.find('[data-action="take-harm"]').click(this._onTakeHarm.bind(this));
    html.find('[data-action="advance-clock"]').click(this._onAdvanceClock.bind(this));

    // Cancel/Back buttons
    html.find('[data-action="cancel"]').click(this._onCancel.bind(this));
    html.find('[data-action="back"]').click(this._onBack.bind(this));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Compute improvements preview text
   */
  _computeImprovements() {
    if (!this.playerState) return [];

    const improvements = [];

    // Trait improvement
    if (this.playerState.selectedTraitId) {
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
      improvements.push('Push Yourself (+1d or +Effect) [1M]');
    }

    // Flashback
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
   * Handle Flashback button
   */
  _onFlashback(event) {
    event.preventDefault();
    // TODO: Open Flashback dialog
    ui.notifications.info('Flashback dialog - to be implemented');
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
   * Handle Traits button
   */
  _onTraits(event) {
    event.preventDefault();
    // TODO: Open Traits dialog
    ui.notifications.info('Traits dialog - to be implemented');
  }

  /**
   * Handle Push toggle
   */
  _onTogglePush(event) {
    event.preventDefault();

    const currentlyPushed = this.playerState?.pushed || false;

    game.fitgd.store.dispatch({
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.characterId,
        pushed: !currentlyPushed,
      },
    });

    this.render();
  }

  /**
   * Handle Roll Action button (DECISION -> ROLL_CONFIRM)
   */
  _onRoll(event) {
    event.preventDefault();

    // Validate action is selected
    if (!this.playerState?.selectedAction) {
      ui.notifications.warn('Please select an action first');
      return;
    }

    // Transition to ROLL_CONFIRM
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'ROLL_CONFIRM',
      },
    });

    this.render();
  }

  /**
   * Handle Commit & Roll button (ROLL_CONFIRM -> ROLLING)
   */
  async _onCommitRoll(event) {
    event.preventDefault();

    // Transition to ROLLING
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'ROLLING',
      },
    });

    this.render();

    // Calculate dice pool using selector
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

    // Spend Momentum if pushed
    if (this.playerState.pushed && this.crewId) {
      game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: 1 });
    }

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

    // Calculate harm segments and momentum gain using selectors
    const position = this.playerState.position || 'risky';
    const effect = this.playerState.effect || 'standard';
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
    setTimeout(() => {
      game.fitgd.store.dispatch({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      });

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
   * Handle Back button
   */
  _onBack(event) {
    event.preventDefault();

    // Go back to DECISION
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
  _endTurn() {
    // Transition to TURN_COMPLETE
    game.fitgd.store.dispatch({
      type: 'playerRoundState/transitionState',
      payload: {
        characterId: this.characterId,
        newState: 'TURN_COMPLETE',
      },
    });

    // Close widget
    this.close();

    // TODO: Advance combat turn order
  }
}
