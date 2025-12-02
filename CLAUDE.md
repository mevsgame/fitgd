# Forged in the Grimdark - Redux Implementation Guide

**TypeScript + Redux Toolkit** event-sourced state management for character and crew sheets. Foundry VTT compatible with full command history for time-travel, undo, and audit trails.

---

## Change Pipeline: Documentation-First → TDD → Implementation

**⚠️ MANDATORY WORKFLOW FOR ALL FEATURES:**

Every feature change follows this pipeline. Skipping steps invalidates the work.

### Phase 1: Documentation & Rules Validation

**BEFORE writing any code:**

1. **Review `vault/rules_primer.md`**
   - Does the proposed change align with existing game rules?
   - Does it contradict any existing mechanics?
   - Are there edge cases defined in the rules?

2. **Review relevant `docs/` files**
   - Check `docs/` for architecture decisions affecting this change
   - Review existing patterns for similar features
   - Identify what documentation needs updating

3. **Validate against rules**
   - If change contradicts rules primer → STOP, ask user to update primer first
   - If change extends rules → Update primer first, then proceed
   - If change is implementation-only → Proceed to Phase 2

**Checklist:**
- [ ] Read relevant sections of `vault/rules_primer.md`
- [ ] Read relevant `docs/` architecture files
- [ ] Identified any rule contradictions
- [ ] If new rules needed: Rules primer updated and approved

### Phase 2: Test-First Development (TDD)

**BEFORE implementing features:**

1. **Write failing tests that describe desired behavior**
   - Tests reflect the rules defined in vault/rules_primer.md
   - Tests verify command → state transformations
   - Tests cover all scenarios mentioned in rules

2. **Test structure:**
   ```typescript
   // ✅ CORRECT: Test describes the rule, not implementation
   describe('Addiction Clock Reset', () => {
     it('should reduce clock by resetReduction value from rules', () => {
       // Per vault/rules_primer.md: "addiction resets reduce progress by N"
       const state = createStateWithAddictionClock({ segments: 4 });
       const action = resetAddictionClock(crewId);
       const newState = reducer(state, action);

       // DEFAULT_CONFIG.clocks.addiction.resetReduction defines the amount
       expect(newState.clocks.byId[clockId].segments)
         .toBe(4 - DEFAULT_CONFIG.clocks.addiction.resetReduction);
     });
   });
   ```

3. **Run tests - they MUST fail initially**
   ```bash
   npm test -- --grep "Addiction Clock Reset"
   # Should show: FAIL ✓ (test exists but fails)
   ```

4. **Test coverage requirements:**
   - Happy path (main game flow)
   - Edge cases (boundaries, empty states)
   - Rule-based scenarios (all conditions in rules)
   - Error conditions (invalid inputs)

**Checklist:**
- [ ] Created test file with failing tests
- [ ] Tests verify rules from vault/rules_primer.md
- [ ] Tests cover all scenarios in documentation
- [ ] Ran tests: confirmed they fail as expected
- [ ] Each test has JSDoc linking to rules

### Phase 3: Implementation

**AFTER tests are written and documented:**

1. **Implement to make tests pass**
   ```bash
   npm test -- --grep "Addiction Clock Reset"
   # Should show: PASS ✓
   ```

