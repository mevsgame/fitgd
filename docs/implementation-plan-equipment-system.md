# Implementation Plan: Equipment System Overhaul

## Overview

This document outlines the implementation plan for the new three-category equipment system, transitioning from the old augmentation-based model to Active/Passive/Consumable categories with slot-based load management and first-lock momentum costs.

### Key Changes Summary

1. **Three Equipment Categories**: Active, Passive, Consumable (removed weapon, heavy-weapon, precision-tool, etc.)
2. **Slot-Based Load**: Items occupy 1+ slots (default 5 slot limit per character)
3. **Locking on Use**: Items lock when used in roll (not when equipped)
4. **First-Lock Momentum Cost**: 1M per Rare/Epic item on first lock between Resets (not on acquisition)
5. **Unified Dropdown**: Secondary Approach dropdown contains both Approaches and Active/Consumable equipment
6. **GM Passive Approval**: Separate grid for GM to approve one Passive item per roll
7. **Equipment Row View Template**: Reusable component with context-specific visibility
8. **Removed Equipment Management Dialog**: All equipment management on Character Sheet

---

## Phase 1: Redux State Model & Types

### Objectives
- Update equipment type definitions for three categories
- Add slot system to equipment model
- Add locked and consumed flags to character equipment state
- Update selectors for new equipment structure
- Ensure backwards compatibility with existing data (migration if needed)

### Implementation Checklist

#### Type Definitions (`src/types/equipment.ts`)
- [ ] Update `EquipmentCategory` type: `'active' | 'passive' | 'consumable'`
- [ ] Remove old category types: `'weapon'`, `'heavy-weapon'`, `'precision-tool'`, etc.
- [ ] Add `slots: number` field to equipment interface (default: 1)
- [ ] Add `EquipmentState` interface for character-specific state:
  ```typescript
  interface EquipmentState {
    itemId: string;
    equipped: boolean;
    locked: boolean;        // New: locks on use
    consumed: boolean;      // New: for Consumables only
    lockedAt?: number;      // Timestamp of first lock (for tracking)
  }
  ```
- [ ] Update `Equipment` interface to include new fields
- [ ] Update `EquipmentTier` type (keep: `'common' | 'rare' | 'epic'`)
- [ ] Update `EquipmentBonuses` interface (keep existing: dice, position, effect)

#### Character State (`src/slices/characterSlice.ts`)
- [ ] Update `Character` interface:
  ```typescript
  interface Character {
    // ...existing fields
    equipment: EquipmentState[];  // Changed from itemId[] to EquipmentState[]
    loadLimit: number;            // New: default 5, crew-configurable
  }
  ```
- [ ] Add migration logic for existing characters (convert itemId[] to EquipmentState[])

#### Crew State (`src/slices/crewSlice.ts`)
- [ ] Add `loadLimit: number` to Crew interface (default: 5, configurable)
- [ ] Add action to update crew load limit

#### Game Config (`src/config/gameConfig.ts`)
- [ ] Remove `equipment.categories` object (weapon, heavy-weapon, etc.)
- [ ] Update `equipment.momentumCostByTier`:
  ```typescript
  momentumCostByTier: {
    common: 0,
    rare: 1,      // Cost on first lock, not acquisition
    epic: 1,      // Cost on first lock
  }
  ```
- [ ] Add `character.defaultLoadLimit: 5`
- [ ] Add `equipment.defaultSlots: 1`
- [ ] Remove `equipment.augmentationCategories` (augmentations are now Passive)
- [ ] Update `equipment.consumableCategories` (simplified list)

### Unit Tests

#### `tests/unit/types/equipment.test.ts`
- [ ] Test `EquipmentCategory` type accepts only 'active', 'passive', 'consumable'
- [ ] Test `EquipmentState` interface has all required fields
- [ ] Test equipment with slots (default 1, custom values 2-10)
- [ ] Test locked and consumed flags default to false

#### `tests/unit/slices/characterSlice.test.ts`
- [ ] Test character creation with empty equipment array
- [ ] Test adding equipment creates EquipmentState with correct defaults
- [ ] Test equipping item sets equipped=true, locked=false, consumed=false
- [ ] Test migration from old itemId[] to new EquipmentState[] format

#### `tests/unit/config/gameConfig.test.ts`
- [ ] Test DEFAULT_CONFIG has correct equipment momentum costs
- [ ] Test DEFAULT_CONFIG has defaultLoadLimit = 5
- [ ] Test old category configs are removed

### Type Checks
```bash
pnpm run type-check:core
```
- [ ] No new TypeScript errors introduced
- [ ] All equipment references use new EquipmentCategory type
- [ ] All character equipment references use EquipmentState[]

### Acceptance Criteria
- [ ] Types compile without errors
- [ ] All unit tests pass
- [ ] Migration logic tested with sample old data
- [ ] gameConfig.ts reflects new equipment model

---

## Phase 2: Equipment Logic & Selectors

### Objectives
- Implement equipment locking logic
- Implement first-lock momentum cost calculation
- Create selectors for equipment queries (by category, locked status, etc.)
- Implement load calculation with slots
- Implement Consumable depletion logic

### Implementation Checklist

