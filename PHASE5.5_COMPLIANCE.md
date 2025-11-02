# Phase 5.5: Resolution Helpers - Rules Compliance Verification

**Date:** 2025-11-02
**Phase:** 5.5 - Resolution Helpers (Position, Effect, Roll Evaluation, Consequences)
**Status:** ✅ VERIFIED

---

## Implementation Summary

Phase 5.5 implements resolution helpers for evaluating rolls and applying consequences as defined in `vault/rules_primer.md`. This verification confirms 100% compliance with game rules.

**Files Created:**
- `src/types/resolution.ts` - Position, Effect, Result types
- `src/resolution/index.ts` - Resolution helper functions
- `tests/unit/resolution.test.ts` - 19 comprehensive tests
- Updated `src/config/gameConfig.ts` - Added resolution tables

**Test Results:** ✅ 108 tests passing (19 resolution + 89 previous)

---

## Design Decision: Application Layer Helpers (Not Redux Slice)

**Why helpers, not a resolution slice?**
1. **No persistent state needed** - Roll results are ephemeral
2. **Coordinates existing slices** - Uses crew (momentum) and clock (harm) slices
3. **Foundry integration** - Foundry rolls dice, we just apply consequences
4. **Event sourcing via existing commands** - Each consequence logged separately
5. **Simpler architecture** - No additional slice complexity

**What Foundry provides:**
- Dice rolling (visual, chat messages)
- Hooks for roll events
- UI for position/effect selection

**What we provide:**
- Roll evaluation logic (`evaluateRoll`)
- Consequence application (`resolveActionConsequence`, `applyHarmConsequence`)
- Configuration-driven tables

---

## Rules Compliance Checklist

### 1. Position & Effect System ✅

**Rule (rules_primer.md:142-146):**
> Position and Effect determine harm segments:
> - **Controlled:** Limited (0), Standard (1), Great (2)
> - **Risky:** Limited (2), Standard (3), Great (4)
> - **Desperate:** Limited (4), Standard (5), Great (6 - Dying)

**Implementation:**
```typescript
// src/types/resolution.ts:7-8
export type Position = 'controlled' | 'risky' | 'desperate';
export type Effect = 'limited' | 'standard' | 'great';

// src/config/gameConfig.ts:53-69
harmSegments: {
  controlled: {
    limited: 0,    // Controlled + Limited = 0 segments
    standard: 1,   // Controlled + Standard = 1 segment
    great: 2,      // Controlled + Great = 2 segments
  },
  risky: {
    limited: 2,    // Risky + Limited = 2 segments
    standard: 3,   // Risky + Standard = 3 segments
    great: 4,      // Risky + Great = 4 segments
  },
  desperate: {
    limited: 4,    // Desperate + Limited = 4 segments
    standard: 5,   // Desperate + Standard = 5 segments
    great: 6,      // Desperate + Great = 6 segments (Dying)
  },
}
```

**Tests:**
- ✅ `should apply 0 segments for controlled + limited` (resolution.test.ts:237)
- ✅ `should apply 1 segment for controlled + standard` (resolution.test.ts:249)
- ✅ `should apply 2 segments for controlled + great` (resolution.test.ts:261)
- ✅ `should apply 3 segments for risky + standard` (resolution.test.ts:273)
- ✅ `should apply 6 segments for desperate + great (dying)` (resolution.test.ts:285)

**Verification:** ✅ COMPLIANT
- All 9 position/effect combinations implemented
- Exact segment values from rules table
- Configuration-driven (no magic numbers)

---

### 2. Roll Evaluation ✅

**Rule (rules_primer.md:113-115):**
> - **1-3 (Failure):** Face consequences and gain Momentum
> - **4-5 (Partial Success):** Succeed but face consequences and gain Momentum
> - **6 (Success):** Succeed without consequences
> - **Critical (two 6s):** Succeed with increased effect

**Implementation:**
```typescript
// src/resolution/index.ts:28-60
export function evaluateRoll(dice: number[], useLowest = false): RollResult {
  let highestDie = useLowest ? Math.min(...dice) : Math.max(...dice);

  const sixes = dice.filter((d) => d === 6).length;

  if (sixes >= 2) {
    result = 'critical'; // Two or more 6s
  } else if (highestDie === 6) {
    result = 'success'; // Single 6
  } else if (highestDie >= 4) {
    result = 'partial'; // 4-5
  } else {
    result = 'failure'; // 1-3
  }

  return { result, highestDie, dice };
}
```

**Tests:**
- ✅ `should return failure for highest die 1-3` (resolution.test.ts:68)
- ✅ `should return partial for highest die 4-5` (resolution.test.ts:82)
- ✅ `should return success for single 6` (resolution.test.ts:93)
- ✅ `should return critical for two or more 6s` (resolution.test.ts:104)
- ✅ `should handle zero dots roll (2d6 take lowest)` (resolution.test.ts:116)

