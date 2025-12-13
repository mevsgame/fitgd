# Character Sheet

## Overview
The **Character Sheet** is the primary interface for managing a character's long-term state. Unlike the ephemeral [Player Action Widget](./player-action-widget.md), which focuses on the current moment of action, the sheet handles character advancement, loadout, and trauma.

## Architecture & State

### Data Binding
The sheet does not store state itself. Instead, it acts as a reactive view for the Redux store.
- **Read**: In `getData()`, it fetches the character state from `state.characters.byId[actor.id]`.
- **Write**: User interactions (clicks, inputs) trigger Redux actions via the `FoundryReduxBridge`.

### Unified IDs
The system uses a "Unified ID" strategy where the Foundry Actor ID is identical to the Redux Character ID. This eliminates the need for a mapping layer and simplifies data retrieval.

### Redux Slices
- **`characterSlice`**: Source of truth for traits, equipment, and action dots.
- **`clockSlice`**: Source of truth for Harm and Addiction clocks.
- **`crewSlice`**: Referenced to determine which crew the character belongs to (for Rally mechanics).

## Implementation Details

### Edit Mode
The sheet features an explicit **Edit Mode** for Action Dots.
- **View Mode**: Dots are read-only. Clicking them does nothing (or rolls, in future iterations).
- **Edit Mode**: Clicking a dot updates the rating.
    - *Logic*: Clicking the Nth dot sets rating to N. To reset to 0, click the first dot when the rating is currently 1.
    - *Validation*: The sheet prevents saving if there are unallocated dots remaining.

### Sub-Features

#### Equipment Management

*See also: [Equipment Mechanics](./mechanics-equipment.md) | [Equipment Row View Template](./equipment-row-view-template.md) | [Equipment Sheet Dialog](./equipment-sheet-dialog.md)*

**Visual Layout**:
- **Header**: Shows current load ("3/5 slots") and "Show Equipped Only" filter checkbox
- **Equipment List**: Uses Equipment Row View Template (full configuration)
  - Sort order: Active → Passive → Consumable (alphabetical within groups)
  - All elements visible (name, category icon, tier, bonuses, locked icon, equipped checkbox, toggleable slots/description)
  - No image thumbnails

**Item Management**:
- **Add Items**:
  - Drag-drop from compendium: *Note: Currently creates a raw Foundry Item which does not sync to the Redux store. Use "Create Equipment" or "Browse Equipment" instead.*
  - Click "Create Equipment" button → Opens Equipment Sheet Dialog (create mode, restricted for players)
  - Click "Browse Equipment" button → Opens Equipment Browser
  - Players can create:
    - **Active**: +1d
    - **Passive**: +1d (previously no bonus)
    - **Consumable**: +1d, +1 position
  - GM can create any item tier/category without restriction
- **Edit Items**:
  - Double-click item → Opens Equipment Sheet Dialog (edit mode)
  - Player: Can edit unlocked Common items only
  - GM: Can edit any item (tier, category, bonuses, slots) without restrictions

**Equipping/Unequipping**:
- **Unlocked Items**: Click checkbox to equip/unequip
- **Locked Items**: Checkbox replaced by lock icon (cannot unequip until Reset)
- **Load Validation**:
  - Prevents equipping if exceeds load limit (default 5 slots)
  - Shows message: "Cannot equip: exceeds load limit (X/5 slots)"
  - Visual feedback on load display in header

**Removal Restrictions**:
- Player cannot remove locked items (enforced at Redux level)
- GM can remove any item without restrictions

#### Clock Integration
- **Harm Clocks**: Created via `ClockCreationDialog`.
- **Addiction Clock**: Automatically displayed if it exists in the Redux store.
- **Interactivity**: GM can click clock segments to advance/reduce them directly on the sheet.

#### Drag & Drop
The sheet supports the `dragstart` event to create Macro hotbar shortcuts for:
- **Rolls**: Dragging an Action name creates a roll macro.
- **Traits**: Dragging a Trait creates a "Lean Into Trait" macro.

## Rules Integration
- **Action Ratings**: Enforces the 0-4 dot limit per action.
- **Load Limits**: Sheet enforces load limit (default 5 slots). Characters can own unlimited items but only equip up to load limit. Validation prevents over-equipping.
- **Equipment Categories**: Three categories (Active/Passive/Consumable) with distinct usage patterns.
- **Trauma**: Harm clocks are the primary representation of long-term consequences.