#### Equipment Actions (`src/slices/characterSlice.ts`)
- [ ] `equipItem(characterId, itemId)`: Set equipped=true if within load limit
- [ ] `unequipItem(characterId, itemId)`: Set equipped=false if not locked
- [ ] `lockItem(characterId, itemId, timestamp)`: Set locked=true, lockedAt=timestamp
- [ ] `unlockItem(characterId, itemId)`: Set locked=false (on Reset)
- [ ] `consumeItem(characterId, itemId)`: Set consumed=true (for Consumables)
- [ ] `replenishConsumables(characterId)`: Set consumed=false for all Consumables
- [ ] `unlockAllEquipment(characterId)`: Set locked=false for all items (on Reset)

#### Equipment Validation (`src/validators/equipmentValidator.ts`)
- [ ] `canEquipItem(character, item)`: Check load limit with slots
- [ ] `canUnequipItem(character, itemId)`: Check if item is locked
- [ ] `canRemoveItem(character, itemId)`: Check if item is locked (player restriction)
- [ ] `calculateLoadUsed(character, items)`: Sum slots for equipped items
- [ ] `getFirstLockCost(item, isLocked)`: Return 0 if locked or Common, 1 if Rare/Epic unlocked

#### Selectors (`src/selectors/equipmentSelectors.ts`)
- [ ] `selectEquippedItems(state, characterId)`: Return equipped items only
- [ ] `selectActiveEquipment(state, characterId)`: Filter equipped Active items
- [ ] `selectPassiveEquipment(state, characterId)`: Filter equipped Passive items
- [ ] `selectConsumableEquipment(state, characterId)`: Filter equipped Consumables (not depleted)
- [ ] `selectLockedItems(state, characterId)`: Filter locked items
- [ ] `selectLoadUsed(state, characterId)`: Calculate total slots used
- [ ] `selectLoadAvailable(state, characterId)`: Calculate remaining slots
- [ ] `selectFirstLockCost(state, characterId, itemIds[])`: Calculate total cost for unlocked Rare/Epic items

#### Momentum Cost Calculator (`src/utils/equipmentUtils.ts`)
- [ ] `calculateFirstLockCost(items[], equipmentStates)`:
  ```typescript
  function calculateFirstLockCost(
    items: Equipment[],
    equipmentStates: EquipmentState[]
  ): number {
    return items.reduce((cost, item) => {
      const state = equipmentStates.find(s => s.itemId === item.id);
      if (!state?.locked && (item.tier === 'rare' || item.tier === 'epic')) {
        return cost + 1;
      }
      return cost;
    }, 0);
  }
  ```

### Unit Tests

#### `tests/unit/validators/equipmentValidator.test.ts`
- [ ] Test `canEquipItem` allows equipping when under load limit
- [ ] Test `canEquipItem` prevents equipping when would exceed load limit
- [ ] Test `canEquipItem` accounts for item slots (2-slot item vs 1-slot items)
- [ ] Test `canUnequipItem` allows unequipping unlocked items
- [ ] Test `canUnequipItem` prevents unequipping locked items
- [ ] Test `canRemoveItem` prevents removing locked items (player restriction)
- [ ] Test `calculateLoadUsed` sums slots correctly (1+1+2 = 4 slots)
- [ ] Test `getFirstLockCost` returns 0 for Common items
- [ ] Test `getFirstLockCost` returns 0 for already-locked Rare items
- [ ] Test `getFirstLockCost` returns 1 for unlocked Rare/Epic items

#### `tests/unit/selectors/equipmentSelectors.test.ts`
- [ ] Test `selectEquippedItems` returns only equipped items
- [ ] Test `selectActiveEquipment` filters by category='active' and equipped=true
- [ ] Test `selectPassiveEquipment` filters by category='passive' and equipped=true
- [ ] Test `selectConsumableEquipment` filters by category='consumable', equipped=true, consumed=false
- [ ] Test `selectLockedItems` returns only locked items
- [ ] Test `selectLoadUsed` calculates correct total (multi-slot items)
- [ ] Test `selectFirstLockCost` returns 0 when all items are Common or locked
- [ ] Test `selectFirstLockCost` returns 2 when two unlocked Rare items selected

#### `tests/unit/utils/equipmentUtils.test.ts`
- [ ] Test `calculateFirstLockCost` with all Common items (cost = 0)
- [ ] Test `calculateFirstLockCost` with one unlocked Rare item (cost = 1)
- [ ] Test `calculateFirstLockCost` with unlocked Rare + unlocked Epic (cost = 2)
- [ ] Test `calculateFirstLockCost` with locked Rare item (cost = 0)
- [ ] Test `calculateFirstLockCost` with mix of Common, locked Rare, unlocked Rare (cost = 1)

#### `tests/unit/slices/characterSlice.test.ts`
- [ ] Test `equipItem` action sets equipped=true
- [ ] Test `equipItem` fails if would exceed load limit
- [ ] Test `unequipItem` action sets equipped=false if unlocked
- [ ] Test `unequipItem` fails if item is locked
- [ ] Test `lockItem` action sets locked=true, lockedAt=timestamp
- [ ] Test `unlockItem` action sets locked=false
- [ ] Test `consumeItem` action sets consumed=true for Consumable
- [ ] Test `replenishConsumables` sets consumed=false for all Consumables
- [ ] Test `unlockAllEquipment` sets locked=false for all items

### Type Checks
```bash
pnpm run type-check:core
```
- [ ] All selectors type-safe
- [ ] All validators return correct types
- [ ] All actions properly typed

### Acceptance Criteria
- [ ] All equipment logic tests pass
- [ ] Selectors return correct filtered results
- [ ] Load calculation accurate with multi-slot items
- [ ] First-lock cost calculation correct for all scenarios
- [ ] Type checks pass