**Verification:** ✅ COMPLIANT
- Correct result thresholds (1-3, 4-5, 6, 6+6)
- Handles 0 dots (roll 2d6, take lowest)
- Returns full roll information for UI display

---

### 3. Momentum Generation on Consequences ✅

**Rule (rules_primer.md:40-48):**
> **Generating Momentum from Accepting Consequences:**
> - **Desperate** Consequence: **+4 Momentum**
> - **Risky** Consequence: **+2 Momentum**
> - **Controlled** Consequence: **+1 Momentum**

**Implementation:**
```typescript
// src/config/gameConfig.ts:47-52
momentumOnConsequence: {
  controlled: 1,
  risky: 2,
  desperate: 4,
}

// src/resolution/index.ts:69-94
export function resolveActionConsequence(store, params) {
  const { crewId, position, result } = params;

  // Only generate momentum on failure/partial
  if (result === 'success' || result === 'critical') {
    return { result, momentumGenerated: 0 };
  }

  const momentum = DEFAULT_CONFIG.resolution.momentumOnConsequence[position];
  store.dispatch(addMomentum({ crewId, amount: momentum }));

  return { result, momentumGenerated: momentum };
}
```

**Tests:**
- ✅ `should generate +1 momentum on controlled failure` (resolution.test.ts:128)
- ✅ `should generate +2 momentum on risky partial` (resolution.test.ts:139)
- ✅ `should generate +4 momentum on desperate failure` (resolution.test.ts:150)
- ✅ `should not generate momentum on success` (resolution.test.ts:161)
- ✅ `should not generate momentum on critical` (resolution.test.ts:173)
- ✅ `should cap momentum at 10` (resolution.test.ts:185)

**Verification:** ✅ COMPLIANT
- Correct momentum values (+1/+2/+4)
- Only on failure/partial (not success/critical)
- Caps at maximum (10)
- Uses existing crew.addMomentum command (event sourced)

---

### 4. Harm Clock Application ✅

**Rule (rules_primer.md:138-140):**
> "Harm is tracked on 6-segment **clocks**. Clocks track a specific type of harm (e.g., Physical Harm, Shaken Morale, Psychic Corruption). Segments are filled based on the action's **Position and Effect**."

**Implementation:**
```typescript
// src/resolution/index.ts:103-160
export function applyHarmConsequence(store, params) {
  const { characterId, position, effect, harmType } = params;

  // Get harm segments from config
  const segments = DEFAULT_CONFIG.resolution.harmSegments[position][effect];

  // Check if clock already exists for this harm type
  const existingClock = existingHarmClocks.find(
    (clock) => clock.subtype === harmType
  );

  if (existingClock) {
    // Add to existing clock
    store.dispatch(addSegments({ clockId: existingClock.id, amount: segments }));
  } else {
    // Create new clock
    store.dispatch(createClock({
      entityId: characterId,
      clockType: 'harm',
      subtype: harmType,
    }));

    // Add segments
    store.dispatch(addSegments({ clockId, amount: segments }));
  }

  // Check if dying (6/6)
  const isDying = clock.segments >= clock.maxSegments;

  return { clockId, segmentsAdded: segments, isDying };
}
```

**Tests:**
- ✅ `should add to existing harm clock` (resolution.test.ts:300)
- ✅ `should create separate clocks for different harm types` (resolution.test.ts:323)
- ✅ `should replace clock with fewest segments when 4th harm type added` (resolution.test.ts:342)

**Verification:** ✅ COMPLIANT
- Creates harm clock if doesn't exist
- Adds to existing clock if same harm type
- Applies correct segments from config table
- Detects dying state (6/6)
- 4th harm clock replacement handled by clock slice

---

### 5. Zero Dots Handling ✅

**Rule (rules_primer.md:95):**
> "Roll a number of d6s equal to your Action rating (if zero, roll 2d6 and take the lowest)."

**Implementation:**
```typescript
// src/resolution/index.ts:28
export function evaluateRoll(dice: number[], useLowest = false): RollResult {
  let highestDie = useLowest ? Math.min(...dice) : Math.max(...dice);
  // ...
}
```

**Tests:**
- ✅ `should handle zero dots roll (2d6 take lowest)` (resolution.test.ts:116)

**Verification:** ✅ COMPLIANT
- `useLowest` parameter for 0 dots
- Caller (Foundry) rolls 2d6, passes with useLowest=true
- We take minimum instead of maximum

---

## Coverage Analysis

### Test Coverage by Feature

