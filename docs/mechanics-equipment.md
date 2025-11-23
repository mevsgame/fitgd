# Mechanic: Equipment Management

## Overview
Equipment in *Forged in the Grimdark* uses a **slot-based load system** with three distinct categories. Players manage their loadout on the Character Sheet, selecting Active equipment during rolls and having Passive equipment approved by the GM. Items lock when used and may cost Momentum (for Rare/Epic first use).

## Architecture & State

### State Slices
- **`characterSlice`**: Stores equipped items (list of item IDs), locked status per item, consumed flags for Consumables
- **`crewSlice`**: Stores Momentum and load limit setting (default 5 slots, configurable per crew)

### Selectors
- `selectEquippedItems(characterId)`: Returns all equipped items
- `selectActiveEquipment(characterId)`: Returns equipped Active items
- `selectPassiveEquipment(characterId)`: Returns equipped Passive items
- `selectConsumableEquipment(characterId)`: Returns equipped Consumable items
- `selectLoadUsed(characterId)`: Calculates total slots occupied
- `selectLockedItems(characterId)`: Returns items locked since last Reset

### UI Components
- **Equipment Row View Template**: Reusable Handlebars partial for displaying items (see below)
- **Character Sheet Equipment Section**: Primary interface for equipping/unequipping
- **Player Action Widget**: Active selection dropdown + GM Passive approval grid
- **Equipment Sheet (Foundry Item Sheet)**: Editor for item properties (GM/Player access)

## Equipment Categories

All equipment falls into exactly three categories:

### Active Equipment
- **Purpose**: Gear used directly in actions (weapons, tools, devices)
- **Usage**: Player selects from dropdown in Player Action Widget as "other thing" influencing the dice pool
- **Locks**: When selected in dice pool and roll committed
- **Examples**: Chainsword, Auspex Scanner, Lockpicks, Heavy Bolter

### Passive Equipment
- **Purpose**: Always-on gear (armor, implants, augmentations)
- **Usage**: GM approves one Passive per roll if narratively applicable during roll conversation
- **Locks**: When GM approves and roll committed
- **Examples**: Flak Armor, Cybernetic Limbs, Psy-Ward Implant, Stealth Cloak

### Consumable Equipment
- **Purpose**: Single-use items (grenades, stims, medkits)
- **Usage**: Can be selected like Active equipment, but depletes after use
- **Locks**: When activated and roll committed
- **Depletion**: Remains equipped (occupies slots) but becomes unusable until Reset
- **Examples**: Frag Grenade, Combat Stim, Emergency Medkit

## Equipment Row View Template

### Purpose
A reusable Handlebars partial used consistently across all equipment displays. Different contexts use different visibility configurations to show/hide elements as needed.

### Visual Elements

| Element | Display | Notes |
|---------|---------|-------|
| **Name** | Text | Item name, always visible |
| **Category Icon** | Icon | Active/Passive/Consumable indicator, always visible |
| **Tier Label** | Label/Badge | Common/Rare/Epic, styled distinctly |
| **Bonuses** | Label/Chip | e.g., "+2d", "+1 Position", "+1 Effect" |
| **Locked Icon** | Icon | Appears when item is locked |
| **Equipped Icon** | Icon/Checkbox | Indicates equipped status |
| **Slots** | Text | e.g., "2 slots" (configurable visibility) |
| **Description** | Text | Flavor text (configurable visibility) |

**Note**: No image thumbnails. Removed from all contexts.

### Context Configurations

#### Character Sheet (Full View)
```
✓ Name
✓ Category Icon
✓ Tier Label
✓ Bonuses
✓ Locked Icon (if locked)
✓ Equipped Checkbox
✓ Slots (toggleable - user can show/hide)
✓ Description (toggleable - user can show/hide)
```

#### Player Action Widget Dropdown (Active Selection)
```
✓ Name
✓ Category Icon
✓ Bonuses
✗ Tier, Locked Icon, Slots, Description hidden
```
Display format: `"Chainsword +2d"` or `"Auspex Scanner +1 Effect"`

#### GM Passive Grid (Approval View)
```
✓ Name
✓ Category Icon
✓ Tier Label
✓ Bonuses
✓ Locked Icon (if locked)
✓ Description (toggleable)
✓ Radio Button (for selection)
✗ Slots hidden
```

## Character Sheet Equipment Management

*See also: [Character Sheet](./character-sheet.md) for full Character Sheet documentation*

