# Redux Batching Best Practices

## The Batching Pitfall

**Core Rule**: When you batch multiple Redux actions with `bridge.executeBatch()`, ALL actions validate against the **SAME initial state**. The state does NOT update between actions in the batch.

This creates a critical constraint: **You cannot batch sequential state transitions**.

## Why This Matters

State transitions are validated using a state machine ([playerRoundState.ts](file:///d:/GitHub/fitgd/src/types/playerRoundState.ts#L227-L243)). Each state has an allowlist of valid next states.

When batching:
```typescript
const currentState = 'GM_RESOLVING_CONSEQUENCE';

const actions = [
  transitionTo('APPLYING_EFFECTS'),    // Validates: GM_RESOLVING_CONSEQUENCE → APPLYING_EFFECTS ✅
  applyConsequence(),                  // Validates: (no state change) ✅
  transitionTo('TURN_COMPLETE'),       // Validates: GM_RESOLVING_CONSEQUENCE → TURN_COMPLETE ❌ INVALID!
];
```

All three actions see `currentState = 'GM_RESOLVING_CONSEQUENCE'`. The third action fails validation because `GM_RESOLVING_CONSEQUENCE → TURN_COMPLETE` is not a valid direct transition.

## Consequences of Invalid Transitions

When a batched state transition fails:

1. **Socket handler error** → Falls back to full state reload
2. **Command history replay** → Reloads 5000+ commands
3. **Subscription loop** → Each command triggers store subscription
4. **Auto-save spam** → Subscription saves → creates MORE commands
5. **Infinite loop** → 3000+ commands accumulated
6. **Circuit breaker triggers** → Blocks all broadcasts to prevent system lockup
7. **State desync** → GM never receives updates, changes revert on reload

## Correct Patterns

### Pattern 1: Single Transition (Recommended)

Stop at the first valid state. Let widgets close based on state detection, not explicit transitions.

```typescript
// ✅ GOOD: Single transition + side effects
const actions = [
  { type: 'playerRoundState/transitionState', payload: { newState: 'APPLYING_EFFECTS' } },
  { type: 'clocks/addSegments', payload: { clockId, amount: 2 } },
  { type: 'playerRoundState/clearConsequenceTransaction', payload: { characterId } },
];

await bridge.executeBatch(actions);

// Widget closes when it detects APPLYING_EFFECTS state via store subscription
```

### Pattern 2: Sequential Dispatches

If you absolutely need two transitions, split into separate calls:

```typescript
// ✅ GOOD: Separate dispatches for sequential transitions
await bridge.executeBatch([
  { type: 'playerRoundState/transitionState', payload: { newState: 'APPLYING_EFFECTS' } },
  { type: 'clocks/addSegments', payload: { clockId, amount: 2 } },
]);

// WAIT for first batch to complete, then transition to final state
await bridge.execute(
  { type: 'playerRoundState/transitionState', payload: { newState: 'TURN_COMPLETE' } }
);
```

## Common Violations

### ❌ BAD: Consequence Batch with Two Transitions

```typescript
// This causes the bug described above
const actions = [
  workflow.transitionToApplyingAction,      // GM_RESOLVING → APPLYING
  workflow.applyConsequenceAction,          // Apply harm
  workflow.clearTransactionAction,          // Clear data
  workflow.transitionToTurnCompleteAction,  // ❌ APPLYING → TURN_COMPLETE (but state is still GM_RESOLVING!)
];
```

### ❌ BAD: Assuming State Updates Mid-Batch

```typescript
// This assumes currentState updates after first action - IT DOESN'T
const actions = [
  { type: 'playerRoundState/transitionState', payload: { newState: 'ROLLING' } },
  { type: 'playerRoundState/setRollResult', payload: { ... } },        // OK
  { type: 'playerRoundState/transitionState', payload: { newState: 'SUCCESS_COMPLETE' } },  // ❌ FAILS
];
```

## Detection and Prevention

### Pre-Implementation Checklist

Before writing a batch with state transitions:

1. **Count transitions**: How many `transitionState` actions in the batch?
   - 0-1: ✅ Safe
   - 2+: ❌ Redesign needed

2. **Validate sequence**: For EACH transition:
   - What is the CURRENT state? (before batch)
   - Is this transition valid FROM current state?
   - Check [STATE_TRANSITIONS map](file:///d:/GitHub/fitgd/src/types/playerRoundState.ts#L227)

3. **Consider alternatives**:
   - Can widgets close based on state detection instead of explicit final transition?
   - Can you split into sequential dispatches?

### Testing

Always test consequence flows with:
- Open browser console on BOTH GM and Player clients
- Look for "Invalid state transition" errors
- Check autosave-manager warnings: "Suspiciously large command batch"
- Verify GM receives socket updates (check console logs)

### Circuit Breaker (Safety Net)

The circuit breaker in `autosave-manager.ts` detects command spam:

```typescript
if (newCommandCount > 3000) {
  console.error('FitGD | Broadcast blocked by circuit breaker');
  return;  // Block broadcast to prevent system lockup
}
```

**This is a safety mechanism, NOT a solution**. If you see circuit breaker warnings, you have a batching bug that needs fixing.

## Related Files

- [playerRoundState.ts](file:///d:/GitHub/fitgd/src/types/playerRoundState.ts) - State machine definition
- [player-action-widget.md](file:///d:/GitHub/fitgd/docs/player-action-widget.md) - State machine diagram and rules
- [autosave-manager.ts](file:///d:/GitHub/fitgd/foundry/module/autosave/autosave-manager.ts) - Circuit breaker implementation
- [foundry-redux-bridge.ts](file:///d:/GitHub/fitgd/foundry/module/foundry-redux-bridge.ts) - executeBatch implementation
