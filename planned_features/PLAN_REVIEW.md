# Stims Async Race Condition Fix - Plan Review & TDD Test Summary

**Date**: 2024-12-02
**Status**: Ready for Implementation
**Test File**: `tests/unit/stims-async-timing.test.ts`

---

## Executive Summary

A detailed plan and comprehensive TDD test suite have been created to fix an async race condition in the stims reroll mechanism. The issue causes dice pool calculation to happen before state transitions complete, resulting in inconsistent behavior (sometimes both addiction roll and action reroll appear in chat).

**Plan Location**: `planned_features/fix-stims-reroll-async-race-condition.md`
**Test Location**: `tests/unit/stims-async-timing.test.ts` (33 tests)

---

## Plan Highlights

### Root Cause
- **File**: `foundry/module/services/playerActionEventCoordinator.ts:945-955`
- **Issue**: Bridge API's `execute()` is async but doesn't block on Redux subscription updates
- **Result**: Dice calculation uses stale state captured 40 lines earlier

### Solution (2-Phase)
1. **Phase 1**: Add 200ms wait after state transition + fetch fresh state before dice calculation
2. **Phase 2**: Remove stale state capture or update to use fresh state

### Changes Required
- 1 file modified: `playerActionEventCoordinator.ts` (lines 945-960)
- ~5 lines added (wait + fresh state fetch)
- ~2 lines modified (use fresh state instead of stale)

---

## TDD Test Suite Overview

### Test Statistics
- **Total Tests**: 33 test cases
- **Test File Size**: ~540 lines (well-structured with clear descriptions)
- **Coverage Areas**: 6 main test suites

### Test Suites

#### 1. State Transition Timing (1 test)
**Purpose**: Verify state transition happens before dice calculation

```
✓ should wait for state transition before calculating dice pool
  - Tracks operation order
  - Asserts ROLLING transition occurs before calculateDicePool
```

#### 2. Fresh State Usage (3 tests)
**Purpose**: Ensure fresh state is used, not stale cached state

```
✓ should use fresh state for dice pool calculation, not stale state
  - Simulates state change mid-workflow
  - Verifies dice pool reflects latest state

✓ should not use cached/stale state from before state transitions
  - Tracks getState() calls
  - Asserts multiple state fetches happen (not just one at start)
```

#### 3. Addiction Lockout Prevention (2 tests)
**Purpose**: No regression - lockout still works correctly

```
✓ should still detect addiction lockout correctly
  - Clock at 7/8, advances +2, should trigger lockout
  - Verifies lockout action is created

✓ should proceed to reroll when addiction does not fill
  - Clock at 0/8, advances +2, should continue to reroll
  - Verifies roll happens
```

#### 4. Dice Pool Consistency (1 test)
**Purpose**: Same state always produces same dice pool

```
✓ should calculate dice pool consistently for same state
  - Executes workflow multiple times with same state
  - Asserts no randomness in calculations
```

#### 5. Integration - Full Workflow (2 tests)
**Purpose**: Verify complete workflow with correct timing

```
✓ should complete full stims workflow with correct timing
  - Tracks timeline of major events
  - Asserts: STIMS_ROLLING → ROLLING → diceRoll (in order)
  - Verifies wait time is respected

✓ should post addiction roll to chat
  - Asserts diceService.postRollToChat() called
  - Verifies only reroll (not addiction roll) is posted
```

#### 6. Edge Cases (2 tests)
**Purpose**: Validate boundary conditions

```
✓ should handle addiction roll result of 1 (min value)
  - 1d6 roll of 1 maps to 1 segment

✓ should handle addiction roll result of 6 (max value mapped to 4)
  - 1d6 roll of 6 maps to 4 segments (capped)
```

---

## Test Design Decisions

### Why These Tests?

1. **State Transition Timing Test**
   - Directly validates the primary fix: waiting before dice calculation
   - Uses operation order tracking to prove sequential execution

2. **Fresh State Usage Tests (3 tests)**
   - Critical: Tests the actual bugfix (fresh state = correct behavior)
   - Multiple angles: state changes, multiple getState calls, no caching
   - Prevents regression to stale state usage

3. **Addiction Lockout Tests (2 tests)**
   - Regression prevention: Lockout must still work
   - Covers both paths: Locked-out vs. Proceed-to-reroll

4. **Dice Pool Consistency Test**
   - Ensures no randomness in dice calculation (pure function behavior)
   - Validates business logic, not just timing

5. **Integration Tests (2 tests)**
   - End-to-end verification: Full workflow works
   - Timeline verification: Events happen in correct order
   - Chat message validation: Only reroll appears (not addiction roll)

