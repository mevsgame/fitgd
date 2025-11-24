# State Machine Architectural Improvements

> [!IMPORTANT]
> **DO NOT IMPLEMENT** unless explicitly requested by user.
> This document exists for planning purposes only.

## Context

The Redux state machine for `playerRoundState` has a subtle but critical bug pattern: batching multiple sequential state transitions fails validation because all actions in a batch validate against the same initial state.

**Current Status**:
- ✅ **Phase 1 Complete**: Runtime validation in `executeBatch` prevents this bug (see [foundry-redux-bridge.ts](file:///d:/GitHub/fitgd/foundry/module/foundry-redux-bridge.ts))
- ⏳ **Phase 2**: Workflow encapsulation (this document)
- ⏳ **Phase 3**: Middleware validation (this document)

## Phase 2: Workflow Encapsulation (Option 3)

### Goal
Create high-level methods that encapsulate common state machine workflows, hiding complexity and enforcing correct patterns.

### Implementation

#### 1. Create WorkflowManager Class

**File**: `foundry/module/workflows/WorkflowManager.ts`

```typescript
import type { FoundryReduxBridge } from '../foundry-redux-bridge';
import type { RootState } from '@/store';
import type { ConsequenceTransaction } from '@/types/playerRoundState';
import { ConsequenceApplicationHandler } from '../handlers/consequenceApplicationHandler';

/**
 * Manages high-level state machine workflows
 * Encapsulates correct batching patterns to prevent state transition bugs
 */
export class WorkflowManager {
  constructor(private bridge: FoundryReduxBridge) {}

  /**
   * Apply consequence workflow
   * Handles: GM_RESOLVING_CONSEQUENCE → APPLYING_EFFECTS + apply harm/clock
   */
  async applyConsequence(
    characterId: string,
    crewId: string | null,
    transaction: ConsequenceTransaction,
    state: RootState
  ): Promise<void> {
    const handler = new ConsequenceApplicationHandler({ characterId, crewId });
    const workflow = handler.createConsequenceApplicationWorkflow(state, transaction);

    // CORRECT: Single transition + side effects in one batch
    await this.bridge.executeBatch(
      [
        workflow.transitionToApplyingAction,   // GM_RESOLVING → APPLYING
        workflow.applyConsequenceAction,        // Apply harm/clock
        workflow.clearTransactionAction,        // Cleanup
      ],
      {
        affectedReduxIds: [
          characterId,
          ...(workflow.characterIdToNotify ? [workflow.characterIdToNotify] : []),
          ...(crewId ? [crewId] : []),
        ].map(id => asReduxId(id)),
        silent: false,
      }
    );

    // Widget closes based on detecting APPLYING_EFFECTS state
    // No need to transition to TURN_COMPLETE here
  }

  /**
   * Stims workflow
   * Handles: GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → ROLLING (reroll)
   */
  async useStims(
    characterId: string,
    /* ... */
  ): Promise<void> {
    // Implementation encapsulates correct stims flow
  }

  /**
   * Rally workflow
   * Handles: DECISION_PHASE → RALLY_ROLLING → DECISION_PHASE
   */
  async rally(
    characterId: string,
    /* ... */
  ): Promise<void> {
    // Implementation encapsulates correct rally flow
  }
}
```

#### 2. Expose via Game API

**File**: `foundry/module/fitgd.ts`

```typescript
import { WorkflowManager } from './workflows/WorkflowManager';

// In 'init' hook
game.fitgd!.workflows = new WorkflowManager(game.fitgd!.bridge);
```

#### 3. Update Widget to Use Workflows

**File**: `foundry/module/widgets/player-action-widget.ts`

```typescript
// Before (manual batching)
const actions = [
  workflow.transitionToApplyingAction,
  workflow.applyConsequenceAction,
  workflow.clearTransactionAction,
];
await game.fitgd.bridge.executeBatch(actions, { ... });

// After (workflow method)
await game.fitgd.workflows.applyConsequence(
  this.characterId,
  this.crewId,
  transaction!,
  state
);
```

### Benefits
- Single source of truth for each workflow
- Hides batching complexity
- Easier to test
- Self-documenting API

### Risks
- Requires refactoring all state machine workflows
- Need to identify all common patterns
- May over-abstract simple cases

---

## Phase 3: Middleware Validation (Option 4)

### Goal
Add Redux middleware that validates ALL state transitions, not just batched ones.

### Implementation

#### 1. Create Middleware

**File**: `src/middleware/stateTransitionValidator.ts`

```typescript
import type { Middleware } from '@reduxjs/toolkit';
import { isValidTransition, STATE_TRANSITIONS } from '../types/playerRoundState';

/**
 * Validates all playerRoundState transitions
 * Prevents invalid state machine transitions at the Redux level
 */
export const stateTransitionValidator: Middleware = store => next => action => {
  // Only validate state transitions
  if (action.type !== 'playerRoundState/transitionState') {
    return next(action);
  }

  const { characterId, newState } = action.payload;
  const currentState = store.getState().playerRoundState.byCharacterId[characterId]?.state;

  // Allow initialization
  if (!currentState) {
    return next(action);
  }

  // Validate transition
  if (!isValidTransition(currentState, newState)) {
    const validTransitions = STATE_TRANSITIONS[currentState] || [];
    
    console.error('❌ Invalid state transition detected!');
    console.error(`   From: ${currentState}`);
    console.error(`   To: ${newState}`);
    console.error(`   Valid transitions from ${currentState}:`, validTransitions);
    console.error(`   Character: ${characterId}`);
    console.trace('Stack trace:');

    // In development: throw error
    if (import.meta.env.DEV) {
      throw new Error(
        `Invalid state transition: ${currentState} → ${newState}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }

    // In production: silently ignore (safer than crashing)
    console.warn('⚠️  Transition blocked in production mode');
    return; // Don't dispatch
  }

  // Valid transition - proceed
  return next(action);
};
```

#### 2. Add to Store Configuration

**File**: `src/store/index.ts`

```typescript
import { stateTransitionValidator } from '../middleware/stateTransitionValidator';

export function configureStore() {
  return createStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(stateTransitionValidator),
  });
}
```

### Benefits
- Catches ALL invalid transitions (batched or not)
- Works across entire application
- Can be development-only or production-safe
- No code changes required in widgets/handlers

### Risks
- Might catch edge cases that need special handling
- Adds runtime overhead to every transition
- Could mask real bugs if too permissive in production

---

## Decision Criteria

**Implement Phase 2 (Workflows) if**:
- State machine becomes more complex (more states/workflows)
- Many widgets/handlers duplicate state transition logic
- Need better testing coverage of workflows

**Implement Phase 3 (Middleware) if**:
- Finding state transition bugs in non-batched code
- Want comprehensive validation across entire app
- Need production safety net

**Don't implement either if**:
- Phase 1 validation catches all issues
- Code complexity would increase without clear benefit
- Team finds current pattern acceptable

---

## Related Documentation

- [docs/redux-batching-rules.md](file:///d:/GitHub/fitgd/docs/redux-batching-rules.md) - Batching best practices
- [docs/player-action-widget.md](file:///d:/GitHub/fitgd/docs/player-action-widget.md) - State machine diagram
- [src/types/playerRoundState.ts](file:///d:/GitHub/fitgd/src/types/playerRoundState.ts) - STATE_TRANSITIONS definition
