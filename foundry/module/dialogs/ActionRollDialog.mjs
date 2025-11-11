/**
 * Action Roll Dialog
 *
 * Dialog for initiating action rolls
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

/* -------------------------------------------- */
/*  Action Roll Dialog                          */
/* -------------------------------------------- */

/**
 * Action Roll Dialog
 *
 * Displays a dialog for performing action rolls with the following options:
 * - Action selection (based on character's action dots)
 * - Position (Controlled/Risky/Desperate)
 * - Effect (Limited/Standard/Great)
 * - Push Yourself (+1d for 1 Momentum)
 * - Devil's Bargain (+1d with GM complication)
 * - Bonus dice from assists/advantages
 *
 * Automatically calculates dice pool, handles 0-dot actions (roll 2d6 keep lowest),
 * evaluates roll outcome, posts to chat, and handles consequences.
 *
 * @extends Dialog
 */
export class ActionRollDialog extends Dialog {
  /**
   * Create a new Action Roll Dialog
   *
   * @param {string} characterId - Redux ID of the character making the roll
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options passed to Dialog constructor
   */
  constructor(characterId, crewId, options = {}) {
    const character = game.fitgd.api.character.getCharacter(characterId);
    const crew = game.fitgd.api.crew.getCrew(crewId);

    if (!character) {
      ui.notifications.error('Character not found');
      return;
    }

    // Build action options
    const actionOptions = Object.entries(character.actionDots)
      .map(([action, dots]) => `<option value="${action}">${action.charAt(0).toUpperCase() + action.slice(1)} (${dots}d)</option>`)
      .join('');

    const content = `
      <form class="fitgd-action-roll">
        <div class="form-group">
          <label>Action</label>
          <select name="action" class="action-select">
            ${actionOptions}
          </select>
          <p class="help-text">Choose which action you're using for this roll.</p>
        </div>

        <div class="form-group">
          <label>Position</label>
          <select name="position">
            <option value="controlled">Controlled (safer, less harm on failure)</option>
            <option value="risky" selected>Risky (balanced risk/reward)</option>
            <option value="desperate">Desperate (dangerous, severe harm on failure)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Effect</label>
          <select name="effect">
            <option value="limited">Limited (small impact)</option>
            <option value="standard" selected>Standard (normal impact)</option>
            <option value="great">Great (significant impact)</option>
          </select>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" name="push" ${crew && crew.currentMomentum >= 1 ? '' : 'disabled'}/>
            Push Yourself (+1d, costs 1 Momentum)
            ${crew && crew.currentMomentum < 1 ? '<span class="warning">(Insufficient Momentum)</span>' : ''}
          </label>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" name="devilsBargain"/>
            Devil's Bargain (+1d, GM adds complication)
          </label>
        </div>

        <div class="form-group">
          <label>Bonus Dice</label>
          <input type="number" name="bonusDice" value="0" min="0" max="5"/>
          <p class="help-text">Additional dice from assists, advantages, etc.</p>
        </div>

        <div class="dice-pool-display">
          <strong>Total Dice Pool: <span class="pool-count">0d6</span></strong>
        </div>
      </form>
    `;

    const buttons = {
      roll: {
        icon: '<i class="fas fa-dice-d6"></i>',
        label: "Roll",
        callback: (html) => this._onRoll(html, characterId, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: `Action Roll - ${character.name}`,
      content,
      buttons,
      default: 'roll',
      render: (html) => this._onRender(html, characterId),
      close: () => {}
    }, options);
  }

  /**
   * Handle dialog render event
   *
   * Sets up reactive UI that updates the dice pool display whenever
   * action, push, devil's bargain, or bonus dice changes.
   *
   * @param {JQuery} html - jQuery object containing the dialog HTML
   * @param {string} characterId - Redux ID of the character
   * @returns {void}
   * @private
   */
  _onRender(html, characterId) {
    const character = game.fitgd.api.character.getCharacter(characterId);
    const actionSelect = html.find('[name="action"]');
    const pushCheckbox = html.find('[name="push"]');
    const devilsCheckbox = html.find('[name="devilsBargain"]');
    const bonusInput = html.find('[name="bonusDice"]');
    const poolDisplay = html.find('.pool-count');

    const updatePool = () => {
      const action = actionSelect.val();
      const actionDots = character.actionDots[action] || 0;
      const push = pushCheckbox.is(':checked') ? 1 : 0;
      const devils = devilsCheckbox.is(':checked') ? 1 : 0;
      const bonus = parseInt(bonusInput.val()) || 0;

      let pool = actionDots + push + devils + bonus;

      // Minimum 2 dice if pool would be 0 or 1
      if (pool < 2) {
        poolDisplay.text(`2d6 (desperate position, roll 2 keep lowest)`);
      } else {
        poolDisplay.text(`${pool}d6`);
      }
    };

    actionSelect.on('change', updatePool);
    pushCheckbox.on('change', updatePool);
    devilsCheckbox.on('change', updatePool);
    bonusInput.on('input', updatePool);

    updatePool();
  }

  /**
   * Handle roll button click
   *
   * Validates Momentum availability if pushing, calculates final dice pool,
   * rolls the dice (handling 0-dot action special case), evaluates outcome
   * (critical/success/partial/failure), posts result to chat, and handles
   * consequences.
   *
   * @param {JQuery} html - jQuery object containing the dialog HTML
   * @param {string} characterId - Redux ID of the character
   * @param {string} crewId - Redux ID of the crew
   * @returns {Promise<void>}
   * @private
   */
  async _onRoll(html, characterId, crewId) {
    const character = game.fitgd.api.character.getCharacter(characterId);
    const crew = game.fitgd.api.crew.getCrew(crewId);

    const action = html.find('[name="action"]').val();
    const position = html.find('[name="position"]').val();
    const effect = html.find('[name="effect"]').val();
    const push = html.find('[name="push"]').is(':checked');
    const devilsBargain = html.find('[name="devilsBargain"]').is(':checked');
    const bonusDice = parseInt(html.find('[name="bonusDice"]').val()) || 0;

    // Calculate dice pool
    const actionDots = character.actionDots[action] || 0;
    let dicePool = actionDots + bonusDice;

    if (push) {
      if (crew.currentMomentum < 1) {
        ui.notifications.warn('Insufficient Momentum to push');
        return;
      }
      dicePool += 1;
      // Spend Momentum
      game.fitgd.api.crew.spendMomentum({ crewId, amount: 1 });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();
    }

    if (devilsBargain) {
      dicePool += 1;
    }

    // Handle 0 dots (roll 2d6, keep lowest)
    const hasZeroDots = dicePool === 0;
    const rollFormula = hasZeroDots ? '2d6kl' : `${dicePool}d6kh`;

    // Roll the dice
    const roll = await new Roll(rollFormula).evaluate();

    // Determine outcome
    const dice = roll.dice[0].results.map(r => r.result);
    const highest = Math.max(...dice);
    const sixes = dice.filter(d => d === 6).length;

    let outcome;
    let outcomeText;
    if (sixes >= 2) {
      outcome = 'critical';
      outcomeText = 'Critical Success!';
    } else if (highest >= 6) {
      outcome = 'success';
      outcomeText = 'Full Success';
    } else if (highest >= 4) {
      outcome = 'partial';
      outcomeText = 'Partial Success';
    } else {
      outcome = 'failure';
      outcomeText = 'Failure';
    }
    const outcomeLabel = `<strong class="outcome-${outcome}">${outcomeText}</strong>`;

    // Create chat message
    const messageContent = `
      <div class="fitgd-action-roll">
        <h3>${character.name} - ${action.charAt(0).toUpperCase() + action.slice(1)}</h3>
        <div class="roll-details">
          <div><strong>Position:</strong> ${position.charAt(0).toUpperCase() + position.slice(1)}</div>
          <div><strong>Effect:</strong> ${effect.charAt(0).toUpperCase() + effect.slice(1)}</div>
          ${push ? '<div><em>Pushed (spent 1 Momentum)</em></div>' : ''}
          ${devilsBargain ? '<div><em>Devil\'s Bargain accepted</em></div>' : ''}
          ${hasZeroDots ? '<div><em>0 dots in action: rolled 2d6, kept lowest</em></div>' : ''}
        </div>
        <div class="roll-result">
          <h4>${outcomeLabel}</h4>
          <div class="dice-result">Highest: ${highest}</div>
          <div class="dice-rolled">Rolled: ${dice.join(', ')}</div>
        </div>
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: game.actors.get(characterId) }),
      flavor: messageContent,
      rollMode: game.settings.get('core', 'rollMode')
    });

    // Handle consequences
    await this._handleConsequences(outcome, position, characterId, crewId, devilsBargain);

    // Re-render sheets
    refreshSheetsByReduxId([characterId, crewId], false);
  }

  /**
   * Handle roll consequences based on outcome
   *
   * - Critical/Success: No consequences
   * - Partial Success: Player chooses consequence (reduced effect, complication, harm, or lose Momentum)
   * - Failure: Automatically takes harm based on position (Controlled: 1, Risky: 2, Desperate: 3)
   * - Devil's Bargain: GM adds complication
   *
   * @param {string} outcome - Roll outcome ('critical', 'success', 'partial', 'failure')
   * @param {import('../../dist/types').Position} position - Position of the roll ('controlled', 'risky', 'desperate')
   * @param {string} characterId - Redux ID of the character
   * @param {string} crewId - Redux ID of the crew
   * @param {boolean} devilsBargain - Whether a devil's bargain was accepted
   * @returns {Promise<void>}
   * @private
   */
  async _handleConsequences(outcome, position, characterId, crewId, devilsBargain) {
    if (outcome === 'critical' || outcome === 'success') {
      // Full success - no consequences
      ui.notifications.info('Success! No consequences.');
      return;
    }

    if (outcome === 'partial') {
      // Partial success - offer choice of consequence
      const choice = await Dialog.confirm({
        title: 'Partial Success - Choose Consequence',
        content: `
          <p>You succeed, but at a cost. Choose your consequence:</p>
          <ul>
            <li><strong>Reduced Effect:</strong> Your effect level is reduced by one.</li>
            <li><strong>Complication:</strong> The GM introduces a complication or danger.</li>
            <li><strong>Take Harm:</strong> You take harm based on the position.</li>
            <li><strong>Lose Momentum:</strong> The crew loses 1 Momentum.</li>
          </ul>
        `,
        yes: () => 'accepted',
        no: () => 'cancelled'
      });

      if (choice) {
        ui.notifications.info('Partial success consequence applied by GM.');
      }
      return;
    }

    if (outcome === 'failure') {
      // Failure - take harm based on position
      const harmSegments = {
        controlled: 1,
        risky: 2,
        desperate: 3
      }[position];

      ui.notifications.warn(`Failure! Taking ${harmSegments} harm (${position} position).`);

      // Auto-open harm dialog
      new TakeHarmDialog(characterId, crewId, {
        defaultPosition: position,
        defaultSegments: harmSegments
      }).render(true);
    }

    if (devilsBargain) {
      ui.notifications.info('Devil\'s Bargain: GM adds a complication.');
    }
  }
}

/* -------------------------------------------- */
/*  Take Harm Dialog                            */
/* -------------------------------------------- */

/**
 * Take Harm Dialog
 *
 * Dialog for applying harm to a character. Harm severity is based on position and effect:
 * - Controlled: 0/1/2 segments (Limited/Standard/Great)
 * - Risky: 2/3/4 segments (Limited/Standard/Great)
 * - Desperate: 4/5/6 segments (Limited/Standard/Great)
 *
 * Creates a new harm clock (max 3 per character). If character already has 3 harm clocks,
 * the new clock replaces the one with the fewest segments.
 *
 * When a harm clock fills (6/6), the character is dying and must be stabilized.
 *
 * @extends Dialog
 */
