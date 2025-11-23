# Equipment System Manual Testing Checklist

**Phases:** 6-8 Equipment Implementation
**Test Environment:** GM + Player Clients
**Last Updated:** Phase 9 Integration Tests Complete

---

## Overview

This checklist verifies end-to-end equipment workflows across actual Foundry VTT gameplay. All unit and integration tests pass (777 tests), but manual testing validates real UI/UX scenarios.

**Key Features Tested:**
1. Regular Equipment Management (equip/unequip)
2. Flashback Rare Equipment (1M Momentum cost)
3. Augmentation System (no load counting, GM control)
4. Consumable Management (depletion/replenishment)
5. Equipment Locking (until Momentum Reset)
6. Load Limits (max 5 regular items)
7. Cross-Client Synchronization (GM ↔ Player)

---

## Test Setup

### Requirements
- [ ] Two Foundry VTT clients open (GM and Player)
- [ ] Synchronized store state (both clients see same data)
- [ ] Test character with mixed equipment
- [ ] Test crew with sufficient Momentum (10M)

### Test Data
Create a test character with:
- 3 common equipment items (weapon, armor, tool)
- 1 rare equipment item (not equipped)
- 2 consumable items (stims, grenades)
- 1 augmentation (cybernetic implant)

---

## Workflow 1: Equipment Management Dialog

### Test 1.1: Open Dialog
- [ ] Player clicks "Manage Equipment" on character sheet
- [ ] Dialog opens with 700px width
- [ ] Load display shows current/max (3/5)
- [ ] Momentum shows crew current/max (10/10)

### Test 1.2: Equipment Organization
- [ ] Equipped items section shows 3 common items
- [ ] Unequipped items section shows 1 rare item
- [ ] Augmentations section shows 1 cybernetic item
- [ ] Depleted consumables section shows (initially empty)
- [ ] Sections collapse properly if empty after search

### Test 1.3: Search/Filter
- [ ] Search "rifle" → shows only weapon items
- [ ] Search "armor" → shows only armor items
- [ ] Search "rare" → shows only rare tier items
- [ ] Search is case-insensitive
- [ ] Clear search → all items return

### Test 1.4: Equipment Toggle
- [ ] Click equipped item → "Staged for unequip" visual indicator
- [ ] Click unequipped item → "Staged for equip" visual indicator
- [ ] Momentum cost updates in real-time when toggling rare item
- [ ] Load indicator updates in real-time

### Test 1.5: Load Validation
- [ ] With 5/5 load, "Create Flashback Item" button is disabled
- [ ] Button tooltip shows "Equipment load is full"
- [ ] Cannot stage equipping another item when at max load
- [ ] Warn message appears: "Equipment load is full - unequip something first"

### Test 1.6: Accept Changes
- [ ] Button shows "Accept Changes (Spend 1M)" when staging rare item
- [ ] Button disabled if staging would exceed crew Momentum
- [ ] Disabled message shows "Insufficient Momentum (need X, have Y)"
- [ ] After accept: dialog closes and changes apply

### Test 1.7: Cancel
- [ ] Click "Cancel" without making changes → dialog closes
- [ ] Click "Cancel" after staging changes → changes discarded
- [ ] Character state unchanged after cancel

---

## Workflow 2: Flashback Rare Equipment

### Test 2.1: Open Flashback Dialog
- [ ] From Equipment Management, click "Create Flashback Item"
- [ ] New dialog opens for flashback equipment
- [ ] Dialog only available if load < 5

### Test 2.2: Tier Selection
- [ ] "Common" tier shows 0M cost
- [ ] "Rare" tier shows 1M cost
- [ ] "Epic" tier is DISABLED with tooltip: "Epic items cannot be acquired via flashback"
- [ ] Cost updates immediately when changing tier

### Test 2.3: Item Configuration
- [ ] Enter item name (e.g., "Plasma Rifle")
- [ ] Enter category from dropdown (weapon, armor, tool, etc.)
- [ ] Enter description
- [ ] Form validation prevents submit with empty fields

### Test 2.4: Momentum Cost Check
- [ ] Display shows "Cost: 0M (common)" or "Cost: 1M (rare)"
- [ ] Load display shows "Will be 4/5"
- [ ] If crew has 10M and acquiring rare: "✓ You have sufficient Momentum"
- [ ] If crew has 0M and acquiring rare: "✗ Insufficient Momentum"

### Test 2.5: Acquisition
- [ ] Click "Acquire" with sufficient Momentum
- [ ] Item appears in Equipment Management as equipped
- [ ] Item has `locked: true` (cannot be unequipped until reset)
- [ ] Item has `acquiredAt: <timestamp>` and `acquiredVia: 'flashback'`
- [ ] Crew Momentum reduced by 1 for rare items

### Test 2.6: GM Broadcast
- [ ] On GM client: crew Momentum decreases from 10 to 9
- [ ] On Player client: crew Momentum updates to 9 (automatic sync)
- [ ] Both clients show new item in equipment list

---

