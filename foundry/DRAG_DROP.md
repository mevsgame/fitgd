# Drag-and-Drop Hotbar Macros

FitGD supports Foundry VTT's native drag-and-drop system for creating hotbar macros directly from character sheets!

## How It Works

Simply **drag action names or trait names** from your character sheet to any hotbar slot. A macro will be automatically created and assigned to that slot.

## What Can Be Dragged?

### 1. Action Rolls

**Location:** Character Sheet → Actions Tab

Drag any action name (shoot, command, skulk, etc.) to create a macro that:
- Opens the Action Roll dialog
- Pre-selects that action
- Ready to roll immediately

**Example:** Drag "Shoot" to hotbar slot 1. Clicking the macro opens the roll dialog with "Shoot" pre-selected.

### 2. Lean into Trait

**Location:** Character Sheet → Traits Tab

Drag any trait name to create a macro that:
- Disables that trait
- Grants 2 Momentum to your crew
- Shows confirmation message

**Example:** Drag "Served with Elite Infantry" to hotbar slot 2. Clicking the macro leans into that trait immediately.

## Visual Cues

### Draggable Items

Draggable items have visual indicators:

- **Cursor changes** to "grab" hand when hovering
- **Color highlights** to orange/red on hover
- **Text shadow** glow effect
- **Tooltip** says "Drag to hotbar to create macro"

### During Drag

- Cursor changes to "grabbing" hand
- Element becomes translucent
- Foundry shows drop target zones

## Created Macros

### Action Roll Macro

```javascript
// Sergeant Kane: Shoot
const actor = game.actors.get("actor-id");
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
    select.val('shoot').trigger('change');
  }
}, 100);
```

**Macro Properties:**
- **Name:** `Character Name: Action`
- **Type:** Script
- **Icon:** Dice icon
- **Flags:** Stores character ID, action name for reference

### Lean into Trait Macro

```javascript
// Sergeant Kane: Lean into Served with Elite Infantry
const actor = game.actors.get("actor-id");
const characterId = actor?.getFlag('forged-in-the-grimdark', 'reduxId');
const traitId = "trait-id";

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

  ui.notifications.info(`Leaned into trait! Gained 2 Momentum (now ${result.newMomentum}/10)`);
} catch (error) {
  ui.notifications.error(`Error: ${error.message}`);
}
```

**Macro Properties:**
- **Name:** `Character Name: Lean into Trait Name`
- **Type:** Script
- **Icon:** Fire icon
- **Flags:** Stores character ID, trait ID for reference

## Managing Macros

### Editing Macros

1. Right-click the hotbar macro
2. Select "Edit Macro"
3. Modify the script as needed
4. Click "Save Changes"

### Deleting Macros

1. Right-click the hotbar macro
2. Select "Delete"
3. Confirm deletion

### Reassigning Slots

Simply drag another item to the same slot. It will ask if you want to replace the existing macro.

## Best Practices

### For Players

1. **Organize by frequency**
   - Slot 1-3: Most used actions (Shoot, Command, Skirmish)
   - Slot 4-6: Less used actions (Tech, Attune, Study)
   - Slot 7-9: Trait macros for quick Momentum gain
   - Slot 10: Rally or Flashback

2. **Name patterns**
   - Macros are auto-named: "Character: Action"
   - Easy to identify which character
   - Rename if you prefer shortcuts

3. **Multiple characters**
   - Create separate macros for each character
   - Use different hotbar pages (1-5)
   - Page 1: Main character, Page 2: Alt character, etc.

### For GMs

1. **GM-specific macros**
   - Add Momentum
   - Apply Consequences
   - Advance Clocks
   - Perform Reset

2. **NPC macros**
   - Create for recurring NPCs
   - Quick rolls for enemy actions
   - Track enemy harm

## Technical Details

### Drag Data Format

```javascript
{
  type: 'FitGD',
  actorId: 'foundry-actor-id',
  characterId: 'redux-character-id',
  actionType: 'roll' | 'lean-trait',
  action: 'shoot' | 'command' | ..., // for roll type
  traitId: 'trait-id',                // for lean-trait type
  traitName: 'Trait Name'              // for lean-trait type
}
```

### Event Flow

1. **Drag Start**
   - Character sheet detects drag on `.draggable` element
   - `_onDragStart()` method creates drag data
   - Data includes actor ID, character ID, action type

2. **Drop**
   - Foundry hotbar receives drop event
   - `hotbarDrop` hook intercepts
   - Checks `data.type === 'FitGD'`

3. **Macro Creation**
   - Generates script based on action type
   - Creates Macro document
   - Assigns to hotbar slot
   - Returns `false` to prevent default

### CSS Classes

```css
.fitgd .draggable {
  cursor: grab;
  user-select: none;
}

.fitgd .draggable:active {
  cursor: grabbing;
}

.fitgd .draggable:hover {
  color: #ff6347;
  text-shadow: 0 0 4px rgba(255, 99, 71, 0.5);
}
```

