# UI Component: Equipment Row View Template

## Overview
The **Equipment Row View Template** is a reusable Handlebars partial for displaying equipment items consistently across all contexts in the application. It uses configurable visibility flags to show/hide elements based on context, ensuring a single source of truth for equipment display.

## Purpose

### Design Philosophy
- **Single Reusable Component**: One template used everywhere equipment is displayed
- **Context-Aware**: Static visibility configuration per context (not user-toggleable during runtime)
- **No Thumbnails**: Image thumbnails have been removed from all contexts
- **Maintainability**: Changes to equipment display propagate automatically to all uses

### Usage Contexts
1. **Character Sheet**: Full view with all information
2. **Player Action Widget Dropdown**: Condensed view for Active equipment selection
3. **GM Passive Grid**: Approval view for Passive equipment during roll conversation
4. **Future contexts**: Any feature displaying equipment items

## Visual Elements

### Element Specifications

| Element | Type | Always Visible? | Notes |
|---------|------|-----------------|-------|
| **Name** | Text | Yes | Item display name, primary identifier |
| **Category Icon** | Icon | Yes | Visual indicator: Active/Passive/Consumable |
| **Tier Label** | Badge/Label | Context | Common/Rare/Epic, styled with distinct colors |
| **Bonuses** | Chip/Label | Context | e.g., "+2d", "+1 Position", "+1 Effect" |
| **Locked Icon** | Icon | Context | Padlock icon when item is locked |
| **Equipped Icon** | Checkbox/Icon | Context | Checkbox (Character Sheet) or icon indicator |
| **Slots** | Text | Context | e.g., "2 slots", shows load cost |
| **Description** | Text | Context | Flavor text, expandable/collapsible |

**Key Principle**: No image thumbnails in any context.

### Visual Styling

**Category Icons**:
- Active: Weapon/tool icon (e.g., crossed swords, wrench)
- Passive: Shield or gear icon
- Consumable: Vial or consumable indicator

**Tier Labels**:
- Common: Neutral/gray badge
- Rare: Highlighted badge (blue/purple)
- Epic: Prominent badge (gold/orange)

**Bonuses**:
- Displayed as inline chips/tags
- Positive bonuses: Green/positive styling
- Negative bonuses: Red/warning styling
- Format: "+2d", "+1 Pos", "-1 Pos", "+1 Eff"

**Lock Icon**:
- Padlock icon, visually distinct
- Appears in place of or alongside equipped checkbox when locked

**Equipped Indicator**:
- Character Sheet: Interactive checkbox
- Other contexts: Static icon or visual highlight

## Context Configurations

### Character Sheet (Full View)

**Purpose**: Complete equipment management interface

**Visible Elements**:
```
✓ Name (text)
✓ Category Icon
✓ Tier Label (badge)
✓ Bonuses (chips)
✓ Locked Icon (if locked - replaces checkbox)
✓ Equipped Checkbox (if unlocked - interactive)
✓ Slots (toggleable by user)
✓ Description (toggleable by user)
```

**Layout**:
- List/grid format with full information
- Sort order: Passive → Consumable → Active (alphabetical within groups)
- Equipped items shown with checked checkbox or equipped icon
- Locked items show lock icon instead of checkbox (checkbox disabled)

**Toggleable Elements**:
- **Slots**: User can show/hide via UI toggle (e.g., "Show Slots" checkbox)
- **Description**: User can expand/collapse per item (e.g., accordion or expand icon)

**Interactions**:
- Click checkbox: Equip/unequip (if unlocked)
- Double-click item: Open Equipment Sheet dialog for editing (role-based permissions)
- Hover: May show tooltip with additional details

---

### Player Action Widget Dropdown (Active Selection)

**Purpose**: Condensed display for selecting Active equipment as "other thing" in dice pool

**Visible Elements**:
```
✓ Name (text)
✓ Category Icon
✓ Bonuses (chips)
✗ Tier, Locked Icon, Slots, Description hidden
```

**Display Format**:
- Single-line compact format
- Example: `"Chainsword +2d"` or `"Auspex Scanner +1 Effect"`

**Layout**:
- Dropdown list items
- Appears after Secondary Approaches, below a visual separator
- Only equipped Active items shown
- Depleted Consumables filtered out

**Interactions**:
- Click: Select item as dice pool modifier
- Selection appears in Current Plan preview

---

### GM Passive Grid (Approval View)

**Purpose**: Allow GM to approve one Passive equipment item during roll conversation

**Visible Elements**:
```
✓ Name (text)
✓ Category Icon
✓ Tier Label (badge)
✓ Bonuses (chips)
✓ Locked Icon (if locked)
✓ Description (toggleable)
✓ Radio Button (for selection)
✗ Slots hidden
```

**Layout**:
- Two-column grid:
  - Column 1: Equipment Row View Template
  - Column 2: Radio button (single selection)
- Shows all equipped Passive items (locked or unlocked)
- Located below Position and Effect dropdowns in Player Action Widget

**Toggleable Elements**:
- **Description**: GM can expand/collapse to review narrative justification

