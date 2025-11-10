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
import { HistoryManagementConfig } from './history-management.mjs';
import { PlayerActionWidget } from './widgets/player-action-widget.mjs';
import { createFoundryReduxBridge } from './foundry-redux-bridge.mjs';

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
function refreshSheetsByReduxId(reduxIds, force = true) {
  const affectedReduxIds = new Set(reduxIds.filter(id => id)); // Remove nulls/undefined
  if (affectedReduxIds.size === 0) return;

  console.log(`FitGD | Refreshing sheets for Redux IDs:`, Array.from(affectedReduxIds));

  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) continue;

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
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheet(s)`);
}

/* -------------------------------------------- */
/*  System Initialization                       */
/* -------------------------------------------- */

/**
 * Initialize the FitGD system
 */
Hooks.once('init', async function() {
  console.log('FitGD | Initializing Forged in the Grimdark system');

  // Create global namespace
  game.fitgd = game.fitgd || {};

  // Initialize Redux store
  console.log('FitGD | Creating Redux store...');
  try {
    game.fitgd.store = configureStore();
    console.log('FitGD | Redux store created successfully');
  } catch (error) {
    console.error('FitGD | Failed to create Redux store:', error);
    return;
  }

  // Initialize Game API
  console.log('FitGD | Creating Game API...');
  try {
    game.fitgd.api = createGameAPI(game.fitgd.store);
    console.log('FitGD | Game API created successfully. Available APIs:', Object.keys(game.fitgd.api));
  } catch (error) {
    console.error('FitGD | Failed to create Game API:', error);
    return;
  }

  // Initialize Foundry adapter
  console.log('FitGD | Creating Foundry adapter...');
  try {
    game.fitgd.foundry = createFoundryAdapter(game.fitgd.store);
    console.log('FitGD | Foundry adapter created successfully');
  } catch (error) {
    console.error('FitGD | Failed to create Foundry adapter:', error);
    return;
  }

  // Initialize socketlib for reliable multi-client communication
  console.log('FitGD | Initializing socketlib...');
  console.log('FitGD | socketlib available?', typeof socketlib !== 'undefined');

  try {
    if (typeof socketlib === 'undefined') {
      throw new Error('socketlib is not defined - module may not be installed or enabled');
    }

    game.fitgd.socket = socketlib.registerSystem('forged-in-the-grimdark');
    console.log('FitGD | socketlib registered successfully, socket object:', game.fitgd.socket);

    // Register socket handlers
    // Note: Handler function must be defined before registration
    game.fitgd.socket.register('syncCommands', receiveCommandsFromSocket);
    console.log('FitGD | Socket handlers registered for "syncCommands"');
    console.log('FitGD | Handler function:', receiveCommandsFromSocket);
  } catch (error) {
    console.error('FitGD | Failed to initialize socketlib:', error);
    console.error('FitGD | Make sure socketlib module is installed and enabled');
    return;
  }

  // Expose save function for dialogs and sheets to use
  game.fitgd.saveImmediate = async function() {
    try {
      // Get new commands since last broadcast
      const newCommands = getNewCommandsSinceLastBroadcast();
      const newCommandCount = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;

      // Also get current playerRoundState for real-time collaboration
      const state = game.fitgd.store.getState();
      const playerRoundState = state.playerRoundState;

      // Broadcast commands FIRST (before persistence) - all users can do this
      if (newCommandCount > 0 || Object.keys(playerRoundState.byCharacterId).length > 0) {
        const socketData = {
          type: 'commandsAdded',
          userId: game.user.id,
          userName: game.user.name,
          commandCount: newCommandCount,
          commands: newCommands,
          playerRoundState: playerRoundState, // Include ephemeral UI state
          timestamp: Date.now()
        };

        console.log(`FitGD | Broadcasting ${newCommandCount} commands + playerRoundState via socketlib`);

        try {
          // Use socketlib to broadcast to OTHER clients (not self)
          const result = await game.fitgd.socket.executeForOthers('syncCommands', socketData);
          console.log(`FitGD | socketlib broadcast completed, result:`, result);
        } catch (error) {
          console.error('FitGD | socketlib broadcast error:', error);
        }
      } else {
        console.log(`FitGD | No new commands or playerRoundState to broadcast`);
      }

      // Save to Foundry settings (only if user has permission - typically GM)
      // Players will broadcast but won't persist; GM will persist when receiving broadcasts
      if (game.user.isGM) {
        const history = game.fitgd.foundry.exportHistory();
        await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
        const total = history.characters.length + history.crews.length + history.clocks.length;
        console.log(`FitGD | Saved ${total} commands to world settings (GM only)`);
      } else {
        console.log(`FitGD | Skipped settings save (player - GM will persist on receipt)`);
      }
    } catch (error) {
      console.error('FitGD | Error in saveImmediate:', error);
      // Don't throw - we still want broadcasts to work even if save fails
    }
  };

  // Initialize Foundry-Redux Bridge API
  console.log('FitGD | Creating Foundry-Redux Bridge...');
  try {
    game.fitgd.bridge = createFoundryReduxBridge(
      game.fitgd.store,
      game.fitgd.saveImmediate
    );
    console.log('FitGD | Foundry-Redux Bridge created successfully');
    console.log('FitGD | Bridge API available at game.fitgd.bridge');
  } catch (error) {
    console.error('FitGD | Failed to create Foundry-Redux Bridge:', error);
    return;
  }

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
  console.log(`FitGD | World ready for user: ${game.user.name} (isGM: ${game.user.isGM})`);
  console.log(`FitGD | game.fitgd initialized: ${!!game.fitgd}, has store: ${!!game.fitgd?.store}, has api: ${!!game.fitgd?.api}`);

  // Check for state snapshot first (used after history pruning)
  const stateSnapshot = game.settings.get('forged-in-the-grimdark', 'stateSnapshot');
  const defaultHistory = { characters: [], crews: [], clocks: [] };
  const history = game.settings.get('forged-in-the-grimdark', 'commandHistory') || defaultHistory;

  // Ensure history has the correct structure
  const validHistory = {
    characters: history.characters || [],
    crews: history.crews || [],
    clocks: history.clocks || []
  };

  const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length;

  if (stateSnapshot && stateSnapshot.timestamp) {
    // Load from snapshot first
    console.log('FitGD | State snapshot found, hydrating from snapshot...');
    console.log(`FitGD | Snapshot timestamp: ${new Date(stateSnapshot.timestamp).toLocaleString()}`);

    try {
      // Hydrate Redux store from snapshot
      game.fitgd.foundry.importState(stateSnapshot);
      console.log('FitGD | State restored from snapshot');

      // Then replay any new commands that occurred after the snapshot
      if (totalCommands > 0) {
        console.log(`FitGD | Replaying ${totalCommands} commands on top of snapshot...`);
        game.fitgd.foundry.replayCommands(validHistory);
        console.log('FitGD | New commands applied');
      }

      // Track all commands as applied
      trackInitialCommandsAsApplied();
    } catch (error) {
      console.error('FitGD | Error loading from snapshot:', error);
      ui.notifications.error('Failed to load game state from snapshot');
    }
  } else if (totalCommands > 0) {
    // No snapshot, use command history replay (old behavior)
    console.log(`FitGD | Replaying ${totalCommands} commands from history...`);
    game.fitgd.foundry.replayCommands(validHistory);
    console.log('FitGD | State restored from command history');

    // Track all initial commands as applied (prevents re-application on sync)
    trackInitialCommandsAsApplied();
  } else {
    console.log('FitGD | No command history or snapshot found, starting fresh');
  }

  // Subscribe to store changes to auto-save
  game.fitgd.store.subscribe(() => {
    saveCommandHistory();
  });

  // Save on page unload to catch any unsaved changes (GM only)
  window.addEventListener('beforeunload', () => {
    if (game.user.isGM) {
      // Synchronous save (no await) for immediate execution
      try {
        const history = game.fitgd.foundry.exportHistory();
        game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
        const total = history.characters.length + history.crews.length + history.clocks.length;
        console.log(`FitGD | Saved ${total} commands (on unload - GM)`);
      } catch (error) {
        console.error('FitGD | Failed to save on unload:', error);
      }
    }
  });

  // Expose test function for manual socket testing
  game.fitgd.testSocket = async function() {
    console.log('FitGD | Testing socketlib...');
    console.log('FitGD | Socket object:', game.fitgd.socket);

    const testData = {
      test: 'Hello from ' + game.user.name,
      timestamp: Date.now(),
      userId: game.user.id
    };

    try {
      console.log('FitGD | Sending test message:', testData);
      const result = await game.fitgd.socket.executeForOthers('syncCommands', testData);
      console.log('FitGD | Test message sent, result:', result);
      return result;
    } catch (error) {
      console.error('FitGD | Test message failed:', error);
      throw error;
    }
  };

  console.log('FitGD | Ready (socketlib handlers active)');
  console.log('FitGD | Test socket with: game.fitgd.testSocket()');
});

/* -------------------------------------------- */
/*  Combat Tracker Hooks                        */
/* -------------------------------------------- */

/**
 * When combat starts, reset Momentum to 5 (per spec)
 */
Hooks.on('combatStart', async function(combat, updateData) {
  console.log('FitGD | Combat started, resetting Momentum to 5');

  // Find crew for this combat
  const state = game.fitgd.store.getState();
  const crews = Object.values(state.crews.byId);

  if (crews.length > 0) {
    const crew = crews[0]; // Assuming single crew for now
    // Use setMomentum with object parameter (API uses object params)
    game.fitgd.api.crew.setMomentum({ crewId: crew.id, amount: 5 });
    ui.notifications.info('Momentum reset to 5 - Combat Start!');
  }

  // Initialize player states for all combatants
  const characterIds = [];
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;

    const characterId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
    if (characterId) {
      characterIds.push(characterId);
    }
  }

  // Use Bridge API to batch all initializations and broadcast once
  if (characterIds.length > 0) {
    const actions = characterIds.map(characterId => ({
      type: 'playerRoundState/initializePlayerState',
      payload: { characterId },
    }));

    await game.fitgd.bridge.executeBatch(actions, {
      affectedReduxIds: characterIds,
      silent: true // Silent: no sheets to refresh for player round state
    });
  }
});

/**
 * When a turn starts, show the Player Action Widget for the active combatant
 *
 * NOTE: Using 'updateCombat' instead of 'combatTurn' because 'combatTurn' only
 * fires on the client that initiated the turn change (usually the GM), not on
 * all connected clients. 'updateCombat' fires on ALL clients when combat data changes.
 */
Hooks.on('updateCombat', async function(combat, updateData, options, userId) {
  // Only trigger when the turn actually changes (not for other combat updates)
  if (!updateData.turn && updateData.turn !== 0) {
    return; // Not a turn change, ignore
  }

  console.log(`FitGD | updateCombat (turn change) hook fired for user: ${game.user.name} (${game.user.id}), isGM: ${game.user.isGM}`);

  const activeCombatant = combat.combatant;
  if (!activeCombatant || !activeCombatant.actor) {
    console.log('FitGD | No active combatant or actor');
    return;
  }

  console.log(`FitGD | Active combatant: ${activeCombatant.actor.name}`);

  const characterId = activeCombatant.actor.getFlag('forged-in-the-grimdark', 'reduxId');
  if (!characterId) {
    console.log('FitGD | Active combatant has no Redux characterId');
    return;
  }

  console.log(`FitGD | Setting active player: ${characterId}`);

  // Update Redux state to mark this player as active
  // Use Bridge API to ensure state propagates to all clients
  await game.fitgd.bridge.execute(
    {
      type: 'playerRoundState/setActivePlayer',
      payload: { characterId },
    },
    { affectedReduxIds: [characterId], silent: true } // Silent: we'll show widget manually below
  );

  // Show the Player Action Widget for this character
  // Only show for the owning player or GM
  const actor = activeCombatant.actor;
  const isOwner = actor.isOwner;
  const isGM = game.user.isGM;

  console.log(`FitGD | Widget visibility check:`, {
    actorName: actor.name,
    currentUser: game.user.name,
    isOwner,
    isGM,
    permission: actor.permission,
    willShow: isOwner || isGM
  });

  if (isOwner || isGM) {
    // Check if widget already exists for this character
    const existingWidget = Object.values(ui.windows).find(
      app => app instanceof PlayerActionWidget && app.characterId === characterId
    );

    if (existingWidget) {
      console.log(`FitGD | Refreshing existing Player Action Widget for character ${characterId}`);
      existingWidget.render(true); // Just refresh existing widget
    } else {
      console.log(`FitGD | Creating new Player Action Widget for character ${characterId}`);
      const widget = new PlayerActionWidget(characterId);
      widget.render(true);
    }
  } else {
    console.log(`FitGD | Widget NOT shown - user is not owner or GM`);
  }
});

/**
 * When combat ends, clear all player states
 */
Hooks.on('combatEnd', async function(combat) {
  console.log('FitGD | Combat ended, clearing player states');

  // Clear all player round states using Bridge API
  await game.fitgd.bridge.execute(
    {
      type: 'playerRoundState/clearAllStates',
    },
    { silent: true } // Silent: no sheets to refresh, just clear state
  );

  // Close any open Player Action Widgets
  for (const app of Object.values(ui.windows)) {
    if (app instanceof PlayerActionWidget) {
      app.close();
    }
  }

  ui.notifications.info('Combat ended');
});

/* -------------------------------------------- */
/*  Actor Lifecycle Hooks                       */
/* -------------------------------------------- */

/**
 * When a Foundry actor is created, create the corresponding Redux entity
 *
 * IMPORTANT: This hook fires on ALL clients, but only the creating user
 * (or GM) should execute the logic. Other clients will receive the Redux
 * commands via socket broadcast.
 */
Hooks.on('createActor', async function(actor, options, userId) {
  // Only execute on the client that created the actor, or on GM's client
  // Other clients will receive updates via socket broadcast
  const isCreatingUser = userId === game.user.id;
  const isGM = game.user.isGM;

  if (!isCreatingUser && !isGM) {
    console.log(`FitGD | Skipping createActor hook (not creator, not GM) for ${actor.type}: ${actor.name}`);
    return;
  }

  console.log(`FitGD | Creating ${actor.type}: ${actor.name} (${actor.id}) [user: ${userId}]`);

  if (actor.type === 'character') {
    // Create character in Redux with 0 dots (player allocates 12 during creation)
    try {
      const characterId = game.fitgd.api.character.create({
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

      // Store the Redux ID in Foundry actor flags (only creator/GM can do this)
      await actor.setFlag('forged-in-the-grimdark', 'reduxId', characterId);
      console.log(`FitGD | Character created in Redux: ${characterId}`);

      // Save immediately (will broadcast to other clients)
      await saveCommandHistoryImmediate();

      // Force re-render the sheet if it's already open
      if (actor.sheet?.rendered) {
        console.log('FitGD | Re-rendering character sheet with Redux data');
        actor.sheet.render(false);
      }
    } catch (error) {
      console.error('FitGD | Failed to create character in Redux:', error);
      ui.notifications.error(`Failed to create character: ${error.message}`);
    }

  } else if (actor.type === 'crew') {
    // Create crew in Redux
    try {
      const crewId = game.fitgd.api.crew.create(actor.name);

      // Store the Redux ID in Foundry actor flags (only creator/GM can do this)
      await actor.setFlag('forged-in-the-grimdark', 'reduxId', crewId);
      console.log(`FitGD | Crew created in Redux: ${crewId}`);

      // Save immediately (will broadcast to other clients)
      await saveCommandHistoryImmediate();

      // Force re-render the sheet if it's already open
      if (actor.sheet?.rendered) {
        console.log('FitGD | Re-rendering crew sheet with Redux data');
        actor.sheet.render(false);
      }
    } catch (error) {
      console.error('FitGD | Failed to create crew in Redux:', error);
      ui.notifications.error(`Failed to create crew: ${error.message}`);
    }
  }
});

/* -------------------------------------------- */
/*  Hotbar Drop Hook                            */
/* -------------------------------------------- */

/**
 * Create a macro when something is dropped on the hotbar
 */
Hooks.on('hotbarDrop', async function(bar, data, slot) {
  // Only handle FitGD drops
  if (data.type !== 'FitGD') return;

  const { actorId, characterId, actionType, action, traitId, traitName } = data;

  // Get the actor
  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error('Actor not found');
    return false;
  }

  // Create macro command based on action type
  let command, name, img;

  if (actionType === 'roll') {
    // Action roll macro
    name = `${actor.name}: ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    img = 'icons/svg/d20-grey.svg';
    command = `// ${name}
const actor = game.actors.get("${actorId}");
const characterId = actor?.getFlag('forged-in-the-grimdark', 'reduxId');

if (!characterId) {
  ui.notifications.error("Character not linked to Redux");
  return;
}

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(characterId)) {
    crewId = id;
    break;
  }
}

if (!crewId) {
  ui.notifications.warn("Character must be part of a crew");
  return;
}

// Open action roll dialog
const { ActionRollDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
const dialog = new ActionRollDialog(characterId, crewId);
dialog.render(true);

// Pre-select action
setTimeout(() => {
  const select = dialog.element.find('[name="action"]');
  if (select.length) {
    select.val('${action}').trigger('change');
  }
}, 100);`;

  } else if (actionType === 'lean-trait') {
    // Lean into trait macro
    name = `${actor.name}: Lean into ${traitName}`;
    img = 'icons/svg/fire.svg';
    command = `// ${name}
const actor = game.actors.get("${actorId}");
const characterId = actor?.getFlag('forged-in-the-grimdark', 'reduxId');
const traitId = "${traitId}";

if (!characterId) {
  ui.notifications.error("Character not linked to Redux");
  return;
}

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(characterId)) {
    crewId = id;
    break;
  }
}

if (!crewId) {
  ui.notifications.warn("Character must be part of a crew");
  return;
}

// Lean into trait
try {
  const result = game.fitgd.api.character.leanIntoTrait({
    characterId,
    traitId,
    crewId
  });

  ui.notifications.info(\`Leaned into trait! Gained 2 Momentum (now \${result.newMomentum}/10)\`);
} catch (error) {
  ui.notifications.error(\`Error: \${error.message}\`);
}`;

  } else {
    return false;
  }

  // Create the macro
  const macro = await Macro.create({
    name: name,
    type: 'script',
    img: img,
    command: command,
    flags: {
      'forged-in-the-grimdark': {
        actorId,
        characterId,
        actionType,
        action,
        traitId
      }
    }
  });

  // Assign macro to hotbar slot
  game.user.assignHotbarMacro(macro, slot);

  return false; // Prevent default behavior
});