---

## Phase 3: Equipment Row View Template (UI Component)

### Objectives
- Create reusable Handlebars partial for equipment display
- Implement context-specific visibility configurations
- Support toggleable elements (slots, description)
- Remove image thumbnails from all contexts

### Implementation Checklist

#### Handlebars Template (`foundry/templates/partials/equipment-row-view.hbs`)
- [ ] Create base template structure with configurable elements:
  ```handlebars
  <div class="equipment-row {{category}}" data-item-id="{{id}}">
    <span class="equipment-name">{{name}}</span>
    <i class="equipment-category-icon {{categoryIcon}}"></i>
    {{#if showTier}}
      <span class="equipment-tier-badge {{tier}}">{{tierLabel}}</span>
    {{/if}}
    {{#if showBonuses}}
      <div class="equipment-bonuses">
        {{#each bonuses}}
          <span class="bonus-chip {{type}}">{{label}}</span>
        {{/each}}
      </div>
    {{/if}}
    {{#if showLocked}}
      {{#if locked}}
        <i class="equipment-locked-icon"></i>
      {{/if}}
    {{/if}}
    {{#if showEquipped}}
      {{#if interactive}}
        <input type="checkbox" class="equipment-equipped-checkbox" {{checked equipped}} {{disabled locked}}>
      {{else}}
        <i class="equipment-equipped-icon {{#if equipped}}equipped{{/if}}"></i>
      {{/if}}
    {{/if}}
    {{#if showSlots}}
      <span class="equipment-slots">{{slots}} slots</span>
    {{/if}}
    {{#if showDescription}}
      <div class="equipment-description {{#unless expanded}}collapsed{{/unless}}">
        {{description}}
      </div>
    {{/if}}
  </div>
  ```

#### CSS Styling (`foundry/styles/equipment-row-view.css`)
- [ ] Base row styling (flexbox layout)
- [ ] Category icon styles (active/passive/consumable colors)
- [ ] Tier badge styles (common=gray, rare=blue, epic=gold)
- [ ] Bonus chip styles (positive=green, negative=red)
- [ ] Locked icon styles (padlock, prominent)
- [ ] Equipped checkbox/icon styles
- [ ] Collapsed/expanded description styles
- [ ] No image thumbnail styles (removed entirely)

#### Configuration Helper (`foundry/module/helpers/equipmentTemplateConfig.ts`)
- [ ] Create config objects for each context:
  ```typescript
  export const EQUIPMENT_ROW_CONFIGS = {
    characterSheet: {
      showTier: true,
      showBonuses: true,
      showLocked: true,
      showEquipped: true,
      showSlots: true,
      showDescription: true,
      interactive: true,
    },
    dropdown: {
      showTier: false,
      showBonuses: true,
      showLocked: false,
      showEquipped: false,
      showSlots: false,
      showDescription: false,
      interactive: false,
    },
    gmPassiveGrid: {
      showTier: true,
      showBonuses: true,
      showLocked: true,
      showEquipped: false,
      showSlots: false,
      showDescription: true,
      interactive: true,  // Radio button
    },
  };
  ```

### Unit Tests

#### `tests/unit/templates/equipmentRowView.test.ts`
- [ ] Test template renders with full config (all elements visible)
- [ ] Test template renders with dropdown config (only name, bonuses, icon)
- [ ] Test template renders with GM grid config (radio button instead of checkbox)
- [ ] Test locked item shows lock icon, not checkbox
- [ ] Test consumed Consumable has depleted visual style
- [ ] Test tier badge has correct class (common/rare/epic)
- [ ] Test category icon has correct class (active/passive/consumable)
- [ ] Test bonuses render as chips with correct styling
- [ ] Test slots display correctly (1 slot, 2 slots, etc.)
- [ ] Test description toggleable (collapsed by default)

### Type Checks
```bash
pnpm run type-check:foundry
```
- [ ] Template config types correct
- [ ] Helper functions properly typed

### Acceptance Criteria
- [ ] Template renders correctly in all three contexts
- [ ] CSS styling matches design specs
- [ ] No image thumbnails present
- [ ] Toggleable elements work correctly
- [ ] Type checks pass

---

## Phase 4: Character Sheet Integration

### Objectives
- Update Character Sheet to use Equipment Row View Template
- Implement equipment list with Passive → Active → Consumable order
- Add load display in header ("3/5 slots")
- Implement equipment equip/unequip with validation
- Remove Equipment Management Dialog
- Add Equipment Sheet Dialog integration

### Implementation Checklist

#### Character Sheet Widget (`foundry/module/widgets/character-sheet.mjs`)
- [ ] Remove references to Equipment Management Dialog
- [ ] Add load display to header: `"{{loadUsed}}/{{loadLimit}} slots"`
- [ ] Add "Show Equipped Only" filter checkbox
- [ ] Implement equipment list using Equipment Row View Template:
  ```javascript
  getData() {
    const character = selectCharacterById(state, this.actor.id);
    const allItems = this.actor.items.filter(i => i.type === 'equipment');
    const equipmentStates = character.equipment;

    // Sort: Passive -> Active -> Consumable
    const sortedItems = allItems.sort((a, b) => {
      const order = { passive: 0, active: 1, consumable: 2 };
      return order[a.system.category] - order[b.system.category];
    });

    const equipmentData = sortedItems.map(item => {
      const state = equipmentStates.find(s => s.itemId === item.id);
      return {
        ...item,
        ...state,
        config: EQUIPMENT_ROW_CONFIGS.characterSheet,
      };
    });

    return {
      character,
      equipment: equipmentData,
      loadUsed: selectLoadUsed(state, character.id),
      loadLimit: character.loadLimit,
    };
  }
  ```

