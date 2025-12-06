# UI Component: Equipment Sheet Dialog

## Overview
The **Equipment Sheet Dialog** is a reusable interface for creating and editing equipment items. It serves as the bridge between Foundry VTT's Item system and the game's equipment mechanics, allowing both GMs and players to manage equipment items with role-based permissions.

## Purpose

### Design Philosophy
- **Single Dialog for Create/Edit**: Same interface used for creating new items and editing existing ones
- **Foundry Integration**: Works with Foundry Items of "equipment" type
- **Role-Based Access**: Different capabilities for GM vs Player
- **Compendium Compatible**: Items can be saved to compendium for reuse

### Usage Contexts
1. **Character Sheet**: Double-click item to edit, "Create Equipment" button to create from scratch, "Browse Equipment" to add from compendium
2. **Compendium Management**: Create equipment templates for reuse
3. **World Item Creation**: GM creates equipment items in world database
4. **Equipment Browser**: Add items from compendium to character

## Foundry Items Integration

### Equipment as Foundry Items

**Item Type**: `"equipment"` (custom item type in Foundry system)

**Data Model**:
```javascript
{
  name: string,           // Display name
  type: "equipment",      // Foundry item type
  img: string,            // Image path (optional, not used in display)
  system: {
    category: string,     // "active" | "passive" | "consumable"
    tier: string,         // "common" | "rare" | "epic"
    slots: number,        // Load cost (default: 1)
    bonuses: {
      dice: number,       // Dice bonus (e.g., +2d)
      position: number,   // Position modifier (e.g., +1 or -1)
      effect: number,     // Effect modifier (e.g., +1)
    },
    description: string,  // Flavor text
  },
  // Redux state tracked separately:
  // - equipped (on character)
  // - locked (since last Reset)
  // - consumed (for Consumables)
}
```

**Storage Options**:
- **Character Items**: Owned by specific Foundry Actor (character)
- **World Items**: Available in world database
- **Compendium**: Packaged for reuse across worlds

**Item Ownership**:
- Items added to character become owned items on the Foundry Actor
- Redux tracks equipped/locked/consumed status separately from Foundry Item
- Foundry Item stores static properties (name, category, bonuses)

## Field Specifications

### Form Fields

| Field | Type | Required | Options | Default | Notes |
|-------|------|----------|---------|---------|-------|
| **Name** | Text Input | Yes | - | "New Equipment" | Display name |
| **Description** | Text Area | No | - | "" | Flavor text, narrative details |
| **Category** | Dropdown | Yes | Active / Passive / Consumable | Active | Determines usage pattern |
| **Tier** | Dropdown | Yes | Common / Rare / Epic | Common | Affects momentum cost on first lock |
| **Slots** | Number Input | Yes | 1-10 | 1 | Load cost (typical range 1-3) |
| **Dice Bonus** | Number Input | No | -3 to +3 | 0 | Dice pool modifier (+2d, -1d, etc.) |
| **Position Modifier** | Number Input | No | -2 to +2 | 0 | Position steps (+1, -1, etc.) |
| **Effect Modifier** | Number Input | No | -2 to +2 | 0 | Effect levels (+1, -1, etc.) |

### Field Validation

**Name**:
- Must not be empty
- Max length: 50 characters
- Trimmed whitespace

**Slots**:
- Must be positive integer (min: 1)
- Typical range: 1-3 (allow up to 10 for edge cases)
- Default: 1

**Bonuses**:
- Can be zero (no bonus)
- Can be negative (penalties)
- Can combine multiple bonuses (e.g., +2d and -1 Position for Heavy Bolter)

**Category + Tier Combinations**:
- All combinations valid
- GM can set any tier for any category
- Players restricted to Common tier creation

## Access Control

### Player Capabilities

**Can Create**:
- New equipment items (Common tier only)
- Add created items to own character
- Recommendation: Players create Common items for personal use