/* -------------------------------------------- */
/*  System Settings                             */
/* -------------------------------------------- */

function registerSystemSettings() {
  // History Management Menu
  game.settings.registerMenu('forged-in-the-grimdark', 'historyManagement', {
    name: game.i18n.localize('FITGD.Settings.HistoryManagement.Name'),
    label: game.i18n.localize('FITGD.Settings.HistoryManagement.Label'),
    hint: game.i18n.localize('FITGD.Settings.HistoryManagement.Hint'),
    icon: 'fas fa-database',
    type: HistoryManagementConfig,
    restricted: true // GM only
  });

  // Command history (for event sourcing)
  game.settings.register('forged-in-the-grimdark', 'commandHistory', {
    name: 'Command History',
    hint: 'Event-sourced command history for state reconstruction',
    scope: 'world',
    config: false,
    type: Object,
    default: { characters: [], crews: [], clocks: [] }
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
    name: game.i18n.localize('FITGD.Settings.AutoSaveInterval.Name'),
    hint: game.i18n.localize('FITGD.Settings.AutoSaveInterval.Hint'),
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

  // Add helper for arithmetic
  Handlebars.registerHelper('add', function(a, b) {
    return a + b;
  });

  // Clock rendering helper
  Handlebars.registerHelper('clockSVG', function(clockData, options) {
    if (!clockData) return '';

    // Determine clock color based on type and metadata
    let color = 'blue'; // default
    switch (clockData.clockType) {
      case 'harm':
        // Morale harm uses grey, physical harm uses red
        if (clockData.subtype?.toLowerCase().includes('morale') ||
            clockData.subtype?.toLowerCase().includes('shaken')) {
          color = 'grey';
        } else {
          color = 'red';
        }
        break;
      case 'consumable':
        color = 'green';
        break;
      case 'addiction':
        color = 'yellow';
        break;
      case 'progress':
        // Check if it's a threat/countdown
        const metadata = clockData.metadata || {};
        if (metadata.isCountdown || metadata.category === 'threat') {
          color = 'red';
        } else if (metadata.category === 'personal-goal') {
          color = 'white';
        } else if (metadata.category === 'faction') {
          color = 'black';
        } else {
          color = 'blue';
        }
        break;
    }

    const size = clockData.maxSegments;
    const value = clockData.segments;
    const svgPath = `systems/forged-in-the-grimdark/assets/clocks/themes/${color}/${size}clock_${value}.svg`;

    const width = options.hash.width || '100px';
    const height = options.hash.height || '100px';
    const cssClass = options.hash.class || 'clock';
    const editable = options.hash.editable !== undefined ? options.hash.editable : game.user.isGM;

    const alt = `${clockData.subtype || clockData.name || 'Clock'} (${value}/${size})`;

    return new Handlebars.SafeString(`
      <div class="clock-container ${editable ? 'editable' : ''}">
        <img
          src="${svgPath}"
          alt="${alt}"
          class="${cssClass} clock-${size} clock-${color}"
          width="${width}"
          height="${height}"
          data-clock-id="${clockData.id}"
          data-clock-type="${clockData.clockType}"
          data-clock-value="${value}"
          data-clock-max="${size}"
          data-clock-color="${color}"
        />
      </div>
    `);
  });

  // Default value helper (returns second arg if first is falsy)
  Handlebars.registerHelper('default', function(value, defaultValue) {
    return value != null ? value : defaultValue;
  });

  // Capitalize first letter
  Handlebars.registerHelper('capitalize', function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Uppercase entire string
  Handlebars.registerHelper('uppercase', function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toUpperCase();
  });

  // Subtract helper for arithmetic
  Handlebars.registerHelper('subtract', function(a, b) {
    return a - b;
  });

  // Join array with separator
  Handlebars.registerHelper('join', function(arr, separator) {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator || ', ');
  });

  // Max value in array
  Handlebars.registerHelper('max', function(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return Math.max(...arr);
  });
}

/* -------------------------------------------- */
/*  Socket Communication (socketlib)            */
/* -------------------------------------------- */

/**
 * Receive commands from other clients via socketlib
 * This function is registered with socketlib and called automatically
 * when other clients broadcast commands.
 */
async function receiveCommandsFromSocket(data) {
  console.log(`FitGD | socketlib received data:`, data);

  // Handle test messages (for diagnostics)
  if (data.test) {
    console.log(`FitGD | Received test message: "${data.test}"`);
    return;
  }

  // Handle real command sync messages
  if (data.type !== 'commandsAdded') {
    console.warn(`FitGD | Received unknown message type: ${data.type}`);
    return;
  }

  const userName = data.userName || 'Unknown User';
  console.log(`FitGD | Received ${data.commandCount || 0} new commands from ${userName}`);

  // Validate commands structure
  if (!data.commands) {
    console.error(`FitGD | No commands in message data`);
    return;
  }

  console.log(`FitGD | Commands to apply:`, data.commands);

  try {
    // BEFORE applying commands, capture entityIds for clocks that will be deleted
    // (so we can refresh sheets even after the clock is gone)
    const state = game.fitgd.store.getState();
    const clockEntityIds = new Map();
    for (const command of data.commands.clocks) {
      if (command.payload?.clockId) {
        const clock = state.clocks.byId[command.payload.clockId];
        if (clock) {
          clockEntityIds.set(command.payload.clockId, clock.entityId);
        }
      }
    }

    // Apply commands incrementally (no store reset!)
    const appliedCount = applyCommandsIncremental(data.commands);

    // Also apply playerRoundState if present (ephemeral UI state)
    const changedCharacterIds = [];
    if (data.playerRoundState) {
      console.log(`FitGD | Applying received playerRoundState:`, data.playerRoundState);

      const currentState = game.fitgd.store.getState();

      // Update each character's playerRoundState by dispatching actions
      for (const [characterId, receivedPlayerState] of Object.entries(data.playerRoundState.byCharacterId)) {
        const currentPlayerState = currentState.playerRoundState.byCharacterId[characterId];

        console.log(`FitGD | Socket handler - character ${characterId.substring(0, 8)}:`);
        console.log(`  Current state: ${currentPlayerState?.state}`);
        console.log(`  Received state: ${receivedPlayerState.state}`);

        // Skip if identical (avoid unnecessary updates)
        if (JSON.stringify(currentPlayerState) === JSON.stringify(receivedPlayerState)) {
          console.log(`  Skipping - states are identical`);
          continue;
        }

        console.log(`  States differ - applying updates`);

        // Track that this character's state changed
        changedCharacterIds.push(characterId);

        // Dispatch individual property updates
        if (receivedPlayerState.position && receivedPlayerState.position !== currentPlayerState?.position) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setPosition',
            payload: { characterId, position: receivedPlayerState.position }
          });
        }

        if (receivedPlayerState.effect && receivedPlayerState.effect !== currentPlayerState?.effect) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setEffect',
            payload: { characterId, effect: receivedPlayerState.effect }
          });
        }

        if (receivedPlayerState.selectedAction && receivedPlayerState.selectedAction !== currentPlayerState?.selectedAction) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setActionPlan',
            payload: {
              characterId,
              action: receivedPlayerState.selectedAction,
              position: receivedPlayerState.position || 'risky',
              effect: receivedPlayerState.effect || 'standard'
            }
          });
        }

        if (receivedPlayerState.gmApproved !== currentPlayerState?.gmApproved) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setGmApproved',
            payload: { characterId, approved: receivedPlayerState.gmApproved || false }
          });
        }

        // CRITICAL: Handle trait transactions (the missing piece!)
        if (JSON.stringify(receivedPlayerState.traitTransaction) !== JSON.stringify(currentPlayerState?.traitTransaction)) {
          if (receivedPlayerState.traitTransaction) {
            game.fitgd.store.dispatch({
              type: 'playerRoundState/setTraitTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.traitTransaction
              }
            });
          } else {
            game.fitgd.store.dispatch({
              type: 'playerRoundState/clearTraitTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle push improvements (pushed + pushType)
        if (receivedPlayerState.pushed !== currentPlayerState?.pushed ||
            receivedPlayerState.pushType !== currentPlayerState?.pushType) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setImprovements',
            payload: {
              characterId,
              pushed: receivedPlayerState.pushed || false,
              pushType: receivedPlayerState.pushType || undefined
            }
          });
        }

        // CRITICAL: Handle state transitions
        if (receivedPlayerState.state && receivedPlayerState.state !== currentPlayerState?.state) {
          console.log(`  Dispatching state transition: ${currentPlayerState?.state} → ${receivedPlayerState.state}`);
          game.fitgd.store.dispatch({
            type: 'playerRoundState/transitionState',
            payload: {
              characterId,
              newState: receivedPlayerState.state
            }
          });
        } else {
          console.log(`  State transition skipped - receivedPlayerState.state: ${receivedPlayerState.state}, currentPlayerState.state: ${currentPlayerState?.state}`);
        }

        // CRITICAL: Handle roll results (dicePool, rollResult, outcome)
        if (receivedPlayerState.rollResult || receivedPlayerState.outcome || receivedPlayerState.dicePool !== undefined) {
          if (JSON.stringify(receivedPlayerState.rollResult) !== JSON.stringify(currentPlayerState?.rollResult) ||
              receivedPlayerState.outcome !== currentPlayerState?.outcome ||
              receivedPlayerState.dicePool !== currentPlayerState?.dicePool) {
            game.fitgd.store.dispatch({
              type: 'playerRoundState/setRollResult',
              payload: {
                characterId,
                dicePool: receivedPlayerState.dicePool || 0,
                rollResult: receivedPlayerState.rollResult || [],
                outcome: receivedPlayerState.outcome
              }
            });
          }
        }

        // CRITICAL: Handle consequence transactions (NEW in Phase 3)
        if (JSON.stringify(receivedPlayerState.consequenceTransaction) !== JSON.stringify(currentPlayerState?.consequenceTransaction)) {
          if (receivedPlayerState.consequenceTransaction) {
            // Set or update consequence transaction
            game.fitgd.store.dispatch({
              type: 'playerRoundState/setConsequenceTransaction',
              payload: {
                characterId,
                transaction: receivedPlayerState.consequenceTransaction
              }
            });
          } else if (currentPlayerState?.consequenceTransaction) {
            // Clear consequence transaction
            game.fitgd.store.dispatch({
              type: 'playerRoundState/clearConsequenceTransaction',
              payload: { characterId }
            });
          }
        }

        // CRITICAL: Handle stims usage tracking (NEW in Phase 5)
        if (receivedPlayerState.stimsUsedThisAction !== currentPlayerState?.stimsUsedThisAction) {
          game.fitgd.store.dispatch({
            type: 'playerRoundState/setStimsUsed',
            payload: {
              characterId,
              used: receivedPlayerState.stimsUsedThisAction || false
            }
          });
        }
      }

      // Update active player if changed
      if (data.playerRoundState.activeCharacterId !== currentState.playerRoundState.activeCharacterId) {
        game.fitgd.store.dispatch({
          type: 'playerRoundState/setActivePlayer',
          payload: { characterId: data.playerRoundState.activeCharacterId }
        });
      }
    }

    if (appliedCount > 0 || data.playerRoundState) {
      // Update lastBroadcastCount to prevent re-broadcasting received commands
      const history = game.fitgd.foundry.exportHistory();
      lastBroadcastCount = {
        characters: history.characters.length,
        crews: history.crews.length,
        clocks: history.clocks.length
      };
      console.log(`FitGD | Updated broadcast tracking after receiving commands`);

      // Refresh affected sheets (pass the captured entityIds for deleted clocks)
      refreshAffectedSheets(data.commands, clockEntityIds);

      // CRITICAL: Also refresh widgets for playerRoundState changes
      // This ensures GM sees player's trait transactions and plan updates
      if (changedCharacterIds.length > 0) {
        console.log(`FitGD | Refreshing widgets for ${changedCharacterIds.length} changed characters:`, changedCharacterIds);
        const { refreshSheetsByReduxId } = await import('./dialogs.mjs');
        refreshSheetsByReduxId(changedCharacterIds, false);
      }

      console.log(`FitGD | Sync complete - applied ${appliedCount} new commands + playerRoundState`);

      // GM persists changes from players to world settings
      if (game.user.isGM) {
        try {
          await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
          console.log(`FitGD | GM persisted player changes to world settings`);
        } catch (error) {
          console.error('FitGD | GM failed to persist player changes:', error);
        }
      }
    } else {
      console.log(`FitGD | No commands or playerRoundState were applied (all duplicates or empty)`);
    }
  } catch (error) {
    console.error('FitGD | Error applying incremental commands:', error);
    console.warn('FitGD | Falling back to full state reload...');
    await reloadStateFromSettings();
  }
}