#### Event Handlers
- [ ] `_onToggleEquipped(event)`:
  - Validate load limit before equipping
  - Prevent unequipping locked items
  - Show error message if validation fails
  - Dispatch equip/unequip action via Bridge API
- [ ] `_onAddEquipment(event)`: Open Equipment Sheet Dialog in create mode
- [ ] `_onEditEquipment(event)`: Open Equipment Sheet Dialog in edit mode
- [ ] `_onRemoveEquipment(event)`: Validate not locked, dispatch remove action
- [ ] `_onToggleSlotsVisibility(event)`: Toggle slots display (UI state only)
- [ ] `_onToggleDescription(event)`: Toggle description expansion (per-item UI state)

#### Handlebars Template (`foundry/templates/character-sheet.hbs`)
- [ ] Update equipment section header:
  ```handlebars
  <div class="equipment-header">
    <h3>Equipment</h3>
    <span class="load-display">{{loadUsed}}/{{loadLimit}} slots</span>
    <label>
      <input type="checkbox" name="showEquippedOnly" {{checked showEquippedOnly}}>
      Show Equipped Only
    </label>
  </div>
  ```
- [ ] Replace equipment list with Equipment Row View Template partial:
  ```handlebars
  <div class="equipment-list">
    {{#each equipment}}
      {{> equipment-row-view this}}
    {{/each}}
  </div>
  ```
- [ ] Remove Equipment Management Dialog template references

### Unit Tests

#### `tests/integration/widgets/characterSheet.test.ts`
- [ ] Test equipment list renders in correct order (Passive -> Active -> Consumable)
- [ ] Test load display shows correct values ("3/5 slots")
- [ ] Test equipping item increments load display
- [ ] Test equipping item when at load limit shows error
- [ ] Test unequipping unlocked item decrements load display
- [ ] Test unequipping locked item shows error and prevents action
- [ ] Test locked items show lock icon, checkbox disabled
- [ ] Test "Show Equipped Only" filter hides unequipped items
- [ ] Test slots visibility toggle works
- [ ] Test description expand/collapse per item works
- [ ] Test adding equipment opens Equipment Sheet Dialog
- [ ] Test editing equipment opens Equipment Sheet Dialog with pre-filled data
- [ ] Test removing unlocked item succeeds
- [ ] Test removing locked item fails with error

### Type Checks
```bash
pnpm run type-check:foundry
```
- [ ] Character Sheet widget compiles
- [ ] Event handlers properly typed
- [ ] getData() return type correct

### Acceptance Criteria
- [ ] Character Sheet displays equipment correctly
- [ ] Load validation prevents over-equipping
- [ ] Locked items cannot be unequipped
- [ ] Equipment Management Dialog removed
- [ ] Type checks pass
- [ ] All integration tests pass

---

## Phase 5: Player Action Widget Integration

### Objectives
- Implement unified Secondary Approach dropdown (Approaches + Active + Consumable)
- Implement GM Passive Equipment approval grid
- Update dice pool calculation to include equipment bonuses
- Implement equipment locking transaction on roll commit
- Calculate and display first-lock momentum costs in Current Plan
- Update roll validation to check equipment lock costs

### Implementation Checklist

#### Dropdown Construction (`foundry/module/widgets/player-action-widget.mjs`)
- [ ] Build Secondary Approach dropdown items:
  ```javascript
  _buildSecondaryOptions(primaryApproach) {
    const options = [];

    // Add other approaches
    const approaches = ['force', 'guile', 'focus', 'spirit'];
    approaches.filter(a => a !== primaryApproach).forEach(approach => {
      options.push({
        type: 'approach',
        value: approach,
        label: capitalize(approach),
      });
    });

    // Add separator
    options.push({ type: 'separator' });

    // Add Active equipment
    const activeItems = selectActiveEquipment(state, this.characterId);
    activeItems.forEach(item => {
      options.push({
        type: 'equipment',
        category: 'active',
        value: item.id,
        ...item,
        config: EQUIPMENT_ROW_CONFIGS.dropdown,
      });
    });

    // Add Consumables (not depleted)
    const consumables = selectConsumableEquipment(state, this.characterId);
    consumables.forEach(item => {
      options.push({
        type: 'equipment',
        category: 'consumable',
        value: item.id,
        ...item,
        config: EQUIPMENT_ROW_CONFIGS.dropdown,
      });
    });

    return options;
  }
  ```

#### GM Passive Grid (`foundry/templates/partials/gm-passive-grid.hbs`)
- [ ] Create template for Passive equipment grid:
  ```handlebars
  {{#if isGM}}
    <div class="passive-equipment-grid">
      <h4>Passive Equipment Approval</h4>
      <div class="passive-grid-items">
        {{#each passiveItems}}
          <div class="passive-grid-row">
            <input type="radio" name="approvedPassive" value="{{id}}" {{checked isApproved}}>
            {{> equipment-row-view this}}
          </div>
        {{/each}}
      </div>
    </div>
  {{/if}}
  ```

