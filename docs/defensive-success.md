# Defensive Success

**Rules:** [vault/rules_primer.md](../vault/rules_primer.md) - "Defensive Success Option"

## Mechanic

On partial success (4-5) with Standard+ Effect, player chooses:
- **Full Offense:** Original position/effect/segments + momentum
- **Defensive Trade:** Reduce position by 1 step, reduce effect by 1 tier, keep original momentum

Position ladder: Impossible→Desperate→Risky→Controlled→None (0 segments)
Effect ladder: Spectacular→Great→Standard→Limited

## Implementation Files

**Redux (Pure Functions):**
- `src/utils/defensiveSuccessRules.ts` - Calculations
- `src/selectors/playerRoundStateSelectors.ts` - `selectDefensiveSuccessValues` selector
- `src/types/playerRoundState.ts` - Add `useDefensiveSuccess` flag to `ConsequenceTransaction`
- `src/types/resolution.ts` - `DefensiveSuccessValues` type

**Handlers:**
- `foundry/module/handlers/consequenceDataResolver.ts` - Calculate defensive values when enabled
- `foundry/module/handlers/consequenceResolutionHandler.ts` - Add `createToggleDefensiveSuccessAction()`

**UI:**
- `foundry/templates/widgets/player-action-widget.html` - Two-column toggle panel
- `foundry/module/widgets/player-action-widget.ts` - Wire up toggle event

## Key Points

- **Player decides** (not GM) via toggle buttons
- **Momentum preserved** at original position value (not reduced)
- **Controlled→None** results in 0 segments, no clock created
- **Limited effect** makes option unavailable (can't reduce further)
- **State machine:** No new states, integrates as flag in existing `ConsequenceTransaction`

## Testing

Test file: `tests/unit/defensiveSuccess.test.ts`

Categories:
- Availability (partial + Standard+ only)
- Position reduction (all 5 steps)
- Effect reduction (all 4 steps)
- Momentum preservation (original position value)
- Complete calculations (3 full scenarios)
- Edge cases (Controlled→None, Limited effect, etc.)

**Tests MUST fail initially** (TDD).
