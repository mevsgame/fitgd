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

---

## Code Best Practices (From 4-Phase Audit)

**Context:** Audit (Nov 2025) extracted 107 lines of business logic from Foundry → Redux, added 101 tests, established clear architectural boundaries.

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
- Use `game.fitgd.bridge.execute()` for single state changes
- Use `game.fitgd.bridge.executeBatch()` for multiple related changes
- Let Redux subscriptions handle all rendering
- Test with GM + Player clients before declaring done
- Verify TypeScript builds before committing (`npm run type-check:all`)
- Run `npm install` or `pnpm install` when starting work on fresh branch/session

### ❌ DO NOT
- Call `game.fitgd.store.dispatch()` directly (except socket handlers)
- Call `game.fitgd.saveImmediate()` manually
- Call `refreshSheetsByReduxId()` manually
- Touch socket handler bare dispatches (socket message handlers)
- Commit code without running type-check and build verification
- **NEVER modify `vault/rules_primer.md` without explicit user consent** - This is the foundation document that defines the game system. Any changes must be approved before implementation.

### Exception
Socket handlers in `receiveCommandsFromSocket()` intentionally use bare dispatch to prevent infinite broadcast loops.

### Sacred Document
**`vault/rules_primer.md` is the canonical game rules document.** It defines the core mechanics of Forged in the Grimdark and serves as the single source of truth for how the system works. This document should never be modified implicitly or as a side effect of other work. Any proposed changes to game rules must be explicitly reviewed and approved by the user before committing.

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
 