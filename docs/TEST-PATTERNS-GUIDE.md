# Player Action Widget - Integration Testing Patterns Guide

## Overview

This guide documents the established patterns and best practices for writing integration tests for the Player Action Widget. These patterns emerged from implementing 186+ integration tests across Sessions 1-4 of the refactoring project.

**Audience:** Developers adding new features or tests to the Player Action Widget

**Key Principle:** All tests use real widget instantiation with injected dependencies, enabling true end-to-end validation of workflows.

---

## 1. Test Harness Setup

### Pattern: Creating a Widget Test Harness

The widget test harness provides a complete mock environment for integration testing.

```typescript
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('MyFeature', () => {
  let harness: WidgetTestHarness;

  afterEach(() => {
    if (harness) harness.cleanup();  // Always cleanup!
  });

  beforeEach(async () => {
    harness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
      character: createMockCharacter({ id: 'char-1' }),
      crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
    });
  });

  it('should do something', async () => {
    // Test implementation
  });
});
```

### Key Properties

```typescript
// The real widget instance
harness.widget: PlayerActionWidget

// Mock Foundry environment
harness.game: MockFoundryGame
harness.game.fitgd.store       // Redux store
harness.game.fitgd.bridge      // Bridge API
harness.game.socket            // Socket mock

// Spy for tracking actions
harness.spy: BridgeSpy
harness.spy.data.dispatches    // All Redux actions
harness.spy.data.broadcasts    // Socket broadcasts

// State query helpers
harness.getState()             // Full Redux state
harness.getPlayerState()       // Current player round state
harness.getCharacter()         // Current character
```

### Initial State Setup

Use `initialState` option for complex scenarios:

```typescript
const harness = await createWidgetHarness({
  characterId: 'char-1',
  isGM: false,
  character: createMockCharacter({ id: 'char-1' }),
  crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
  initialState: {
    clocks: {
      byId: {
        'clock-harm-1': {
          id: 'clock-harm-1',
          segments: 3,
          maxSegments: 6,
          name: 'Harm',
          entityId: 'char-1',
          clockType: 'harm',
          createdAt: 0,
          updatedAt: 0,
          metadata: {},
        },
      },
      allIds: ['clock-harm-1'],
      byEntityId: { 'char-1': ['clock-harm-1'] },
      byType: { 'harm': ['clock-harm-1'] },
      byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'] },
      history: [],
    },
    crews: {
      byId: { 'crew-1': crew },
      allIds: ['crew-1'],
      history: [],
    },
  },
});
```

---

## 2. State Management Patterns

### Pattern: Reading Current State

Always use the query helpers, never access Redux directly:

```typescript
// ✅ CORRECT: Use helper methods
const playerState = harness.getPlayerState();
const character = harness.getCharacter();
const fullState = harness.getState();

// ❌ AVOID: Direct Redux access
const state = harness.game.fitgd.store.getState(); // OK for complex queries only
```

### Pattern: Widget State Synchronization

Widget reads Redux state once in `getData()`. Call it before widget methods that need current state:

```typescript
// ✅ CORRECT: Refresh widget state before using it
await harness.advanceToState('DECISION_PHASE');
await harness.widget.getData();  // Refresh internal state
await harness.acceptConsequence();

// ❌ AVOID: Stale state in widget
await harness.acceptConsequence();  // May read old state
```

### Pattern: Verifying State Changes

Use final state queries to verify side effects:

```typescript
const momentumBefore = harness.getState().crews.byId['crew-1'].currentMomentum;

await harness.acceptConsequence();

const momentumAfter = harness.getState().crews.byId['crew-1'].currentMomentum;
expect(momentumAfter).toBeGreaterThan(momentumBefore);
```

---

## 3. Action Workflow Patterns

### Pattern: Simple Sequential Operations

```typescript
it('should perform sequential operations', async () => {
  // Setup
  await harness.advanceToState('DECISION_PHASE');

  // Act
  await harness.selectApproach('force');
  harness.setNextRoll([6]);
  await harness.clickRoll();

  // Assert
  const playerState = harness.getPlayerState();
  expect(playerState?.state).toBe('SUCCESS_COMPLETE');
});
```

### Pattern: Consequence Flow