/* -------------------------------------------- */
/*  Auto-save Functionality                     */
/* -------------------------------------------- */

let autoSaveTimer = null;

// Track applied command IDs for idempotency (prevents re-applying same command)
const appliedCommandIds = new Set();

// Track last broadcast command counts to detect new commands
let lastBroadcastCount = {
  characters: 0,
  crews: 0,
  clocks: 0
};

/**
 * Extract new commands since last broadcast (for incremental sync)
 */
function getNewCommandsSinceLastBroadcast() {
  const history = game.fitgd.foundry.exportHistory();

  console.log(`FitGD | Current history counts: chars=${history.characters.length}, crews=${history.crews.length}, clocks=${history.clocks.length}`);
  console.log(`FitGD | Last broadcast counts: chars=${lastBroadcastCount.characters}, crews=${lastBroadcastCount.crews}, clocks=${lastBroadcastCount.clocks}`);

  const newCommands = {
    characters: history.characters.slice(lastBroadcastCount.characters),
    crews: history.crews.slice(lastBroadcastCount.crews),
    clocks: history.clocks.slice(lastBroadcastCount.clocks)
  };

  // Update the tracking counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };

  const totalNew = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;
  console.log(`FitGD | Found ${totalNew} new commands to broadcast:`, {
    characters: newCommands.characters.length,
    crews: newCommands.crews.length,
    clocks: newCommands.clocks.length
  });

  if (totalNew > 0) {
    console.log(`FitGD | New command types:`, newCommands.characters.map(c => c.type), newCommands.crews.map(c => c.type), newCommands.clocks.map(c => c.type));
  }

  return newCommands;
}