## Troubleshooting

### Macro doesn't work

**Problem:** Clicking macro shows "Character not linked to Redux"

**Solution:**
1. Open character sheet
2. Check if Redux ID is set
3. If not, delete and recreate the character
4. Or manually set via console: `actor.setFlag('forged-in-the-grimdark', 'reduxId', id)`

### Can't drag items

**Problem:** Items don't become draggable

**Solution:**
1. Ensure sheet is rendered
2. Refresh browser (F5)
3. Check browser console for errors
4. Verify system is up to date

### Wrong action pre-selected

**Problem:** Macro opens dialog but wrong action is selected

**Solution:**
1. Edit the macro
2. Find the line: `select.val('action-name')`
3. Change `'action-name'` to correct action
4. Actions: shoot, skirmish, skulk, wreck, finesse, survey, study, tech, attune, command, consort, sway

### Macro references wrong character

**Problem:** Macro uses different character than expected

**Solution:**
1. Macro is bound to actor by ID
2. If character deleted/recreated, drag again to create new macro
3. Old macros won't update automatically

## Advanced Customization

### Custom Icons

Edit the macro and change the `img` field:

```javascript
// In macro edit dialog
img: 'path/to/custom/icon.png'
```

Common Foundry icon paths:
- `icons/svg/d20-grey.svg` - Dice (default for actions)
- `icons/svg/fire.svg` - Fire (default for traits)
- `icons/svg/sword.svg` - Weapon
- `icons/svg/shield.svg` - Defense
- `icons/svg/lightning.svg` - Power

### Adding Modifiers

Edit action roll macros to auto-apply Push:

```javascript
// Before opening dialog, spend Momentum
if (game.fitgd.api.query.getMomentum(crewId) >= 1) {
  game.fitgd.api.action.push({ crewId, type: 'extra-die' });
  ui.notifications.info('Auto-pushed! Used 1 Momentum');
}

// Then open dialog as normal
const { ActionRollDialog } = await import(...);
```

### Multi-Action Macros

Combine multiple actions:

```javascript
// Shoot + Push if high Momentum
const momentum = game.fitgd.api.query.getMomentum(crewId);

if (momentum >= 5) {
  game.fitgd.api.action.push({ crewId, type: 'extra-die' });
}

// Open roll dialog
const { ActionRollDialog } = await import('./systems/forged-in-the-grimdark/module/dialogs.mjs');
const dialog = new ActionRollDialog(characterId, crewId);
dialog.render(true);

setTimeout(() => {
  dialog.element.find('[name="action"]').val('shoot').trigger('change');
}, 100);
```

## Future Enhancements

Potential future drag-and-drop sources:

- **Equipment** - Quick use item macro
- **Clocks** - Advance clock by 1 segment
- **Crew actions** - Add Momentum, Perform Reset
- **Harm clocks** - Quick recovery macro

## Comparison to Manual Macros

### Drag-and-Drop (This Feature)

✅ **Pros:**
- Instant macro creation
- No coding needed
- Automatically bound to character
- Correct API calls generated
- Visual, intuitive

❌ **Cons:**
- Limited customization
- Can't add complex logic
- One action per macro

### Manual Macros (See MACROS.md)

✅ **Pros:**
- Full customization
- Complex logic possible
- Multi-action workflows
- Conditional behavior

❌ **Cons:**
- Requires JavaScript knowledge
- Manual maintenance
- Slower to create

### Best Approach

**Use both!**

1. **Drag-and-drop** for common actions (shoot, command, lean into trait)
2. **Manual macros** for complex workflows (Rally with conditions, multi-step sequences)
3. **Edit dragged macros** to add small customizations

## Example Hotbar Setup

### Combat-Focused Character

| Slot | Macro | Type |
|------|-------|------|
| 1 | Shoot | Action Roll |
| 2 | Skirmish | Action Roll |
| 3 | Command | Action Roll |
| 4 | Survey | Action Roll |
| 5 | Lean into "Veteran Soldier" | Lean Trait |
| 6 | Lean into "Survived Ambush" | Lean Trait |
| 7 | Rally (Manual) | Custom |
| 8 | Flashback (Manual) | Custom |
| 9 | Check Momentum (Manual) | Custom |
| 10 | Add Momentum +2 (Manual GM) | Custom |

### Social/Technical Character

| Slot | Macro | Type |
|------|-------|------|
| 1 | Sway | Action Roll |
| 2 | Consort | Action Roll |
| 3 | Tech | Action Roll |
| 4 | Study | Action Roll |
| 5 | Finesse | Action Roll |
| 6 | Lean into "Con Artist" | Lean Trait |
| 7 | Lean into "Tech Specialist" | Lean Trait |
| 8 | Flashback (Manual) | Custom |
| 9 | Rally (Manual) | Custom |
| 10 | Check Momentum (Manual) | Custom |

---

**Happy dragging!** 🎲
