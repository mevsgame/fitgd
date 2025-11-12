/**
 * Hotbar Drop Hooks
 *
 * Handles drag-and-drop to hotbar for quick actions
 */

// @ts-check

/**
 * Register hotbar-related hooks
 */
export function registerHotbarHooks() {
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

  if (actionType === 'take-action') {
    // Take Action macro (opens Player Action Widget)
    name = `${actor.name}: Take Action`;
    img = 'icons/svg/dice-target.svg';
    command = `// ${name}
const actor = game.actors.get("${actorId}");
const characterId = actor?.id; // Unified IDs

if (!characterId) {
  ui.notifications.error("Character not linked to Redux");
  return;
}

// Call takeAction API
await game.fitgd.api.action.takeAction(characterId);`;

  } else if (actionType === 'lean-trait') {
    // Lean into trait macro
    name = `${actor.name}: Lean into ${traitName}`;
    img = 'icons/svg/fire.svg';
    command = `// ${name}
const actor = game.actors.get("${actorId}");
const characterId = actor?.id; // Unified IDs
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

}
)}