#### Dice Pool Calculation
- [ ] Update `_calculateDicePool()`:
  ```javascript
  _calculateDicePool() {
    let pool = this.primaryApproach.rating;

    // Add secondary (approach or equipment)
    if (this.secondary) {
      if (this.secondary.type === 'approach') {
        pool += this.secondary.rating;
      } else if (this.secondary.type === 'equipment') {
        pool += this.secondary.bonuses.dice || 0;
      }
    }

    // Add approved Passive
    if (this.approvedPassive) {
      pool += this.approvedPassive.bonuses.dice || 0;
    }

    // Add other modifiers (Push, traits, etc.)
    // ...

    return pool;
  }
  ```

#### Equipment Locking Transaction
- [ ] Update `_onRoll()` to include equipment locking:
  ```javascript
  async _onRoll() {
    // Validate
    const lockCost = this._calculateFirstLockCost();
    if (this.momentum < lockCost + otherCosts) {
      ui.notifications.error(`Insufficient Momentum (need ${lockCost}M to lock equipment)`);
      return;
    }

    // Build equipment lock actions
    const itemsToLock = [];
    if (this.secondary?.type === 'equipment') {
      itemsToLock.push(this.secondary.id);
    }
    if (this.approvedPassive) {
      itemsToLock.push(this.approvedPassive.id);
    }

    // Execute transaction
    const actions = [
      { type: 'crew/spendMomentum', payload: { amount: totalCost } },
      ...itemsToLock.map(id => ({
        type: 'character/lockItem',
        payload: { characterId: this.characterId, itemId: id, timestamp: Date.now() }
      })),
      // Mark Consumables as consumed
      ...(this.secondary?.category === 'consumable' ? [{
        type: 'character/consumeItem',
        payload: { characterId: this.characterId, itemId: this.secondary.id }
      }] : []),
      // Roll result, state transition, etc.
    ];

    await game.fitgd.bridge.executeBatch(actions);
  }
  ```

#### Current Plan Display
- [ ] Update Current Plan to show equipment:
  ```javascript
  _buildCurrentPlan() {
    const parts = [];

    // Primary
    parts.push(capitalize(this.primaryApproach.name));

    // Secondary
    if (this.secondary) {
      if (this.secondary.type === 'approach') {
        parts.push(capitalize(this.secondary.name));
      } else {
        parts.push(this.secondary.name);
      }
    }

    // Approved Passive
    if (this.approvedPassive) {
      parts.push(this.approvedPassive.name);
    }

    const display = `${parts.join(' + ')} = ${this.totalDice}d`;

    // Add costs
    const lockCost = this._calculateFirstLockCost();
    if (lockCost > 0) {
      display += `, First-lock: ${lockCost}M`;
    }

    return display;
  }
  ```

#### Event Handlers
- [ ] `_onPrimaryApproachChange(event)`: Clear secondary selection
- [ ] `_onSecondaryChange(event)`: Update secondary, recalculate dice pool
- [ ] `_onPassiveApprove(event)`: Set approved Passive (GM only)
- [ ] `_onPassiveDeselect(event)`: Clear approved Passive (GM only)

### Unit Tests

#### `tests/integration/widgets/playerActionWidget.test.ts`
- [ ] Test Secondary dropdown contains approaches + equipment in correct order
- [ ] Test Secondary dropdown separator visible between approaches and equipment
- [ ] Test selecting Active equipment adds bonus to dice pool
- [ ] Test selecting Consumable equipment adds bonus to dice pool
- [ ] Test depleted Consumables filtered from dropdown
- [ ] Test locked items still appear in dropdown (can be used multiple times)
- [ ] Test GM sees Passive equipment grid
- [ ] Test Player does not see Passive equipment grid
- [ ] Test GM can approve one Passive item via radio button
- [ ] Test approved Passive appears in Current Plan
- [ ] Test approved Passive bonus added to dice pool
- [ ] Test changing Primary Approach clears Secondary selection
- [ ] Test Current Plan displays equipment correctly ("Force + Chainsword = 4d")
- [ ] Test first-lock cost calculated correctly (0M, 1M, 2M scenarios)
- [ ] Test first-lock cost displayed in Current Plan
- [ ] Test roll validation fails if insufficient Momentum for equipment locks
- [ ] Test roll commits equipment locks atomically
- [ ] Test Consumable marked as consumed on roll commit
- [ ] Test locked items cannot be unequipped on Character Sheet after roll

### Type Checks
```bash
pnpm run type-check:foundry
```
- [ ] Player Action Widget compiles
- [ ] Dropdown options properly typed
- [ ] Equipment lock actions properly typed

### Acceptance Criteria
- [ ] Unified dropdown works correctly
- [ ] GM Passive grid functional
- [ ] Dice pool calculation includes equipment
- [ ] Equipment locks on roll commit
- [ ] First-lock costs calculated and charged
- [ ] Current Plan displays equipment accurately
- [ ] Type checks pass
- [ ] All integration tests pass

---

## Phase 6: Equipment Sheet Dialog

### Objectives
- Create Equipment Sheet Dialog for creating/editing equipment items
- Integrate with Foundry Items system
- Implement role-based access (Player: Common only, GM: all tiers)
- Support create and edit modes
- Validate field inputs

### Implementation Checklist

#### Dialog Class (`foundry/module/dialogs/equipment-sheet-dialog.mjs`)
- [ ] Create dialog class extending Application
- [ ] Constructor accepts mode ('create' | 'edit'), item (if edit), character
- [ ] `getData()` returns form data:
  ```javascript
  getData() {
    return {
      item: this.item || { system: { tier: 'common', category: 'active', slots: 1 } },
      isGM: game.user.isGM,
      canEditTier: game.user.isGM || (!this.item || this.item.system.tier === 'common'),
      mode: this.mode,
    };
  }
  ```

