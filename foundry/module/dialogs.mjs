/**
 * Dialog Forms for FitGD
 *
 * Implements dialog forms for core game mechanics:
 * - Action Roll
 * - Take Harm
 * - Rally
 * - Push Yourself
 * - Flashback
 * - Add/Manage Traits
 * - Add/Manage Clocks
 */

// @ts-check

/**
 * @typedef {import('../dist/types').Character} Character
 * @typedef {import('../dist/types').Crew} Crew
 * @typedef {import('../dist/types').Clock} Clock
 * @typedef {import('../dist/types').Trait} Trait
 * @typedef {import('../dist/types').Equipment} Equipment
 * @typedef {import('../dist/types').ActionDots} ActionDots
 * @typedef {import('../dist/store').RootState} RootState
 * @typedef {import('../dist/types/playerRoundState').PlayerRoundState} PlayerRoundState
 * @typedef {import('../dist/types/playerRoundState').Position} Position
 * @typedef {import('../dist/types/playerRoundState').Effect} Effect
 */

/* -------------------------------------------- */
/*  Helper Functions                            */
/* -------------------------------------------- */

/**
 * Refresh sheets for the given Redux entity IDs
 *
 * This properly handles the fact that characterId/crewId are Redux IDs,
 * not Foundry Actor IDs. We need to find sheets by matching the Redux ID
 * stored in the actor's flags.
 *
 * @param {string[]} reduxIds - Array of Redux entity IDs to refresh
 * @param {boolean} force - Whether to force re-render (default: true)
 */