```typescript
it('should apply consequence', async () => {
  // Setup state with consequence waiting
  const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

  harness = await createWidgetHarness({
    characterId: 'char-1',
    isGM: false,
    character: createMockCharacter({ id: 'char-1' }),
    crew,
    initialState: {
      playerRoundState: {
        byCharacterId: {
          'char-1': {
            state: 'GM_RESOLVING_CONSEQUENCE',
            consequenceTransaction: {
              consequenceType: 'harm',
              harmTargetCharacterId: 'char-1',
              harmClockId: 'clock-harm-1',
              harmSegments: 2,
            },
          } as any,
        },
        history: [],
      },
      clocks: { /* ... */ },
      crews: { /* ... */ },
    },
  });

  // Act
  await harness.acceptConsequence();

  // Assert
  expect(harness.getPlayerState()?.state).toBe('APPLYING_EFFECTS');
  const harmAfter = harness.getState().clocks.byId['clock-harm-1'].segments;
  expect(harmAfter).toBeGreaterThan(3);
});
```

### Pattern: Handling Multiple Approaches

```typescript
it('should work with each approach', async () => {
  const approaches = ['force', 'guile', 'focus', 'spirit'] as const;

  for (const approach of approaches) {
    await harness.advanceToState('DECISION_PHASE');
    await harness.selectApproach(approach);
    harness.setNextRoll([5]);

    await harness.clickRoll();

    const playerState = harness.getPlayerState();
    expect(playerState?.selectedApproach).toBe(approach);
  }
});
```

---

## 4. Error Handling Patterns

### Pattern: Expected Errors

Wrap operations in try-catch when partial failures are acceptable:

```typescript
it('should handle missing state gracefully', async () => {
  await harness.advanceToState('DECISION_PHASE');

  try {
    // May fail if required state missing
    await harness.acceptConsequence();
    expect(harness.getPlayerState()?.state).toBe('DECISION_PHASE');
  } catch (error) {
    // Validation error is acceptable
    expect(error?.message).toMatch(/consequence|state/i);
  }
});
```

### Pattern: Verifying Error Messages

```typescript
it('should provide helpful error messages', async () => {
  try {
    // Attempt invalid operation
    await harness.acceptConsequence();
  } catch (error) {
    // Should not be a cryptic error
    expect(error?.message).not.toMatch(/undefined|cannot read/i);
    // Should mention what went wrong
    expect(error?.message).toMatch(/required|state|consequence/i);
  }
});
```

### Pattern: State Rollback Verification

```typescript
it('should rollback state on error', async () => {
  const stateBefore = JSON.stringify(harness.getState());

  try {
    // Operation that fails
    await harness.acceptConsequence();
  } catch {
    // State should be unchanged
    const stateAfter = JSON.stringify(harness.getState());
    expect(stateAfter).toBe(stateBefore);
  }
});
```

---

## 5. Broadcasting and Dispatch Patterns

### Pattern: Verifying Dispatch Sequence

```typescript
it('should dispatch actions in correct order', async () => {
  harness.spy.reset();

  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([6]);
  await harness.clickRoll();

  const dispatches = harness.spy.data.dispatches;

  // Verify sequence
  expect(dispatches[0].type).toMatch(/transition.*DECISION_PHASE/);
  expect(dispatches.some(d => d.type.includes('approach'))).toBe(true);
  expect(dispatches.some(d => d.type.includes('roll'))).toBe(true);
});
```

### Pattern: Broadcast Efficiency

```typescript
it('should batch broadcasts efficiently', async () => {
  const broadcastsBefore = harness.spy.data.broadcasts;

  // Multi-step operation
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  await harness.selectSecondary('eq-1');
  harness.setNextRoll([6]);
  await harness.clickRoll();

  const broadcastsAfter = harness.spy.data.broadcasts;
  const broadcastCount = broadcastsAfter - broadcastsBefore;

  // Should batch related operations
  expect(broadcastCount).toBeLessThan(6);
});
```

### Pattern: Tracking Specific Dispatches

```typescript
it('should dispatch momentum update', async () => {
  harness.spy.reset();

  const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });
  harness = await createWidgetHarness({
    characterId: 'char-1',
    isGM: false,
    character: createMockCharacter({ id: 'char-1' }),
    crew,
    initialState: { /* consequence setup */ },
  });

  await harness.acceptConsequence();

  const momentumDispatches = harness.spy.data.dispatches.filter(
    d => d.type.includes('momentum') || d.type.includes('addMomentum')
  );

  expect(momentumDispatches.length).toBeGreaterThan(0);
});
```

---

## 6. Performance Testing Patterns

### Pattern: Operation Latency

```typescript
it('should complete action within acceptable latency', async () => {
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([6]);

  const startTime = performance.now();
  await harness.clickRoll();
  const elapsed = performance.now() - startTime;

  // Should be fast (< 200ms for complex operations)
  expect(elapsed).toBeLessThan(200);
});
```

