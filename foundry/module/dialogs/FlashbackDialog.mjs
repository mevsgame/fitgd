/**
 * Flashback Dialog
 *
 * Dialog for initiating flashbacks
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class FlashbackDialog extends Dialog {
  /**
   * Create a new Flashback Dialog
   *
   * @param {string} characterId - Redux ID of the character using flashback
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(characterId, crewId, options = {}) {
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    if (momentum < 1) {
      ui.notifications.warn('Not enough Momentum for flashback (need 1)');
      return;
    }

    const content = `
      <form>
        <p>Current Momentum: <strong>${momentum}/10</strong></p>
        <p>Cost: <strong>1 Momentum</strong></p>
        <p>Gain: <strong>New trait + advantage on roll</strong></p>
        <div class="form-group">
          <label>Trait Name</label>
          <input type="text" name="traitName" placeholder="e.g., 'Studied the Enemy Commander'" />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <textarea name="traitDescription" rows="3" placeholder="How did you prepare?"></textarea>
        </div>
      </form>
    `;

    const buttons = {
      flashback: {
        icon: '<i class="fas fa-history"></i>',
        label: "Flashback",
        callback: (html) => this._onApply(html, characterId, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Flashback",
      content,
      buttons,
      default: "flashback",
      ...options
    });

    this.characterId = characterId;
    this.crewId = crewId;
  }

  async _onApply(html, characterId, crewId) {
    const form = html.find('form')[0];
    const traitName = form.traitName.value.trim();
    const traitDescription = form.traitDescription.value.trim();

    if (!traitName) {
      ui.notifications.warn('Please enter a trait name');
      return;
    }

    try {
      const result = game.fitgd.api.action.flashback({
        crewId,
        characterId,
        trait: {
          name: traitName,
          disabled: false,
          description: traitDescription || undefined
        }
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      ui.notifications.info(`Flashback! New trait "${traitName}" added. Momentum: ${result.newMomentum}/10`);

      // Re-render sheets (force = true to ensure new trait appears)
      refreshSheetsByReduxId([characterId, crewId], true);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Flashback error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Add Trait Dialog                            */
/* -------------------------------------------- */

/**
 * Add Trait Dialog
 *
 * Simple dialog for manually adding a trait to a character. Traits can be:
 * - Role: Character's primary role or archetype
 * - Background: Past experiences or training
 * - Scar: Lasting consequence from serious harm or trauma
 * - Flashback: Trait gained through flashback mechanic
 *
 * Traits can be disabled (leaned into for Momentum) and re-enabled (Rally).
 *
 * @extends Dialog
 */
