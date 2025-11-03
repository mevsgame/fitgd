/**
 * Forged in the Grimdark - Foundry VTT System
 *
 * Main module entry point. Integrates Redux-based state management with Foundry VTT.
 *
 * Architecture:
 * - Redux store maintains single source of truth
 * - Foundry Actors/Items sync from Redux state
 * - All mutations go through Redux actions
 * - Full event sourcing with command history
 */

import { configureStore, createGameAPI } from '../dist/fitgd-core.es.js';
import { createFoundryAdapter } from '../dist/fitgd-core.es.js';
import {
  ActionRollDialog,
  TakeHarmDialog,
  RallyDialog,
  PushDialog,
  FlashbackDialog,
  AddTraitDialog,
  AddClockDialog
} from './dialogs.mjs';

/* -------------------------------------------- */
/*  System Initialization                       */
/* -------------------------------------------- */

/**
 * Initialize the FitGD system
 */
Hooks.once('init', async function() {
  console.log('FitGD | Initializing Forged in the Grimdark');

  // Create global namespace
  game.fitgd = game.fitgd || {};

  // Initialize Redux store
  console.log('FitGD | Creating Redux store...');
  game.fitgd.store = configureStore();

  // Initialize Game API
  console.log('FitGD | Creating Game API...');
  game.fitgd.api = createGameAPI(game.fitgd.store);

  // Initialize Foundry adapter
  console.log('FitGD | Creating Foundry adapter...');
  game.fitgd.foundry = createFoundryAdapter(game.fitgd.store);

  // Register settings
  registerSystemSettings();

  // Register sheet classes
  registerSheetClasses();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  console.log('FitGD | Initialization complete');
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

/**
 * Load saved game state when world is ready
 */
Hooks.once('ready', async function() {
  console.log('FitGD | World ready, loading state...');

  // Load command history from settings
  const history = game.settings.get('forged-in-the-grimdark', 'commandHistory') || [];

  if (history.length > 0) {
    console.log(`FitGD | Replaying ${history.length} commands...`);
    game.fitgd.foundry.replayCommands(history);
    console.log('FitGD | State restored from history');
  } else {
    console.log('FitGD | No command history found, starting fresh');
  }

  // Subscribe to store changes to auto-save
  game.fitgd.store.subscribe(() => {
    saveCommandHistory();
  });

  console.log('FitGD | Ready');
});

/* -------------------------------------------- */
/*  Actor Lifecycle Hooks                       */
/* -------------------------------------------- */

/**
 * When a Foundry actor is created, create the corresponding Redux entity
 */
Hooks.on('createActor', async function(actor, options, userId) {
  console.log(`FitGD | Creating ${actor.type}: ${actor.name} (${actor.id})`);

  if (actor.type === 'character') {
    // Create character in Redux with default stats
    const result = game.fitgd.api.character.create({
      name: actor.name,
      traits: [
        { name: 'Role Trait (edit me)', category: 'role', disabled: false },
        { name: 'Background Trait (edit me)', category: 'background', disabled: false }
      ],
      actionDots: {
        shoot: 0, skirmish: 0, skulk: 0, wreck: 0,
        finesse: 0, survey: 0, study: 0, tech: 0,
        attune: 0, command: 0, consort: 0, sway: 0
      }
    });

    // Store the Redux ID in Foundry actor flags
    await actor.setFlag('forged-in-the-grimdark', 'reduxId', result.characterId);
    console.log(`FitGD | Character created in Redux: ${result.characterId}`);

  } else if (actor.type === 'crew') {
    // Create crew in Redux
    const result = game.fitgd.api.crew.create({ name: actor.name });

    // Store the Redux ID in Foundry actor flags
    await actor.setFlag('forged-in-the-grimdark', 'reduxId', result.crewId);
    console.log(`FitGD | Crew created in Redux: ${result.crewId}`);
  }
});

/* -------------------------------------------- */
/*  System Settings                             */
/* -------------------------------------------- */

function registerSystemSettings() {
  // Command history (for event sourcing)
  game.settings.register('forged-in-the-grimdark', 'commandHistory', {
    name: 'Command History',
    hint: 'Event-sourced command history for state reconstruction',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Game state snapshot (for performance)
  game.settings.register('forged-in-the-grimdark', 'stateSnapshot', {
    name: 'State Snapshot',
    hint: 'Periodic state snapshot for faster loading',
    scope: 'world',
    config: false,
    type: Object,
    default: null
  });

  // Auto-save interval
  game.settings.register('forged-in-the-grimdark', 'autoSaveInterval', {
    name: 'Auto-save Interval',
    hint: 'Seconds between auto-saves (0 to disable)',
    scope: 'world',
    config: true,
    type: Number,
    default: 30,
    range: {
      min: 0,
      max: 300,
      step: 10
    }
  });
}

/* -------------------------------------------- */
/*  Sheet Registration                          */
/* -------------------------------------------- */

function registerSheetClasses() {
  // Unregister default sheets
  Actors.unregisterSheet('core', ActorSheet);
  Items.unregisterSheet('core', ItemSheet);

  // Register character sheet
  Actors.registerSheet('forged-in-the-grimdark', FitGDCharacterSheet, {
    types: ['character'],
    makeDefault: true
  });

  // Register crew sheet
  Actors.registerSheet('forged-in-the-grimdark', FitGDCrewSheet, {
    types: ['crew'],
    makeDefault: true
  });

  // Register trait item sheet
  Items.registerSheet('forged-in-the-grimdark', FitGDTraitSheet, {
    types: ['trait'],
    makeDefault: true
  });

  // Register equipment item sheet
  Items.registerSheet('forged-in-the-grimdark', FitGDEquipmentSheet, {
    types: ['equipment'],
    makeDefault: true
  });
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function registerHandlebarsHelpers() {
  // Times helper (for loops)
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; ++i)
      accum += block.fn(i);
    return accum;
  });

  // Equals helper
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // Less than or equal
  Handlebars.registerHelper('lte', function(a, b) {
    return a <= b;
  });

  // Greater than or equal
  Handlebars.registerHelper('gte', function(a, b) {
    return a >= b;
  });

  // Less than
  Handlebars.registerHelper('lt', function(a, b) {
    return a < b;
  });

  // Checked helper for checkboxes
  Handlebars.registerHelper('checked', function(value) {
    return value ? 'checked' : '';
  });
}

/* -------------------------------------------- */
/*  Auto-save Functionality                     */
/* -------------------------------------------- */

let autoSaveTimer = null;

function saveCommandHistory() {
  // Debounce auto-save
  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  const interval = game.settings.get('forged-in-the-grimdark', 'autoSaveInterval');
  if (interval === 0) return;

  autoSaveTimer = setTimeout(async () => {
    const history = game.fitgd.foundry.exportHistory();
    await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
    console.log(`FitGD | Auto-saved ${history.characters.length + history.crews.length + history.clocks.length} commands`);
  }, interval * 1000);
}

/* -------------------------------------------- */
/*  Character Sheet Class                       */
/* -------------------------------------------- */

class FitGDCharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'actor', 'character'],
      template: 'systems/forged-in-the-grimdark/templates/character-sheet.html',
      width: 700,
      height: 800,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'actions' }]
    });
  }

  getData() {
    const context = super.getData();

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');

    if (reduxId) {
      const character = game.fitgd.api.character.getCharacter(reduxId);

      if (character) {
        context.system = {
          actionDots: character.actionDots,
          traits: character.traits,
          equipment: character.equipment,
          rallyAvailable: character.rallyAvailable,
          harmClocks: game.fitgd.api.query.getHarmClocks(reduxId)
        };

        // Find crew for this character
        context.crewId = this._getCrewId(reduxId);
        context.reduxId = reduxId;
      }
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Action Rolls
    html.find('.action-roll-btn').click(this._onActionRoll.bind(this));
    html.find('.action-roll-single-btn').click(this._onActionRollSingle.bind(this));

    // Action Dots (clickable)
    html.find('.dot').click(this._onDotClick.bind(this));

    // Harm
    html.find('.add-harm-btn').click(this._onAddHarm.bind(this));

    // Traits
    html.find('.trait-lean-btn').click(this._onLeanIntoTrait.bind(this));
    html.find('.add-trait-btn').click(this._onAddTrait.bind(this));

    // Rally
    html.find('.use-rally-btn').click(this._onUseRally.bind(this));

    // Flashback
    html.find('.flashback-btn').click(this._onFlashback.bind(this));
  }

  /**
   * Get Redux character ID from Foundry actor
   */
  _getReduxId() {
    return this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
  }

  /**
   * Find the crew that contains this character
   */
  _getCrewId(characterId) {
    const state = game.fitgd.store.getState();

    // Search all crews for this character
    for (const crewId of state.crews.allIds) {
      const crew = state.crews.byId[crewId];
      if (crew.characters.includes(characterId)) {
        return crewId;
      }
    }

    return null;
  }

  /**
   * Handle clicking on action dots to set the value
   */
  async _onDotClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const characterId = this._getReduxId();
    if (!characterId) return;

    const action = event.currentTarget.dataset.action;
    const value = parseInt(event.currentTarget.dataset.value);

    if (!action || isNaN(value)) return;

    try {
      // Get current character state
      const character = game.fitgd.api.character.getCharacter(characterId);
      if (!character) return;

      // Calculate total dots if we make this change
      const currentActionDots = character.actionDots;
      const oldValue = currentActionDots[action] || 0;
      const totalDots = Object.values(currentActionDots).reduce((sum, dots) => sum + dots, 0);
      const newTotalDots = totalDots - oldValue + value;

      // Check for validation at character creation (12 dots max, 3 per action max)
      // Note: We'll be permissive and allow 4 dots for advancement, but warn if over 12 total
      if (value > 4) {
        ui.notifications.warn('Maximum 4 dots per action');
        return;
      }

      // Warn if exceeding 12 total (but allow it for advancement)
      if (newTotalDots > 12) {
        ui.notifications.warn(`Setting ${action} to ${value} would give ${newTotalDots} total dots (standard starting is 12)`);
      }

      // Update the action dots
      game.fitgd.api.character.setActionDots({
        characterId,
        action,
        dots: value
      });

      // Re-render sheet
      this.render(false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Set action dots error:', error);
    }
  }

  /**
   * Handle clicking on single action roll button
   */
  async _onActionRollSingle(event) {
    event.preventDefault();
    event.stopPropagation();

    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to make action rolls');
      return;
    }

    const action = event.currentTarget.dataset.action;

    if (action) {
      const dialog = new ActionRollDialog(characterId, crewId);
      dialog.render(true);

      // Pre-select the action after dialog renders
      setTimeout(() => {
        const select = dialog.element.find('[name="action"]');
        if (select.length) {
          select.val(action.toLowerCase()).trigger('change');
        }
      }, 100);
    }
  }

  async _onActionRoll(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to make action rolls');
      return;
    }

    new ActionRollDialog(characterId, crewId).render(true);
  }

  async _onAddHarm(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    new TakeHarmDialog(characterId, crewId).render(true);
  }

  async _onLeanIntoTrait(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);
    const traitId = event.currentTarget.dataset.traitId;

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to lean into traits');
      return;
    }

    try {
      const result = game.fitgd.api.action.leanIntoTrait({
        crewId,
        characterId,
        traitId
      });

      ui.notifications.info(`Leaned into trait. Gained ${result.momentumGenerated} Momentum.`);

      // Re-render sheets
      this.render(false);
      game.actors.get(crewId)?.sheet.render(false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Lean into trait error:', error);
    }
  }

  async _onAddTrait(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    new AddTraitDialog(characterId).render(true);
  }

  async _onUseRally(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to use Rally');
      return;
    }

    new RallyDialog(characterId, crewId).render(true);
  }

  async _onFlashback(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to use Flashback');
      return;
    }

    new FlashbackDialog(characterId, crewId).render(true);
  }
}

