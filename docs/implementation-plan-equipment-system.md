# Implementation Plan: Equipment System Overhaul

## Overview

Implementation of three-category equipment system with slot-based load management and first-lock momentum costs.

### Key Changes

1. **Three Categories**: Active, Passive, Consumable (remove old categories)
2. **Slot-Based Load**: Items occupy slots (default 1 slot), character limit 5 slots
3. **Locking on Use**: Items lock when used in roll, not when equipped
4. **First-Lock Cost**: 1M for Rare/Epic on first lock between Resets
5. **Unified Dropdown**: Secondary Approach contains Approaches + Active + Consumable
6. **GM Passive Grid**: Separate grid for GM to approve one Passive per roll
7. **Equipment Row View**: Reusable template with context-specific visibility
8. **Character Sheet Only**: All equipment management on Character Sheet (no dialog)

---

## Phase 1: Redux State & Types

### Implementation

**Types** (`src/types/equipment.ts`):
- [ ] `EquipmentCategory`: `'active' | 'passive' | 'consumable'`
- [ ] Remove old categories (weapon, heavy-weapon, etc.)
- [ ] Add `slots: number` to Equipment interface
- [ ] Add `EquipmentState` interface:
  ```typescript
  interface EquipmentState {
    itemId: string;
    equipped: boolean;
    locked: boolean;
    consumed: boolean;
  }
  ```

**Character State** (`src/slices/characterSlice.ts`):
- [ ] Change `equipment: string[]` to `equipment: EquipmentState[]`
- [ ] Add `loadLimit: number` (default 5)

**Game Config** (`src/config/gameConfig.ts`):
- [ ] Remove old `equipment.categories` object
- [ ] Update `momentumCostByTier`: `{ common: 0, rare: 1, epic: 1 }`
- [ ] Add `character.defaultLoadLimit: 5`

### Key Tests

- [ ] EquipmentState has correct structure
- [ ] Character equipment is EquipmentState[] not string[]
- [ ] gameConfig has correct momentum costs

### Type Check
```bash
pnpm run type-check:core
```

---

## Phase 2: Equipment Logic & Selectors

### Implementation

**Actions** (`src/slices/characterSlice.ts`):
- [ ] `equipItem(characterId, itemId)` - set equipped=true if within load
- [ ] `unequipItem(characterId, itemId)` - set equipped=false if not locked
- [ ] `lockItem(characterId, itemId)` - set locked=true
- [ ] `consumeItem(characterId, itemId)` - set consumed=true (Consumables)
- [ ] `unlockAllEquipment(characterId)` - set locked=false for all (on Reset)
- [ ] `replenishConsumables(characterId)` - set consumed=false for all (on Reset)

**Validators** (`src/validators/equipmentValidator.ts`):
- [ ] `canEquipItem(character, item)` - check load limit
- [ ] `canUnequipItem(character, itemId)` - check not locked
- [ ] `calculateLoadUsed(character, items)` - sum slots

**Selectors** (`src/selectors/equipmentSelectors.ts`):
- [ ] `selectActiveEquipment(state, characterId)` - equipped Active items
- [ ] `selectPassiveEquipment(state, characterId)` - equipped Passive items
- [ ] `selectConsumableEquipment(state, characterId)` - equipped Consumables (not consumed)
- [ ] `selectLoadUsed(state, characterId)` - total slots used
- [ ] `selectFirstLockCost(state, characterId, itemIds[])` - calculate 1M per unlocked Rare/Epic

### Key Tests

- [ ] `canEquipItem` allows when under load limit
- [ ] `canEquipItem` prevents when would exceed load
- [ ] `canUnequipItem` prevents unequipping locked items
- [ ] `selectFirstLockCost` returns 0 for Common or locked items
- [ ] `selectFirstLockCost` returns 1 per unlocked Rare/Epic item
- [ ] `lockItem` sets locked=true
- [ ] `unlockAllEquipment` sets locked=false for all items
- [ ] `replenishConsumables` sets consumed=false for Consumables

### Type Check
```bash
pnpm run type-check:core
```

---

## Phase 3: Equipment Row View Template

### Implementation

**Template** (`foundry/templates/partials/equipment-row-view.hbs`):
- [ ] Create reusable partial with configurable elements
- [ ] Elements: name, category icon, tier badge, bonuses, locked icon, equipped checkbox, slots, description
- [ ] Remove image thumbnails entirely
- [ ] Support three contexts: Character Sheet (full), Dropdown (condensed), GM Grid (approval)

**Config Helper** (`foundry/module/helpers/equipmentTemplateConfig.ts`):
- [ ] `characterSheet` config: all elements visible
- [ ] `dropdown` config: name + bonuses + category icon only
- [ ] `gmPassiveGrid` config: name + tier + bonuses + locked icon + description + radio button

**CSS** (`foundry/styles/equipment-row-view.css`):
- [ ] Category icon styles (active/passive/consumable)
- [ ] Tier badge styles (common/rare/epic colors)
- [ ] Bonus chip styles (positive/negative)
- [ ] Locked icon styles

