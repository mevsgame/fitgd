# Forged in the Grimdark - Redux Implementation Guide

 
## Project Overview

**TypeScript + Redux Toolkit** event-sourced state management system for character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

---

## Core Architecture Principles

### 1. Event Sourcing
- Full snapshot + complete command history stored
- Current state is single source of truth
- Command history allows reconstruction, undo, and audit trails

### 2. Entity Separation
**High-change entities** (separate stores with full history):
- `Clock` - Abstract entity for harm, addiction, progress tracking
- `Momentum` - Crew-level shared resource
- `PlayerRoundState` - Turn workflow and action resolution state

**Low-change entities** (snapshot with history):
- `Character` - Traits, approaches, equipment, harm clocks
- `Crew` - Metadata, campaign info
- `Equipment` - Loot with state tracking (equipped, locked, consumed)

**Design Principle:** Clocks are generic/reusable. Different clock types are instances of the same `Clock` entity with different metadata.

### 3. TDD First
- Every feature starts with failing tests
- Tests verify command → state transformations
- Property-based tests for invariant checking

### 4. Foundry Compatibility
- **No Foundry dependencies** in core logic
- Expose serializable JSON state for Foundry persistence
- Provide command replay mechanism
- Clean interfaces for Foundry (dice rolling, persistence)

### 5. Documentation-First, Rules-Driven Development
- **`vault/rules_primer.md` is the canonical source of truth** for all game mechanics
- All feature changes must be validated against existing rules before implementation
- Documentation in `docs/` must be updated BEFORE code changes for new features
- No implementation can contradict the rules primer without explicit user approval to change the primer first

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
   npm run type-check:all
   npm run build
   ```

2. **Run full test suite**
   ```bash
   npm test
   # All tests pass, including new ones
   ```

3. **Manual testing (if UI changes)**
   - Test with GM + Player clients
   - Verify state syncs correctly

4. **Code review checklist:**
   - [ ] Passes type-check:all
   - [ ] Passes build
   - [ ] All tests pass (including new ones)
   - [ ] No code contradicts vault/rules_primer.md
   - [ ] Tests verify rules, not implementation
   - [ ] Used Bridge API (if Foundry changes)
   - [ ] Documentation updated

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

## Code Best Practices (From 4-Phase Audit)

### 1. Foundry-Redux Separation ✅

**GOLDEN RULE:** All business logic belongs in Redux layer, NOT Foundry widgets.

**Foundry Layer (Presentation):**
- UI rendering, event handling
- Foundry API integration
- Bridge API calls to update Redux

**Redux Layer (Business Logic):**
- Game rules, state management
- Validation, pure utility functions
- Configuration values

```typescript
// ✅ CORRECT: Business logic in Redux utils
// src/utils/diceRules.ts
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  const sixes = rollResult.filter(d => d === 6).length;
  if (sixes >= 2) return 'critical';
  // ...
}

// Foundry widget uses it
import { calculateOutcome } from '@/utils/diceRules';
const outcome = calculateOutcome(rollResult);
```

### 2. Check for Existing Selectors First ✅

```bash
# Before implementing state queries, search for existing selectors
grep -rn "selectStims" src/selectors/
```

Use existing selector if found. If none exists, create in Redux (NOT in widget).

### 3. Extract Pure Functions, Write Tests FIRST ✅

**TDD Workflow:**
1. Create utility with signature (throws error)
2. Write comprehensive tests FIRST
3. Implement function to make tests pass
4. Use in Foundry widget

### 4. No Magic Numbers - Centralized Config ✅

```typescript
// ✅ CORRECT: Use centralized config
import { DEFAULT_CONFIG } from '@/config/gameConfig';

getData() {
  return {
    maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
    maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
  };
}
```

### 5. Export Types with Functions ✅

```typescript
export type DiceOutcome = 'critical' | 'success' | 'partial' | 'failure';
export function calculateOutcome(rollResult: number[]): DiceOutcome { /* ... */ }
```

### 6. Comprehensive Test Coverage ✅

Every pure function/selector should cover:
- Happy paths (all valid outcomes)
- Edge cases (empty inputs, boundaries, max values)
- Priority rules (when multiple conditions apply)
- Real-world scenarios (gameplay situations)

### 7. Use Selectors for ALL State Queries ✅

```typescript
// ✅ CORRECT: Use existing selector
import { selectAddictionClockByCrew } from '@/selectors/clockSelectors';
const addictionClock = selectAddictionClockByCrew(state, this.crewId);
```

**Why:** Memoized, testable, reusable, type-safe, single source of truth.

### 8. JSDoc with Examples ✅

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
```