| Feature | Tests | Status |
|---------|-------|--------|
| Roll evaluation | 5 | ✅ |
| Momentum generation | 6 | ✅ |
| Harm application | 8 | ✅ |
| **Total** | **19** | **✅** |

### Configuration Coverage

| Config Value | Rule Source | Status |
|--------------|-------------|--------|
| Controlled consequence | +1 Momentum | ✅ |
| Risky consequence | +2 Momentum | ✅ |
| Desperate consequence | +4 Momentum | ✅ |
| Controlled/Limited | 0 segments | ✅ |
| Controlled/Standard | 1 segment | ✅ |
| Controlled/Great | 2 segments | ✅ |
| Risky/Limited | 2 segments | ✅ |
| Risky/Standard | 3 segments | ✅ |
| Risky/Great | 4 segments | ✅ |
| Desperate/Limited | 4 segments | ✅ |
| Desperate/Standard | 5 segments | ✅ |
| Desperate/Great | 6 segments (dying) | ✅ |

---

## Architecture Compliance

### Application Layer Pattern ✅
- ✅ No new Redux slice (ephemeral data)
- ✅ Coordinates existing slices (crew, clock)
- ✅ Pure functions (testable)
- ✅ Store-agnostic interface (can mock for testing)

### Event Sourcing ✅
- ✅ Uses existing commands (addMomentum, createClock, addSegments)
- ✅ Each consequence logged separately
- ✅ Full audit trail via command history

### Type Safety ✅
- ✅ Full TypeScript coverage
- ✅ Position/Effect/Result union types
- ✅ Structured return types

### TDD Compliance ✅
- ✅ Tests written FIRST (failing)
- ✅ Implementation made tests pass
- ✅ No false positives (verified against rules)

---

## Foundry Integration Pattern

**Example Usage from Foundry:**

```typescript
// Foundry VTT Hook Example
Hooks.on('dnd5e.rollAbilityTest', async (actor, roll, abilityId) => {
  // 1. Get character/crew IDs from actor flags
  const characterId = actor.getFlag('fitgd', 'characterId');
  const crewId = actor.getFlag('fitgd', 'crewId');

  // 2. Extract dice results
  const diceResults = roll.dice[0].results.map(r => r.result);

  // 3. Get position/effect from UI or defaults
  const position = 'risky'; // From UI selection
  const effect = 'standard'; // From UI selection

  // 4. Evaluate roll
  const { result } = evaluateRoll(diceResults);

  // 5. Apply consequence (momentum)
  const { momentumGenerated } = resolveActionConsequence(store, {
    crewId,
    position,
    result,
  });

  // 6. If harm accepted, apply it
  if (playerAcceptsHarm) {
    const { clockId, segmentsAdded, isDying } = applyHarmConsequence(store, {
      characterId,
      position,
      effect,
      harmType: 'Physical Harm',
    });

    if (isDying) {
      ui.notifications.warn(`${actor.name} is dying!`);
    }
  }

  // 7. Update Foundry UI
  ui.notifications.info(`Generated ${momentumGenerated} Momentum`);
});
```

**Flow:**
```
Foundry Rolls → evaluateRoll() → resolveActionConsequence() → applyHarmConsequence()
                       ↓                     ↓                           ↓
                  (result)            (momentum +1/+2/+4)        (harm clock segments)
                                             ↓                           ↓
                                     crew.addMomentum          clock.createClock
                                                               clock.addSegments
```

---

## Summary

**Overall Compliance:** ✅ **100% VERIFIED**

Phase 5.5 successfully implements:
1. ✅ Roll evaluation (1-3 failure, 4-5 partial, 6 success, 6+6 critical)
2. ✅ Position/Effect system (Controlled/Risky/Desperate + Limited/Standard/Great)
3. ✅ Momentum generation on consequences (+1/+2/+4)
4. ✅ Harm segment application (0-6 segments based on position/effect)
5. ✅ Configuration-driven tables (no magic numbers)
6. ✅ Integration-ready for Foundry VTT

**No deviations from game rules detected.**

**Test Results:** 108 tests passing (19 resolution + 89 previous)

**Architecture Benefits:**
- Application layer helpers (not Redux slice)
- Coordinates existing slices
- Event sourced via existing commands
- Foundry provides dice rolling, we provide consequence logic
- Clean separation of concerns

---

## Completed Phases Summary

**Phase 1:** Foundation ✅
**Phase 2:** Character System ✅
**Phase 3:** Crew & Momentum System ✅
**Phase 4:** Clock System ✅
**Phase 5:** Advanced Features ✅
**Phase 5.5:** Resolution Helpers ✅

**Total Test Count:** 108 tests passing

**Next Phase:** Phase 6 - API Implementation & Foundry Integration
- Complete high-level API layer
- Foundry Actor/Item mapping
- State serialization/deserialization
- Example integration patterns
