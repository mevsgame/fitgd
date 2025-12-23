/**
 * Add Trait Dialog
 *
 * Dialog for adding new traits to a character
 */

import type { Trait } from '@/types/character';
import { asReduxId } from '../types/ids';

export class AddTraitDialog extends Dialog {
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
          <label>${game.i18n.localize('FITGD.Dialogs.AddTrait.TraitName')}</label>
          <input type="text" name="traitName" placeholder="${game.i18n.localize('FITGD.Dialogs.AddTrait.PlaceholderName')}" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('FITGD.Dialogs.AddTrait.Category')}</label>
          <select name="category">
            <option value="role">${game.i18n.localize('FITGD.TraitCategories.Role')}</option>
            <option value="background">${game.i18n.localize('FITGD.TraitCategories.Background')}</option>
            <option value="scar">${game.i18n.localize('FITGD.TraitCategories.Scar')}</option>
            <option value="flashback">${game.i18n.localize('FITGD.TraitCategories.Flashback')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('FITGD.Dialogs.AddTrait.DescriptionOptional')}</label>
          <textarea name="description" rows="3"></textarea>
        </div>
      </form>
    `;

    const buttons = {
      add: {
        icon: '<i class="fas fa-plus"></i>',
        label: game.i18n.localize('FITGD.Dialogs.AddTrait.ButtonAdd'),
        callback: (html?: JQuery) => this._onApply(html!, characterId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('FITGD.Global.Cancel')
      }
    };

    super(
      {
        title: game.i18n.localize('FITGD.Dialogs.AddTrait.Title'),
        content,
        buttons,
        default: "add"
      },
      {
        classes: ['fitgd', 'dialog', 'fitgd-dialog', 'add-trait-dialog'],
        ...options
      }
    );
  }

  private async _onApply(html: JQuery, characterId: string): Promise<void> {
    // Null safety checks
    if (!game.fitgd!) {
      console.error('FitGD | FitGD not initialized');
      return;
    }

    const form = html.find('form')[0] as HTMLFormElement;
    const traitName = (form.elements.namedItem('traitName') as HTMLInputElement).value.trim();
    const category = (form.elements.namedItem('category') as HTMLSelectElement).value as Trait['category'];
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim();

    if (!traitName) {
      ui.notifications!.warn(game.i18n.localize('FITGD.Dialogs.AddTrait.EnterNameWarning'));
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
      await game.fitgd!.bridge.execute(
        {
          type: 'characters/addTrait',
          payload: {
            characterId,
            trait
          }
        },
        { affectedReduxIds: [asReduxId(characterId)], force: true }
      );

      ui.notifications!.info(game.i18n.format('FITGD.Dialogs.AddTrait.AddedSuccess', { name: traitName }));

    } catch (error) {
      ui.notifications!.error(`Error: ${(error as Error).message}`);
      console.error('FitGD | Add Trait error:', error);
    }
  }
}