**Interactions**:
- Select radio button: Approve Passive for current roll
- Only one Passive can be approved per roll
- Selection appears in Current Plan (visible to player)

**Visibility**: GM view only (player cannot see grid, only approved result)

---

## Toggleable Visibility Behavior

### User-Toggleable (Character Sheet)

**Slots Toggle**:
- UI control: Checkbox or toggle switch labeled "Show Slots"
- Affects all items in list simultaneously
- State persists per session (optional: save to user preferences)

**Description Toggle**:
- UI control: Expand/collapse icon per item (e.g., chevron, plus/minus)
- Independent per item (can expand one while others collapsed)
- Default state: Collapsed (to reduce visual clutter)

**Implementation Note**:
- Toggle state stored in component state, not Redux (UI-only concern)
- No persistence required between sessions (defaults to standard state on load)

### Static Configuration (All Other Contexts)

**Dropdown & GM Grid**:
- Visibility is **statically configured** at render time
- No user interaction to show/hide elements
- Template receives configuration object specifying which elements to render

**Configuration Pattern** (implementation reference):
```javascript
// Example configuration object
{
  showTier: true,
  showBonuses: true,
  showSlots: false,
  showDescription: false,
  showLocked: true,
  showEquipped: true,
  interactiveEquipped: false, // radio button vs checkbox
}
```

## Implementation Details

### Handlebars Partial

**File Location**: `foundry/templates/partials/equipment-row-view.hbs` (or similar)

**Template Parameters**:
- `item`: Equipment item data (name, category, tier, bonuses, etc.)
- `config`: Visibility configuration object
- `locked`: Boolean flag for locked state
- `equipped`: Boolean flag for equipped state
- `interactive`: Boolean for interactive controls (checkboxes/radio buttons)

**Rendering Logic**:
- Use Handlebars conditionals to show/hide elements based on `config`
- Apply CSS classes for styling (category icons, tier badges, etc.)
- Handle locked state (show lock icon, disable checkbox)

### CSS Styling

**Category Icons**:
- Use icon font (Font Awesome, game-icons, etc.) or SVG
- Distinct color per category for quick visual identification

**Tier Badges**:
- Badge component with tier-specific background colors
- Small, inline element next to name

**Bonuses**:
- Chip/tag component with positive/negative styling
- Inline display (multiple bonuses shown side-by-side)

**Lock Icon**:
- Positioned where checkbox would normally be
- Visually distinct (red or amber color to indicate restriction)

### State Management

**No Redux State for Visibility Toggles**:
- Toggle states (Slots, Description) are UI-only concerns
- Stored in component state (React state, Handlebars data, etc.)
- Do not persist to Redux or Foundry storage

**Equipment State from Redux**:
- Item locked/equipped status comes from Redux
- Fetched via selectors in each context's `getData()` method

## Integration Points

### Character Sheet
*See: [Character Sheet](./character-sheet.md)*
- Equipment section header shows load ("3/5 slots")
- Full Equipment Row View Template with all elements
- Checkboxes interactive (equip/unequip if unlocked)
- Double-click opens Equipment Sheet dialog

### Player Action Widget
*See: [Player Action Widget](./player-action-widget.md)*
- Active equipment in dropdown (condensed config)
- Passive equipment in GM grid (approval config)
- Selected items appear in Current Plan preview

### Equipment Mechanics
*See: [Equipment Mechanics](./mechanics-equipment.md)*
- Template displays equipment state (locked, equipped, consumed)
- Visual feedback for load validation
- Reflects three equipment categories

## Design Rationale

### Why Single Template?

**Consistency**: Users see equipment displayed identically across all features, reducing cognitive load.

**Maintainability**: Changes to equipment display (add new field, change icon) only require updating one template.

**Testability**: Single template means single set of visual tests, easier to validate correct rendering.

### Why No Thumbnails?

**Visual Clutter**: Thumbnails add significant space without proportional information value.

**Maintenance Burden**: Requires sourcing/creating images for every item.

**Consistency**: Text-based display with icons is more consistent and easier to style.

**Performance**: Faster rendering without image loading.

### Why Configurable Visibility?

**Context-Appropriate Detail**: Dropdown needs brevity, Character Sheet needs completeness.

**Single Source of Truth**: Same data model, different presentation layer.

**Future-Proof**: New contexts can reuse template with custom visibility config.

## Rules Integration

*Primary Source: [vault/rules_primer.md - Equipment](../vault/rules_primer.md#equipment)*

**Visual Representation of Rules**:
- **Categories**: Icon clearly identifies Active/Passive/Consumable role
- **Tiers**: Badge shows Common/Rare/Epic (affects momentum cost)
- **Locked State**: Lock icon enforces "can't change mid-mission" rule
- **Slots**: Visible count reinforces load limit constraints
- **Bonuses**: Clear display of mechanical effects (dice/position/effect)

**State Changes Reflected Immediately**:
- Lock icon appears when item used in roll
- Consumed state (grayed out) visible for depleted Consumables
- Equipped checkbox state syncs with Redux store