#### Form Template (`foundry/templates/dialogs/equipment-sheet-dialog.hbs`)
- [ ] Name field (required, max 50 chars)
- [ ] Description textarea (optional)
- [ ] Category dropdown (active/passive/consumable)
- [ ] Tier dropdown (common/rare/epic, disabled if player + not Common)
- [ ] Slots number input (min 1, default 1)
- [ ] Bonuses section:
  - [ ] Dice bonus (number, -3 to +3, default 0)
  - [ ] Position modifier (number, -2 to +2, default 0)
  - [ ] Effect modifier (number, -2 to +2, default 0)
- [ ] Submit button ("Create" or "Save")
- [ ] Cancel button

#### Form Validation
- [ ] `_validateForm(formData)`:
  ```javascript
  _validateForm(formData) {
    const errors = [];

    if (!formData.name || formData.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (formData.name.length > 50) {
      errors.push('Name must be 50 characters or less');
    }
    if (formData.slots < 1) {
      errors.push('Slots must be at least 1');
    }
    if (!game.user.isGM && formData.tier !== 'common') {
      errors.push('Players can only create Common items');
    }

    return errors;
  }
  ```

#### Event Handlers
- [ ] `_onSubmit(event)`:
  - Validate form
  - If create mode: Create Foundry Item, add to character
  - If edit mode: Update Foundry Item
  - Close dialog
- [ ] `_onCancel(event)`: Close dialog without changes

#### Integration with Character Sheet
- [ ] Character Sheet "Add Equipment" button opens dialog in create mode
- [ ] Character Sheet equipment double-click opens dialog in edit mode
- [ ] Dialog closes and Character Sheet refreshes on successful save

### Unit Tests

#### `tests/unit/dialogs/equipmentSheetDialog.test.ts`
- [ ] Test create mode opens with empty form
- [ ] Test edit mode opens with pre-filled data
- [ ] Test name validation (required, max length)
- [ ] Test slots validation (min 1)
- [ ] Test tier validation (player restricted to Common)
- [ ] Test GM can set any tier
- [ ] Test player cannot edit Rare/Epic items
- [ ] Test submit in create mode creates Foundry Item
- [ ] Test submit in edit mode updates Foundry Item
- [ ] Test cancel closes dialog without changes
- [ ] Test bonuses can be negative (penalties)
- [ ] Test bonuses can be zero (no bonus)

### Type Checks
```bash
pnpm run type-check:foundry
```
- [ ] Equipment Sheet Dialog compiles
- [ ] Form data types correct
- [ ] Validation types correct

### Acceptance Criteria
- [ ] Dialog creates items correctly
- [ ] Dialog edits items correctly
- [ ] Role-based access enforced
- [ ] Form validation works
- [ ] Type checks pass
- [ ] All unit tests pass

---

## Phase 7: Momentum Reset & Equipment Unlock

### Objectives
- Implement Momentum Reset action that unlocks all equipment
- Implement Consumable replenishment
- Update Reset dialog/flow
- Test Reset behavior with locked equipment

### Implementation Checklist

#### Momentum Reset Action (`src/slices/crewSlice.ts` or dedicated Reset actions)
- [ ] Create `momentumReset(crewId)` action:
  ```javascript
  momentumReset(state, action) {
    const { crewId } = action.payload;
    const crew = state.byId[crewId];

    // Reset momentum to 5
    crew.currentMomentum = DEFAULT_CONFIG.crew.startingMomentum;

    // Unlock all equipment and replenish Consumables for all crew characters
    crew.characters.forEach(characterId => {
      dispatch(unlockAllEquipment({ characterId }));
      dispatch(replenishConsumables({ characterId }));
    });
  }
  ```

#### Reset Flow Integration
- [ ] Update Momentum Reset dialog to mention equipment unlock
- [ ] Update Reset button handler to call `momentumReset()` via Bridge API
- [ ] Broadcast Reset to all clients
- [ ] Character Sheets auto-refresh showing unlocked equipment

### Unit Tests

#### `tests/unit/slices/crewSlice.test.ts`
- [ ] Test `momentumReset` sets momentum to 5
- [ ] Test `momentumReset` unlocks all equipment for all crew characters
- [ ] Test `momentumReset` replenishes all Consumables

#### `tests/integration/momentumReset.test.ts`
- [ ] Test Reset with locked equipment: all items unlock
- [ ] Test Reset with depleted Consumables: all replenish
- [ ] Test Reset with locked Rare item: can be used again (pay 1M on next lock)
- [ ] Test Reset broadcasts to all clients
- [ ] Test Character Sheets refresh showing unlocked equipment

### Type Checks
```bash
pnpm run type-check:all
```
- [ ] Reset actions compile
- [ ] All reset-related code type-safe

### Acceptance Criteria
- [ ] Momentum Reset unlocks all equipment
- [ ] Consumables replenish on Reset
- [ ] Reset broadcasts to all clients
- [ ] Type checks pass
- [ ] All tests pass

---

## Phase 8: Integration Testing & Polish

### Objectives
- End-to-end testing of complete equipment system
- GM + Player multi-client testing
- Performance testing (large equipment lists)
- Edge case testing
- UI/UX polish

### Implementation Checklist

