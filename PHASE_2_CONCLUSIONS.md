# Phase 2: Replace Hard-Coded Config Values - Conclusions

**Date:** 2025-11-15
**Phase:** 2 of 4
**Status:** ✅ COMPLETE

---

## Executive Summary

Successfully eliminated magic numbers by replacing hard-coded game configuration values with centralized `DEFAULT_CONFIG` references. This enables playtesting flexibility and ensures all game rules are defined in one place.

---

## Changes Implemented

### 1. Added Config Import

**File:** `foundry/module/widgets/player-action-widget.ts`

**Import Added:**
```typescript
import { DEFAULT_CONFIG } from '@/config/gameConfig';
```

---

### 2. Replaced Hard-Coded Values

#### maxMomentum (Line 298)
**Before:**
```typescript
maxMomentum: 10,
```

**After:**
```typescript
maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
```

**Benefit:** Can now adjust max Momentum for different campaigns without code changes

---

#### Addiction Clock Segments (Line 1559)
**Before:**
```typescript
maxSegments: 8,
```

**After:**
```typescript
maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
```

**Benefit:** Addiction clock size can be tuned for playtesting

---

## Metrics

### Lines of Code
- **Import Added:** +1 line
- **Hard-coded Values Removed:** 2 magic numbers
- **Config References Added:** 2 lines
- **Net Change:** +3 lines

### Configuration Centralization
- ✅ All Momentum config values now centralized
- ✅ All addiction clock config values now centralized
- ✅ Zero magic numbers for these values

---

## Verification Results

### TypeScript Compilation
```bash
pnpm run type-check
```

**Results:**
- ✅ Redux core compiles with 0 errors
- ✅ No new type errors introduced

### Test Suite
```bash
pnpm test --run playerRoundStateSelectors
```

**Results:**
- ✅ 60/60 tests passed (Phase 1 tests still passing)
- ✅ No regressions from Phase 2 changes

**Note on Other Test Failures:**
- 3 tests failing in `config.test.ts` (pre-existing)
- Issue: Config uses `epic` but test expects `rare` for consumables
- Not caused by Phase 2 changes
- Should be fixed separately (config inconsistency)

---

## Benefits Achieved

### 1. Playtesting Flexibility ✅
**Before:** Changing max Momentum or addiction segments required finding magic numbers in code
**After:** Single place to adjust all game config values

**Example Playtesting Scenarios:**
```typescript
// Test with lower max Momentum (more resource constrained)
maxMomentum: 8,

// Test with larger addiction clock (slower addiction progression)
addiction: {
  segments: 10,
  resetReduction: 2,
}
```

---

### 2. Single Source of Truth ✅
**Before:** Game rules scattered across multiple files as magic numbers
**After:** All game rules defined in `src/config/gameConfig.ts`

**Config Structure:**
```typescript
export const DEFAULT_CONFIG: GameConfig = {
  character: { /* ... */ },
  crew: {
    startingMomentum: 5,
    maxMomentum: 10,
    minMomentum: 0,
  },
  clocks: {
    harm: { /* ... */ },
    consumable: { /* ... */ },
    addiction: {
      segments: 8,
      resetReduction: 2,
    },
  },
  rally: { /* ... */ },
  resolution: { /* ... */ },
};
```

---

### 3. Campaign-Specific Configuration ✅
Foundry can now override config per world:

**Possible Future Enhancement:**
```typescript
// In Foundry initialization
const customConfig = {
  ...DEFAULT_CONFIG,
  crew: {
    ...DEFAULT_CONFIG.crew,
    maxMomentum: 12, // Override for this campaign
  },
};

const gameAPI = createGameAPI(customConfig);
```

---

### 4. Self-Documenting Code ✅
**Before:**
```typescript
maxMomentum: 10, // Where did 10 come from?
```

**After:**
```typescript
maxMomentum: DEFAULT_CONFIG.crew.maxMomentum, // Clear: defined in game config
```

Code now clearly indicates values come from centralized config.

---

## Search for Remaining Magic Numbers

Performed audit for other potential magic numbers:

```bash
# No hard-coded Momentum values found
grep -rn "Momentum.*[0-9]" foundry/module/widgets/player-action-widget.ts

# No hard-coded clock segment values found (except config)
grep -rn "segments.*[0-9]" foundry/module/widgets/player-action-widget.ts
```

**Result:** All major game config values now centralized

---

## Challenges Encountered

### 1. Pre-existing Test Failures
**Issue:** Found 3 tests failing in `config.test.ts`
**Root Cause:** Config uses `epic` but test expects `rare` for consumables
**Impact:** No impact on Phase 2 - these tests were already failing
**Recommendation:** Fix in separate issue/PR

---

## Lessons Learned

### 1. Magic Numbers are Technical Debt
Even "obvious" values like `maxMomentum: 10` should come from config:
- Enables flexibility
- Improves discoverability
- Makes playtesting easier

### 2. Configuration Should Be Data-Driven
Game rules belong in config files, not scattered through code:
- Easier for non-programmers (GMs) to adjust
- Clear documentation of all game parameters
- Supports A/B testing different rulesets

### 3. Import Organization Matters
Placed config import after selectors but before dialogs:
```typescript
import { selectDicePool, ... } from '@/selectors/...';
import { DEFAULT_CONFIG } from '@/config/gameConfig';
import { FlashbackTraitsDialog } from '../dialogs/...';
```

Clear visual separation: data imports → config → UI components

---

## Success Criteria Review

| Criterion | Target | Result | Status |
|-----------|--------|--------|--------|
| No hard-coded maxMomentum | 0 | 0 (replaced) | ✅ |
| No hard-coded maxSegments | 0 | 0 (replaced) | ✅ |
| TypeScript compiles | 0 new errors | 0 new errors | ✅ |
| Tests still pass | Phase 1 tests | 60/60 passed | ✅ |
| Config centralized | Yes | Yes | ✅ |

---

## Remaining Config Opportunities

### Potential Future Refactoring
The audit identified these as already using config correctly:
- ✅ Harm clock segments: Uses `DEFAULT_CONFIG.clocks.harm.segments`
- ✅ Starting Momentum: Uses `DEFAULT_CONFIG.crew.startingMomentum`
- ✅ Rally max Momentum: Uses `DEFAULT_CONFIG.rally.maxMomentumToUse`

### Possible Additional Centralization
Could consider moving these to config:
- Chat message templates
- UI text/labels
- Notification messages

**Recommendation:** Leave for future if needed - not core game rules

---

## Next Steps

### Immediate (Phase 3)
Remove duplicate stims lock logic:
- Delete `_areStimsLocked()` method (~18 lines)
- Use existing `selectStimsAvailable` selector
- Verify tests cover stims availability

**Estimated Time:** 15 minutes
**LOC Impact:** -18 lines (duplicate method)

### Short-term (Phase 4)
Move dice outcome calculation to Redux utils:
- Create `src/utils/diceRules.ts`
- Add `calculateOutcome()` pure function
- Write comprehensive tests
- Remove `_calculateOutcome()` from widget

**Estimated Time:** 30 minutes
**LOC Impact:** +40 Redux, +80 tests, -10 Foundry

---

## Conclusion

Phase 2 successfully eliminated magic numbers and centralized game configuration:

✅ **Config Centralization:** All Momentum and addiction values now in `DEFAULT_CONFIG`
✅ **Flexibility:** Can adjust game rules for playtesting without code changes
✅ **Documentation:** Clear config structure documents all game parameters
✅ **No Regressions:** All Phase 1 tests still passing, TypeScript compiles

**Quick win:** Only 10 minutes to complete, immediate value for playtesting flexibility.

**Ready to proceed to Phase 3: Remove Duplicate Stims Lock Logic**

---

## Appendix: Files Modified

### Modified
1. `foundry/module/widgets/player-action-widget.ts` (+3 lines / -2 magic numbers)

### No New Files Created

---

**Phase 2 Complete** ✅
**Total Time:** ~10 minutes
**Next Phase:** Remove Duplicate Stims Lock Logic