**Can Edit**:
- Own Common items (if unlocked)
- Cannot edit item if locked
- Cannot edit Rare/Epic items (even if self-created)

**Cannot**:
- Edit item properties of Rare/Epic items
- Remove locked items from character
- Change item tier
- Edit items owned by other characters

**Enforcement**:
- UI-level: Dialog fields disabled for non-editable items
- Redux-level: Actions validate user permissions before applying changes

### GM Capabilities

**Full Access**:
- Create items of any tier
- Edit any item property (name, category, tier, bonuses, slots)
- Change item tier (e.g., make Rare item Common for specific character)
- Remove any item from any character
- Override locks (can unequip locked items)

**No Restrictions**:
- No validation on GM edits
- No momentum costs
- Can create Epic items (cannot be acquired via flashback by players)

**Use Cases**:
- Adjust item tier for character-appropriate gear (veteran soldier gets Rare weapon as Common)
- Create campaign-specific equipment
- Balance items by tweaking bonuses
- Manage equipment load by adjusting slots

## Usage Contexts

### Character Sheet Integration
*See: [Character Sheet](./character-sheet.md)*

**Opening Dialog**:
- **Create New**: Click "Create Equipment" button → Opens dialog in create mode
- **Edit Existing**: Double-click item in equipment list → Opens dialog in edit mode

**Create Mode**:
- **GM**: All fields empty/default values, full control over Tier/Modifiers
- **Player (Restricted)**: Simplified interface
  - Choose Type: Active (+1d) or Passive (No Bonus)
  - Name, Slots, Description input
  - Automatically sets Tier=Common and appropriate Category/Modifiers
- "Create" button at bottom
- On submit: Creates Foundry Item, adds to character, closes dialog
- Item starts unlocked and unequipped (player must equip on Character Sheet)