#### End-to-End Scenarios
- [ ] **Scenario 1: Equip and Use Equipment**
  1. Player creates Common weapon on Character Sheet
  2. Player equips weapon (load display updates)
  3. Player opens Player Action Widget, selects weapon in dropdown
  4. Player commits roll
  5. Weapon locks (checkbox disabled on Character Sheet)
  6. Player tries to unequip → Error message shown
  7. GM initiates Momentum Reset
  8. Weapon unlocks, player can unequip

- [ ] **Scenario 2: First-Lock Momentum Cost**
  1. GM creates Rare weapon, adds to player character
  2. Player equips Rare weapon
  3. Crew has 2 Momentum
  4. Player opens Player Action Widget, selects Rare weapon
  5. Current Plan shows "First-lock: 1M"
  6. Player commits roll
  7. Momentum decreases to 1M, weapon locks
  8. Player uses weapon in another roll → No additional cost

- [ ] **Scenario 3: GM Passive Approval**
  1. Player equips Passive armor
  2. Player opens Player Action Widget
  3. GM sees Passive equipment grid, selects armor
  4. Current Plan updates showing armor bonus
  5. Player commits roll
  6. Armor locks, bonus applied to dice pool

- [ ] **Scenario 4: Consumable Depletion**
  1. Player equips Consumable grenade
  2. Player selects grenade in dropdown
  3. Player commits roll
  4. Grenade locks and becomes depleted (grayed out on Character Sheet)
  5. Grenade no longer appears in dropdown
  6. Grenade still occupies slot
  7. GM initiates Reset
  8. Grenade replenishes, becomes usable again

- [ ] **Scenario 5: Load Limit Enforcement**
  1. Player has 4/5 slots used
  2. Player tries to equip 2-slot weapon → Success (6/5 error shown)
  3. Actually, validation prevents equipping (error shown)
  4. Player unequips 1-slot item
  5. Player equips 2-slot weapon → Success (5/5)

#### Multi-Client Testing (GM + Player)
- [ ] Test equipment changes broadcast correctly
- [ ] Test locked equipment visible to both GM and Player
- [ ] Test GM Passive approval visible to Player in Current Plan
- [ ] Test equipment unlocking on Reset visible to all clients
- [ ] Test Character Sheets auto-refresh when equipment state changes

#### Performance Testing
- [ ] Test with 50+ equipment items on character (dropdown performance)
- [ ] Test Equipment Row View Template render time
- [ ] Test Character Sheet render with large equipment list
- [ ] Test sorting performance (Passive → Active → Consumable)

#### Edge Cases
- [ ] Test equipping item when exactly at load limit
- [ ] Test locking already-locked item (should not double-charge)
- [ ] Test removing locked item (should fail for player, succeed for GM)
- [ ] Test equipment with 0 dice bonus (should not display "+0d")
- [ ] Test equipment with negative bonuses (penalties)
- [ ] Test equipment with multiple bonuses (+2d, -1 Position)
- [ ] Test player trying to edit Rare item (should be read-only)
- [ ] Test GM changing item from Rare to Common (character-specific)
- [ ] Test Consumable with consumed=true filtered from dropdown
- [ ] Test Reset with no locked equipment (should not error)

#### UI/UX Polish
- [ ] Add loading states for equipment operations
- [ ] Add success notifications ("Equipment equipped")
- [ ] Add error notifications with clear messages
- [ ] Add confirmation dialog for removing equipment
- [ ] Add tooltips for tier badges, locked icons
- [ ] Ensure consistent spacing/alignment in Equipment Row View
- [ ] Ensure category icons visually distinct
- [ ] Ensure locked icon prominent and clear
- [ ] Test responsive design (different screen sizes)
- [ ] Test keyboard navigation (tab through equipment list)

### Integration Tests

#### `tests/integration/equipment-system.test.ts`
- [ ] Test complete equipment lifecycle (create → equip → use → lock → reset → unlock)
- [ ] Test first-lock momentum cost across multiple rolls
- [ ] Test load limit enforcement with multi-slot items
- [ ] Test Consumable depletion and replenishment
- [ ] Test GM Passive approval workflow
- [ ] Test equipment changes broadcast to all clients
- [ ] Test Character Sheet refresh after equipment operations

### Type Checks
```bash
pnpm run type-check:all
pnpm run build
```
- [ ] All type checks pass
- [ ] Build succeeds without errors
- [ ] No new warnings introduced

### Acceptance Criteria
- [ ] All E2E scenarios pass
- [ ] Multi-client testing successful (GM + Player)
- [ ] Performance acceptable with large equipment lists
- [ ] All edge cases handled gracefully
- [ ] UI/UX polished and intuitive
- [ ] Type checks and build pass
- [ ] All integration tests pass

---

## Phase 9: Documentation & Migration

### Objectives
- Update inline code documentation
- Create migration guide for existing worlds
- Document breaking changes
- Update user-facing documentation

### Implementation Checklist

#### Code Documentation
- [ ] Add JSDoc comments to all new functions
- [ ] Document equipment locking flow
- [ ] Document first-lock momentum cost calculation
- [ ] Document Equipment Row View Template usage
- [ ] Document Secondary Approach dropdown construction
- [ ] Document GM Passive approval grid

#### Migration Guide (`docs/migration-guide-equipment-v2.md`)
- [ ] Document breaking changes:
  - Equipment categories changed
  - Augmentations now Passive equipment
  - Locking behavior changed
  - Momentum cost timing changed