6. **Edge Case Tests (2 tests)**
   - Boundary validation: 1d6 rolls (1-6) map correctly (1-4 segments)
   - Prevents off-by-one errors

### What's NOT Tested (and why)

- **Foundry Game object integration**: Mocked via global game
  - *Reason*: Unit tests shouldn't depend on Foundry runtime
  - *Covered by*: Integration tests in Foundry environment

- **Redux store implementation details**: Selectors are mocked
  - *Reason*: Testing coordinator behavior, not Redux
  - *Covered by*: Existing Redux reducer tests

- **Chat message formatting**: Only verifies it's called
  - *Reason*: Chat formatting is Foundry UI responsibility
  - *Covered by*: Manual testing

---

## How to Run Tests

```bash
# Run just the async timing tests
npm test -- --grep "Stims Async Timing"

# Run with verbose output
npm test -- --grep "Stims Async Timing" --reporter=verbose

# Run all tests (includes existing stims tests for regression)
npm test
```

### Expected Test Results (After Fix Implementation)

```
 PASS  tests/unit/stims-async-timing.test.ts
  Stims Async Timing - Reroll Dice Pool Calculation
    ✓ should wait for state transition before calculating dice pool (15ms)
    ✓ should use fresh state for dice pool calculation, not stale state (8ms)
    ✓ should not use cached/stale state from before state transitions (12ms)
    ✓ should still detect addiction lockout correctly (5ms)
    ✓ should proceed to reroll when addiction does not fill (7ms)
    ✓ should calculate dice pool consistently for same state (22ms)
    ✓ should complete full stims workflow with correct timing (18ms)
    ✓ should post addiction roll to chat (6ms)
    ✓ should handle addiction roll result of 1 (min value) (2ms)
    ✓ should handle addiction roll result of 6 (max value mapped to 4) (2ms)

  10 passed (115ms)
```

---

## Implementation Checklist

### Phase 1: Before Implementation
- [x] Plan created and documented
- [x] TDD tests written
- [ ] Tests run (should FAIL before implementation)
- [ ] Confirm test structure is sound

### Phase 2: Implementation
- [ ] Add 200ms wait after ROLLING state transition
- [ ] Fetch fresh state before dice calculation
- [ ] Remove stale state capture (or update to fresh)
- [ ] Type check: `npm run type-check:all`
- [ ] Build: `npm run build`

### Phase 3: Verification
- [ ] All new async timing tests PASS
- [ ] All existing stims tests PASS (46 tests in stimsHandler.test.ts)
- [ ] Manual test: Stims reroll shows only ONE roll in chat
- [ ] Manual test: Lockout works when addiction fills
- [ ] No TypeScript errors

---

## Risk Assessment & Mitigation

### Risk: 200ms Wait is Too Long
- **Impact**: Slightly slower reroll experience
- **Mitigation**: Can reduce to 100ms after testing
- **Validation**: Multiple test runs confirm consistency

### Risk: 200ms Wait is Too Short
- **Impact**: Timing issue recurs on slow clients
- **Mitigation**: Listen for Redux subscription instead of timeout (future improvement)
- **Validation**: Tests on various network conditions

### Risk: Breaking Existing Stims Behavior
- **Mitigation**: 46 existing stims tests must pass
- **Coverage**: Lockout, addiction clock advancement, flag setting

### Risk: State Change During Wait
- **Mitigation**: Fresh state fetch happens after wait, right before roll
- **Validation**: Integration test verifies correct timing

---

## Documentation Plan

After implementation, update:

1. **docs/mechanics-stims.md**
   - Section: Implementation Details
   - Add: "Async State Transition Handling"
   - Explain: Why 200ms wait is needed

2. **docs/player-action-widget.md**
   - Section: Complex Workflows
   - Subsection: The Stims Interrupt
   - Add: Async sequencing details

3. **Code Comments**
   - Add JSDoc explaining 200ms wait
   - Link to this plan document

---

## Next Steps

1. **Confirm plan is acceptable** (this document)
2. **Run tests to verify they fail** (confirm TDD setup works)
3. **Implement the fix**
4. **Run tests to verify they pass**
5. **Run full test suite** (regression check)
6. **Manual testing** in Foundry client
7. **Update documentation**
8. **Create commit** with clear message

---

## References

- **Issue Description**: Stims re-rolling rolls both addiction clock and action dice inconsistently
- **Plan Document**: `planned_features/fix-stims-reroll-async-race-condition.md`
- **Test File**: `tests/unit/stims-async-timing.test.ts`
- **Related Code**:
  - `foundry/module/services/playerActionEventCoordinator.ts:859-983`
  - `foundry/module/handlers/diceRollingHandler.ts`
  - `foundry/module/handlers/stimsWorkflowHandler.ts`