### 9. Architectural Decision Template ✅

When adding game logic, ask:
1. **Is this a pure function?** → Extract to `src/utils/`
2. **Is this a state query?** → Create selector in `src/selectors/`
3. **Is this a constant game value?** → Add to `src/config/gameConfig.ts`
4. **Is this Foundry-specific UI?** → Can stay in Foundry widget
5. **Can this be reused?** → MUST be in Redux layer

**Default:** If in doubt, extract to Redux layer.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| State Management | Redux Toolkit | Excellent TS support, built-in Immer |
| Language | TypeScript 5+ | Type safety, excellent tooling |
| Testing | Vitest | Fast, modern, excellent TS support |
| Build | Vite | Fast, modern, tree-shakeable |
| Package Manager | npm / pnpm | Both supported; pnpm preferred (lockfiles for both) |

---

## Data Model

### Command Schema
```typescript
interface Command<T = unknown> {
  type: string;                    // e.g., "character/addTrait"
  payload: T;
  timestamp: number;               // Unix timestamp (ms)
  version: number;                 // Schema version for migration
  userId?: string;
  commandId: string;               // UUID for idempotency
}
```

### Core Entities

#### Character
```typescript
interface Character {
  id: string;                      // Foundry Actor ID
  name: string;
  traits: Trait[];
  approaches: Approaches;          // 4 approaches (force, guile, focus, spirit), 0-4 dots each
  equipment: Equipment[];
  rallyAvailable: boolean;
  createdAt: number;
  updatedAt: number;
}
```

#### Crew
```typescript
interface Crew {
  id: string;
  name: string;
  characters: string[];            // Character IDs
  currentMomentum: number;         // 0-10, starts at 5
  createdAt: number;
  updatedAt: number;
}
```

#### Clock (Abstract)
```typescript
interface Clock {
  id: string;
  entityId: string;                // characterId, crewId
  clockType: 'harm' | 'addiction' | 'progress';
  subtype?: string;
  segments: number;
  maxSegments: number;
  metadata?: {
    rarity?: 'common' | 'uncommon' | 'rare';
    tier?: 'accessible' | 'inaccessible';
    frozen?: boolean;
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
}
```