### Key Tests

- [ ] Template renders with all three configs
- [ ] Locked item shows lock icon, not checkbox
- [ ] Category icons correct for each category
- [ ] No image thumbnails present

### Type Check
```bash
pnpm run type-check:foundry
```

---

## Phase 4: Character Sheet Equipment

### Implementation

**Character Sheet** (`foundry/module/widgets/character-sheet.mjs`):
- [ ] Add load display header: `"{{loadUsed}}/{{loadLimit}} slots"`
- [ ] Render equipment list using Equipment Row View Template
- [ ] Sort order: Passive → Active → Consumable (alphabetical within groups)
- [ ] Add "Show Equipped Only" filter checkbox
- [ ] Remove Equipment Management Dialog references

**Event Handlers**:
- [ ] `_onToggleEquipped`: Validate load limit, prevent unequipping locked
- [ ] `_onAddEquipment`: Open Equipment Sheet Dialog (create mode)
- [ ] `_onEditEquipment`: Open Equipment Sheet Dialog (edit mode)
- [ ] `_onRemoveEquipment`: Prevent removing locked items (player only)

**Template** (`foundry/templates/character-sheet.hbs`):
- [ ] Equipment header with load display
- [ ] Equipment list using partial: `{{> equipment-row-view this}}`
- [ ] Remove Equipment Management Dialog template

### Key Tests

- [ ] Equipment list sorts correctly (Passive → Active → Consumable)
- [ ] Load display updates when equipping/unequipping
- [ ] Equipping when at limit shows error
- [ ] Unequipping locked item shows error and prevents action
- [ ] Locked items show lock icon, checkbox disabled
- [ ] Filter checkbox hides unequipped items

### Type Check
```bash
pnpm run type-check:foundry
```

---

## Phase 5: Player Action Widget Equipment

### Implementation

**Secondary Dropdown** (`foundry/module/widgets/player-action-widget.mjs`):
- [ ] Build unified dropdown with order:
  1. Secondary Approaches (Force/Guile/Focus/Spirit - minus primary)
  2. Visual separator
  3. Active equipment (using Equipment Row View Template)
  4. Consumable equipment (not depleted, using Equipment Row View Template)
- [ ] Clear secondary selection if primary changes

**GM Passive Grid** (`foundry/templates/partials/gm-passive-grid.hbs`):
- [ ] Two-column grid: Equipment Row View + Radio button
- [ ] Show all equipped Passive items (locked or unlocked)
- [ ] Location: Below Position/Effect dropdowns
- [ ] Visibility: GM only

**Dice Pool Calculation**:
- [ ] Add secondary bonus (approach rating or equipment dice bonus)
- [ ] Add approved Passive bonus (if GM selected)

**Current Plan Display**:
- [ ] Format: `[Primary] + [Secondary] + [Passive] = [Total]d`
- [ ] Example: `Force + Chainsword + Power Armor = 6d`
- [ ] Show first-lock cost if applicable: `"First-lock: 2M"`

**Roll Transaction** (`_onRoll`):
- [ ] Validate sufficient Momentum for equipment locks
- [ ] Calculate first-lock cost (1M per unlocked Rare/Epic)
- [ ] Lock selected Active/Passive/Consumable items
- [ ] Mark Consumables as consumed
- [ ] Spend total Momentum (including lock costs)
- [ ] Use `executeBatch` for atomic transaction

### Key Tests

- [ ] Dropdown contains approaches + equipment in correct order
- [ ] Depleted Consumables filtered from dropdown
- [ ] Locked items still appear (can be used multiple times)
- [ ] GM sees Passive grid, Player doesn't
- [ ] GM can approve one Passive via radio button
- [ ] Approved Passive appears in Current Plan
- [ ] Dice pool includes equipment bonuses
- [ ] First-lock cost calculated correctly (0M, 1M, 2M scenarios)
- [ ] Roll validation fails if insufficient Momentum for locks
- [ ] Equipment locks on roll commit
- [ ] Consumable marked consumed on roll commit

### Type Check
```bash
pnpm run type-check:foundry
```

---

## Phase 6: Equipment Sheet Dialog

### Implementation

**Dialog** (`foundry/module/dialogs/equipment-sheet-dialog.mjs`):
- [ ] Create mode (empty form) and Edit mode (pre-filled)
- [ ] Fields: Name, Description, Category, Tier, Slots, Bonuses
- [ ] Role-based access: Player can only create/edit Common items
- [ ] GM can edit all items, change tier

**Form Validation**:
- [ ] Name required, max 50 chars
- [ ] Slots min 1
- [ ] Player restricted to Common tier
- [ ] Bonuses can be negative (penalties)

**Integration**:
- [ ] Character Sheet "Add Equipment" button opens dialog (create)
- [ ] Character Sheet double-click item opens dialog (edit)
- [ ] Dialog creates/updates Foundry Item on submit

