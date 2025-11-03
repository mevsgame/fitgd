# FitGD Foundry VTT Macros

This document contains example macros for **Forged in the Grimdark** that interact directly with the Redux backend via the game API.

## How to Use Macros

1. Click the **Macro Directory** button in Foundry VTT (dice icon at the bottom)
2. Click **Create Macro**
3. Set **Type** to "Script"
4. Copy one of the scripts below
5. Give it a name and icon
6. Click **Save**
7. Drag the macro to your hotbar

## Available API

The FitGD system exposes a complete game API at `game.fitgd.api` with the following namespaces:

- **game.fitgd.api.character** - Character management
- **game.fitgd.api.crew** - Crew and Momentum management
- **game.fitgd.api.action** - Game actions (Push, Flashback, Rally, Lean into Trait)
- **game.fitgd.api.harm** - Harm and clocks
- **game.fitgd.api.clock** - Clock management
- **game.fitgd.api.query** - Read-only queries

---

## Quick Action Macros

### Make an Action Roll

Opens the action roll dialog for your selected character.

```javascript
// Action Roll
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) {
  ui.notifications.warn("Please select a character token");
  return;
}

const actor = tokens[0].actor;
if (actor.type !== 'character') {
  ui.notifications.warn("Please select a character, not a crew");
  return;
}

const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) {
  ui.notifications.error("Character not linked to Redux");
  return;
}

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

if (!crewId) {
  ui.notifications.warn("Character must be part of a crew to make rolls");
  return;
}

// Import dialog class
const { ActionRollDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
new ActionRollDialog(reduxId, crewId).render(true);
```

### Quick Roll (Pre-selected Action)

Roll a specific action (e.g., Shoot) directly without opening dialog.

```javascript
// Quick Shoot Roll
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) return ui.notifications.warn("Select a character");

const actor = tokens[0].actor;
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) return ui.notifications.error("Character not linked");

const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

if (!crewId) return ui.notifications.warn("Character not in crew");

const { ActionRollDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
const dialog = new ActionRollDialog(reduxId, crewId);
dialog.render(true);

// Pre-select "shoot" action
setTimeout(() => {
  const select = dialog.element.find('[name="action"]');
  if (select.length) {
    select.val('shoot').trigger('change');
  }
}, 100);
```

---

## Momentum Macros

### Add Momentum

Add Momentum to your crew (for GMs accepting consequences).

```javascript
// Add Momentum
const crewActors = game.actors.filter(a => a.type === 'crew');
if (crewActors.length === 0) {
  ui.notifications.warn("No crews exist");
  return;
}

let crewId = crewActors[0].getFlag('forged-in-the-grimdark', 'reduxId');

// If multiple crews, let user choose
if (crewActors.length > 1) {
  const options = crewActors.map(c => `<option value="${c.getFlag('forged-in-the-grimdark', 'reduxId')}">${c.name}</option>`).join('');
  const content = `
    <form>
      <div class="form-group">
        <label>Crew</label>
        <select name="crew">${options}</select>
      </div>
      <div class="form-group">
        <label>Amount</label>
        <input type="number" name="amount" value="1" min="1" max="10"/>
      </div>
    </form>
  `;

  new Dialog({
    title: "Add Momentum",
    content,
    buttons: {
      add: {
        label: "Add",
        callback: (html) => {
          const crew = html.find('[name="crew"]').val();
          const amount = parseInt(html.find('[name="amount"]').val());
          game.fitgd.api.crew.addMomentum({ crewId: crew, amount });
          ui.notifications.info(`Added ${amount} Momentum`);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "add"
  }).render(true);
  return;
}

// Single crew, just ask for amount
new Dialog({
  title: "Add Momentum",
  content: `
    <form>
      <div class="form-group">
        <label>Amount</label>
        <input type="number" name="amount" value="1" min="1" max="10"/>
      </div>
    </form>
  `,
  buttons: {
    add: {
      label: "Add",
      callback: (html) => {
        const amount = parseInt(html.find('[name="amount"]').val());
        game.fitgd.api.crew.addMomentum({ crewId, amount });
        ui.notifications.info(`Added ${amount} Momentum`);
      }
    },
    cancel: { label: "Cancel" }
  },
  default: "add"
}).render(true);
```

### Check Momentum

Display current Momentum for all crews.

```javascript
// Check Momentum
const crews = game.actors.filter(a => a.type === 'crew');
if (crews.length === 0) {
  ui.notifications.warn("No crews exist");
  return;
}

let content = "<ul>";
for (const crewActor of crews) {
  const crewId = crewActor.getFlag('forged-in-the-grimdark', 'reduxId');
  const crew = game.fitgd.api.crew.getCrew(crewId);
  if (crew) {
    content += `<li><strong>${crewActor.name}:</strong> ${crew.currentMomentum}/10 Momentum</li>`;
  }
}
content += "</ul>";

new Dialog({
  title: "Current Momentum",
  content,
  buttons: {
    ok: { label: "OK" }
  }
}).render(true);
```

