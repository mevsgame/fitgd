/**
 * Take Harm Dialog
 *
 * Dialog for taking harm and creating harm clocks
 */

import type { Position, Effect } from '@/types/resolution';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers';

interface TakeHarmOptions extends Partial<DialogOptions> {
  defaultPosition?: Position;
  defaultSegments?: number;
}

export class TakeHarmDialog extends Dialog {
  /**
   * Create a new Take Harm Dialog
   *
   * @param characterId - Redux ID of the character taking harm
   * @param crewId - Redux ID of the character's crew
   * @param options - Additional options
   */
  constructor(characterId: string, crewId: string, options: TakeHarmOptions = {}) {
    const defaultPosition = options.defaultPosition || 'risky';

    const content = `
      <div class="clock-creation-dialog">
        <div class="dialog-header">
          <h2>Take Harm</h2>
          <p class="help-text">Apply harm from consequences or enemy action</p>
        </div>

        <form class="clock-creation-form">
          <div class="form-group">
            <label>Harm Type</label>
            <select name="harmType">
              <option value="Physical Harm">Physical Harm</option>
              <option value="Shaken Morale">Shaken Morale</option>
            </select>
          </div>

          <div class="form-group">
            <label>Position</label>
            <select name="position">
              <option value="controlled" ${defaultPosition === 'controlled' ? 'selected' : ''}>Controlled</option>
              <option value="risky" ${defaultPosition === 'risky' ? 'selected' : ''}>Risky</option>
              <option value="desperate" ${defaultPosition === 'desperate' ? 'selected' : ''}>Desperate</option>
              <option value="impossible" ${defaultPosition === 'impossible' ? 'selected' : ''}>Impossible</option>
            </select>
          </div>

          <div class="form-group">
            <label>Effect (Harm Severity)</label>
            <select name="effect">
              <option value="limited">Limited</option>
              <option value="standard" selected>Standard</option>
              <option value="great">Great</option>
              <option value="spectacular">Spectacular</option>
            </select>
          </div>

          <div class="help-text harm-reference">
            <strong>Harm Segments (Position Only):</strong><br/>
            • Controlled: 1 segment<br/>
            • Risky: 3 segments<br/>
            • Desperate: 5 segments<br/>
            • Impossible: 6 segments (instant dying)<br/>
            <br/>
            <em>Note: Effect does not modify harm, only success clocks.</em>
          </div>
        </form>
      </div>
    `;

    const buttons = {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Take Harm",
        callback: async (html?: JQuery<HTMLElement>) => {
          await this._onApply(html!, characterId, crewId);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Take Harm",
      content,
      buttons,
      default: "apply",
      classes: ['fitgd', 'fitgd-dialog', 'clock-creation-dialog'],
      ...options
    });
  }

  private async _onApply(html: JQuery, characterId: string, crewId: string): Promise<void> {
    const form = html.find('form')[0] as HTMLFormElement;
    const harmType = (form.elements.namedItem('harmType') as HTMLSelectElement).value;
    const position = (form.elements.namedItem('position') as HTMLSelectElement).value as Position;
    const effect = (form.elements.namedItem('effect') as HTMLSelectElement).value as Effect;

    try {
      // Apply consequences (generates Momentum AND applies harm)
      // Using 'failure' as default result since taking harm implies a consequence
      const consequence = game.fitgd.api.action.applyConsequences({
        crewId,
        characterId,
        position,
        effect,
        result: 'failure',  // Default to failure when taking harm
        harmType
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      // Notify
      const harmInfo = consequence.harmApplied;
      if (harmInfo) {
        ui.notifications.info(`Took ${harmInfo.segmentsAdded} segments of ${harmType}. Gained ${consequence.momentumGenerated} Momentum.`);

        if (harmInfo.isDying) {
          ui.notifications.error(`Character is DYING! (6/6 harm clock)`);
        }
      } else {
        ui.notifications.info(`Gained ${consequence.momentumGenerated} Momentum.`);
      }

      // Force re-render affected sheets
      refreshSheetsByReduxId([characterId, crewId], true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications.error(`Error: ${errorMessage}`);
      console.error('FitGD | Take Harm error:', error);
    }
  }
}
