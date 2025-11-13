/**
 * Flashback Dialog
 *
 * Dialog for initiating flashbacks
 */

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class FlashbackDialog extends Dialog {
  private characterId: string;
  private crewId: string;

  /**
   * Create a new Flashback Dialog
   *
   * @param characterId - Redux ID of the character using flashback
   * @param crewId - Redux ID of the character's crew
   * @param options - Additional options passed to Dialog constructor
   */
  constructor(characterId: string, crewId: string, options: Partial<DialogOptions> = {}) {
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    if (momentum < 1) {
      ui.notifications.warn('Not enough Momentum for flashback (need 1)');
      // @ts-expect-error - Returning from constructor to prevent dialog creation
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
        callback: (html: JQuery) => this._onApply(html, characterId, crewId)
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

  private async _onApply(html: JQuery, characterId: string, crewId: string): Promise<void> {
    const form = html.find('form')[0] as HTMLFormElement;
    const traitName = (form.elements.namedItem('traitName') as HTMLInputElement).value.trim();
    const traitDescription = (form.elements.namedItem('traitDescription') as HTMLTextAreaElement).value.trim();

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications.error(`Error: ${errorMessage}`);
      console.error('FitGD | Flashback error:', error);
    }
  }
}
