/**
 * Push Yourself Dialog
 *
 * Dialog for pushing yourself (spending Momentum)
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class PushDialog extends Dialog {
  /**
   * Create a new Push Yourself Dialog
   *
   * @param {string} crewId - Redux ID of the crew
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(crewId, options = {}) {
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    if (momentum < 1) {
      ui.notifications.warn('Not enough Momentum to push (need 1)');
      return;
    }

    const content = `
      <form>
        <p>Current Momentum: <strong>${momentum}/10</strong></p>
        <p>Cost: <strong>1 Momentum</strong></p>
        <div class="form-group">
          <label>Push Type</label>
          <select name="pushType">
            <option value="extra-die">Add +1d to your roll</option>
            <option value="improved-effect">Improve Effect (+1 level)</option>
            <option value="improved-position">Improve Position (+1 level)</option>
          </select>
        </div>
      </form>
    `;

    const buttons = {
      push: {
        icon: '<i class="fas fa-bolt"></i>',
        label: "Push Yourself",
        callback: (html) => this._onApply(html, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Push Yourself",
      content,
      buttons,
      default: "push",
      ...options
    });

    this.crewId = crewId;
  }

  async _onApply(html, crewId) {
    const form = html.find('form')[0];
    const pushType = form.pushType.value;

    try {
      const result = game.fitgd.api.action.push({
        crewId,
        type: pushType
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      const typeLabel = {
        'extra-die': '+1d to roll',
        'improved-effect': 'Effect +1',
        'improved-position': 'Position +1'
      }[pushType];

      ui.notifications.info(`Pushed! ${typeLabel}. Momentum: ${result.newMomentum}/10`);

      // Re-render crew sheet
      refreshSheetsByReduxId([crewId], false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Push error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Flashback Dialog                            */
/* -------------------------------------------- */

/**
 * Flashback Dialog
 *
 * Allows a character to declare a flashback, spending 1 Momentum to:
 * 1. Create a new flashback trait (representing prior preparation)
 * 2. Gain advantage on the current roll
 *
 * The new trait is added with category 'flashback' and can be used in future situations.
 * Advantage typically means +1d or improved position/effect (GM discretion).
 *
 * @extends Dialog
 */
