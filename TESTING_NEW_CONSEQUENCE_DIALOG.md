# Testing the New ConsequenceResolutionDialog

## Overview

Session 5 integrated the new `ConsequenceResolutionDialog` with a feature flag for gradual rollout. This document provides testing instructions.

## Enable the Feature

**Location:** `src/config/gameConfig.ts`

Change the feature flag from `false` to `true`:

```typescript
experimental: {
  // Use new ConsequenceResolutionDialog (typed clocks + context-aware suggestions)
  // Set to true to enable the new dialog, false to use legacy flow
  useNewConsequenceDialog: true, // ← Change this to true
},
```

**After changing:** Rebuild the Foundry module and refresh Foundry.

## Testing Scenarios

### Scenario 1: Basic Consequence Flow (Partial Success)

**Setup:**
1. Create a character with 2-3 harm clocks (different types: Physical, Morale)
2. Create a crew with 2-3 threat clocks (different categories)
3. Start an encounter with the character

**Steps:**
1. Select an action (e.g., Shoot)
2. GM sets Position: Risky, Effect: Standard
3. Roll and get a partial success (one 6, or highest is 4-5)
4. Player clicks "Accept Consequences"
5. **EXPECTED:** GM sees "Configure Consequence (Smart Suggestions)" button
6. GM clicks the button
7. **EXPECTED:** Dialog opens with:
   - Roll outcome summary (Partial Success, Risky/Standard)
   - Harm clocks grouped under "Harm Clocks" section
   - Each harm clock shows "Advance +3" suggestion (Risky = 3 segments)
   - Threat clocks grouped under "Threat Clocks" section
   - Each threat clock shows "Advance +3" suggestion
   - Skip option at bottom

8. GM selects a harm clock (radio button)
9. **EXPECTED:** Preview shows "Physical Harm: 2/6 → 5/6"
10. GM clicks "Apply"
11. **EXPECTED:**
    - Dialog closes
    - Harm clock advances by 3 segments
    - Momentum increases by 2 (Risky consequence)
    - Turn ends (returns to DECISION_PHASE)
    - GM notification: "Consequence applied"

### Scenario 2: Desperate Failure (Max Consequences)

**Setup:**
1. Same character/crew from Scenario 1

**Steps:**
1. Select action
2. GM sets Position: Desperate, Effect: Standard
3. Roll and get failure (no 6s, highest is 1-3)
4. Player accepts consequences
5. GM opens consequence dialog
6. **EXPECTED:**
   - Harm clocks show "Advance +5" (Desperate = 5 segments)
   - Threat clocks show "Advance +5"
7. GM selects a harm clock that has 2/6 segments
8. **EXPECTED:** Preview shows "Physical Harm: 2/6 → 6/6 (DYING)"
9. GM clicks "Apply"
10. **EXPECTED:**
    - Harm clock fills to 6/6
    - Character is marked as dying
    - Momentum increases by 4 (Desperate consequence)

### Scenario 3: Skip Consequence

**Setup:**
1. Same character/crew

**Steps:**
1. Roll partial/failure
2. Player accepts consequences
3. GM opens consequence dialog
4. GM clicks "Skip Consequence" instead of selecting a clock
5. **EXPECTED:**
   - Dialog closes
   - No clocks change
   - Momentum still increases (consequence momentum)
   - Turn ends
   - GM notification: "Consequence skipped"

### Scenario 4: Clock Auto-Delete (Future: Rally/Reduction)

**Note:** This requires implementing Rally action type detection. For now, test manually:

**Setup:**
1. Character with a harm clock at 2/6 segments

**Steps:**
1. Manually set actionType to 'rally' in handler (temporary code change)
2. Roll success with Great effect
3. GM opens consequence dialog
4. **EXPECTED:**
   - Harm clocks show "Reduce -4" (Great effect = 4 segments reduction)
5. GM selects the 2/6 harm clock
6. **EXPECTED:** Preview shows "Physical Harm: 2/6 → 0/6 (WILL DELETE)"
7. GM clicks "Apply"
8. **EXPECTED:**
   - Harm clock is deleted entirely
   - Clock no longer appears in character sheet

### Scenario 5: Progress Clocks (Success)

**Setup:**
1. Create progress clocks for the crew (e.g., "Disable Security", "Hack Mainframe")

**Steps:**
1. Roll success (one 6) with Risky/Great
2. Player ends turn (no consequence needed)
3. **FUTURE IMPLEMENTATION:** Dialog should also suggest progress clocks on success
   - For now, progress clocks are only suggested on GM-initiated actions

## Verification Checklist

After each scenario, verify:

- [ ] Dialog opens correctly
- [ ] Clocks are grouped by category (Harm, Threat, Progress)
- [ ] Suggested amounts match position/effect calculations
- [ ] Radio button selection works (only ONE clock selectable)
- [ ] Preview updates when selection changes
- [ ] Apply dispatches correct Redux action
- [ ] Clock segments update correctly in Redux store
- [ ] Character/crew sheets reflect changes
- [ ] Momentum increases correctly
- [ ] Turn transitions correctly (back to DECISION_PHASE)
- [ ] GM notification appears

## Calculation Reference

**Consequence Clocks (Advance on Failure/Partial):**
- Controlled: +1 segment
- Risky: +3 segments
- Desperate: +5 segments
- Impossible: +6 segments

**Success Clocks (Advance on Success/Critical):**
- Base (position): same as consequence
- Modifier (effect):
  - Limited: -1
  - Standard: 0
  - Great: +1
  - Spectacular: +2

**Reduction (Rally/Medical/Defuse):**
- Limited: -1 segment
- Standard: -2 segments
- Great: -4 segments
- Spectacular: -6 segments

**Momentum Gain (on Consequence):**
- Controlled: +1M
- Risky: +2M
- Desperate: +4M
- Impossible: +6M

## Known Limitations (Session 5)

1. **Action type detection:** Currently hardcoded to 'normal'. Rally/medical/defuse detection not yet implemented.
2. **Progress clocks:** Only suggested for consequence flows (failure/partial), not for success flows.
3. **Position improvements:** Trait-based position improvements not reflected in suggestions yet.
4. **Multi-client sync:** Ensure both GM and Player clients see updates (test with two browser windows).

## Disable Feature Flag

To revert to legacy flow:

```typescript
experimental: {
  useNewConsequenceDialog: false, // ← Set to false
},
```

Rebuild and refresh Foundry.

---

**Created:** 2025-11-15 (Session 5)
**Status:** Ready for manual testing
**Next Steps:** Report any bugs or UI issues, then enable by default after validation
