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

import { configureStore, createGameAPI } from '../dist/fitgd-core.js';
import { createFoundryAdapter } from '../dist/fitgd-core.js';
import {
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

    // Get character data from Redux
    const characterId = this.actor.id;
    const character = game.fitgd.api.character.getCharacter(characterId);

    if (character) {
      context.system = game.fitgd.foundry.exportCharacter(characterId).system;
      // Find crew for this character
      context.crewId = this._getCrewId();
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

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
   * Find the crew that contains this character
   */
  _getCrewId() {
    const characterId = this.actor.id;
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

  async _onAddHarm(event) {
    event.preventDefault();
    const characterId = this.actor.id;
    const crewId = this._getCrewId();

    new TakeHarmDialog(characterId, crewId).render(true);
  }

  async _onLeanIntoTrait(event) {
    event.preventDefault();
    const characterId = this.actor.id;
    const crewId = this._getCrewId();
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
    const characterId = this.actor.id;

    new AddTraitDialog(characterId).render(true);
  }

  async _onUseRally(event) {
    event.preventDefault();
    const characterId = this.actor.id;
    const crewId = this._getCrewId();

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to use Rally');
      return;
    }

    new RallyDialog(characterId, crewId).render(true);
  }

  async _onFlashback(event) {
    event.preventDefault();
    const characterId = this.actor.id;
    const crewId = this._getCrewId();

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

    // Get crew data from Redux
    const crewId = this.actor.id;
    const crew = game.fitgd.api.crew.getCrew(crewId);

    if (crew) {
      context.system = game.fitgd.foundry.exportCrew(crewId).system;
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
  }

  async _onAddMomentum(event) {
    event.preventDefault();
    const crewId = this.actor.id;
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
    const crewId = this.actor.id;
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
    const crewId = this.actor.id;

    new PushDialog(crewId).render(true);
  }

  async _onAddClock(event) {
    event.preventDefault();
    const crewId = this.actor.id;

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

  async _onPerformReset(event) {
    event.preventDefault();
    const crewId = this.actor.id;

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