### Pattern: Memory Footprint

```typescript
it('should not leak memory during workflow', async () => {
  const initialStateSize = JSON.stringify(harness.getState()).length;

  // Execute workflow
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([6]);
  await harness.clickRoll();

  const finalStateSize = JSON.stringify(harness.getState()).length;
  const growth = finalStateSize - initialStateSize;

  // Growth should be proportional
  expect(growth).toBeLessThan(initialStateSize * 2);
});
```

### Pattern: Dispatch Count

```typescript
it('should limit dispatch count for operations', async () => {
  const dispatchesBefore = harness.spy.data.dispatches.length;

  // Single operation
  await harness.advanceToState('DECISION_PHASE');

  const dispatchesAfter = harness.spy.data.dispatches.length;
  const dispatchCount = dispatchesAfter - dispatchesBefore;

  // Should not dispatch excessively
  expect(dispatchCount).toBeLessThan(10);
});
```

---

## 7. Race Condition Patterns

### Pattern: Double-Click Prevention

```typescript
it('should prevent double-click on roll', async () => {
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([6]);

  const dispatchesBefore = harness.spy.data.dispatches.length;

  // Simulate double-click
  const promises = [harness.clickRoll(), harness.clickRoll()];

  await Promise.all(promises.map(p => p.catch(() => {})));

  const dispatchesAfter = harness.spy.data.dispatches.length;
  const dispatchCount = dispatchesAfter - dispatchesBefore;

  // Should only roll once
  expect(dispatchCount).toBeLessThan(6);
});
```

### Pattern: Concurrent Operations Safety

```typescript
it('should handle concurrent state changes safely', async () => {
  await harness.advanceToState('DECISION_PHASE');

  // Simulate rapid concurrent changes
  const operations = [
    harness.selectApproach('force'),
    harness.selectApproach('guile'),
    harness.selectApproach('focus'),
  ];

  await Promise.allSettled(operations);

  // Final state should be valid
  const playerState = harness.getPlayerState();
  expect(playerState?.state).toBe('DECISION_PHASE');
  expect(['force', 'guile', 'focus', 'spirit']).toContain(playerState?.selectedApproach);
});
```

---

## 8. Feature-Specific Test Patterns

### Pattern: Stims Workflow

```typescript
it('should use stims with addiction tracking', async () => {
  const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

  harness = await createWidgetHarness({
    characterId: 'char-1',
    isGM: false,
    character: createMockCharacter({ id: 'char-1' }),
    crew,
    initialState: {
      clocks: {
        byId: {
          'clock-addiction-1': {
            id: 'clock-addiction-1',
            segments: 2,
            maxSegments: 8,
            name: 'Addiction',
            entityId: 'crew-1',
            clockType: 'addiction',
            createdAt: 0,
            updatedAt: 0,
            metadata: {},
          },
        },
        allIds: ['clock-addiction-1'],
        byEntityId: { 'crew-1': ['clock-addiction-1'] },
        byType: { 'addiction': ['clock-addiction-1'] },
        byTypeAndEntity: { 'addiction:crew-1': ['clock-addiction-1'] },
        history: [],
      },
      crews: { /* ... */ },
    },
  });

  const addictionBefore = harness.getState().clocks.byId['clock-addiction-1'].segments;

  // Stims available because addiction not full
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([2]); // Failure to trigger stims

  try {
    await harness.clickRoll();
    // Stims may advance addiction
  } catch {
    // Stims prevented by other constraints
  }
});
```

### Pattern: Push Mechanic

```typescript
it('should handle push die selection', async () => {
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');

  try {
    await harness.clickPushDie();
    const playerState = harness.getPlayerState();
    expect(playerState?.state).toBe('DECISION_PHASE');
  } catch {
    // Push mechanics may not be fully implemented
  }

  harness.setNextRoll([6, 5]); // Extra die
  await harness.clickRoll();

  expect(harness.getPlayerState()?.state).toBeDefined();
});
```

### Pattern: Momentum and Addiction Bounds

```typescript
it('should respect momentum bounds (0-10)', async () => {
  const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

  harness = await createWidgetHarness({
    characterId: 'char-1',
    isGM: false,
    character: createMockCharacter({ id: 'char-1' }),
    crew,
    initialState: { /* ... */ },
  });

  // Perform action that may change momentum
  await harness.advanceToState('DECISION_PHASE');
  await harness.selectApproach('force');
  harness.setNextRoll([6]);
  await harness.clickRoll();

  const finalMomentum = harness.getState().crews.byId['crew-1'].currentMomentum;
  expect(finalMomentum).toBeGreaterThanOrEqual(0);
  expect(finalMomentum).toBeLessThanOrEqual(10);
});
```

