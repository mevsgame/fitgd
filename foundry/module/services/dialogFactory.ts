/**
 * Dialog Factory
 *
 * Creates and manages dialog instances used by the Player Action Widget
 * Provides injectable service for testability
 */

import { RallyDialog } from '../dialogs/RallyDialog';
import { FlashbackTraitsDialog } from '../dialogs/FlashbackTraitsDialog';

/**
 * Type for dialog callbacks
 */
export type FlashbackItemCallback = (data: {
  name: string;
  tags: string[];
  cost: number;
}) => Promise<void>;

/**
 * Interface for dialog creation
 */
export interface DialogFactory {
  /**
   * Create a Rally Dialog
   *
   * @param characterId - Redux ID of the character rallying
   * @param crewId - Redux ID of the crew
   * @returns Dialog instance with render method
   */
  createRallyDialog(characterId: string, crewId: string): { render: (force: boolean) => void };

  /**
   * Create a Flashback Traits Dialog
   *
   * @param characterId - Redux ID of the character
   * @param crewId - Redux ID of the crew
   * @returns Dialog instance with render method
   */
  createFlashbackTraitsDialog(characterId: string, crewId: string): { render: (force: boolean) => void };

  /**
   * Create a Flashback Item Dialog
   *
   * @param onSubmit - Callback when user submits the form
   * @returns Dialog instance with render method
   */
  createFlashbackItemDialog(onSubmit: FlashbackItemCallback): { render: (force: boolean) => void };
}

/**
 * Default Foundry implementation of DialogFactory
 *
 * Uses Foundry's Dialog and custom dialog classes
 */
export class FoundryDialogFactory implements DialogFactory {
  createRallyDialog(characterId: string, crewId: string): { render: (force: boolean) => void } {
    return new RallyDialog(characterId, crewId);
  }

  createFlashbackTraitsDialog(characterId: string, crewId: string): { render: (force: boolean) => void } {
    return new FlashbackTraitsDialog(characterId, crewId);
  }

  createFlashbackItemDialog(onSubmit: FlashbackItemCallback): { render: (force: boolean) => void } {
    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('FITGD.Dialogs.FlashbackItem.ItemName')}</label>
          <input type="text" name="name" placeholder="${game.i18n.localize('FITGD.Dialogs.FlashbackItem.ItemName')}" autofocus style="width: 100%; margin-bottom: 10px;">
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('FITGD.Dialogs.FlashbackItem.Tags')}</label>
          <input type="text" name="tags" value="bonus" placeholder="${game.i18n.localize('FITGD.Dialogs.FlashbackItem.Tags')}" style="width: 100%; margin-bottom: 10px;">
          <p class="notes" style="font-size: 0.8em; color: #666;">${game.i18n.localize('FITGD.Dialogs.FlashbackItem.TagsHint')}</p>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('FITGD.Dialogs.FlashbackItem.MomentumCost')}</label>
          <input type="number" name="cost" value="1" min="0" max="10" style="width: 100%;">
          <p class="notes" style="font-size: 0.8em; color: #666;">${game.i18n.localize('FITGD.Dialogs.FlashbackItem.CostHint')}</p>
        </div>
      </form>
    `;

    return new Dialog({
      title: game.i18n.localize('FITGD.Dialogs.FlashbackItem.Title'),
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('FITGD.Global.Add'),
          callback: async (html: JQuery | HTMLElement | undefined) => {
            if (!html) return;
            const $html = $(html as HTMLElement);
            const name = $html.find('[name="name"]').val() as string;
            const tagsStr = $html.find('[name="tags"]').val() as string;
            const cost = parseInt($html.find('[name="cost"]').val() as string) || 0;
            const tags = tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t);

            if (!name) return;

            await onSubmit({ name, tags, cost });
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('FITGD.Global.Cancel'),
        },
      },
      default: "add",
    });
  }
}