#### Equipment
```typescript
interface Equipment {
  id: string;
  name: string;
  category: 'active' | 'passive' | 'consumable';
  tier: 'common' | 'rare' | 'epic';
  slots: number;
  equipped: boolean;
  locked: boolean;
  consumed: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Redux Store Structure

```typescript
interface RootState {
  characters: {
    byId: Record<string, Character>;
    allIds: string[];
    history: Command[];
  };
  crews: { /* same structure */ };
  clocks: {
    byId: Record<string, Clock>;
    allIds: string[];
    // Indexes for efficient lookups
    byEntityId: Record<string, string[]>;
    byType: Record<string, string[]>;
    byTypeAndEntity: Record<string, string[]>;   // "harm:character-123"
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

## Foundry-Redux Bridge API (CRITICAL)

**Status:** ✅ **IMPLEMENTED** (56+ usages, ongoing adoption)

### The Problem

Direct Redux access requires remembering 3+ steps, easy to forget:

```javascript
// ❌ Error-prone pattern
game.fitgd.store.dispatch({ type: 'action', payload: {...} });
await game.fitgd.saveImmediate();  // Forget → GM doesn't see changes
refreshSheetsByReduxId([id], false);  // Forget → UI doesn't update
```

### The Solution

**Foundry-Redux Bridge API** encapsulates entire pattern:

```javascript
// ✅ CORRECT: Single call, impossible to forget steps
await game.fitgd.bridge.execute(
  { type: 'action', payload: {...} }
);
// Automatically: dispatches → broadcasts → refreshes affected sheets
```

### Key Features

1. **Automatic broadcast** - Can't forget, it's part of the call
2. **Automatic sheet refresh** - Detects affected entities
3. **Batch support** - Prevents render race conditions:
   ```javascript
   await game.fitgd.bridge.executeBatch([
     { type: 'action1', payload: {...} },
     { type: 'action2', payload: {...} },
     { type: 'action3', payload: {...} }
   ]);
   ```
4. **ID mapping** - Handles Redux ↔ Foundry Actor ID conversion
5. **Query methods** - Safe access to Redux state

### Benefits

| Before | After |
|--------|-------|
| 3-5 lines of code | 1-3 lines |
| Easy to forget steps | Impossible to forget |
| Render race conditions | Batching prevents races |
| ID confusion | Automatic mapping |
| Hard to test | Easy to mock |

**Key Principle:** Make the correct pattern the easy pattern.

---

## Common Pitfalls (Implementation Learnings)

### 1. Unified IDs: Foundry Actor ID === Redux ID ✅

**Solution:** Redux entities use Foundry Actor IDs directly as primary key.

```javascript
// ✅ Single ID, direct access
const characterId = game.fitgd.api.character.create({ id: actor.id, ... });
const character = state.characters.byId[actor.id];
```

**Benefits:** No ID mapping, simpler code, better debugging, faster access.

### 2. Package Manager: npm or pnpm ✅

**Status:** Both npm and pnpm are supported. Project maintains both `package-lock.json` and `pnpm-lock.yaml`.

```bash
# ✅ Either works
npm install
pnpm install

# Use your preferred manager consistently
npm run build:foundry
# or
pnpm run build:foundry
```

**Recommendation:** Use `pnpm` for faster installs, but npm works fine for this project.

### 3. Universal Broadcasting Pattern ✅

**⚠️ GOLDEN RULE:** Every `store.dispatch()` MUST be followed by `await game.fitgd.saveImmediate()`

```javascript
// ✅ CORRECT
game.fitgd.store.dispatch({ type: 'action', payload: { /* ... */ } });
await game.fitgd.saveImmediate();

// ❌ WRONG - GM won't see the change
game.fitgd.store.dispatch({ type: 'action', payload: { /* ... */ } });
this.render();
```

**Exception:** Socket handlers in `receiveCommandsFromSocket()` intentionally use bare dispatch to prevent infinite loops.

### 4. Foundry Render Lifecycle ✅

**Pattern 1: Let Redux subscription handle ALL rendering**

```javascript
// ✅ CORRECT
async _onRoll() {
  dispatch(transitionState('ROLLING'));
  await saveImmediate();  // Subscription handles render

  const result = await this._rollDice();

  dispatch(setRollResult(result));
  await saveImmediate();  // Subscription handles render
}
```

**Pattern 2: Batch dispatches before broadcast**

```javascript
// ✅ CORRECT
dispatch(action1());
dispatch(action2());
dispatch(action3());
await saveImmediate();  // Single render cycle
```

### 5. Quick Pitfall Reference

- **Broadcast loops:** Update `lastBroadcastCount` immediately after applying socket commands
- **Clock deletion refresh:** Capture entityId mapping BEFORE deleting
- **Harm overflow:** Cap segments at max, don't error (game design)
- **Orphaned commands:** Make replay resilient to "entity not found"
- **Render blocking:** Use `render(true)` for structural changes, `render(false)` for value updates

---

## Critical Rules

### ✅ DO
- **Follow the 5-phase change pipeline ALWAYS** (Documentation → TDD → Implementation → Docs → Verification)
- **Read `vault/rules_primer.md` BEFORE writing any code** for a feature
- **Write failing tests FIRST** before implementing features
- **Check existing docs/** for patterns before inventing new ones
- Use `game.fitgd.bridge.execute()` for single state changes
- Use `game.fitgd.bridge.executeBatch()` for multiple related changes
- Let Redux subscriptions handle all rendering
- Test with GM + Player clients before declaring done
- Verify TypeScript builds before committing (`npm run type-check:all`)
- Run `npm install` or `pnpm install` when starting work on fresh branch/session

### ❌ DO NOT
- **Write code without reading rules primer first** - This violates the change pipeline
- **Implement features without test-first approach** - Tests must fail before implementation
- **Modify code that contradicts `vault/rules_primer.md`** - Stop and ask user to update primer first
- **Skip documentation updates** - Docs must be updated AFTER implementation
- Call `game.fitgd.store.dispatch()` directly (except socket handlers)
- Call `game.fitgd.saveImmediate()` manually
- Call `refreshSheetsByReduxId()` manually
- Touch socket handler bare dispatches (socket message handlers)
- Commit code without running type-check and build verification

### Exception
Socket handlers in `receiveCommandsFromSocket()` intentionally use bare dispatch to prevent infinite broadcast loops.

### Sacred Documents

**1. `vault/rules_primer.md` - CANONICAL GAME RULES**
- The single source of truth for Forged in the Grimdark mechanics
- Never modify implicitly or as side effect of other work
- Any rule changes must be explicitly requested and approved by user BEFORE implementation
- All code changes must validate against this document
- If code contradicts this document, STOP and ask user to update primer first

**2. `docs/` - ARCHITECTURE & IMPLEMENTATION PATTERNS**
- Describes how to build features within the Redux/Foundry architecture
- Must be reviewed before implementing new features
- Must be updated after implementing new features
- Establishes reusable patterns to prevent reinvention

---

## Development Workflow

### ⚠️ FIRST STEP: Install Dependencies

**CRITICAL:** Always run `npm install` (or `pnpm install`) on fresh branch or new session!

```bash
# ALWAYS run this first
npm install
# or: pnpm install

# Verify installation
npm run build
```

**When to run:**
- Starting work on new branch
- After pulling changes to `package.json` or lockfiles
- When encountering "Cannot find module" errors
- At start of every Claude Code session

### Before Committing Code

```bash
# 1. Type check
npm run type-check:all

# 2. Build verification
npm run build

# 3. Run tests
npm test

# 4. Commit
git add .
git commit -m "your message"
git push
```

### Pre-Commit Checklist

- [ ] Dependencies installed (`npm install` or `pnpm install`)
- [ ] Code compiles (`npm run build`)
- [ ] Type check passes (`npm run type-check:all`)
- [ ] No new TypeScript errors introduced
- [ ] Tested with GM + Player clients (for Foundry changes)
- [ ] Used Bridge API for state changes
- [ ] **User Code review requested and approved** - Mandatory If the user requested it before during session

### Common Commands

```bash
# Install dependencies
npm install  # or: pnpm install

# Type check specific file
npm run type-check:foundry | grep "filename.ts"

# Build and watch
npm run build:watch

# Run tests
npm test

# Type check core
npm run type-check:core

# Type check all
npm run type-check:all
```

### ⚠️ Running Tests

**NOTE:** `npm test` produces large output (700+ tests). When running tests:
- **Look for failure summaries** at the end (FAIL/PASS indicators)
- **Use filters** if targeting specific tests: `npm test -- --grep "pattern"`
- **Check for error sections** rather than reading full output
- **Capture and analyze** final summary line showing pass/fail counts

---

## Project Structure

```
fitgd/
├── src/
│   ├── api/              # High-level API layer
│   ├── store/            # Configure store, middleware
│   ├── slices/           # Redux slices (character, crew, clock, playerRoundState)
│   ├── types/            # TypeScript interfaces
│   ├── config/           # gameConfig.ts (DEFAULT_CONFIG)
│   ├── validators/       # Business rule validation
│   ├── selectors/        # Memoized selectors
│   ├── resolution/       # Consequence resolution logic
│   ├── resources/        # Resource management
│   ├── adapters/         # Foundry Actor/Item mapping
│   └── utils/            # Pure functions, command factory
│
├── tests/
│   ├── unit/             # Per-reducer and selector tests
│   ├── integration/      # Cross-slice, API contract tests
│   └── fixtures/         # Test data
│
├── foundry/
│   └── module/
│       ├── foundry-redux-bridge.mjs  # Bridge API
│       ├── handlers/     # Business logic handlers
│       ├── dialogs/      # Dialog implementations
│       └── widgets/      # UI widgets & components
│
├── docs/                 # Architecture and implementation docs
└── README.md             # Project overview
```

--- 

## Testing Strategy

**700+ tests** covering unit, integration, and selector scenarios.

**Approach:** Test command → state transformations, not implementation details.

- **Unit tests:** Per-reducer command handling
- **Integration tests:** Cross-slice workflows (e.g., character creation + equipment)
- **Selector tests:** Memoization and correctness
- **Invariant tests:** Constraints always maintained (approaches 0-4, momentum 0-10, etc.)

See `tests/` directory for examples.

---

## Foundry VTT Integration

### Actor/Item Mapping

**Character → Foundry Actor (type: "character")**
- Redux ID = Foundry Actor ID (unified)
- Derived data (harm clocks) fetched via selectors

**Crew → Foundry Actor (type: "crew")**
- Redux ID = Foundry Actor ID
- Derived data (addiction/consumable clocks) via selectors

**Equipment/Trait → Foundry Items**
- Standard item mapping

### Persistence Strategy
- Foundry saves full Redux state snapshot to world data
- On load, hydrate Redux store from snapshot
- Command history optionally saved separately for audit/replay

### Data Flow
```
Foundry UI → Command → Redux → Selector → Actor Update
     ↑                                          ↓
     └────────── Subscription callback ─────────┘
```
 