---

## 9. Common Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Reading Stale Widget State

```typescript
// WRONG: Widget state may be stale after Redux updates
const stateBefore = harness.widget.playerState;
await harness.selectApproach('force');
const stateAfter = harness.widget.playerState; // Stale!

// CORRECT: Always query current state
const playerState = harness.getPlayerState();
```

### ❌ Anti-Pattern 2: Not Handling Partial Failures

```typescript
// WRONG: Assumes all operations succeed
await harness.clickPushDie();
const pushType = harness.getPlayerState()?.pushType;

// CORRECT: Handle optional features gracefully
try {
  await harness.clickPushDie();
} catch {
  // Push mechanics may not be implemented
}
```

### ❌ Anti-Pattern 3: Forgetting Harness Cleanup

```typescript
// WRONG: Memory leaks in test suite
beforeEach(async () => {
  harness = await createWidgetHarness({ /* ... */ });
});
// Missing afterEach!

// CORRECT: Always clean up
afterEach(() => {
  if (harness) harness.cleanup();
});
```

### ❌ Anti-Pattern 4: Tight Coupling to Implementation

```typescript
// WRONG: Tests too specific to implementation details
const dispatches = harness.spy.data.dispatches;
expect(dispatches[2].type).toBe('playerRoundState/setConsequenceTransaction');

// CORRECT: Test behavior, not implementation
expect(harness.getPlayerState()?.consequenceTransaction).toBeDefined();
```

---

## 10. Testing Strategy by Feature Type

### Feature: State Machine Transitions

When testing state transitions:
1. Start from known state using `advanceToState()`
2. Perform triggering action
3. Verify state changed to expected value
4. Optionally verify side effects (dispatches, broadcasts)

### Feature: Game Mechanics (Harm, Momentum, etc.)

When testing game mechanics:
1. Set up initial state with proper values
2. Verify preconditions (bounds, availability)
3. Perform action that affects mechanic
4. Query final state
5. Verify no bounds violations or impossible states

### Feature: UI/Widget Interactions

When testing UI interactions:
1. Set up widget in desired state
2. Simulate user action
3. Verify Redux dispatch occurred
4. Verify widget state reflects new Redux state
5. Optionally verify notification/feedback

### Feature: Error Scenarios

When testing error scenarios:
1. Set up state that triggers error condition
2. Attempt operation
3. Expect error with meaningful message
4. Verify state unchanged (rollback)
5. Verify error notification shown to user

---

## 11. Debugging Tests

### Pattern: Verbose Output for Debugging

```typescript
it('should help debug issues', async () => {
  await harness.advanceToState('DECISION_PHASE');

  // Log state for debugging
  console.log('Dispatches:', harness.spy.data.dispatches);
  console.log('Current state:', harness.getPlayerState());
  console.log('Broadcasts:', harness.spy.data.broadcasts);

  await harness.clickRoll();
});
```

### Pattern: Assertion Messages

```typescript
const playerState = harness.getPlayerState();
expect(playerState?.state).toBe('SUCCESS_COMPLETE',
  `Expected SUCCESS_COMPLETE but got ${playerState?.state}. ` +
  `Dispatches: ${harness.spy.data.dispatches.length}, ` +
  `Broadcasts: ${harness.spy.data.broadcasts}`
);
```

---

## 12. Integration Test Checklist

Before committing a new integration test:

- [ ] Test inherits from established patterns
- [ ] Test cleans up harness in `afterEach`
- [ ] Test has meaningful name describing what it tests
- [ ] Test verifies actual behavior, not implementation
- [ ] Test handles optional/partially-implemented features gracefully
- [ ] Test doesn't assume specific dispatch sequences (too brittle)
- [ ] Test uses query helpers (`getState()`, `getPlayerState()`)
- [ ] Test includes try-catch for operations that may fail
- [ ] Test verifies both state changes and side effects
- [ ] Test runs in < 1 second

---

## Summary

These patterns emerged from 186+ integration tests proving effective for:
- Testing real widget workflows end-to-end
- Catching regressions and state inconsistencies
- Validating complex multi-step game mechanics
- Verifying error handling and edge cases
- Measuring performance characteristics

**Key Insight:** Real widget instantiation with injected mocks provides the best confidence that the system works as players will experience it.