export function refreshSheetsByReduxId(reduxIds, force = true) {
  const affectedReduxIds = new Set(reduxIds.filter(id => id)); // Remove nulls/undefined
  if (affectedReduxIds.size === 0) return;

  console.log(`FitGD | Refreshing sheets/widgets for Redux IDs:`, Array.from(affectedReduxIds));

  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) continue;

    // Check sheets (character/crew)
    if (app.constructor.name === 'FitGDCharacterSheet' || app.constructor.name === 'FitGDCrewSheet') {
      try {
        const reduxId = app.actor?.getFlag('forged-in-the-grimdark', 'reduxId');
        if (reduxId && affectedReduxIds.has(reduxId)) {
          console.log(`FitGD | Re-rendering ${app.constructor.name} for Redux ID ${reduxId}`);
          app.render(force);
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`FitGD | Could not refresh sheet:`, error);
      }
    }

    // CRITICAL: Also check widgets (PlayerActionWidget)
    // This ensures GM sees player's trait transactions and plan updates
    if (app.constructor.name === 'PlayerActionWidget') {
      try {
        const characterId = app.characterId;
        if (characterId && affectedReduxIds.has(characterId)) {
          console.log(`FitGD | Re-rendering PlayerActionWidget for character ${characterId}`);
          app.render(force);
          refreshedCount++;
        }
      } catch (error) {
        console.warn(`FitGD | Could not refresh widget:`, error);
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheet(s)/widget(s)`);
}

/* -------------------------------------------- */
/*  Action Roll Dialog                          */
/* -------------------------------------------- */

export class ActionRollDialog extends Dialog {
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

export class TakeHarmDialog extends Dialog {
  constructor(characterId, crewId, options = {}) {
    const content = `
      <form>
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
            <option value="controlled">Controlled</option>
            <option value="risky" selected>Risky</option>
            <option value="desperate">Desperate</option>
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
        <p class="help-text">
          <strong>Harm Segments:</strong><br/>
          Controlled: 0/1/2 (Limited/Standard/Great)<br/>
          Risky: 2/3/4 (Limited/Standard/Great)<br/>
          Desperate: 4/5/6 (Limited/Standard/Great)
        </p>
      </form>
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

/* -------------------------------------------- */
/*  Rally Dialog                                */
/* -------------------------------------------- */

export class RallyDialog extends Dialog {
  constructor(characterId, crewId, options = {}) {
    const character = game.fitgd.api.character.getCharacter(characterId);
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    // Check if Rally is available
    if (momentum > 3) {
      ui.notifications.warn(`Rally only available at 0-3 Momentum (current: ${momentum})`);
      return;
    }

    if (!game.fitgd.api.query.canUseRally(characterId)) {
      ui.notifications.warn('Rally already used. Reset required.');
      return;
    }

    // Get disabled traits
    const disabledTraits = character?.traits.filter(t => t.disabled) || [];

    if (disabledTraits.length === 0) {
      ui.notifications.warn('No disabled traits to re-enable.');
      return;
    }

    const traitOptions = disabledTraits.map(t =>
      `<option value="${t.id}">${t.name}</option>`
    ).join('');

    const content = `
      <form>
        <p>Current Momentum: <strong>${momentum}/10</strong></p>
        <p>Rally costs 2 Momentum, gains 1 back.</p>
        <div class="form-group">
          <label>Select Trait to Re-enable</label>
          <select name="traitId">
            ${traitOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Momentum to Spend</label>
          <input type="number" name="momentumToSpend" value="2" min="0" max="${Math.min(3, momentum)}" />
        </div>
      </form>
    `;

    const buttons = {
      rally: {
        icon: '<i class="fas fa-heartbeat"></i>',
        label: "Use Rally",
        callback: (html) => this._onApply(html, characterId, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Use Rally",
      content,
      buttons,
      default: "rally",
      ...options
    });

    this.characterId = characterId;
    this.crewId = crewId;
  }

  async _onApply(html, characterId, crewId) {
    const form = html.find('form')[0];
    const traitId = form.traitId.value;
    const momentumToSpend = parseInt(form.momentumToSpend.value);

    try {
      const result = game.fitgd.api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      ui.notifications.info(`Rally used! Trait re-enabled. Momentum: ${result.newMomentum}/10`);

      // Re-render sheets
      refreshSheetsByReduxId([characterId, crewId], false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Rally error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Push Yourself Dialog                        */
/* -------------------------------------------- */

export class PushDialog extends Dialog {
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

export class FlashbackDialog extends Dialog {
  constructor(characterId, crewId, options = {}) {
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const momentum = crew?.currentMomentum || 0;

    if (momentum < 1) {
      ui.notifications.warn('Not enough Momentum for flashback (need 1)');
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
        callback: (html) => this._onApply(html, characterId, crewId)
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

  async _onApply(html, characterId, crewId) {
    const form = html.find('form')[0];
    const traitName = form.traitName.value.trim();
    const traitDescription = form.traitDescription.value.trim();

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
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Flashback error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Add Trait Dialog                            */
/* -------------------------------------------- */

export class AddTraitDialog extends Dialog {
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

export class FlashbackTraitsDialog extends Application {
  constructor(characterId, crewId, options = {}) {
    super(options);

    this.characterId = characterId;
    this.crewId = crewId;
    this.character = game.fitgd.api.character.getCharacter(characterId);
    this.crew = game.fitgd.api.crew.getCrew(crewId);

    // Determine if player is eligible for editable mode (fewest traits)
    this.isEditable = this._checkTraitEligibility();

    // Current mode: 'use-existing', 'create-new', or 'consolidate'
    this.mode = 'use-existing';

    // Selected traits for consolidation
    this.selectedTraitIds = [];

    // Selected trait for use
    this.selectedTraitId = null;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'flashback-traits-dialog'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/flashback-traits-dialog.html',
      width: 500,
      height: 'auto',
      title: 'Use Trait / Flashback',
      resizable: false,
    });
  }

  /** @override */
  get id() {
    return `flashback-traits-dialog-${this.characterId}`;
  }

  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options);

    // Get traits, excluding disabled ones
    const availableTraits = this.character.traits.filter(t => !t.disabled);

    // Categorize traits
    const roleAndBackgroundTraits = availableTraits.filter(t =>
      t.category === 'role' || t.category === 'background'
    );
    const consolidatableTraits = availableTraits.filter(t =>
      t.category !== 'role' && t.category !== 'background'
    );

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: this.crew?.currentMomentum || 0,
      isEditable: this.isEditable,
      mode: this.mode,
      availableTraits,
      roleAndBackgroundTraits,
      consolidatableTraits,
      selectedTraitIds: this.selectedTraitIds,
      selectedTraitId: this.selectedTraitId,
      canConsolidate: consolidatableTraits.length >= 3,
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Store html for later use
    this.html = html;

    // Mode selection (if editable)
    html.find('[name="mode"]').change(this._onModeChange.bind(this));

    // Trait selection
    html.find('.trait-item').click(this._onTraitClick.bind(this));

    // Apply button
    html.find('[data-action="apply"]').click(this._onApply.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Check if character is eligible for editable mode (fewest traits in crew)
   */
  _checkTraitEligibility() {
    const state = game.fitgd.store.getState();
    const crewCharacters = this.crew.characters;

    // Count traits for all characters in crew
    const traitCounts = crewCharacters.map(charId => {
      const char = state.characters.byId[charId];
      return { id: charId, count: char?.traits.length || 0 };
    });

    // Find minimum trait count
    const minCount = Math.min(...traitCounts.map(tc => tc.count));

    // Check if this character has the minimum (or tied for minimum)
    const myCount = traitCounts.find(tc => tc.id === this.characterId)?.count || 0;
    return myCount === minCount;
  }

  /**
   * Handle mode change
   */
  _onModeChange(event) {
    this.mode = event.currentTarget.value;
    this.selectedTraitIds = [];
    this.selectedTraitId = null;
    this.render();
  }

  /**
   * Handle trait click
   */
  _onTraitClick(event) {
    const traitId = event.currentTarget.dataset.traitId;

    if (this.mode === 'consolidate') {
      // Toggle selection for consolidation (max 3)
      const index = this.selectedTraitIds.indexOf(traitId);
      if (index >= 0) {
        this.selectedTraitIds.splice(index, 1);
      } else if (this.selectedTraitIds.length < 3) {
        this.selectedTraitIds.push(traitId);
      }
    } else {
      // Single selection for use-existing or trait to use after create
      this.selectedTraitId = traitId;
    }

    this.render();
  }

  /**
   * Handle apply button
   */
  async _onApply(event) {
    event.preventDefault();

    try {
      if (this.mode === 'use-existing') {
        await this._applyUseExisting();
      } else if (this.mode === 'create-new') {
        await this._applyCreateNew();
      } else if (this.mode === 'consolidate') {
        await this._applyConsolidate();
      }

      this.close();
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Flashback Traits error:', error);
    }
  }

  /**
   * Apply use existing trait (costs 1 Momentum for position improvement)
   */
  async _applyUseExisting() {
    if (!this.selectedTraitId) {
      ui.notifications.warn('Please select a trait');
      return;
    }

    // Check Momentum (costs 1M for position improvement)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: this.selectedTraitId,
            positionImprovement: true, // Using trait will improve position
            momentumCost: 1, // Flashback costs 1M
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info('Trait selected - will improve position on roll (costs 1M)');
  }

  /**
   * Apply create new trait (flashback)
   */
  async _applyCreateNew() {
    // Get trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = this.html.find('[name="newTraitName"]').val()?.trim();
    const newTraitDescription = this.html.find('[name="newTraitDescription"]').val()?.trim();

    if (!newTraitName) {
      ui.notifications.warn('Please enter a trait name');
      return;
    }

    // Check Momentum (costs 1M for flashback)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'new',
            newTrait: {
              name: newTraitName,
              description: newTraitDescription || undefined,
              category: 'flashback',
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info(`New trait "${newTraitName}" will be created on roll (costs 1M)`);
  }

  /**
   * Apply consolidate traits
   */
  async _applyConsolidate() {
    if (this.selectedTraitIds.length !== 3) {
      ui.notifications.warn('Please select exactly 3 traits to consolidate');
      return;
    }

    // Get consolidated trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = this.html.find('[name="newTraitName"]').val()?.trim();
    const newTraitDescription = this.html.find('[name="newTraitDescription"]').val()?.trim();

    if (!newTraitName) {
      ui.notifications.warn('Please enter a name for the consolidated trait');
      return;
    }

    // Check Momentum (costs 1M for flashback)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'consolidate',
            consolidation: {
              traitIdsToRemove: this.selectedTraitIds,
              newTrait: {
                name: newTraitName,
                description: newTraitDescription || undefined,
                category: 'grouped',
              },
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info(`Traits will be consolidated into "${newTraitName}" on roll (costs 1M)`);
  }
}

/* -------------------------------------------- */
/*  Add Progress Clock Dialog                   */
/* -------------------------------------------- */

export class AddClockDialog extends Dialog {
  constructor(crewId, options = {}) {
    const content = `
      <form>
        <div class="form-group">
          <label>Clock Name</label>
          <input type="text" name="clockName" placeholder="e.g., 'Infiltrate Enemy Base'" />
        </div>
        <div class="form-group">
          <label>Size (segments)</label>
          <select name="segments">
            <option value="4">4 segments (short)</option>
            <option value="6" selected>6 segments</option>
            <option value="8">8 segments</option>
            <option value="12">12 segments (long)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select name="category">
            <option value="long-term-project">Long-term Project</option>
            <option value="threat">Threat (countdown)</option>
            <option value="personal-goal">Personal Goal</option>
            <option value="obstacle">Obstacle</option>
            <option value="faction">Faction</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <textarea name="description" rows="2"></textarea>
        </div>
      </form>
    `;

    const buttons = {
      add: {
        icon: '<i class="fas fa-clock"></i>',
        label: "Add Clock",
        callback: (html) => this._onApply(html, crewId)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    };

    super({
      title: "Add Progress Clock",
      content,
      buttons,
      default: "add",
      ...options
    });

    this.crewId = crewId;
  }

  async _onApply(html, crewId) {
    const form = html.find('form')[0];
    const clockName = form.clockName.value.trim();
    const segments = parseInt(form.segments.value);
    const category = form.category.value;
    const description = form.description.value.trim();

    if (!clockName) {
      ui.notifications.warn('Please enter a clock name');
      return;
    }

    try {
      const clockId = game.fitgd.api.clock.createProgress({
        entityId: crewId,
        name: clockName,
        segments,
        category,
        isCountdown: category === 'threat',
        description: description || undefined
      });

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      ui.notifications.info(`Clock "${clockName}" created`);

      // Re-render sheet (force = true to ensure new clock appears)
      refreshSheetsByReduxId([crewId], true);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Add Clock error:', error);
    }
  }
}