/**
 * Apply commands incrementally to Redux store (for real-time sync)
 */
function applyCommandsIncremental(commands) {
  let appliedCount = 0;
  let skippedCount = 0;

  // Merge all commands and sort by timestamp
  const allCommands = [
    ...commands.characters,
    ...commands.crews,
    ...commands.clocks
  ].sort((a, b) => a.timestamp - b.timestamp);

  console.log(`FitGD | Applying ${allCommands.length} commands incrementally...`);

  for (const command of allCommands) {
    // Skip if already applied (idempotency check)
    if (appliedCommandIds.has(command.commandId)) {
      skippedCount++;
      continue;
    }

    try {
      // Dispatch command to Redux
      game.fitgd.store.dispatch({
        type: command.type,
        payload: command.payload,
        meta: { command }
      });

      // Track as applied
      appliedCommandIds.add(command.commandId);
      appliedCount++;
    } catch (error) {
      console.error(`FitGD | Error applying command ${command.type}:`, error);
    }
  }

  console.log(`FitGD | Applied ${appliedCount} commands, skipped ${skippedCount} duplicates`);
  return appliedCount;
}

/**
 * Track initial commands as applied (called on ready)
 */
function trackInitialCommandsAsApplied() {
  const history = game.fitgd.foundry.exportHistory();

  // Track all initial commands as applied
  for (const command of history.characters) {
    appliedCommandIds.add(command.commandId);
  }
  for (const command of history.crews) {
    appliedCommandIds.add(command.commandId);
  }
  for (const command of history.clocks) {
    appliedCommandIds.add(command.commandId);
  }

  // Set initial broadcast counts
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };

  const total = history.characters.length + history.crews.length + history.clocks.length;
  console.log(`FitGD | Tracked ${total} initial commands as applied`);
}

