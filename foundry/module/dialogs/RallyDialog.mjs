/**
 * Rally Dialog
 *
 * Dialog for rallying teammates by referencing their traits
 *
 * Game Mechanic:
 * - Character initiates flashback referencing a teammate's trait to inspire the group
 * - Always in Controlled position
 * - Uses social action (Command/Consort/Sway) to determine dice pool
 * - Roll outcome determines Momentum gain:
 *   - Fail (1-3): +1 Momentum
 *   - Partial (4-5): +2 Momentum
 *   - Success (6): +3 Momentum
 *   - Critical (two 6s): +4 Momentum
 * - If the trait was disabled, it gets re-enabled
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class RallyDialog extends Application {
  /**
   * Create a new Rally Dialog
   *
   * @param {string} characterId - Redux ID of the character rallying
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options passed to Application constructor
   */
  constructor(characterId, crewId, options = {}) {
    super(options);

    this.characterId = characterId;
    this.crewId = crewId;
    this.character = game.fitgd.api.character.getCharacter(characterId);
    this.crew = game.fitgd.api.crew.getCrew(crewId);

    // Selection state
    this.selectedAction = null; // 'command', 'consort', or 'sway'
    this.selectedTargetId = null; // Redux ID of target character
    this.selectedTraitId = null; // ID of trait to reference

    // Roll state
    this.hasRolled = false;
    this.rollResult = null;
    this.momentumGain = 0;
    this.outcome = null;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'rally-dialog'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/rally-dialog.html',
      width: 550,
      height: 'auto',
      title: 'Rally Teammate',
      resizable: false,
    });
  }

  /** @override */
  get id() {
    return `rally-dialog-${this.characterId}`;
  }

  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options);

    // Get crew members excluding acting character
    const state = game.fitgd.store.getState();
    const teammates = this.crew.characters
      .filter(id => id !== this.characterId)
      .map(id => state.characters.byId[id])
      .filter(char => char); // Filter out null/undefined

    // Get target character if selected
    let targetCharacter = null;
    let targetTraits = [];
    if (this.selectedTargetId) {
      targetCharacter = state.characters.byId[this.selectedTargetId];
      targetTraits = targetCharacter?.traits || [];
    }

    // Get action dots for selected action
    let actionDots = 0;
    if (this.selectedAction) {
      actionDots = this.character.actionDots[this.selectedAction] || 0;
    }

    const currentMomentum = this.crew?.currentMomentum || 0;

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: currentMomentum,
      teammates,
      targetCharacter,
      targetTraits,
      selectedAction: this.selectedAction,
      selectedTargetId: this.selectedTargetId,
      selectedTraitId: this.selectedTraitId,
      actionDots,
      hasRolled: this.hasRolled,
      rollResult: this.rollResult,
      momentumGain: this.momentumGain,
      outcome: this.outcome,
      canRoll: this.selectedAction && this.selectedTargetId && this.selectedTraitId && !this.hasRolled,
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Store html for later use
    this.html = html;

    // Action selection
    html.find('[name="action"]').change(this._onActionChange.bind(this));

    // Target selection
    html.find('[name="target"]').change(this._onTargetChange.bind(this));

    // Trait selection
    html.find('.trait-item').click(this._onTraitClick.bind(this));

    // Roll button
    html.find('[data-action="roll"]').click(this._onRoll.bind(this));

    // Apply button (after roll)
    html.find('[data-action="apply"]').click(this._onApply.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Handle action selection change
   */
  _onActionChange(event) {
    this.selectedAction = event.currentTarget.value || null;
    this.render();
  }

  /**
   * Handle target selection change
   */
  _onTargetChange(event) {
    this.selectedTargetId = event.currentTarget.value || null;
    this.selectedTraitId = null; // Reset trait selection
    this.render();
  }

  /**
   * Handle trait click
   */
  _onTraitClick(event) {
    const traitId = event.currentTarget.dataset.traitId;
    this.selectedTraitId = traitId;
    this.render();
  }

  /**
   * Handle roll button
   */
  async _onRoll(event) {
    event.preventDefault();

    if (!this.selectedAction || !this.selectedTargetId || !this.selectedTraitId) {
      ui.notifications.warn('Please select action, target, and trait');
      return;
    }

    // Get action dots
    const actionDots = this.character.actionDots[this.selectedAction] || 0;

    // Roll dice (Controlled position always)
    const diceCount = Math.max(actionDots, 2); // 0 dots = roll 2d6 keep lowest
    const roll = new Roll(`${diceCount}d6`);
    await roll.evaluate({ async: true });

    const results = roll.terms[0].results.map(r => r.result);
    const highest = Math.max(...results);

    // Determine outcome
    let outcome;
    let momentumGain;

    const criticalCount = results.filter(r => r === 6).length;
    if (criticalCount >= 2) {
      outcome = 'critical';
      momentumGain = 4;
    } else if (highest === 6) {
      outcome = 'success';
      momentumGain = 3;
    } else if (highest >= 4) {
      outcome = 'partial';
      momentumGain = 2;
    } else {
      outcome = 'fail';
      momentumGain = 1;
    }

    // If 0 dots, roll 2d6 keep lowest
    if (actionDots === 0) {
      const lowest = Math.min(...results);
      if (lowest === 6 && results.filter(r => r === 6).length >= 2) {
        outcome = 'critical';
        momentumGain = 4;
      } else if (lowest === 6) {
        outcome = 'success';
        momentumGain = 3;
      } else if (lowest >= 4) {
        outcome = 'partial';
        momentumGain = 2;
      } else {
        outcome = 'fail';
        momentumGain = 1;
      }
    }

    // Store roll results
    this.hasRolled = true;
    this.rollResult = results;
    this.outcome = outcome;
    this.momentumGain = momentumGain;

    // Show roll result in chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ alias: this.character.name }),
      flavor: `<strong>Rally: ${this.selectedAction}</strong> (Controlled)`,
    });

    this.render();
  }

  /**
   * Handle apply button - add momentum and re-enable trait
   */
  async _onApply(event) {
    event.preventDefault();

    if (!this.hasRolled) {
      ui.notifications.warn('Please roll first');
      return;
    }

    try {
      const state = game.fitgd.store.getState();
      const targetCharacter = state.characters.byId[this.selectedTargetId];
      const trait = targetCharacter.traits.find(t => t.id === this.selectedTraitId);

      if (!trait) {
        ui.notifications.error('Selected trait not found');
        return;
      }

      const currentMomentum = this.crew.currentMomentum;
      const newMomentum = Math.min(currentMomentum + this.momentumGain, 10);
      const actualGain = newMomentum - currentMomentum;

      // Build list of actions
      const actions = [];

      // Add momentum
      actions.push({
        type: 'crews/setMomentum',
        payload: {
          crewId: this.crewId,
          amount: newMomentum,
        },
      });

      // Re-enable trait if it was disabled
      const wasDisabled = trait.disabled;
      if (wasDisabled) {
        actions.push({
          type: 'characters/enableTrait',
          payload: {
            characterId: this.selectedTargetId,
            traitId: this.selectedTraitId,
          },
        });
      }

      // Mark rally as used
      actions.push({
        type: 'characters/useRally',
        payload: {
          characterId: this.characterId,
        },
      });

      // Execute all actions together
      await game.fitgd.bridge.executeBatch(
        actions,
        { affectedReduxIds: [this.characterId, this.selectedTargetId, this.crewId] }
      );

      // Create chat message summary
      const outcomeText = {
        critical: 'CRITICAL SUCCESS',
        success: 'SUCCESS',
        partial: 'PARTIAL SUCCESS',
        fail: 'FAILURE',
      }[this.outcome];

      let chatContent = `
        <div class="fitgd-rally-summary">
          <h3>🎖️ Rally</h3>
          <p><strong>${this.character.name}</strong> rallies <strong>${targetCharacter.name}</strong></p>
          <p><strong>Action:</strong> ${this.selectedAction.charAt(0).toUpperCase() + this.selectedAction.slice(1)}</p>
          <p><strong>Trait Referenced:</strong> "${trait.name}"</p>
          <hr>
          <p><strong>Outcome:</strong> ${outcomeText}</p>
          <p><strong>Momentum Gain:</strong> +${actualGain}M (${currentMomentum} → ${newMomentum})</p>
      `;

      if (wasDisabled) {
        chatContent += `<p class="rally-trait-enabled">✨ <strong>Trait Re-Enabled:</strong> "${trait.name}"</p>`;
      }

      if (actualGain < this.momentumGain) {
        chatContent += `<p class="rally-capped">(Capped at 10 Momentum)</p>`;
      }

      chatContent += `</div>`;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ alias: this.character.name }),
        content: chatContent,
      });

      ui.notifications.info(`Rally complete - Gained ${actualGain}M${wasDisabled ? ', trait re-enabled' : ''}`);

      // Close dialog
      this.close();
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Rally error:', error);
    }
  }
}
