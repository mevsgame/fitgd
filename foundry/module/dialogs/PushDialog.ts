/**
 * Push Yourself Dialog
 *
 * Dialog for pushing yourself (spending Momentum)
 */

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

type PushType = 'extra-die' | 'improved-effect' | 'improved-position';

export class PushDialog extends Dialog {
  private crewId: string;

  /**
   * Create a new Push Yourself Dialog
   *
   * @param crewId - Redux ID of the crew
   * @param options - Additional options passed to Dialog constructor
   */
  constructor(crewId: string, options: Partial<DialogOptions> = {}) {
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    if (momentum < 1) {
      ui.notifications.warn('Not enough Momentum to push (need 1)');
      // @ts-expect-error - Returning from constructor to prevent dialog creation
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
        callback: (html: JQuery) => this._onApply(html, crewId)
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

  private async _onApply(html: JQuery, crewId: string): Promise<void> {
    const form = html.find('form')[0] as HTMLFormElement;
    const pushType = (form.elements.namedItem('pushType') as HTMLSelectElement).value as PushType;

    try {
      const result = game.fitgd.api.action.push({
        crewId,
        type: pushType
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      const typeLabel: Record<PushType, string> = {
        'extra-die': '+1d to roll',
        'improved-effect': 'Effect +1',
        'improved-position': 'Position +1'
      };

      ui.notifications.info(`Pushed! ${typeLabel[pushType]}. Momentum: ${result.newMomentum}/10`);

      // Re-render crew sheet
      refreshSheetsByReduxId([crewId], false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications.error(`Error: ${errorMessage}`);
      console.error('FitGD | Push error:', error);
    }
  }
}