/**
 * Refresh only the sheets affected by the given commands (optimization)
 * @param {Object} commands - Commands to process
 * @param {Map} clockEntityIds - Map of clockId to entityId (captured before deletion)
 */
function refreshAffectedSheets(commands, clockEntityIds = new Map()) {
  const affectedEntityIds = new Set();
  const state = game.fitgd.store.getState();

  // Extract entity IDs from command payloads
  for (const command of [...commands.characters, ...commands.crews, ...commands.clocks]) {
    // Direct entity references
    if (command.payload?.characterId) {
      affectedEntityIds.add(command.payload.characterId);
    }
    if (command.payload?.crewId) {
      affectedEntityIds.add(command.payload.crewId);
    }
    if (command.payload?.id) {
      affectedEntityIds.add(command.payload.id);
    }
    if (command.payload?.entityId) {
      affectedEntityIds.add(command.payload.entityId);
    }

    // Clock commands: resolve clockId to entityId
    if (command.payload?.clockId) {
      // First try the pre-captured map (for deleted clocks)
      if (clockEntityIds.has(command.payload.clockId)) {
        const entityId = clockEntityIds.get(command.payload.clockId);
        affectedEntityIds.add(entityId);
        console.log(`FitGD | Resolved clockId ${command.payload.clockId} to entityId ${entityId} (from pre-delete capture)`);
      } else {
        // Otherwise try current state (for non-deleted clocks)
        const clock = state.clocks.byId[command.payload.clockId];
        if (clock && clock.entityId) {
          affectedEntityIds.add(clock.entityId);
          console.log(`FitGD | Resolved clockId ${command.payload.clockId} to entityId ${clock.entityId}`);
        }
      }
    }
  }

  console.log(`FitGD | Refreshing sheets for ${affectedEntityIds.size} affected entities:`, Array.from(affectedEntityIds));
  console.log(`FitGD | Open windows: ${Object.keys(ui.windows).length}`);

  // Refresh only affected sheets (works for all permission levels: owner, observer, etc.)
  let refreshedCount = 0;
  for (const app of Object.values(ui.windows)) {
    if (!app.rendered) {
      continue;
    }

    if (app instanceof FitGDCharacterSheet || app instanceof FitGDCrewSheet) {
      // Try to get Redux ID from the actor flags
      let reduxId = null;
      try {
        reduxId = app.actor?.getFlag('forged-in-the-grimdark', 'reduxId');
      } catch (error) {
        console.warn(`FitGD | Could not read reduxId flag from actor (permission issue?):`, error);
        continue;
      }

      console.log(`FitGD | Checking ${app.constructor.name} - Actor: ${app.actor?.name}, ReduxId: ${reduxId}, Match: ${affectedEntityIds.has(reduxId)}`);

      if (reduxId && affectedEntityIds.has(reduxId)) {
        try {
          const permission = app.actor?.testUserPermission(game.user, 'OBSERVER') ? 'observer+' :
                           app.actor?.testUserPermission(game.user, 'OWNER') ? 'owner' : 'limited';
          console.log(`FitGD | Re-rendering ${app.constructor.name} for ${reduxId} (user: ${game.user.name}, permission: ${permission})`);

          // Force a full re-render (true = force) to ensure observers see updates
          // The sheet's getData() will read from Redux which has the latest state
          app.render(true);
          refreshedCount++;
        } catch (error) {
          console.error(`FitGD | Error re-rendering sheet for ${reduxId}:`, error);
        }
      }
    }
  }

  console.log(`FitGD | Refreshed ${refreshedCount} sheets`);
}