---

## Character Action Macros

### Lean into Trait

Mark a trait as disabled and gain 2 Momentum.

```javascript
// Lean into Trait
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) return ui.notifications.warn("Select a character");

const actor = tokens[0].actor;
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) return ui.notifications.error("Character not linked");

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

if (!crewId) return ui.notifications.warn("Character not in crew");

// Get character traits
const character = game.fitgd.api.character.getCharacter(reduxId);
const enabledTraits = character.traits.filter(t => !t.disabled);

if (enabledTraits.length === 0) {
  ui.notifications.warn("No enabled traits to lean into");
  return;
}

const traitOptions = enabledTraits.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

new Dialog({
  title: "Lean into Trait",
  content: `
    <form>
      <p>Select a trait to disable and gain 2 Momentum for your crew.</p>
      <div class="form-group">
        <label>Trait</label>
        <select name="trait">${traitOptions}</select>
      </div>
    </form>
  `,
  buttons: {
    lean: {
      icon: '<i class="fas fa-arrow-up"></i>',
      label: "Lean In",
      callback: (html) => {
        const traitId = html.find('[name="trait"]').val();
        const result = game.fitgd.api.action.leanIntoTrait({ crewId, characterId: reduxId, traitId });
        ui.notifications.info(`Leaned into trait! Gained 2 Momentum (now ${result.newMomentum}/10)`);
      }
    },
    cancel: { label: "Cancel" }
  },
  default: "lean"
}).render(true);
```

### Use Rally

Re-enable a disabled trait when at 0-3 Momentum.

```javascript
// Rally
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) return ui.notifications.warn("Select a character");

const actor = tokens[0].actor;
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) return ui.notifications.error("Character not linked");

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

if (!crewId) return ui.notifications.warn("Character not in crew");

// Open Rally dialog
const { RallyDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
new RallyDialog(reduxId, crewId).render(true);
```

### Flashback

Spend 1 Momentum to add a new trait.

```javascript
// Flashback
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) return ui.notifications.warn("Select a character");

const actor = tokens[0].actor;
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) return ui.notifications.error("Character not linked");

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

if (!crewId) return ui.notifications.warn("Character not in crew");

// Open Flashback dialog
const { FlashbackDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
new FlashbackDialog(reduxId, crewId).render(true);
```

---

## GM Macros

### Reset Momentum

Perform a Momentum Reset (sets to 5, reduces Addiction by 2, restores Rally).

```javascript
// Perform Reset
const crewActors = game.actors.filter(a => a.type === 'crew');
if (crewActors.length === 0) {
  ui.notifications.warn("No crews exist");
  return;
}

let crewId = crewActors[0].getFlag('forged-in-the-grimdark', 'reduxId');

// If multiple crews, let user choose
if (crewActors.length > 1) {
  const options = crewActors.map(c => `<option value="${c.getFlag('forged-in-the-grimdark', 'reduxId')}">${c.name}</option>`).join('');

  new Dialog({
    title: "Perform Reset",
    content: `
      <form>
        <p>This will reset Momentum to 5, reduce Addiction by 2, and restore Rally for all characters.</p>
        <div class="form-group">
          <label>Crew</label>
          <select name="crew">${options}</select>
        </div>
      </form>
    `,
    buttons: {
      reset: {
        icon: '<i class="fas fa-redo"></i>',
        label: "Reset",
        callback: (html) => {
          const crew = html.find('[name="crew"]').val();
          const result = game.fitgd.api.crew.performReset(crew);
          ui.notifications.info(`Reset complete! Momentum: ${result.newMomentum}/10, Addiction reduced by ${result.addictionReduced}`);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "reset"
  }).render(true);
  return;
}

// Single crew
new Dialog({
  title: "Perform Reset",
  content: `<p>This will reset Momentum to 5, reduce Addiction by 2, and restore Rally for all characters.</p>`,
  buttons: {
    reset: {
      icon: '<i class="fas fa-redo"></i>',
      label: "Reset",
      callback: () => {
        const result = game.fitgd.api.crew.performReset(crewId);
        ui.notifications.info(`Reset complete! Momentum: ${result.newMomentum}/10, Addiction reduced by ${result.addictionReduced}`);
      }
    },
    cancel: { label: "Cancel" }
  },
  default: "reset"
}).render(true);
```

### Take Harm

Apply harm to a character.