## Workflow 3: Augmentation System

### Test 3.1: Augmentation Display
- [ ] Augmentations shown in separate section
- [ ] "Augmentations (Not Count Toward Load)" header
- [ ] Each augmentation shows microchip icon
- [ ] Augmentation count correct (1 cybernetic)

### Test 3.2: Load Exemption
- [ ] Current load is 3 (equipment only, not augmentation)
- [ ] Max load 5 is NOT exceeded by augmentation
- [ ] Can equip 2 more regular items even with augmentation
- [ ] Load limit: `equipment + consumables < 5`, but `augmentations` unlimited

### Test 3.3: GM Augmentation Control
- [ ] During action roll, GM sees "enabledAugmentationIds" selector
- [ ] GM can toggle which augmentations apply to this roll
- [ ] Player cannot manually activate/deactivate augmentations
- [ ] Augmentation bonus only applies if GM enables it for that roll

### Test 3.4: Augmentation Persistence
- [ ] Augmentation remains equipped across game phases
- [ ] Augmentation not locked/unlocked by Momentum Reset
- [ ] Augmentation bonuses calculated if enabled in playerRoundState

---

## Workflow 4: Consumable Management

### Test 4.1: Consumable Identification
- [ ] Consumable items show hourglass icon when depleted
- [ ] Consumables section shows depleted items separately
- [ ] Item marked `type: 'consumable'`

### Test 4.2: Depletion in Action
- [ ] Character selects stim consumable for bonus in action
- [ ] After action completes: consumable shows as "Depleted"
- [ ] Depleted consumable still counts toward load
- [ ] Depleted consumable cannot be used again

### Test 4.3: Replenishment at Momentum Reset
- [ ] During Momentum Reset action, all consumables reset
- [ ] Depleted flag changes from `true` to `false`
- [ ] Consumable becomes usable again
- [ ] Load count unchanged (was counting before, still counts after)

### Test 4.4: Depletion UI State
- [ ] Equipped consumable: checkmark + hourglass (when depleted)
- [ ] Unequipped consumable: no checkmark, no hourglass
- [ ] Description text grayed out when depleted

---

## Workflow 5: Equipment Locking

### Test 5.1: Lock on Equip
- [ ] Equip rare item from Equipment Management
- [ ] Accept changes
- [ ] Item now shows lock icon
- [ ] Hover lock icon: "Locked until Momentum Reset (mission in progress)"

### Test 5.2: Prevent Unequip
- [ ] Try to click locked item to unequip
- [ ] Warning notification: "Item is locked until Momentum Reset"
- [ ] Item remains equipped
- [ ] No staged change created

### Test 5.3: Unlock at Reset
- [ ] During Momentum Reset, all locks cleared
- [ ] Locked items no longer show lock icon
- [ ] Can now unequip previously locked items
- [ ] Lock cleared on all equipped items (equipment + consumables)

### Test 5.4: Auto-Equip Feature (if implemented)
- [ ] Character flags rare item with `autoEquip: true`
- [ ] After Momentum Reset, item automatically re-equipped
- [ ] New lock applied (if acquired via flashback again)
- [ ] Load recalculated with auto-equipped item

---

## Workflow 6: Load Management at Capacity

### Test 6.1: Equipped at Max
- [ ] Equip 5 regular items (at max load)
- [ ] Load display shows 5/5
- [ ] "Create Flashback Item" button DISABLED
- [ ] Cannot stage equipping 6th item

### Test 6.2: Unequip to Free Space
- [ ] Unequip 1 item from 5
- [ ] Load shows 4/5
- [ ] "Create Flashback Item" button ENABLED
- [ ] Can now stage equipping another item

