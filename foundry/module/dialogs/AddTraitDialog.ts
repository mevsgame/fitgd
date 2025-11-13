/**
 * Add Trait Dialog
 *
 * Dialog for adding new traits to a character
 */

import type { Trait } from '@/types/character';

export class AddTraitDialog extends Dialog {
  private characterId: string;

  /**
   * Create a new Add Trait Dialog
   *
   * @param characterId - Redux ID of the character
   * @param options - Additional options passed to Dialog constructor
   */
  constructor(characterId: string, options: any = {}) {
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
        callback: (html: JQuery) => this._onApply(html, characterId)
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

  private async _onApply(html: JQuery, characterId: string): Promise<void> {
    const form = html.find('form')[0] as HTMLFormElement;
    const traitName = (form.elements.namedItem('traitName') as HTMLInputElement).value.trim();
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value as Trait['category'];
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim();

    if (!traitName) {
      ui.notifications.warn('Please enter a trait name');
      return;
    }

    try {
      // Create trait through Redux
      const trait: Trait = {
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
      ui.notifications.error(`Error: ${(error as Error).message}`);
      console.error('FitGD | Add Trait error:', error);
    }
  }
}