/* -------------------------------------------- */
/*  Crew Sheet Class                            */
/* -------------------------------------------- */

class FitGDCrewSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'actor', 'crew'],
      template: 'systems/forged-in-the-grimdark/templates/crew-sheet.html',
      width: 800,
      height: 900,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'members' }]
    });
  }

  getData() {
    const context = super.getData();

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');

    if (reduxId) {
      const crew = game.fitgd.api.crew.getCrew(reduxId);

      if (crew) {
        context.system = {
          currentMomentum: crew.currentMomentum,
          characters: crew.characters,
          addictionClock: game.fitgd.api.query.getAddictionClock(reduxId),
          consumableClocks: game.fitgd.api.query.getConsumableClocks(reduxId),
          progressClocks: [] // TODO: Add progress clock query
        };
        context.reduxId = reduxId;
      }
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Momentum controls
    html.find('.momentum-add-btn').click(this._onAddMomentum.bind(this));
    html.find('.momentum-spend-btn').click(this._onSpendMomentum.bind(this));

    // Actions
    html.find('.push-btn').click(this._onPush.bind(this));

    // Clocks
    html.find('.add-clock-btn').click(this._onAddClock.bind(this));
    html.find('.clock-segment').click(this._onClickClockSegment.bind(this));

    // Reset
    html.find('.reset-btn').click(this._onPerformReset.bind(this));

    // Crew members
    html.find('.add-character-btn').click(this._onAddCharacter.bind(this));
  }

  /**
   * Get Redux crew ID from Foundry actor
   */
  _getReduxId() {
    return this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
  }

  async _onAddMomentum(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    const amount = parseInt(event.currentTarget.dataset.amount) || 1;

    try {
      game.fitgd.api.crew.addMomentum({ crewId, amount });
      ui.notifications.info(`Added ${amount} Momentum`);
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Add Momentum error:', error);
    }
  }

  async _onSpendMomentum(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    const amount = parseInt(event.currentTarget.dataset.amount) || 1;

    try {
      game.fitgd.api.crew.spendMomentum({ crewId, amount });
      ui.notifications.info(`Spent ${amount} Momentum`);
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Spend Momentum error:', error);
    }
  }

  async _onPush(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    new PushDialog(crewId).render(true);
  }

  async _onAddClock(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    new AddClockDialog(crewId).render(true);
  }

  async _onClickClockSegment(event) {
    event.preventDefault();
    const clockId = event.currentTarget.dataset.clockId;
    const segment = parseInt(event.currentTarget.dataset.segment);
    const currentSegments = parseInt(event.currentTarget.dataset.currentSegments);

    if (!clockId) return;

    try {
      const clock = game.fitgd.api.clock.getClock(clockId);
      if (!clock) return;

      // Toggle segment: if clicking on filled segment, reduce; otherwise increase
      if (segment < currentSegments) {
        // Reduce to this segment
        const toRemove = currentSegments - segment;
        game.fitgd.api.clock.clearSegments({ clockId, segments: toRemove });
        ui.notifications.info(`Clock reduced to ${segment} segments`);
      } else if (segment === currentSegments) {
        // Reduce by 1
        game.fitgd.api.clock.clearSegments({ clockId, segments: 1 });
        ui.notifications.info(`Clock reduced by 1 segment`);
      } else {
        // Add to this segment
        const toAdd = segment - currentSegments + 1;
        game.fitgd.api.clock.addSegments({ clockId, segments: toAdd });
        ui.notifications.info(`Clock advanced to ${segment + 1} segments`);
      }

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock segment error:', error);
    }
  }

  async _onAddCharacter(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    // Show dialog to select character
    const characters = game.actors.filter(a => a.type === 'character');

    if (characters.length === 0) {
      ui.notifications.warn('No characters exist. Create a character first.');
      return;
    }

    // Create simple selection dialog
    const options = characters.map(char => `<option value="${char.id}">${char.name}</option>`).join('');

    const dialog = new Dialog({
      title: 'Add Character to Crew',
      content: `
        <form>
          <div class="form-group">
            <label>Select Character:</label>
            <select name="characterId">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Add',
          callback: async (html) => {
            const selectedFoundryId = html.find('[name="characterId"]').val();
            const selectedActor = game.actors.get(selectedFoundryId);
            const characterReduxId = selectedActor?.getFlag('forged-in-the-grimdark', 'reduxId');

            if (characterReduxId) {
              try {
                game.fitgd.api.crew.addCharacter({ crewId, characterId: characterReduxId });
                ui.notifications.info(`Added ${selectedActor.name} to crew`);
                this.render(false);
              } catch (error) {
                ui.notifications.error(`Error: ${error.message}`);
              }
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'add'
    });

    dialog.render(true);
  }

  async _onPerformReset(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    try {
      const result = game.fitgd.api.crew.performReset(crewId);

      ui.notifications.info(`Reset complete! Momentum: ${result.newMomentum}, Addiction: -${result.addictionReduced}`);

      // Re-render sheet
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Reset error:', error);
    }
  }
}

/* -------------------------------------------- */
/*  Item Sheet Classes                          */
/* -------------------------------------------- */

class FitGDTraitSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'item', 'trait'],
      template: 'systems/forged-in-the-grimdark/templates/trait-sheet.html',
      width: 520,
      height: 480
    });
  }
}

class FitGDEquipmentSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'item', 'equipment'],
      template: 'systems/forged-in-the-grimdark/templates/equipment-sheet.html',
      width: 520,
      height: 480
    });
  }
}

/* -------------------------------------------- */
/*  Console Commands (for testing)              */
/* -------------------------------------------- */

// Expose API to console for debugging
window.fitgd = {
  store: () => game.fitgd.store,
  api: () => game.fitgd.api,
  adapter: () => game.fitgd.foundry,
  getState: () => game.fitgd.store.getState(),
  exportHistory: () => game.fitgd.foundry.exportHistory(),
};