### Test 6.3: Mixed Type Capacity
- [ ] Equip 3 regular equipment + 1 consumable (4/5 load)
- [ ] Add 1 augmentation
- [ ] Load still shows 4/5 (augmentation doesn't count)
- [ ] Can equip 1 more regular item/consumable

### Test 6.4: Batch Changes
- [ ] Unequip item A, equip item B, equip item C
- [ ] All changes staged simultaneously
- [ ] Load calculation correct for final state
- [ ] Momentum cost calculated for all rare items being equipped

---

## Workflow 7: Action Resolution & Locking

### Test 7.1: Equipment in Action
- [ ] Character selects equipment bonus for action
- [ ] Equipment marked `equippedForAction: true`
- [ ] After action completes: equipment locked

### Test 7.2: Consumable in Action
- [ ] Character uses stim consumable for bonus
- [ ] After action completes: consumable marked `depleted: true`
- [ ] Equipment still takes load slot

### Test 7.3: Multi-Action Scenario
- [ ] Action 1: Equipment A locked
- [ ] Action 2: Equipment B selected and locked
- [ ] After Reset: both unlocked

---

## Workflow 8: Cross-Client Synchronization

### Test 8.1: Equipment Changes
- **GM Side:** Equip rare item from flashback (costs 1M)
- **Player Side:** Equipment appears in their list within 1 second
- **Both:** Load calculation matches
- **Both:** Momentum shows same (crew: 9/10)

### Test 8.2: Locking Sync
- **GM Side:** Equipment locked after being selected for action
- **Player Side:** Lock icon appears on their client
- **Player Side:** Cannot unequip locked item

### Test 8.3: Consumable Depletion
- **GM Side:** Marks consumable as depleted
- **Player Side:** Hourglass icon appears on consumable
- **Both:** Load counts unchanged

### Test 8.4: Momentum Reset Broadcast
- **GM Side:** Triggers Momentum Reset
- **Player Side:** All locks cleared, consumables replenished
- **Both:** Equipment state synchronized

---

## Workflow 9: Edge Cases & Error Handling

### Test 9.1: Epic Item Prevention
- [ ] Try to flashback epic tier item
- [ ] Tier dropdown has epic DISABLED
- [ ] Cannot select epic tier
- [ ] Notification explains: "Epic items are earned as story rewards"

### Test 9.2: Insufficient Momentum
- [ ] Crew has 0 Momentum
- [ ] Try to stage equipping rare item
- [ ] "Accept Changes" button DISABLED
- [ ] Message shows: "Insufficient Momentum (need 1, have 0)"
- [ ] No action taken when clicking disabled button

### Test 9.3: Load Limit Validation
- [ ] At 5/5 load
- [ ] Click unequipped item to stage equip
- [ ] Prevent staging: "Equipment load is full - unequip something first"
- [ ] Staged changes not created

### Test 9.4: Locked Item Unequip
- [ ] Locked item selected
- [ ] Click to unequip
- [ ] Warning: "Item is locked until Momentum Reset"
- [ ] No change staged

### Test 9.5: State Consistency
- [ ] Close Equipment Management without accepting
- [ ] Changes discarded
- [ ] Character state unchanged
- [ ] Dialog can be reopened fresh

---

## Workflow 10: UI/UX Verification

### Test 10.1: Visual States
- [ ] Equipped items: checkmark, highlighted background
- [ ] Unequipped items: dimmed, no checkmark
- [ ] Locked items: lock icon, grayed out
- [ ] Depleted items: hourglass icon, grayed out
- [ ] Augmentations: microchip icon, separate section

### Test 10.2: Real-time Updates
- [ ] Load number updates immediately when toggling items
- [ ] Momentum cost updates immediately when staging rare items
- [ ] Section headers update (hide empty sections)
- [ ] Search results update as typing

### Test 10.3: Responsive Layout
- [ ] Dialog width maintains 700px
- [ ] Equipment grid flows responsive to content
- [ ] Buttons stack properly on narrower windows
- [ ] Tooltips display without overflow

### Test 10.4: Accessibility
- [ ] Tab through all buttons in order
- [ ] Equipment items keyboard selectable (if using click handler)
- [ ] Tooltips read aloud by screen readers
- [ ] Color not sole indicator of state (icons + text)

---

## Summary Results

**Total Manual Test Suites:** 10
**Total Manual Test Cases:** 75+

| Phase | Test Count | Status |
|-------|-----------|--------|
| Workflow 1 (Equipment Dialog) | 7 | ☐ Pass |
| Workflow 2 (Flashback) | 6 | ☐ Pass |
| Workflow 3 (Augmentations) | 4 | ☐ Pass |
| Workflow 4 (Consumables) | 4 | ☐ Pass |
| Workflow 5 (Locking) | 4 | ☐ Pass |
| Workflow 6 (Load Management) | 4 | ☐ Pass |
| Workflow 7 (Action Resolution) | 3 | ☐ Pass |
| Workflow 8 (Cross-Client Sync) | 4 | ☐ Pass |
| Workflow 9 (Edge Cases) | 5 | ☐ Pass |
| Workflow 10 (UI/UX) | 4 | ☐ Pass |

---

## Test Execution Notes

### Before Testing
```bash
# 1. Run all tests to verify code integrity
pnpm test
# Expected: 777 tests pass

# 2. Build to verify no compilation errors
pnpm run build
# Expected: Build succeeds

# 3. Start Foundry VTT with module
# Create test crew + character with equipment
```

### During Testing
- [ ] Document any visual glitches
- [ ] Note if sync delays > 1 second
- [ ] Test with multiple gaming sessions
- [ ] Test with varying network conditions (if possible)

### After Testing
- [ ] All manual workflows pass
- [ ] No console errors (browser DevTools)
- [ ] No Redux warnings
- [ ] Prepare Phase 10 cleanup documentation

---

## Known Limitations

- Equipment cannot be deleted (design decision)
- Augmentations always visible (no conditional hiding)
- Load limit is hard-capped at 5 items
- Momentum cost is fixed (1M for rare, not configurable)

---

## Sign-Off

- [ ] Manual testing completed by GM
- [ ] Manual testing completed by Player
- [ ] No critical bugs found
- [ ] Ready for Phase 10 documentation cleanup

**Tested by:** _______________
**Date:** _______________
**Notes:** _______________
