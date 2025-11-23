# Stims (Combat Stimulants)

**Primary Rule** (vault/rules_primer.md:90): "Once per action, you may use Stims on your own roll after seeing the result to reroll it."

## 1. Overview

Stims are a last-resort mechanic allowing characters to reroll a failed action by advancing their addiction clock. Available only after seeing an unfavorable roll result.

**User Flow:**
1. Roll action → unfavorable result
2. Click "Use Stims" button
3. Roll 1d6 for addiction advancement
4. If addiction fills (≥8): character becomes "Addict", crew-wide lockout
5. Otherwise: auto-reroll the action

## 2. Architecture & State

### Redux Slices
- `playerRoundState.stimsUsedThisAction` - Boolean flag (prevents double use, resets per action)
- `clocks` - Addiction clocks (type='addiction', entityId=characterId, maxSegments=8)
- `characters` - Adds "Addict" scar trait when addiction fills

### Key Selectors
- `selectStimsAvailable(state)` - False if ANY crew member's addiction filled
- `selectAddictionClockByCharacter(state, characterId)` - Get character's addiction clock

### State Machine & Transactions
- **Button Available**: Only in `GM_RESOLVING_CONSEQUENCE` state (post-roll)
- **Transition**: CONSEQUENCE → STIMS_ROLLING → ROLLING (reroll) OR STIMS_LOCKED (if filled)
- **Atomic Batch**: Advance clock + mark used + check lockout in single dispatch

## 3. UI/UX Design

### Button States
- **Available** (green): In consequence phase, not already used, crew not locked
- **Locked** (red/disabled): Crew addiction filled OR `stimsUsedThisAction: true`

### Interactions & Feedback
- Click "Use Stims" → rolls 1d6 (posted to chat)
- Success: "Stims used! Rerolling..." + auto-reroll
- Lockout: "Addiction clock filled! Stims locked."
- Blocked: "Stims are LOCKED due to crew addiction!"

## 4. Implementation Details

### Handler Classes
- **StimsWorkflowHandler** - Main orchestration (PlayerActionWidget)
- **StimsHandler** - Alternative implementation (testing)

### Bridge API Usage
All changes via `game.fitgd.bridge.execute(action, { affectedReduxIds, silent: true })`
- Automatic Redux dispatch + broadcast + sheet refresh
- `silent: true` prevents render race during animation

### Files
- `foundry/module/handlers/stimsWorkflowHandler.ts` - Validation & actions
- `foundry/module/widgets/player-action-widget.ts` - Button & orchestration
- `src/slices/clockSlice.ts` - Clock advancement, crew-wide lockout
- `tests/unit/stimsHandler.test.ts` - 46 tests (independence, once-per-action, etc.)

## 5. Rules Integration

### Independence Rule
Stims are **independent** of Push/Flashback:
- ✅ Can use stims after Push Yourself
- ✅ Can use stims after Flashback
- ❌ Cannot use stims if already used stims this action

### Edge Cases
- **Clock Auto-Creation**: Created on first use if doesn't exist
- **Addiction Fills**: Character becomes Addict, ALL crew clocks frozen, no reroll
- **Multiple Characters**: One filled addiction locks entire crew

## Bugs Fixed This Commit

1. **Validation Check**: Was blocking stims if Push/Flashback used (wrong flag check)
   - Fix: Now checks only `stimsUsedThisAction`

2. **Missing Flag**: Addiction advanced but flag never set
   - Fix: Added `setStimsUsed` call after clock advancement