### Player Capabilities
- **Equip/Unequip**: Toggle equipped status on unlocked items
- **Add Items**: Add new Foundry Items to character (Common recommended for player-created items)
- **Remove Items**: Remove items from character
- **Cannot Edit**: Item properties (category, tier, bonuses, slots) are read-only for players

### GM Capabilities
- **Edit Items**: Full access to edit any item property without restrictions or costs
- **Override States**: Can change tier (e.g., Rare → Common for specific character), category, bonuses
- **No Costs**: GM edits never trigger momentum costs or validation

### Equipment List Display

**Sort Order**: Passive → Consumable → Active (within each group, alphabetical by name)

**Filter Option**: "Show Equipped Only" checkbox to hide unequipped items

**Load Display**: Shows current slots used vs. max (e.g., "3/5 slots")

**Visual States**:
- Equipped items: Checkbox checked, equipped icon visible
- Locked items: Lock icon visible, checkbox disabled
- Depleted Consumables: Grayed out, crossed-off visual style

### Load Validation

When player attempts to equip an item that would exceed load limit:
- **Prevent Action**: Checkbox click does not toggle
- **Show Message**: "Cannot equip: exceeds load limit (6/5 slots)"
- **Visual Feedback**: Brief highlight or shake animation on load display

### Locking Enforcement

When player attempts to unequip a locked item:
- **Prevent Action**: Checkbox does not uncheck
- **Show Message**: "This item is locked until Momentum Reset"
- **Revert State**: Checkbox automatically reverts to checked

## Equipment in Player Action Widget

*See also: [Player Action Widget](./player-action-widget.md) for full roll flow documentation*

### Active Equipment Selection (Dropdown)

**Location**: "Other Thing" dropdown, appears after Primary Approach selection

**Dropdown Order**:
1. Secondary Approaches (Force, Guile, Focus, Spirit - minus the primary Approach selected)
2. **Visual Separator** (horizontal line)
3. Equipped Active items (using Equipment Row View Template - condensed config)

**Display Format**: Uses Equipment Row View Template showing Name + Bonuses + Category Icon

**Selection Behavior**:
- Selecting an Active item adds its bonus to the dice pool
- If item is Rare/Epic and unlocked, will trigger 1 Momentum cost on roll commit
- Selected item appears in Current Plan transaction preview

### Passive Equipment Approval (GM Grid)

**Location**: Below Position and Effect dropdowns in Player Action Widget

**Visibility**: GM view only (player cannot see the grid, only the result)

**Display**: Two-column grid:
- Column 1: Equipment Row View Template (approval config)
- Column 2: Radio button (single selection only)

**Equipment Shown**: All equipped Passive items (locked or unlocked)

**GM Workflow**:
1. GM reviews roll conversation with player
2. GM determines if any Passive equipment is narratively applicable
3. GM selects ONE Passive item via radio button (or none)
4. Approved Passive appears in Current Plan (visible to player)
5. Approved Passive locks on roll commit

**Mechanical Effect**: Approved Passive provides its defined bonus (dice/position/effect) to the roll

## Load & Slots

### Load Limit
- **Default**: 5 slots per character
- **Future**: Configurable per crew (crew-level setting)
- **Display**: "current/max" format (e.g., "3/5 slots")

### Slot Costs
- **Default**: 1 slot per item
- **Custom**: GM can set higher slot costs (e.g., Heavy Bolter = 2 slots)
- **All Categories**: Active, Passive, and Consumable all count toward load limit

### Load Calculation
Sum of slot costs for all equipped items (locked or unlocked).

## Locking & Momentum

### Locking Behavior

**When Items Lock**:
- **Active**: Selected in dice pool and roll committed
- **Passive**: GM approves and roll committed
- **Consumable**: Activated and roll committed

**Lock State**:
- Locked items cannot be unequipped on Character Sheet
- Lock icon appears in Equipment Row View Template
- Lock persists until Momentum Reset

**Purpose**: Prevents reality-bending mid-mission. Once committed to using equipment, it stays equipped.

### Momentum Cost

**Trigger**: First time a Rare or Epic item locks between Resets

**Cost by Tier**:
- Common: **0 Momentum** (free)
- Rare: **1 Momentum**
- Epic: **1 Momentum**

**Timing**: Part of Player Action Widget transaction on roll commit

**One-Time Cost**: If same item locks, unlocks (at Reset), then locks again, pay again. But multiple uses of already-locked item cost nothing additional.

