/**
 * Take Harm Dialog
 *
 * Dialog for taking harm and creating harm clocks
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class TakeHarmDialog extends Dialog {
  /**
   * Create a new Take Harm Dialog
   *
   * @param {string} characterId - Redux ID of the character taking harm
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options
   * @param {import('dist/types').Position} options.defaultPosition - Pre-select position (default: 'risky')
   * @param {number} options.defaultSegments - Pre-calculate segments to display
   */
  constructor(characterId, crewId, options = {}) {
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
            </select>
          </div>

          <div class="form-group">
            <label>Effect (Harm Severity)</label>
            <select name="effect">
              <option value="limited">Limited</option>
              <option value="standard" selected>Standard</option>
              <option value="great">Great</option>
            </select>
          </div>

          <div class="help-text harm-reference">
            <strong>Harm Segments:</strong><br/>
            • Controlled: 0/1/2 (Limited/Standard/Great)<br/>
            • Risky: 2/3/4 (Limited/Standard/Great)<br/>
            • Desperate: 4/5/6 (Limited/Standard/Great)
          </div>
        </form>
      </div>
    `;

    const buttons = {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: "Take Harm",
        callback: (html) => this._onApply(html, characterId, crewId)
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
      classes: ['fitgd', 'clock-creation-dialog'],
      ...options
    });

    this.characterId = characterId;
    this.crewId = crewId;
  }

  async _onApply(html, characterId, crewId) {
    const form = html.find('form')[0];
    const harmType = form.harmType.value;
    const position = form.position.value;
    const effect = form.effect.value;

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
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Take Harm error:', error);
    }
  }
}
 