**Template** (`foundry/templates/dialogs/equipment-sheet-dialog.hbs`):
- [ ] Form with all fields
- [ ] Tier dropdown disabled if player editing Rare/Epic
- [ ] Submit button ("Create" or "Save")

### Key Tests

- [ ] Create mode opens with empty form
- [ ] Edit mode opens with pre-filled data
- [ ] Name validation works
- [ ] Player cannot create Rare/Epic items
- [ ] Player cannot edit Rare/Epic items
- [ ] GM can edit any item
- [ ] Submit creates Foundry Item (create mode)
- [ ] Submit updates Foundry Item (edit mode)

### Type Check
```bash
pnpm run type-check:foundry
```

---

## Phase 7: Momentum Reset Integration

### Implementation

**Reset Action** (`src/slices/crewSlice.ts` or dedicated):
- [ ] `momentumReset(crewId)`:
  - Set momentum to 5
  - Unlock all equipment for all crew characters
  - Replenish all Consumables for all crew characters

**Integration**:
- [ ] Update Reset button handler to call `momentumReset` via Bridge API
- [ ] Broadcast to all clients
- [ ] Character Sheets auto-refresh

### Key Tests

- [ ] Reset sets momentum to 5
- [ ] Reset unlocks all equipment
- [ ] Reset replenishes all Consumables
- [ ] Reset broadcasts to all clients

### Type Check
```bash
pnpm run type-check:all
```

---

## Phase 8: Final Integration & Testing

### GM + Player Testing

Test each scenario with both GM and Player clients:

**Scenario 1: Equipment Locking**
1. Player equips Rare weapon on Character Sheet
2. Player uses weapon in roll
3. Weapon locks (1M spent, checkbox disabled)
4. Player attempts to unequip → Error shown
5. GM initiates Reset → Weapon unlocks

**Scenario 2: Load Limit**
1. Player has 4/5 slots used
2. Player equips 2-slot item → Error (would be 6/5)
3. Player unequips 1-slot item → Success (3/5)
4. Player equips 2-slot item → Success (5/5)

**Scenario 3: GM Passive Approval**
1. Player equips Passive armor
2. GM sees armor in Passive grid
3. GM selects armor via radio button
4. Player sees armor in Current Plan
5. Roll commits → Armor locks, bonus applied

**Scenario 4: Consumable Depletion**
1. Player equips Consumable grenade
2. Player selects grenade in dropdown
3. Roll commits → Grenade locks and depletes
4. Grenade grayed out on Character Sheet, not in dropdown
5. Reset → Grenade replenishes

**Scenario 5: First-Lock Cost**
1. Crew has 2 Momentum
2. Player selects unlocked Rare Active + GM approves unlocked Rare Passive
3. Current Plan shows "First-lock: 2M"
4. Roll commits → 2M spent, both items lock
5. Player uses same items again → No additional cost

### Build & Type Check
```bash
pnpm run type-check:all
pnpm run build
```

- [ ] All type checks pass
- [ ] Build succeeds
- [ ] No new TypeScript errors

---

## Acceptance Criteria

**Phase 1-2 (Redux)**:
- [ ] Equipment types correct (Active/Passive/Consumable)
- [ ] Slot system works (items occupy slots, character has limit)
- [ ] Locked/consumed flags in state
- [ ] Selectors return correct filtered results
- [ ] First-lock cost calculation accurate

**Phase 3-4 (Character Sheet)**:
- [ ] Equipment Row View Template reusable across contexts
- [ ] Character Sheet equipment management works
- [ ] Load validation prevents over-equipping
- [ ] Locked items cannot be unequipped

**Phase 5 (Player Action Widget)**:
- [ ] Unified dropdown contains approaches + equipment
- [ ] GM Passive grid functional
- [ ] Dice pool includes equipment bonuses
- [ ] Equipment locks on roll commit
- [ ] First-lock costs charged correctly

**Phase 6 (Equipment Sheet)**:
- [ ] Dialog creates/edits Foundry Items
- [ ] Role-based access enforced

**Phase 7-8 (Reset & Integration)**:
- [ ] Reset unlocks all equipment
- [ ] Reset replenishes Consumables
- [ ] All 5 GM+Player scenarios pass
- [ ] Multi-client sync works

---

## Implementation Order

1. **Redux Foundation** (Phases 1-2): ~1 week
2. **UI Components** (Phases 3-4): ~1 week
3. **Widget Integration** (Phases 5-6): ~1.5 weeks
4. **Reset & Testing** (Phases 7-8): ~0.5 week

**Total: ~4 weeks** (single developer)

---

## Command Reference

```bash
# Type checks
pnpm run type-check:core       # Redux layer
pnpm run type-check:foundry    # Foundry layer
pnpm run type-check:all        # All

# Tests
pnpm test                      # Run all tests
pnpm test --watch              # Watch mode

# Build
pnpm run build:core            # Redux
pnpm run build:foundry         # Foundry
pnpm run build                 # All
```