- [ ] Provide migration steps for existing worlds:
  1. Backup world before migration
  2. Run migration script to convert equipment categories
  3. Convert augmentations to Passive equipment
  4. Reset all locked flags (clean slate)
  5. Verify load limits per character
- [ ] Provide rollback plan if issues occur

#### Migration Script (`foundry/module/migrations/equipment-v2-migration.mjs`)
- [ ] Convert old equipment categories to new categories:
  ```javascript
  const categoryMapping = {
    'weapon': 'active',
    'heavy-weapon': 'active',
    'precision-tool': 'active',
    'stealth-gear': 'active',
    'armor': 'passive',
    'cybernetic': 'passive',
    'biological': 'passive',
    'psionic': 'passive',
    'consumable': 'consumable',
    'grenade': 'consumable',
    'stim': 'consumable',
    'medkit': 'consumable',
  };
  ```
- [ ] Convert `equipment: string[]` to `equipment: EquipmentState[]`
- [ ] Set default slots to 1 for all items
- [ ] Clear all locked flags (fresh start)
- [ ] Verify load limits (default to 5 if not set)

#### User-Facing Documentation
- [ ] Update user guide with new equipment system
- [ ] Add screenshots of Equipment Row View Template
- [ ] Document GM Passive approval workflow
- [ ] Document first-lock momentum costs
- [ ] Add FAQ section for common questions

### Acceptance Criteria
- [ ] Code well-documented
- [ ] Migration guide complete
- [ ] Migration script tested on sample world
- [ ] User documentation updated
- [ ] Breaking changes clearly communicated

---

## Testing Matrix

### Unit Test Coverage Goals
- [ ] Equipment types: 100%
- [ ] Equipment validators: 100%
- [ ] Equipment selectors: 100%
- [ ] Equipment actions (reducers): 100%
- [ ] Equipment utilities: 100%

### Integration Test Coverage Goals
- [ ] Character Sheet equipment: 90%+
- [ ] Player Action Widget equipment: 90%+
- [ ] Equipment Sheet Dialog: 90%+
- [ ] Equipment locking transaction: 100%
- [ ] Momentum Reset: 100%

### Manual Test Checklist
- [ ] GM + Player multi-client testing (all scenarios)
- [ ] Different tier combinations (Common/Rare/Epic mix)
- [ ] Different category combinations (Active/Passive/Consumable mix)
- [ ] Load limit edge cases (exactly at limit, exceeding limit)
- [ ] Locked equipment edge cases (try to unequip, try to remove)
- [ ] First-lock cost edge cases (0M, 1M, 2M scenarios)
- [ ] Reset behavior (unlock, replenish)
- [ ] UI responsiveness (large equipment lists, slow network)

---

## Rollout Plan

### Pre-Release
1. Complete all phases 1-9
2. Achieve testing matrix goals
3. Run migration on test world
4. Internal testing (dev + QA)
5. Beta testing with select users

### Release
1. Tag release version
2. Deploy to production
3. Announce in changelogs
4. Provide migration guide
5. Monitor for issues

### Post-Release
1. Gather user feedback
2. Address critical bugs
3. Performance monitoring
4. Iterate on UI/UX based on feedback

---

## Success Metrics

- [ ] Zero critical bugs in first week
- [ ] <5 minor bugs reported
- [ ] Migration success rate >95%
- [ ] User satisfaction (survey results positive)
- [ ] Performance: Equipment operations <100ms
- [ ] Type check: 0 new errors introduced

---

## Risk Mitigation

### Risk: Data Loss During Migration
- **Mitigation**: Automatic backup before migration, rollback script available

### Risk: Performance Issues with Large Equipment Lists
- **Mitigation**: Performance testing in Phase 8, pagination if needed

### Risk: User Confusion with New System
- **Mitigation**: Comprehensive user documentation, in-app tooltips

### Risk: Breaking Changes Impact Existing Games
- **Mitigation**: Migration script, backwards compatibility layer if feasible

### Risk: Multi-Client Sync Issues
- **Mitigation**: Extensive multi-client testing, atomic transactions via Bridge API

---

## Estimated Timeline

- **Phase 1**: Redux State Model & Types - 3 days
- **Phase 2**: Equipment Logic & Selectors - 4 days
- **Phase 3**: Equipment Row View Template - 3 days
- **Phase 4**: Character Sheet Integration - 5 days
- **Phase 5**: Player Action Widget Integration - 6 days
- **Phase 6**: Equipment Sheet Dialog - 4 days
- **Phase 7**: Momentum Reset & Unlock - 2 days
- **Phase 8**: Integration Testing & Polish - 5 days
- **Phase 9**: Documentation & Migration - 3 days

**Total Estimated Time**: ~35 days (7 weeks)

*Note: Timeline assumes single developer, full-time work. Adjust based on team size and availability.*

---

## Appendix: Command Reference

### Type Checks
```bash
# Core (Redux) type check
pnpm run type-check:core

# Foundry type check
pnpm run type-check:foundry

# All type checks
pnpm run type-check:all
```

### Testing
```bash
# Run all unit tests
pnpm test

# Run specific test file
pnpm test equipmentValidator.test.ts

# Run tests with coverage
pnpm test --coverage

# Watch mode for development
pnpm test --watch
```

### Building
```bash
# Build core (Redux)
pnpm run build:core

# Build Foundry module
pnpm run build:foundry

# Build all
pnpm run build
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/equipment-phase-1

# Commit with co-author
git commit -m "feat(equipment): implement phase 1 - redux state model

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push -u origin feature/equipment-phase-1
```