```javascript
// Take Harm
const tokens = canvas.tokens.controlled;
if (tokens.length === 0) return ui.notifications.warn("Select a character");

const actor = tokens[0].actor;
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
if (!reduxId) return ui.notifications.error("Character not linked");

// Find crew
const state = game.fitgd.store.getState();
let crewId = null;
for (const id of state.crews.allIds) {
  const crew = state.crews.byId[id];
  if (crew.characters.includes(reduxId)) {
    crewId = id;
    break;
  }
}

// Open Take Harm dialog
const { TakeHarmDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
new TakeHarmDialog(reduxId, crewId).render(true);
```

---

## Direct API Usage Examples

For advanced users, you can call the API directly in macros:

```javascript
// Get character state
const character = game.fitgd.api.character.getCharacter(characterId);
console.log(character);

// Get crew state
const crew = game.fitgd.api.crew.getCrew(crewId);
console.log(crew.currentMomentum);

// Set action dots
game.fitgd.api.character.setActionDots({
  characterId,
  action: 'shoot',
  dots: 3
});

// Add trait
game.fitgd.api.character.addTrait({
  characterId,
  trait: {
    name: 'Veteran Soldier',
    category: 'role',
    disabled: false,
    description: 'Served 10 years in the Imperial Guard'
  }
});

// Create progress clock
const clockId = game.fitgd.api.clock.createProgress({
  entityId: crewId,
  name: 'Infiltrate Enemy Base',
  segments: 8,
  category: 'long-term-project'
});

// Advance clock
game.fitgd.api.clock.addSegments({ clockId, amount: 2 });

// Check if character can rally
const canRally = game.fitgd.api.query.canUseRally(characterId);
```

---

## Console Commands for Debugging

Open the browser console (F12) to access the Redux store directly:

```javascript
// Get full Redux state
game.fitgd.store.getState()

// Get all characters
game.fitgd.store.getState().characters.byId

// Get all crews
game.fitgd.store.getState().crews.byId

// Get all clocks
game.fitgd.store.getState().clocks.byId

// Get command history
game.fitgd.store.getState().characters.history

// Export state for backup
const state = game.fitgd.foundry.exportState();
console.log(JSON.stringify(state, null, 2));

// Export command history
const history = game.fitgd.foundry.exportHistory();
console.log(JSON.stringify(history, null, 2));
```

---

## Tips for Macro Development

1. **Token Selection**: Most macros check for `canvas.tokens.controlled` to get the selected character
2. **Error Handling**: Always check if Redux IDs exist before calling API methods
3. **Crew Lookup**: Many actions require finding which crew a character belongs to
4. **Dialog Import**: Use dynamic imports for dialog classes: `await import('./systems/forged-in-the-grimdark/module/dialogs.mjs')`
5. **Notifications**: Use `ui.notifications.info/warn/error()` to provide feedback
6. **Re-rendering**: Sheets auto-update via Redux subscriptions, no manual refresh needed

---

## Common Patterns

### Get Character's Crew

```javascript
function getCharacterCrew(characterId) {
  const state = game.fitgd.store.getState();
  for (const crewId of state.crews.allIds) {
    const crew = state.crews.byId[crewId];
    if (crew.characters.includes(characterId)) {
      return crewId;
    }
  }
  return null;
}
```

### Get Selected Character's Redux ID

```javascript
function getSelectedCharacterId() {
  const tokens = canvas.tokens.controlled;
  if (tokens.length === 0) {
    ui.notifications.warn("Select a character");
    return null;
  }

  const actor = tokens[0].actor;
  if (actor.type !== 'character') {
    ui.notifications.warn("Select a character, not a crew");
    return null;
  }

  const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
  if (!reduxId) {
    ui.notifications.error("Character not linked to Redux");
    return null;
  }

  return reduxId;
}
```

---

## Advanced: Custom Actions

You can create custom game actions by dispatching Redux actions directly:

```javascript
// WARNING: Advanced usage - prefer using game.fitgd.api

// Dispatch a custom action
game.fitgd.store.dispatch({
  type: 'crews/addMomentum',
  payload: {
    crewId: 'some-crew-id',
    amount: 3
  }
});

// Subscribe to state changes
const unsubscribe = game.fitgd.store.subscribe(() => {
  const state = game.fitgd.store.getState();
  console.log('State changed:', state);
});

// Later: unsubscribe();
```

---

## Macro Hotbar Setup Suggestions

Recommended macros to add to your hotbar:

1. **Action Roll** - Quick access to action rolls
2. **Check Momentum** - See current Momentum
3. **Lean into Trait** - Quick trait disable
4. **Flashback** - Quick flashback action
5. **Take Harm** - For GMs to quickly apply harm

Players can drag these to their hotbar for one-click access!
