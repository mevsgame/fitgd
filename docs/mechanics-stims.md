# Stims (Combat Stimulants)

**Rule** (vault/rules_primer.md:90): "Once per action, you may use Stims on your own roll after seeing the result to reroll it."

## How It Works

1. Player rolls action → unfavorable result
2. Clicks "Use Stims" button
3. System rolls 1d6 for addiction advancement
4. Addiction clock advances by that amount
5. If clock fills (≥8 segments): character gets "Addict" trait, crew-wide stims lockout
6. Otherwise: auto-reroll the action

## State & Architecture

| Aspect | Detail |
|--------|--------|
| **Flag** | `playerRoundState.stimsUsedThisAction` (prevents double use) |
| **Clock** | `clocks` slice, type='addiction', entityId=characterId |
| **Config** | 8 segments per clock (DEFAULT_CONFIG.clocks.addiction.segments) |
| **Check** | `selectStimsAvailable(state)` - false if ANY crew addiction filled |
| **Trait** | "Addict" (scar) added when clock fills |

## Independence Rule

Stims are **independent** of other mechanics:
- ✅ Can use stims even after Push Yourself (+1d momentum)
- ✅ Can use stims even after Flashback (narrative rewind)
- ❌ Cannot use stims if already used stims this action

## Bug Fixes

1. **Validation**: Now checks `stimsUsedThisAction` (not `pushed || flashbackApplied`)
2. **Flag Setting**: Now calls `setStimsUsed` when stims used (was missing before)

## Files Involved

- `foundry/module/handlers/stimsWorkflowHandler.ts` - Validation & action creation
- `foundry/module/handlers/stimsHandler.ts` - Alternative handler
- `foundry/module/widgets/player-action-widget.ts` - UI & orchestration
- `src/selectors/clockSelectors.ts` - `selectStimsAvailable`, `selectAddictionClockByCharacter`
- `src/slices/clockSlice.ts` - Addiction clock management

## Testing

See `tests/unit/stimsHandler.test.ts` for:
- Independence from Push/Flashback
- Once-per-action enforcement
- Addiction clock management
- Crew-wide lockout scenarios