**Example Flow**:
1. Player equips Rare Chainsword (unlocked, no cost)
2. Player selects Chainsword in roll, commits → **Locks, pay 1 Momentum**
3. Player uses Chainsword in another roll → Already locked, **no additional cost**
4. Momentum Reset occurs → Chainsword unlocks
5. Player uses Chainsword again → Locks again, **pay 1 Momentum again**

### Consumable Depletion

When a Consumable locks, it also sets a **consumed flag**:
- Remains equipped (still occupies slots)
- Visual state: grayed out, crossed off, or similar indication of depletion
- Unavailable in dropdowns (filtered out)
- Replenishes at Momentum Reset (consumed flag clears)

## Equipment Item Editor (Foundry Item Sheet)

### Item Properties

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| **Name** | Text | - | Display name |
| **Description** | Text | - | Flavor text |
| **Category** | Dropdown | Active / Passive / Consumable | Determines usage pattern |
| **Tier** | Dropdown | Common / Rare / Epic | Affects momentum cost |
| **Slots** | Number | Default: 1 | Load cost |
| **Bonuses** | Multi-select | Dice (+Xd), Position (+X), Effect (+X) | Can combine multiple |

**Bonus Examples**:
- Chainsword: +2d
- Heavy Bolter: +2d, -1 Position (unwieldy)
- Flak Armor: +1 Position
- Auspex Scanner: +1 Effect

### Access Control

**GM**:
- Full edit access to all fields
- No restrictions or costs
- Can override item tier for specific characters (e.g., make Rare item Common for veteran soldier)

**Player**:
- Can create new items (Common tier recommended)
- Cannot edit properties of existing items
- Can add/remove items from their Character Sheet

### Item Storage
- Items are Foundry VTT Items (standard Foundry data model)
- Can be stored in Compendia for reuse
- Added to character via drag-drop or item creation dialog

## Reset Behavior

### On Momentum Reset

**All Equipment**:
- **Locked flag** removed (items stay equipped but become unlocked)
- **Consumable consumed flag** removed (Consumables become usable again)
- Items remain on character, loadout unchanged

**Player Workflow**:
1. Momentum Reset occurs (GM initiates or team requests)
2. All equipped items unlock
3. All Consumables replenish
4. Player reviews loadout (optional)
5. Player can freely swap unlocked items before next roll
6. First use of Rare/Epic items after Reset may trigger momentum cost again

### Natural Timing
Players typically review/adjust loadout just before their next roll. The system allows this flexibility rather than forcing reorganization at Reset.

## Transaction Flow (Roll Commit)

When a roll is committed in the Player Action Widget:

1. **Build Transaction**:
   - Primary Approach selected
   - Active Equipment selected (optional)
   - Passive Equipment approved by GM (optional)
   - Consumables activated (optional)

2. **Apply Transaction** (atomic, via Bridge API):
   - Lock all equipment used in roll (Active + Passive + Consumables)
   - Set consumed flag on Consumables
   - Calculate momentum cost (1M per Rare/Epic first-lock)
   - Spend momentum
   - Apply roll results
   - Update character state

3. **Broadcast & Refresh**:
   - State changes broadcast to all clients
   - Character Sheets auto-refresh
   - Lock icons appear immediately

### Edge Cases & Pitfalls

**Insufficient Momentum for Rare/Epic Lock**:
- If player has 0 Momentum and commits roll with unlocked Rare item, the transaction fails
- Show error: "Insufficient Momentum to lock [Item Name] (Rare, 1M required)"
- Player must either deselect the item or gain Momentum first

**Equipment Changes During Active Mission**:
- Unlocked items can be swapped freely on Character Sheet mid-mission
- Locked items cannot be unequipped until Reset
- This allows "I grab my backup pistol" flexibility for unused gear

**GM Changing Item Tier**:
- GM can set a Rare item to Common for a specific character
- This makes first-lock cost 0M for that character only
- Useful for character-appropriate gear (e.g., medic always has medkit access)

## Rules Integration

*Primary Source: [vault/rules_primer.md - Equipment](../vault/rules_primer.md#equipment)*

**Three Categories**: Enforces clear equipment roles (Active for player agency, Passive for GM narrative control, Consumable for resource tension)

**Slot-Based Load**: Forces strategic choices (bring heavy weapon or multiple tools?)

**Lock on Use**: Prevents mid-mission reality-bending ("I actually had X equipped all along")

**Momentum Cost on First Lock**: Represents flashback/narrative justification for Rare/Epic gear availability

**Reset Cycle**: Natural reorganization point for loadout without constant micromanagement