2. **Implementation must:**
   - Use selectors for state queries (don't access state directly)
   - Use functions in `src/utils/` for business logic
   - Use `DEFAULT_CONFIG` for game values
   - Never contradict vault/rules_primer.md

3. **No scope creep:**
   - Only implement what tests specify
   - Don't add "improvements" or extra features
   - Don't refactor unrelated code

### Phase 4: Documentation Updates

**AFTER implementation is working:**

1. **Update `docs/` files to reflect new behavior**
   - Add implementation notes if complex
   - Document patterns used (selectors, utils structure)
   - Link to relevant rules in vault/rules_primer.md

2. **Update code comments only for unclear logic:**
   - JSDoc for public functions (required)
   - Inline comments only where logic isn't self-evident
   - Never comment obvious code

**Checklist:**
- [ ] Updated relevant `docs/` files
- [ ] Updated CLAUDE.md if new patterns introduced
- [ ] All JSDoc has examples
- [ ] No unused documentation files created

### Phase 5: Verification & Review

**BEFORE committing:**

1. **Type check & build**
   ```bash
   npm run type-check:all && npm run build
   ```

2. **Run tests (minimal output)**
   ```bash
   npm test 2>&1 | grep -E "^(PASS|FAIL|Tests:|✓|✗)" | tail -50
   # For specific test: npm test -- --grep "pattern" 2>&1 | grep -E "^(✓|✗|Error)"
   ```

3. **Verification checklist:**
   - [ ] Passes type-check:all and build
   - [ ] All tests pass (check failure summary only)
   - [ ] No code contradicts vault/rules_primer.md
   - [ ] Tests verify rules, not implementation
   - [ ] Used Bridge API (if Foundry changes)
   - [ ] Documentation updated
   - [ ] Tested with GM + Player clients (if UI changes)

---

## When Rules Primer Needs Updating

**Scenario 1: New Feature Requiring Rule Changes**
```
User: "Add a mechanic that reduces harm clock reset by 1"
Claude: STOP. This requires rules primer update.
  1. Ask user: Should vault/rules_primer.md be updated?
  2. Wait for user approval
  3. Update vault/rules_primer.md with new rule
  4. Follow change pipeline with new rule in place
```

**Scenario 2: Bug Fix Contradicts Rules**
```
User: "Fix bug in momentum calculation"
Claude:
  1. Find the contradiction
  2. Ask: "Implement per rules, or should rules change?"
  3. If rules change: Update vault/rules_primer.md first
  4. Then follow change pipeline
```

**Scenario 3: Clarifying Ambiguous Rules**
```
User: "The rules say X is 'sometimes' applied. When exactly?"
Claude:
  1. Propose clarification to vault/rules_primer.md
  2. Get approval
  3. Implement based on clarified rule
```

**⚠️ GOLDEN RULE:**
- No implementation can contradict vault/rules_primer.md
- If contradiction exists, user must update rules primer first
- Code changes always follow rule changes, never precede them

---

## Architecture & Code Principles

**GOLDEN RULE:** All business logic belongs in Redux layer, NOT Foundry widgets.

### Foundry-Redux Separation
- **Foundry:** UI rendering, event handling, Bridge API calls
- **Redux:** Game rules, validation, pure functions, configuration

```typescript
// ✅ CORRECT: Business logic in Redux utils (src/utils/diceRules.ts)
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  const sixes = rollResult.filter(d => d === 6).length;
  if (sixes >= 2) return 'critical';
  // ...
}

// Foundry widget uses it (imports from Redux layer)
import { calculateOutcome } from '@/utils/diceRules';
const outcome = calculateOutcome(rollResult);
```

### Code Organization

1. **Pure functions** → `src/utils/` (TDD first, write tests before code)
2. **State queries** → `src/selectors/` (search for existing first with `grep -rn "selectName" src/selectors/`)
3. **Game values** → `src/config/gameConfig.ts` (no magic numbers)
4. **Types** → Export with functions: `export type X = ...; export function y(): X { }`

### State Query Pattern

```typescript
// ✅ CORRECT: Use existing selector
import { selectAddictionClockByCrew } from '@/selectors/clockSelectors';
const clock = selectAddictionClockByCrew(state, crewId);
// Memoized, testable, reusable, type-safe
```

### Test Coverage Requirements

Every function/selector should cover:
- Happy paths (all valid outcomes)
- Edge cases (boundaries, empty inputs)
- Rule-based scenarios (all conditions in rules)
- Error conditions (invalid inputs)

### Architectural Decision Template

When adding game logic, ask:
1. **Is this a pure function?** → Extract to `src/utils/`
2. **Is this a state query?** → Create selector in `src/selectors/`
3. **Is this a constant game value?** → Add to `src/config/gameConfig.ts`
4. **Is this Foundry-specific UI?** → Can stay in Foundry widget
5. **Can this be reused?** → MUST be in Redux layer

**Default:** If in doubt, extract to Redux layer.

### JSDoc Requirements

```typescript
/**
 * Calculate dice roll outcome based on Forged in the Dark rules
 *
 * @param rollResult - Array of dice values
 * @returns The outcome of the roll
 *
 * @example
 * calculateOutcome([6, 6, 3]) // 'critical'
 * calculateOutcome([5, 4, 3]) // 'partial'
 */
export type DiceOutcome = 'critical' | 'success' | 'partial' | 'failure';
export function calculateOutcome(rollResult: number[]): DiceOutcome { /* ... */ }
```

All public functions require JSDoc with examples. Types should be exported alongside functions.

---

## Data Model

### Entities (Redux IDs = Foundry Actor IDs)

```typescript
interface Character {
  id: string;                      // Foundry Actor ID
  name: string;
  traits: Trait[];
  approaches: Approaches;          // 4 approaches (force, guile, focus, spirit), 0-4 dots
  equipment: Equipment[];
  rallyAvailable: boolean;
}

interface Crew {
  id: string;                      // Foundry Actor ID
  name: string;
  characters: string[];            // Character IDs
  currentMomentum: number;         // 0-10, starts at 5
}

interface Clock {
  id: string;
  entityId: string;                // characterId or crewId
  clockType: 'harm' | 'addiction' | 'progress';
  segments: number;
  maxSegments: number;
  metadata?: { rarity?: string; tier?: string; frozen?: boolean };
}

interface Command<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  version: number;
  commandId: string;               // UUID for idempotency
}
```

### Redux Store Structure

```typescript
interface RootState {
  characters: { byId: Record<string, Character>; allIds: string[]; history: Command[] };
  crews: { byId: Record<string, Crew>; allIds: string[]; history: Command[] };
  clocks: {
    byId: Record<string, Clock>;
    allIds: string[];
    byEntityId: Record<string, string[]>;      // Efficient lookup
    byType: Record<string, string[]>;
    byTypeAndEntity: Record<string, string[]>; // "harm:character-123"
    history: Command[];
  };
}
```

---

## Game Rules Configuration

All game rules centralized in `src/config/gameConfig.ts`:

```typescript
export const DEFAULT_CONFIG: GameConfig = {
  character: {
    startingTraitCount: 2,
    startingApproachDots: 5,
    maxDotsPerApproach: 4,
  },
  crew: {
    startingMomentum: 5,
    maxMomentum: 10,
    minMomentum: 0,
  },
  clocks: {
    harm: { maxClocks: 3, segments: 6 },
    addiction: { segments: 8, resetReduction: 2 },
    progress: { segments: 4 },
  },
  rally: { maxMomentumToUse: 3 },
};
```

**Benefits:** Easy playtesting, campaign-specific overrides, data-driven balance.

---

## Foundry-Redux Bridge API

**Use Bridge API for ALL state changes in Foundry widgets.**

```javascript
// ✅ CORRECT: Single call encapsulates dispatch → broadcast → refresh
await game.fitgd.bridge.execute({ type: 'action', payload: {...} });

// ✅ CORRECT: Batch multiple actions (prevents render race conditions)
await game.fitgd.bridge.executeBatch([
  { type: 'action1', payload: {...} },
  { type: 'action2', payload: {...} }
]);

// ❌ WRONG: Direct dispatch without broadcast/refresh
game.fitgd.store.dispatch({ type: 'action', payload: {...} });
```

**Why:** Encapsulates 3+ required steps (dispatch → broadcast → refresh) into one call. Automatic ID mapping, batch support.

---

## Critical Implementation Patterns

### Unified IDs (Foundry Actor ID === Redux ID)
- No separate ID mapping layer - use Foundry IDs directly
- Simpler code, better debugging, faster access

### Broadcasting Pattern
- **Rule:** Every bare `store.dispatch()` MUST be followed by `await game.fitgd.saveImmediate()`
- **Exception:** Socket handlers in `receiveCommandsFromSocket()` intentionally skip this to prevent infinite loops
- **Better:** Use Bridge API to avoid this entirely

### Render Lifecycle
- **Pattern 1:** Let Redux subscriptions handle ALL rendering
  ```javascript
  async _onRoll() {
    dispatch(transitionState('ROLLING'));
    await saveImmediate();  // Subscription handles render
    const result = await this._rollDice();
    dispatch(setRollResult(result));
    await saveImmediate();  // Subscription handles render
  }
  ```

- **Pattern 2:** Batch dispatches before broadcast
  ```javascript
  dispatch(action1());
  dispatch(action2());
  dispatch(action3());
  await saveImmediate();  // Single render cycle
  ```

- **Render blocking:** Use `render(true)` for structural changes, `render(false)` for value updates (Foundry-specific optimization)

### Quick Reference
- **Broadcast loops:** Update `lastBroadcastCount` immediately after socket commands
- **Clock deletion:** Capture entityId mapping BEFORE deleting
- **Harm overflow:** Cap segments at max, don't error
- **Orphaned commands:** Make replay resilient to "entity not found"
- **Package manager:** Both npm and pnpm supported; use consistently

---

## Critical Rules

### Sacred Documents (Non-negotiable)

**`vault/rules_primer.md` - CANONICAL GAME RULES**
- Single source of truth for all mechanics
- All code MUST validate against this
- If code contradicts rules → STOP, ask user to update primer first
- Never modify implicitly or as side effect of other work

**`docs/` - ARCHITECTURE PATTERNS**
- Describes Redux/Foundry integration patterns
- Review before implementing new features
- Update AFTER implementation is working

### DO
- **ALWAYS follow 5-phase pipeline** (Documentation → TDD → Implementation → Docs → Verification)
- **Read rules primer BEFORE writing code**
- **Write failing tests FIRST** before implementation
- Use Bridge API for state changes (`game.fitgd.bridge.execute()` / `executeBatch()`)
- Let Redux subscriptions handle all rendering
- Batch dispatches before broadcast
- Run `npm install` at start of session
- Type-check before committing: `npm run type-check:all && npm run build`

### DO NOT
- Write code without reading rules primer first
- Implement without test-first approach (tests must fail initially)
- Call `store.dispatch()` directly in Foundry widgets (use Bridge API)
- Call `saveImmediate()` or `refreshSheetsByReduxId()` manually
- Call `this.render()` - let Redux subscriptions handle it
- Commit without type-check and build verification
- Create markdown files documenting current progress, plans, summaries, or explanations of work (user will explicitly request such documentation)

### Exceptions
- **Socket handlers:** Intentionally use bare dispatch to prevent infinite broadcast loops
- **`git commit --no-verify`:** Only when **user explicitly requests it**. This bypasses the pre-commit hook. Use when:
  - Feature is working but tests need refactoring
  - Test-code tension exists (feature proven, tests not reflecting reality)
  - User has reviewed and approved proceeding without passing tests
  - Always document why in commit message and investigate tests later

---

## Development Workflow

### Installation (Run First)
```bash
npm install  # or: pnpm install (either works, use consistently)
npm run build
```

### Before Committing

**Pre-commit Hook Guarantee:** The pre-commit hook ensures the previous commit had successful tests and type checks. If test or type-check failures appear, they indicate a regression and must be investigated and fixed.

```bash
# Type check & build
npm run type-check:all && npm run build

# Run tests (minimal output only)
npm test 2>&1 | grep -E "^(PASS|FAIL|Tests:|✓|✗)" | tail -50
# For specific test: npm test -- --grep "pattern" 2>&1 | grep -E "^(✓|✗|Error)"

# Commit
git add .
git commit -m "your message"
git push
```

### Quick Command Reference

```bash
npm run type-check:core          # Type check src/ only
npm run type-check:foundry       # Type check foundry module
npm run type-check:all           # Type check everything
npm run build:watch              # Watch and rebuild
npm test -- --grep "pattern"     # Run specific test
```

---

## Project Structure

```
src/
├── api/              # High-level API
├── store/            # Store configuration
├── slices/           # Redux reducers
├── selectors/        # Memoized selectors
├── utils/            # Pure functions
├── config/           # gameConfig.ts
├── validators/       # Rule validation
└── types/            # TypeScript interfaces

tests/
├── unit/             # Per-reducer tests
├── integration/      # Cross-slice workflows
└── fixtures/         # Test data

foundry/module/
├── foundry-redux-bridge.mjs  # Bridge API
├── handlers/         # Business logic
├── dialogs/          # Dialog UIs
└── widgets/          # Component widgets

docs/                 # Architecture documentation
vault/                # Game rules (rules_primer.md)
```

## Foundry Integration Notes

- **Redux ID = Foundry Actor ID** (no separate ID layer)
- Character/Crew are Foundry Actors
- Selectors fetch derived data (harm clocks, etc.)
- Foundry saves Redux state snapshot to world data
- Data flow: Foundry UI → Bridge API → Redux → Selectors → Actor Update