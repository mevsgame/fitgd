/**
 * Hotbar Drop Hooks
 *
 * Handles drag-and-drop to hotbar for quick actions
 */

interface HotbarDropData {
  type: string;
  actorId: string;
  characterId: string;
  actionType: string;
  action?: string;
  traitId?: string;
  traitName?: string;
}

/**
 * Register hotbar-related hooks
 */
export function registerHotbarHooks(): void {
/* -------------------------------------------- */
/*  Hotbar Drop Hook                            */
/* -------------------------------------------- */

/**
 * Create a macro when something is dropped on the hotbar
 */
Hooks.on('hotbarDrop' as any, async function(_bar: Hotbar, data: any, slot: number) {
  // Only handle FitGD drops
  if (data.type !== 'FitGD') return;

  const { actorId, characterId, actionType, action, traitId, traitName } = data as HotbarDropData;

  // Get the actor
  const actor = game.actors!.get(actorId);
  if (!actor) {
    ui.notifications!.error('Actor not found');
    return false;
  }

  // Create macro command based on action type
  let command: string, name: string, img: string;

  if (actionType === 'roll') {
    // Action roll macro
    name = `${actor.name}: ${action!.charAt(0).toUpperCase() + action!.slice(1)}`;
    img = 'icons/svg/d20-grey.svg';
    command = `// ${name}
const actor = game.actors.get("${actorId}");
const characterId = actor?.id; // Unified IDs

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
const { ActionRollDialog } = await import('./systems/forged-in-the-grimdark/module-dist/dialogs/index.mjs');
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
    } as any
  } as any);

  // Assign macro to hotbar slot
  if (macro) {
    game.user!.assignHotbarMacro(macro as any, slot);
  }

  return false;
});
}
