/**
 * Add Trait Dialog
 *
 * Dialog for adding new traits to a character
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class AddTraitDialog extends Dialog {
  /**
   * Create a new Add Trait Dialog
   *
   * @param {string} characterId - Redux ID of the character
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(characterId, options = {}) {
    const content = `
      <form>
        <div class="form-group">
          <label>Trait Name</label>
          <input type="text" name="traitName" placeholder="e.g., 'Veteran Soldier'" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <select name="category">
            <option value="role">Role</option>
            <option value="background">Background</option>
            <option value="scar">Scar</option>
            <option value="flashback">Flashback</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <textarea name="description" rows="3"></textarea>
        </div>
      </form>
    `;

    const buttons = {
      add: {
        icon: '<i class="fas fa-plus"></i>',
        label: "Add Trait",
        callback: (html) => this._onApply(html, characterId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Add Trait",
      content,
      buttons,
      default: "add",
      ...options
    });

    this.characterId = characterId;
  }

  async _onApply(html, characterId) {
    const form = html.find('form')[0];
    const traitName = form.traitName.value.trim();
    const category = form.category.value;
    const description = form.description.value.trim();

    if (!traitName) {
      ui.notifications.warn('Please enter a trait name');
      return;
    }

    try {
      // Create trait through Redux
      const trait = {
        id: foundry.utils.randomID(),
        name: traitName,
        category,
        disabled: false,
        description: description || undefined,
        acquiredAt: Date.now()
      };

      // Use Bridge API to dispatch, broadcast, and refresh automatically
      await game.fitgd.bridge.execute(
        {
          type: 'characters/addTrait',
          payload: {
            characterId,
            trait
          }
        },
        { affectedReduxIds: [characterId], force: true }
      );

      ui.notifications.info(`Trait "${traitName}" added`);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Add Trait error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Flashback Traits Dialog                     */
/* -------------------------------------------- */

/**
 * Flashback Traits Dialog
 *
 * Advanced flashback system that allows players to use traits strategically before a roll.
 * Provides three modes:
 *
 * 1. **Use Existing Trait** - Spend 1 Momentum to:
 *    - Improve position by 1 level (Desperate → Risky → Controlled)
 *    - No new trait created, just using existing trait's narrative justification
 *
 * 2. **Create New Trait** - Spend 1 Momentum to:
 *    - Create a completely new flashback trait
 *    - Improve position by 1 level
 *
 * 3. **Consolidate Traits** - Spend 1 Momentum to:
 *    - Group 3 existing traits into 1 new broader trait
 *    - Improve position by 1 level
 *    - Helps manage trait count and creates more powerful traits
 *
 * All modes store a transaction that's applied when the roll is committed.
 * This shows GM the player's plan before the roll happens.
 *
 * @extends Application
 */