**Edit Mode**:
- Fields pre-populated with item data
- "Save" button at bottom
- On submit: Updates Foundry Item properties, broadcasts change, closes dialog
- Role-based field disabling (player can't edit Rare/Epic)

**Post-Creation Flow**:
1. Player creates item via dialog
2. Item added to character's items list (unequipped)
3. Player equips item via checkbox on Character Sheet
4. Item available for use in rolls (appears in dropdowns if Active, or in GM grid if Passive)

### Compendium Management

**Creating Compendium Items**:
- GM opens compendium, creates new equipment item
- Uses Equipment Sheet dialog to define properties
- Item saved to compendium for reuse
- Players can drag-drop from compendium to character

**Editing Compendium Items**:
- GM opens compendium, double-clicks item
- Equipment Sheet dialog opens in edit mode
- Changes affect compendium template (not existing character items)
- Characters using that item retain old properties until GM manually updates

**Compendium Organization**:
- Separate compendia for weapon types, armor, consumables (optional)
- Or single "Equipment" compendium with items tagged by category

### Equipment Browser

**Browser Dialog** (if implemented):
- Shows list/grid of compendium equipment
- Uses Equipment Row View Template for display
- Player clicks "Add to Character" → Item added to character
- Opens Equipment Sheet dialog if customization needed

**Flow**:
1. Player opens Equipment Browser from Character Sheet
2. Browses compendium items (filtered by tier, category, etc.)
3. Selects item → Added to character as unequipped
4. Player equips via Character Sheet

## Bridge API Integration

### Creating Items

**Action Sequence**:
1. User fills form, clicks "Create"
2. Frontend creates Foundry Item via Foundry API
3. Item added to character's items array
4. Optional: Dispatch Redux action to sync state (if needed)
5. Character Sheet refreshes to show new item

**Code Pattern** (implementation reference):
```javascript
// Create Foundry Item
const itemData = {
  name: formData.name,
  type: "equipment",
  system: {
    category: formData.category,
    tier: formData.tier,
    slots: formData.slots,
    bonuses: {
      dice: formData.diceBonus,
      position: formData.positionModifier,
      effect: formData.effectModifier,
    },
    description: formData.description,
  },
};

await actor.createEmbeddedDocuments("Item", [itemData]);
// Character Sheet auto-refreshes via Foundry hooks
```

### Editing Items

**Action Sequence**:
1. User modifies fields, clicks "Save"
2. Validate user permissions (player can't edit Rare/Epic)
3. Update Foundry Item via Foundry API
4. Broadcast change to all clients
5. Character Sheets refresh to reflect new properties

**Code Pattern**:
```javascript
// Update Foundry Item
await item.update({
  name: formData.name,
  system: {
    category: formData.category,
    tier: formData.tier,
    slots: formData.slots,
    bonuses: formData.bonuses,
    description: formData.description,
  },
});
// Auto-broadcasts to all clients via Foundry
```

**Bridge API Not Required**:
- Foundry Item updates broadcast automatically
- Character Sheet subscribed to Foundry Actor updates
- Redux state (equipped, locked, consumed) stored separately
- Equipment Sheet only modifies Foundry Item properties, not Redux state

## Visual Design

### Dialog Layout

**Header**:
- Title: "Create Equipment" or "Edit Equipment: [Name]"
- Close button (X)

**Body** (Form):
- Organized in logical sections:
  1. **Identity**: Name, Description
  2. **Classification**: Category, Tier, Slots
  3. **Bonuses**: Dice, Position, Effect (collapsible or always visible)

**Footer**:
- "Cancel" button (closes dialog, discards changes)
- "Create" / "Save" button (submits form, applies changes)

### Field Styling

**Disabled Fields** (Player editing Rare/Epic):
- Grayed out, non-interactive
- Tooltip: "Only GM can edit Rare/Epic items"

**Validation Feedback**:
- Disable fields based on permissions
- Show warning message if read-only

### Submission
- Validate all fields
- Create/update Foundry Item
- Close dialog on success
- Show error message on failure (don't close dialog)

## Edge Cases & Pitfalls

**Editing Locked Items**:
- Player cannot edit locked items (even if Common)
- GM can edit locked items without restriction
- Lock status doesn't prevent editing properties, only prevents unequipping

**Changing Tier After Equipped**:
- GM can change item tier (Rare → Common) for specific character
- If item already locked, no momentum refund (momentum already spent)
- If item unlocked, next lock will use new tier cost

**Negative Bonuses (Penalties)**:
- Valid for Heavy Weapons, bulky armor, etc.
- Example: Heavy Bolter (+2d, -1 Position) - powerful but unwieldy
- Display in Equipment Row View Template with red/warning styling

**Slot Changes on Equipped Items**:
- GM changes item slots while equipped
- May cause character to exceed load limit
- Character Sheet validates on next equip/unequip attempt
- Optional: Show warning to GM when making this change

**Item Deletion**:
- Player cannot delete locked items (Redux-level enforcement)
- GM can delete any item
- Deleting equipped item: Redux cleans up equipped/locked state

## Rules Integration

*Primary Source: [vault/rules_primer.md - Equipment](../vault/rules_primer.md#equipment)*

**Tier → Momentum Cost**:
- Common: 0 Momentum on first lock
- Rare: 1 Momentum on first lock (requires Trait justification narratively)
- Epic: 1 Momentum on first lock (cannot be acquired via flashback, must be earned)

**Category → Usage Pattern**:
- Active: Player selects in dice pool dropdown
- Passive: GM approves during roll conversation
- Consumable: Single-use, depletes on lock

**Slots → Load Limit**:
- Default 5 slots per character
- Forces strategic choices (bring heavy weapon or multiple tools?)
- All categories count toward load

**Bonuses → Mechanical Effect**:
- Dice: Adds/removes dice from pool
- Position: Improves/worsens Position by steps
- Effect: Improves/worsens Effect by levels
- Can combine multiple bonuses for complex items