/**
 * Reload Redux state from Foundry settings (for multi-client sync)
 */
async function reloadStateFromSettings() {
  try {
    console.log('FitGD | Reloading state from settings...');

    // Load command history from settings
    const defaultHistory = { characters: [], crews: [], clocks: [] };
    const history = game.settings.get('forged-in-the-grimdark', 'commandHistory') || defaultHistory;

    // Ensure history has the correct structure
    const validHistory = {
      characters: history.characters || [],
      crews: history.crews || [],
      clocks: history.clocks || []
    };

    const totalCommands = validHistory.characters.length + validHistory.crews.length + validHistory.clocks.length;

    if (totalCommands > 0) {
      console.log(`FitGD | Replaying ${totalCommands} commands...`);

      // Reset store to initial state, then replay all commands
      // This ensures we rebuild state from scratch rather than applying changes twice
      const { configureStore } = await import('../dist/fitgd-core.es.js');
      game.fitgd.store = configureStore();

      // Replay commands
      game.fitgd.foundry.replayCommands(validHistory);

      console.log('FitGD | State reloaded successfully');

      // Re-render all open sheets to show updated state
      for (const app of Object.values(ui.windows)) {
        if (app.rendered && (app instanceof FitGDCharacterSheet || app instanceof FitGDCrewSheet)) {
          console.log(`FitGD | Re-rendering ${app.constructor.name}`);
          app.render(false);
        }
      }
    }
  } catch (error) {
    console.error('FitGD | Error reloading state:', error);
    ui.notifications.error('Failed to reload game state. Please refresh the page.');
  }
}

async function saveCommandHistoryImmediate() {
  // Save immediately without debounce
  console.log(`FitGD | saveCommandHistoryImmediate() called`);
  try {
    // Get new commands since last broadcast
    const newCommands = getNewCommandsSinceLastBroadcast();
    const newCommandCount = newCommands.characters.length + newCommands.crews.length + newCommands.clocks.length;

    // Broadcast commands FIRST (before persistence) - all users can do this
    if (newCommandCount > 0) {
      const socketData = {
        type: 'commandsAdded',
        userId: game.user.id,
        userName: game.user.name,
        commandCount: newCommandCount,
        commands: newCommands,
        timestamp: Date.now()
      };

      console.log(`FitGD | Broadcasting ${newCommandCount} commands via socketlib:`, socketData);
      console.log(`FitGD | game.fitgd.socket exists?`, !!game.fitgd.socket);

      try {
        // Use socketlib to broadcast to OTHER clients (not self)
        const result = await game.fitgd.socket.executeForOthers('syncCommands', socketData);
        console.log(`FitGD | socketlib broadcast completed, result:`, result);
      } catch (error) {
        console.error('FitGD | socketlib broadcast error:', error);
      }
    } else {
      console.log(`FitGD | No new commands to broadcast (count = 0)`);
    }

    // Save to Foundry settings (only if user has permission - typically GM)
    if (game.user.isGM) {
      const history = game.fitgd.foundry.exportHistory();
      await game.settings.set('forged-in-the-grimdark', 'commandHistory', history);
      const total = history.characters.length + history.crews.length + history.clocks.length;
      console.log(`FitGD | Saved ${total} commands to world settings (GM only)`);
    } else {
      console.log(`FitGD | Skipped settings save (player - GM will persist on receipt)`);
    }
  } catch (error) {
    console.error('FitGD | Error in saveCommandHistoryImmediate:', error);
    // Don't throw - we still want broadcasts to work even if save fails
  }
}

function saveCommandHistory() {
  // Debounced auto-save for non-critical updates
  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  const interval = game.settings.get('forged-in-the-grimdark', 'autoSaveInterval');
  if (interval === 0) return;

  autoSaveTimer = setTimeout(async () => {
    await saveCommandHistoryImmediate();
  }, interval * 1000);
}

/* -------------------------------------------- */
/*  Character Sheet Class                       */
/* -------------------------------------------- */

/**
 * FitGD Character Sheet
 *
 * Foundry VTT Actor Sheet for character entities. Displays and manages:
 * - Character traits (with lean-in/rally mechanics)
 * - Action dots (12 actions, 0-4 dots each)
 * - Equipment inventory
 * - Harm clocks (max 3 per character)
 * - Rally availability
 *
 * All state is stored in Redux, fetched via actor's Redux ID flag.
 * Sheet provides UI for triggering Redux actions (add trait, disable trait, take harm).
 *
 * Edit mode allows GM to modify action dots directly.
 *
 * @extends ActorSheet
 */
class FitGDCharacterSheet extends ActorSheet {
  /**
   * Create a new Character Sheet
   *
   * @param {...any} args - Arguments passed to ActorSheet constructor
   */
  constructor(...args) {
    super(...args);
    this.editMode = false; // Track edit mode for action dots
  }

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
    context.editMode = this.editMode;

    // Override editable to be GM-only for clock editing
    context.editable = game.user.isGM;

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
    console.log('FitGD | Character Sheet getData - reduxId:', reduxId, 'editable:', context.editable);

