/**
 * Rally Dialog
 *
 * Dialog for rallying to restore traits
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class RallyDialog extends Dialog {
  /**
   * Create a new Rally Dialog
   *
   * @param {string} characterId - Redux ID of the character rallying
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(characterId, crewId, options = {}) {
    const character = game.fitgd.api.character.getCharacter(characterId);
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    // Check if Rally is available
    if (momentum > 3) {
      ui.notifications.warn(`Rally only available at 0-3 Momentum (current: ${momentum})`);
      return;
    }

    if (!game.fitgd.api.query.canUseRally(characterId)) {
      ui.notifications.warn('Rally already used. Reset required.');
      return;
    }

    // Get disabled traits
    const disabledTraits = character?.traits.filter(t => t.disabled) || [];

    if (disabledTraits.length === 0) {
      ui.notifications.warn('No disabled traits to re-enable.');
      return;
    }

    const traitOptions = disabledTraits.map(t =>
      `<option value="${t.id}">${t.name}</option>`
    ).join('');

    const content = `
      <form>
        <p>Current Momentum: <strong>${momentum}/10</strong></p>
        <p>Rally costs 2 Momentum, gains 1 back.</p>
        <div class="form-group">
          <label>Select Trait to Re-enable</label>
          <select name="traitId">
            ${traitOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Momentum to Spend</label>
          <input type="number" name="momentumToSpend" value="2" min="0" max="${Math.min(3, momentum)}" />
        </div>
      </form>
    `;

    const buttons = {
      rally: {
        icon: '<i class="fas fa-heartbeat"></i>',
        label: "Use Rally",
        callback: (html) => this._onApply(html, characterId, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Use Rally",
      content,
      buttons,
      default: "rally",
      ...options
    });

    this.characterId = characterId;
    this.crewId = crewId;
  }

  async _onApply(html, characterId, crewId) {
    const form = html.find('form')[0];
    const traitId = form.traitId.value;
    const momentumToSpend = parseInt(form.momentumToSpend.value);

    try {
      const result = game.fitgd.api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      ui.notifications.info(`Rally used! Trait re-enabled. Momentum: ${result.newMomentum}/10`);

      // Re-render sheets
      refreshSheetsByReduxId([characterId, crewId], false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Rally error:', error);
    }
  }
}
 