    if (reduxId) {
      const character = game.fitgd.api.character.getCharacter(reduxId);
      console.log('FitGD | Character from Redux:', character);

      if (character) {
        // Calculate total allocated dots
        const allocatedDots = Object.values(character.actionDots).reduce((sum, dots) => sum + dots, 0);
        const unallocatedDots = character.unallocatedActionDots;
        const totalDots = allocatedDots + unallocatedDots;

        // Convert actionDots object to array for easier template iteration
        const actionDotsArray = Object.entries(character.actionDots).map(([action, dots]) => ({
          action,
          dots
        }));

        context.system = {
          actionDots: actionDotsArray,
          traits: character.traits,
          equipment: character.equipment,
          rallyAvailable: character.rallyAvailable,
          harmClocks: game.fitgd.api.query.getHarmClocks(reduxId),
          unallocatedActionDots: unallocatedDots,
          allocatedActionDots: allocatedDots,
          totalActionDots: totalDots
        };

        // Find crew for this character
        context.crewId = this._getCrewId(reduxId);
        context.reduxId = reduxId;

        console.log('FitGD | Context system data:', context.system);
        console.log('FitGD | Harm clocks:', context.system.harmClocks);
      } else {
        console.warn('FitGD | Character not found in Redux for ID:', reduxId);
      }
    } else {
      console.warn('FitGD | No Redux ID found in actor flags');
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log('FitGD | Character Sheet activateListeners called');

    // Action Rolls
    const actionRollBtn = html.find('.action-roll-btn');
    const actionRollSingleBtn = html.find('.action-roll-single-btn');
    console.log('FitGD | Found action roll buttons:', actionRollBtn.length, 'single:', actionRollSingleBtn.length);
    actionRollBtn.click(this._onActionRoll.bind(this));
    actionRollSingleBtn.click(this._onActionRollSingle.bind(this));

    // Action Dots (clickable)
    const dots = html.find('.dot');
    console.log('FitGD | Found action dots:', dots.length);
    dots.click(this._onDotClick.bind(this));

    // Toggle Edit Mode for action dots
    html.find('.toggle-edit-btn').click(this._onToggleEdit.bind(this));

    // Harm
    html.find('.add-harm-btn').click(this._onAddHarm.bind(this));

    // Clock controls (GM-only editing)
    html.find('.clock-container img.clock').click(this._onClickClockSVG.bind(this));
    html.find('.clock-value-input').change(this._onChangeClockValue.bind(this));
    html.find('.clock-name').blur(this._onRenameClockBlur.bind(this));
    html.find('.delete-clock-btn').click(this._onDeleteClock.bind(this));

    // Traits
    html.find('.trait-lean-btn').click(this._onLeanIntoTrait.bind(this));
    html.find('.add-trait-btn').click(this._onAddTrait.bind(this));

    // Rally
    html.find('.use-rally-btn').click(this._onUseRally.bind(this));

    // Flashback
    html.find('.flashback-btn').click(this._onFlashback.bind(this));

    // Drag events for hotbar macros
    html.find('.draggable').on('dragstart', this._onDragStart.bind(this));
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
   * Handle drag start for creating hotbar macros
   */
  _onDragStart(event) {
    const element = event.currentTarget;
    const actionType = element.dataset.actionType;
    const characterId = this._getReduxId();

    if (!characterId) return;

    const dragData = {
      type: 'FitGD',
      actorId: this.actor.id,
      characterId: characterId,
      actionType: actionType,
    };

    if (actionType === 'roll') {
      dragData.action = element.dataset.action;
    } else if (actionType === 'lean-trait') {
      dragData.traitId = element.dataset.traitId;
      dragData.traitName = element.dataset.traitName;
    }

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Handle clicking on action dots to set the value (only in edit mode)
   */
  async _onDotClick(event) {
    event.preventDefault();
    event.stopPropagation();

    console.log('FitGD | Dot clicked, editMode:', this.editMode);
    console.log('FitGD | Event target:', event.target);
    console.log('FitGD | Event currentTarget:', event.currentTarget);

    // Only allow editing in edit mode
    if (!this.editMode) {
      ui.notifications.warn('Click Edit to allocate action dots');
      return;
    }

    const characterId = this._getReduxId();
    if (!characterId) {
      console.error('FitGD | No character ID found');
      return;
    }

    // Try to get data attributes from both target and currentTarget
    // Prefer event.target (the actual clicked element) first, as it has both data-action and data-value
    // Fall back to currentTarget only if target doesn't have the required attributes
    const element = (event.target.dataset?.action && event.target.dataset?.value)
      ? event.target
      : event.currentTarget;
    const action = element.dataset?.action;
    const value = parseInt(element.dataset?.value);

    console.log('FitGD | Element used:', element);
    console.log('FitGD | Data action:', action);
    console.log('FitGD | Data value:', value);
    console.log('FitGD | Parsed action:', action, 'value:', value);

    if (!action || isNaN(value)) {
      console.error('FitGD | Invalid action or value');
      console.error('FitGD | Element dataset:', element.dataset);
      console.error('FitGD | Element:', element);
      return;
    }

    try {
      // Get current character state to check if we should toggle to 0
      const character = game.fitgd.api.character.getCharacter(characterId);
      if (!character) {
        console.error('FitGD | Character not found');
        return;
      }

      const currentDots = character.actionDots[action];
      let newDots = value;

      // Feature: If clicking on a single filled dot (current dots is 1 and clicking dot 1), set to 0
      if (currentDots === 1 && value === 1) {
        newDots = 0;
        console.log('FitGD | Toggling single dot to 0');
      }

      console.log('FitGD | Calling setActionDots with:', { characterId, action, dots: newDots });

      // Update the action dots (Redux will handle unallocated dots validation)
      game.fitgd.api.character.setActionDots({
        characterId,
        action,
        dots: newDots
      });

      console.log('FitGD | setActionDots succeeded');

      // Save and broadcast changes to other clients
      await game.fitgd.saveImmediate();

      // Re-render sheet
      this.render(false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Set action dots error:', error);
    }
  }

  /**
   * Toggle edit mode for action dots
   */
  async _onToggleEdit(event) {
    event.preventDefault();

    console.log('FitGD | Toggle edit clicked, current editMode:', this.editMode);

    const characterId = this._getReduxId();
    if (!characterId) {
      console.error('FitGD | No character ID for toggle edit');
      return;
    }

    if (this.editMode) {
      // Trying to save - validate that all dots are allocated
      const character = game.fitgd.api.character.getCharacter(characterId);
      if (!character) {
        console.error('FitGD | Character not found');
        return;
      }

      console.log('FitGD | Attempting to save, unallocated dots:', character.unallocatedActionDots);

      if (character.unallocatedActionDots > 0) {
        ui.notifications.warn(`You must allocate all ${character.unallocatedActionDots} remaining action dots before saving`);
        return;
      }

      // All dots allocated, exit edit mode
      this.editMode = false;
      console.log('FitGD | Exiting edit mode, saving changes');

      // Save and broadcast final dot allocation to other clients
      await game.fitgd.saveImmediate();

      ui.notifications.info('Action dots saved');
    } else {
      // Enter edit mode
      this.editMode = true;
      console.log('FitGD | Entering edit mode');
      ui.notifications.info('Edit mode: Click dots to allocate action ratings');
    }

    // Re-render to update button text and dot states
    console.log('FitGD | Re-rendering with editMode:', this.editMode);
    this.render(false);
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

  /**
   * Handle clicking on clock SVG image (GM-only)
   * Cycles through clock segments
   */
  async _onClickClockSVG(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const img = event.currentTarget;
    const clockId = img.dataset.clockId;
    const currentValue = parseInt(img.dataset.clockValue);
    const maxValue = parseInt(img.dataset.clockMax);

    if (!clockId) return;

    try {
      // Cycle: 0 -> max, then back to 0
      const newValue = currentValue >= maxValue ? 0 : currentValue + 1;

      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock SVG click error:', error);
    }
  }

  /**
   * Handle clock value input change (GM-only)
   * Directly sets clock segments
   */
  async _onChangeClockValue(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const input = event.currentTarget;
    const clockId = input.dataset.clockId;
    const newValue = parseInt(input.value);

    if (!clockId) return;

    try {
      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock value change error:', error);
    }
  }

  /**
   * Handle clock name blur (GM-only)
   * Renames clock when contenteditable loses focus
   */
  async _onRenameClockBlur(event) {
    if (!game.user.isGM) return;

    const element = event.currentTarget;
    const clockId = element.dataset.clockId;
    const newName = element.textContent.trim();

    if (!clockId || !newName) return;

    try {
      game.fitgd.api.clock.rename({ clockId, name: newName });
      await game.fitgd.saveImmediate();
      ui.notifications.info(`Clock renamed to "${newName}"`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock rename error:', error);
      this.render(false); // Reset to original name
    }
  }

  /**
   * Handle delete clock button (GM-only)
   */
  async _onDeleteClock(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const clockId = event.currentTarget.dataset.clockId;

    if (!clockId) return;

    const confirmed = await Dialog.confirm({
      title: 'Delete Clock',
      content: '<p>Are you sure you want to delete this clock?</p>',
      yes: () => true,
      no: () => false
    });

    if (!confirmed) return;

    try {
      game.fitgd.api.clock.delete(clockId);
      await game.fitgd.saveImmediate();
      this.render(false);
      ui.notifications.info('Clock deleted');
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock delete error:', error);
    }
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

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      // Re-render sheets
      this.render(false);
      refreshSheetsByReduxId([crewId], false);

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

/**
 * FitGD Crew Sheet
 *
 * Foundry VTT Actor Sheet for crew entities. Displays and manages:
 * - Crew members (characters in the crew)
 * - Momentum pool (0-10, starts at 5)
 * - Consumable clocks (grenades, stims, etc.)
 * - Addiction clock (fills when using too many stims)
 * - Progress clocks (long-term projects, threats, goals)
 *
 * All state is stored in Redux, fetched via actor's Redux ID flag.
 * Sheet provides UI for triggering crew-level actions (spend Momentum, use consumables).
 *
 * @extends ActorSheet
 */
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

    // Override editable to be GM-only for clock editing
    context.editable = game.user.isGM;

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
    console.log('FitGD | Crew Sheet getData - reduxId:', reduxId, 'editable:', context.editable);

    if (reduxId) {
      const crew = game.fitgd.api.crew.getCrew(reduxId);

      if (crew) {
        // Resolve character names from Redux IDs
        const characterDetails = crew.characters.map(charId => {
          const character = game.fitgd.api.character.getCharacter(charId);
          return {
            id: charId,
            name: character?.name || 'Unknown Character',
            // Find the Foundry actor for this character for linking
            foundryActorId: this._findFoundryActorId(charId)
          };
        });

        context.system = {
          currentMomentum: crew.currentMomentum,
          characters: characterDetails,
          addictionClock: game.fitgd.api.query.getAddictionClock(reduxId),
          consumableClocks: game.fitgd.api.query.getConsumableClocks(reduxId),
          progressClocks: game.fitgd.api.query.getProgressClocks(reduxId)
        };
        context.reduxId = reduxId;

        console.log('FitGD | Crew system data:', context.system);
      }
    }

    return context;
  }

  /**
   * Find Foundry actor ID from Redux character ID
   */
  _findFoundryActorId(characterReduxId) {
    for (const actor of game.actors) {
      if (actor.type === 'character') {
        const actorReduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
        if (actorReduxId === characterReduxId) {
          return actor.id;
        }
      }
    }
    return null;
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

    // Clock controls (GM-only editing)
    html.find('.clock-container img.clock').click(this._onClickClockSVG.bind(this));
    html.find('.clock-value-input').change(this._onChangeClockValue.bind(this));
    html.find('.clock-name').blur(this._onRenameClockBlur.bind(this));
    html.find('.delete-clock-btn').click(this._onDeleteClock.bind(this));

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

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

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

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

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

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock segment error:', error);
    }
  }

  /**
   * Handle clicking on clock SVG image (GM-only)
   * Cycles through clock segments
   */
  async _onClickClockSVG(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const img = event.currentTarget;
    const clockId = img.dataset.clockId;
    const currentValue = parseInt(img.dataset.clockValue);
    const maxValue = parseInt(img.dataset.clockMax);

    if (!clockId) return;

    try {
      // Cycle: 0 -> max, then back to 0
      const newValue = currentValue >= maxValue ? 0 : currentValue + 1;

      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock SVG click error:', error);
    }
  }

  /**
   * Handle clock value input change (GM-only)
   * Directly sets clock segments
   */
  async _onChangeClockValue(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const input = event.currentTarget;
    const clockId = input.dataset.clockId;
    const newValue = parseInt(input.value);

    if (!clockId) return;

    try {
      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock value change error:', error);
    }
  }

  /**
   * Handle clock name blur (GM-only)
   * Renames clock when contenteditable loses focus
   */
  async _onRenameClockBlur(event) {
    if (!game.user.isGM) return;

    const element = event.currentTarget;
    const clockId = element.dataset.clockId;
    const newName = element.textContent.trim();

    if (!clockId || !newName) return;

    try {
      game.fitgd.api.clock.rename({ clockId, name: newName });
      await game.fitgd.saveImmediate();
      ui.notifications.info(`Clock renamed to "${newName}"`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock rename error:', error);
      this.render(false); // Reset to original name
    }
  }

  /**
   * Handle delete clock button (GM-only)
   */
  async _onDeleteClock(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const clockId = event.currentTarget.dataset.clockId;

    if (!clockId) return;

    const confirmed = await Dialog.confirm({
      title: 'Delete Clock',
      content: '<p>Are you sure you want to delete this clock?</p>',
      yes: () => true,
      no: () => false
    });

    if (!confirmed) return;

    try {
      game.fitgd.api.clock.delete(clockId);
      await game.fitgd.saveImmediate();
      this.render(false);
      ui.notifications.info('Clock deleted');
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock delete error:', error);
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

                // Save immediately (critical state change)
                await game.fitgd.saveImmediate();

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

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

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

/**
 * FitGD Trait Item Sheet
 *
 * Foundry VTT Item Sheet for trait items. Displays trait details:
 * - Trait name
 * - Category (role, background, scar, flashback, grouped)
 * - Description
 * - Disabled status (leaned into for Momentum)
 *
 * Traits are stored in Redux but can be viewed as Foundry Items.
 *
 * @extends ItemSheet
 */
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

/**
 * FitGD Equipment Item Sheet
 *
 * Foundry VTT Item Sheet for equipment items. Displays equipment details:
 * - Equipment name
 * - Tier (accessible, inaccessible, epic)
 * - Category (weapon, armor, tool, etc.)
 * - Description
 *
 * Equipment is stored in Redux but can be viewed as Foundry Items.
 *
 * @extends ItemSheet
 */
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
