# Forged in the Grimdark - Redux Implementation Plan

## 🚨 IMPORTANT: For Claude Code Sessions

**If you are a new Claude Code session starting work on this project:**

→ **READ [SESSION_START.md](./SESSION_START.md) FIRST** ←

This file contains:
- Required reading list (conditional based on task)
- Critical rules that must NEVER be violated
- Common patterns and quick diagnostics
- Session checklist

**Key sections to read in THIS document:**
- "Core Architecture Principles" (below)
- "Critical Rules (Updated)" (near end)
- "Implementation Learnings & Debugging Notes" (historical bugs to avoid)
- "Universal Broadcasting Pattern (CRITICAL)" (Foundry-specific)
- "SOLUTION: Foundry-Redux Bridge API" (Foundry-specific)

---

## Project Overview

A **TypeScript + Redux Toolkit** event-sourced state management system for character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

---

## Core Architecture Principles

### 1. Event Sourcing
- **Full snapshot + complete command history** stored
- Current state is the single source of truth
- Command history allows reconstruction, undo, and audit trails
- Each command is immutable and timestamped

### 2. Entity Separation & Abstraction
**High-change entities** (separate stores with full history):
- `Clock` - **Abstract entity** used for harm, consumables, addiction, etc.
- `Momentum` - crew-level shared resource

**Low-change entities** (snapshot with history):
- `Character` - traits, action dots, equipment
- `Crew` - metadata, campaign info

**Design Principle:** Clocks are generic/reusable. Different clock types (harm, consumable, addiction) are instances of the same `Clock` entity with different metadata. Crew validates actions against clock states but doesn't duplicate tracking.

### 3. TDD First
- **Every feature** starts with failing tests
- Tests verify command → state transformations
- Property-based tests for invariant checking
- Jest + TypeScript for testing framework

### 4. Foundry Compatibility
- **No Foundry dependencies** in core logic
- Expose serializable JSON state for Foundry persistence
- Provide command replay mechanism for Foundry
- Clean interfaces for Foundry to implement (dice rolling, persistence)

---

## Code Best Practices & Patterns (Learned from 4-Phase Audit)

**Context:** A comprehensive audit (Nov 2025) extracted all business logic from Foundry widgets to Redux layer, adding 101 tests and establishing clear architectural boundaries. These patterns emerged as critical for maintaining clean separation of concerns.

### 1. Foundry-Redux Separation of Concerns ✅

**GOLDEN RULE:** All business logic belongs in Redux layer, NOT in Foundry widgets.

**Foundry Layer (Presentation Only):**
- UI rendering and templates
- Event handling (clicks, drags, etc.)
- Foundry API integration (dice rolls, chat messages)
- Bridge API calls to update Redux state

**Redux Layer (Business Logic):**
- Game rules (dice outcomes, position/effect improvements, etc.)
- State management (reducers, selectors)
- Validation logic
- Pure utility functions
- Configuration values

**Examples:**

```typescript
// ❌ WRONG: Business logic in Foundry widget
class PlayerActionWidget {
  private _calculateOutcome(rollResult: number[]): DiceOutcome {
    const sixes = rollResult.filter(d => d === 6).length;
    if (sixes >= 2) return 'critical';
    // ... more logic
  }
}

// ✅ CORRECT: Business logic in Redux utils, widget uses it
// src/utils/diceRules.ts
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  const sixes = rollResult.filter(d => d === 6).length;
  if (sixes >= 2) return 'critical';
  // ... more logic
}

// foundry/module/widgets/player-action-widget.ts
import { calculateOutcome } from '@/utils/diceRules';

class PlayerActionWidget {
  async _onRoll() {
    const rollResult = await this._rollDice(dicePool);
    const outcome = calculateOutcome(rollResult); // Use utility
  }
}
```

---

### 2. Always Check for Existing Selectors Before Writing Logic ✅

**BEFORE implementing any state query or derived calculation in Foundry:**

1. **Check if selector already exists:**
   ```bash
   # Search by name
   grep -rn "selectStims" src/selectors/

   # Search by similar logic
   grep -rn "addiction.*filled" src/
   ```

2. **Use existing selector if found:**
   ```typescript
   // ✅ CORRECT: Reuse existing selector
   import { selectStimsAvailable } from '@/selectors/clockSelectors';

   const stimsLocked = !selectStimsAvailable(state, this.crewId);
   ```

3. **If no selector exists, create one in Redux (NOT in widget):**
   ```typescript
   // ❌ WRONG: Create method in widget
   private _areStimsLocked(): boolean { /* logic */ }

   // ✅ CORRECT: Create selector in Redux
   // src/selectors/clockSelectors.ts
   export const selectStimsAvailable = createSelector(...);
   ```

**Why:** Prevents duplication, ensures consistency, maintains single source of truth.

---

### 3. Extract Pure Functions to Utils, Write Tests FIRST ✅

**Pattern:** When you identify game logic that's a pure function (no side effects, deterministic), extract it to Redux utils immediately.

**Workflow:**

```typescript
// STEP 1: Create utility with signature
// src/utils/diceRules.ts
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  throw new Error('Not implemented');
}

// STEP 2: Write comprehensive tests FIRST (TDD)
// tests/unit/diceRules.test.ts
describe('calculateOutcome', () => {
  it('should return critical for 2+ sixes', () => {
    expect(calculateOutcome([6, 6, 3])).toBe('critical');
  });
  // ... 40+ more tests
});

// STEP 3: Implement function to make tests pass
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  const sixes = rollResult.filter(d => d === 6).length;
  if (sixes >= 2) return 'critical';
  // ... implementation
}

// STEP 4: Use in Foundry widget
import { calculateOutcome } from '@/utils/diceRules';
const outcome = calculateOutcome(rollResult);
```

**Benefits:**
- TDD ensures correctness from the start
- Pure functions trivial to test (no mocking)
- Reusable across entire codebase
- Can be used in CLI tools, tests, simulations, etc.

---

### 4. No Magic Numbers - Always Use Centralized Config ✅

**Rule:** NEVER hard-code game values in Foundry code.

```typescript
// ❌ WRONG: Hard-coded magic numbers
getData() {
  return {
    maxMomentum: 10,      // What if playtesting changes this?
    maxSegments: 8,       // What if we add difficulty levels?
  };
}

// ✅ CORRECT: Use centralized config
import { DEFAULT_CONFIG } from '@/config/gameConfig';

getData() {
  return {
    maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
    maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
  };
}
```

**Benefits:**
- Playtesting adjustments require changing one file
- Different campaigns can override config
- Game balance is data-driven, not code-driven

---

### 5. Export Types Along With Functions ✅

**Pattern:** When creating utilities, export both the function AND related types.

```typescript
// ❌ INCOMPLETE: Only export function
export function calculateOutcome(rollResult: number[]): 'critical' | 'success' | 'partial' | 'failure' {
  // ...
}

// ✅ COMPLETE: Export function AND type
export type DiceOutcome = 'critical' | 'success' | 'partial' | 'failure';

export function calculateOutcome(rollResult: number[]): DiceOutcome {
  // ...
}

// Now consumers can import the type:
import { calculateOutcome, type DiceOutcome } from '@/utils/diceRules';

function handleRoll(outcome: DiceOutcome) {
  // Type-safe, no string literal repetition
}
```

**Benefits:**
- Single source of truth for types
- Easier refactoring (change type once)
- Better IDE autocomplete
- Compile-time safety across all usage sites

---

### 6. Comprehensive Test Coverage for Game Logic ✅

**Standard:** Every pure function and selector should have comprehensive tests covering:

- **Happy paths:** All valid outcomes
- **Edge cases:** Empty inputs, boundary values, maximum values
- **Priority rules:** When multiple conditions apply, correct one wins
- **Real-world scenarios:** Actual gameplay situations (desperate/risky/controlled rolls, pushing, assistance)
- **Type safety:** Verify TypeScript types work correctly

**Example from dice rules tests (41 tests total):**

```typescript
describe('calculateOutcome', () => {
  // Happy paths: 5 tests per outcome type
  describe('Critical outcomes', () => {
    it('should return critical for exactly 2 sixes', () => { ... });
    it('should return critical for 3 sixes', () => { ... });
    // ... 3 more tests
  });

  // Edge cases: 4 tests
  describe('Edge cases', () => {
    it('should return failure for empty roll array', () => { ... });
    it('should handle large dice pools correctly', () => { ... });
    // ... 2 more tests
  });

  // Real-world scenarios: 6 tests
  describe('Real-world scenarios', () => {
    it('should calculate outcome for desperate position roll (1 die)', () => { ... });
    it('should calculate outcome for risky position roll (2 dice)', () => { ... });
    // ... 4 more tests
  });
});
```

**ROI:** Time spent writing tests is minimal compared to permanent value (prevents regressions, documents behavior, enables confident refactoring).

---

### 7. Use Selectors for ALL State Queries ✅

**Rule:** Foundry widgets should NEVER directly iterate or filter Redux state. Always use selectors.

```typescript
// ❌ WRONG: Direct state access in widget
const crew = state.crews.byId[this.crewId];
const addictionClock = Object.values(state.clocks.byId).find(
  clock => clock.entityId === crew.id && clock.clockType === 'addiction'
);

// ✅ CORRECT: Use existing selector
import { selectAddictionClockByCrew } from '@/selectors/clockSelectors';
const addictionClock = selectAddictionClockByCrew(state, this.crewId);
```

**Why selectors are better:**
- Memoized (performance optimization)
- Testable in isolation
- Reusable across widgets
- Single place to update query logic
- Type-safe

---

### 8. Write JSDoc with Examples for All Exported Functions ✅

**Standard:** Every exported function should have comprehensive JSDoc including:

- Description of what it does
- Parameter descriptions with types
- Return value description
- Examples showing usage

```typescript
/**
 * Calculate the outcome of a dice roll based on Forged in the Dark rules
 *
 * Rules:
 * - Critical: 2 or more 6s
 * - Success: At least one 6
 * - Partial: Highest die is 4 or 5
 * - Failure: Highest die is 1, 2, or 3
 *
 * @param rollResult - Array of dice values (typically d6 results)
 * @returns The outcome of the roll
 *
 * @example
 * calculateOutcome([6, 6, 3]) // 'critical' - two 6s
 * calculateOutcome([6, 4, 2]) // 'success' - one 6
 * calculateOutcome([5, 4, 3]) // 'partial' - highest is 5
 * calculateOutcome([3, 2, 1]) // 'failure' - highest is 3
 */
export function calculateOutcome(rollResult: number[]): DiceOutcome {
  // ...
}
```

**Benefits:**
- Better IDE autocomplete
- Self-documenting code
- Can generate API docs with TypeDoc
- Easier onboarding for new developers

---

### 9. When Refactoring, Verify Tests Still Pass ✅

**Workflow:** After extracting logic from Foundry to Redux:

```bash
# 1. Create Redux utility/selector
# 2. Write comprehensive tests
pnpm test --run <test-file>

# 3. Refactor Foundry widget to use utility
# 4. Verify TypeScript compiles
pnpm run type-check

# 5. Run ALL tests to check for regressions
pnpm test --run

# 6. If all pass, commit
git add .
git commit -m "feat(redux): Extract X to Redux utils"
```

**Critical:** Always verify tests pass after refactoring. If tests fail, you've broken something.

---

### 10. Architectural Decision Template ✅

**When adding new game logic, ask:**

1. **Is this a pure function?**
   - Yes → Extract to `src/utils/`
   - No → Might be a selector or reducer

2. **Is this a state query or derived calculation?**
   - Yes → Create selector in `src/selectors/`
   - No → Might be a pure function

3. **Is this a constant game value?**
   - Yes → Add to `src/config/gameConfig.ts`
   - No → Might be dynamic state

4. **Is this Foundry-specific UI logic?**
   - Yes → Can stay in Foundry widget
   - No → Extract to Redux layer

5. **Can this be reused elsewhere?**
   - Yes → MUST be in Redux layer
   - No → Might still benefit from extraction for testing

**Default assumption:** If in doubt, extract to Redux layer. It's easier to test and maintain.

---

## Summary of Audit Learnings

**4-Phase Audit Results (Nov 2025):**
- ✅ Extracted 107 lines of business logic from Foundry → Redux
- ✅ Added 101 comprehensive tests (60 selector tests + 41 utility tests)
- ✅ Eliminated 4 instances of duplicate logic
- ✅ Replaced 2 magic numbers with centralized config
- ✅ Established clear architectural boundaries

**Key Principle:** Treat Foundry as a thin presentation layer that consumes Redux business logic. All game rules, validation, and calculations belong in Redux where they can be tested, reused, and maintained independently.

**Reference:** See `PHASE_1_CONCLUSIONS.md`, `PHASE_2_CONCLUSIONS.md`, `PHASE_3_CONCLUSIONS.md`, and `PHASE_4_CONCLUSIONS.md` for detailed analysis.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| State Management | Redux Toolkit (RTK) | Excellent TS support, built-in Immer, small bundle |
| Language | TypeScript 5+ | Type safety, excellent tooling |
| Testing | Jest + ts-jest | Industry standard, great TS support |
| Build | Vite | Fast, modern, tree-shakeable |
| Package Manager | **pnpm** | Required - lockfile incompatible with npm (see Package Manager section below) |

---

## Game Rules Configuration

All game rules are defined in a central configuration object to avoid magic numbers:

```typescript
interface GameConfig {
  character: {
    startingTraitCount: number;           // 2
    maxTraitCount?: number;               // Optional cap (TBD via playtesting)
    startingActionDots: number;           // 12
    maxActionDotsPerAction: number;       // 4
    maxActionDotsAtCreation: number;      // 3
  };

  crew: {
    startingMomentum: number;             // 5
    maxMomentum: number;                  // 10
    minMomentum: number;                  // 0
  };

  clocks: {
    harm: {
      maxClocks: number;                  // 3
      segments: number;                   // 6
    };
    consumable: {
      segments: {
        common: number;                   // 8
        uncommon: number;                 // 6
        rare: number;                     // 4
      };
    };
    addiction: {
      segments: number;                   // 8
      resetReduction: number;             // 2
    };
  };

  rally: {
    maxMomentumToUse: number;             // 3 (only available at 0-3 Momentum)
  };
}

// Default configuration
export const DEFAULT_CONFIG: GameConfig = {
  character: {
    startingTraitCount: 2,
    startingActionDots: 12,
    maxActionDotsPerAction: 4,
    maxActionDotsAtCreation: 3,
  },
  crew: {
    startingMomentum: 5,
    maxMomentum: 10,
    minMomentum: 0,
  },
  clocks: {
    harm: {
      maxClocks: 3,
      segments: 6,
    },
    consumable: {
      segments: {
        common: 8,
        uncommon: 6,
        rare: 4,
      },
    },
    addiction: {
      segments: 8,
      resetReduction: 2,
    },
  },
  rally: {
    maxMomentumToUse: 3,
  },
};
```

**Design Principle:** Game rules are data, not code. This allows:
- Easy playtesting adjustments
- Different rulesets per campaign
- Foundry can override config via game settings

---

## Data Model

### Command Schema
```typescript
interface Command<T = unknown> {
  type: string;                    // e.g., "character/addTrait"
  payload: T;                      // Command-specific data
  timestamp: number;               // Unix timestamp (ms)
  version: number;                 // Schema version for migration
  userId?: string;                 // Optional: tracking who made change
  commandId: string;               // UUID for idempotency
}
```

### Core Entities

#### Character
```typescript
interface Character {
  id: string;                      // UUID
  name: string;
  traits: Trait[];                 // Max TBD via playtesting
  actionDots: ActionDots;          // 12 actions, 0-4 dots each
  equipment: Equipment[];
  rallyAvailable: boolean;         // Reset per Momentum Reset
  createdAt: number;
  updatedAt: number;
}

interface Trait {
  id: string;
  name: string;                    // e.g., "Served with Elite Infantry"
  category: 'role' | 'background' | 'scar' | 'flashback' | 'grouped';
  disabled: boolean;               // Leaning into trait
  description?: string;
  acquiredAt: number;              // Timestamp
}

interface ActionDots {
  shoot: number;      // 0-4
  skirmish: number;
  skulk: number;
  wreck: number;
  finesse: number;
  survey: number;
  study: number;
  tech: number;
  attune: number;
  command: number;
  consort: number;
  sway: number;
}

interface Equipment {
  id: string;
  name: string;
  tier: 'accessible' | 'inaccessible' | 'epic';
  category: string;                // e.g., 'weapon', 'armor', 'tool'
  description?: string;
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
  entityId: string;                // characterId, crewId, or itemType
  clockType: 'harm' | 'consumable' | 'addiction';
  subtype?: string;                // For harm: "Physical", "Morale"; for consumable: "grenades", "stims"
  segments: number;
  maxSegments: number;             // 6 for harm, 8 for addiction, 4/6/8 for consumables
  metadata?: {                     // Flexible storage for type-specific data
    rarity?: 'common' | 'uncommon' | 'rare';
    tier?: 'accessible' | 'inaccessible';
    frozen?: boolean;              // For consumables when filled
    [key: string]: unknown;
  };
  createdAt: number;
  updatedAt: number;
}
```

**Clock Type Examples:**
```typescript
// Harm Clock
{
  id: "uuid-1",
  entityId: "character-123",
  clockType: "harm",
  subtype: "Physical Harm",
  segments: 3,
  maxSegments: 6
}

// Consumable Clock
{
  id: "uuid-2",
  entityId: "crew-456",
  clockType: "consumable",
  subtype: "frag_grenades",
  segments: 5,
  maxSegments: 8,
  metadata: {
    rarity: "common",
    tier: "accessible",
    frozen: false
  }
}

// Addiction Clock
{
  id: "uuid-3",
  entityId: "crew-456",
  clockType: "addiction",
  segments: 6,
  maxSegments: 8
}
```

---

## Redux Store Structure

```typescript
interface RootState {
  characters: {
    byId: Record<string, Character>;
    allIds: string[];
    history: Command[];
  };

  crews: {
    byId: Record<string, Crew>;
    allIds: string[];
    history: Command[];
  };

  clocks: {
    byId: Record<string, Clock>;
    allIds: string[];
    // Indexes for efficient lookups
    byEntityId: Record<string, string[]>;        // All clocks for an entity
    byType: Record<string, string[]>;            // All clocks of a type
    byTypeAndEntity: Record<string, string[]>;   // e.g., "harm:character-123"
    history: Command[];
  };
}
```

**Index Usage Examples:**
```typescript
// Get all harm clocks for a character
state.clocks.byTypeAndEntity[`harm:${characterId}`]

// Get all consumable clocks for a crew
state.clocks.byTypeAndEntity[`consumable:${crewId}`]

// Get addiction clock for a crew
state.clocks.byTypeAndEntity[`addiction:${crewId}`]

// Get all clocks for any entity
state.clocks.byEntityId[entityId]
```

---

## Command Patterns (Examples)

### Character Commands
- `character/create` - Create new character
- `character/updateName` - Rename character
- `character/addTrait` - Add trait (via flashback, scar, etc.)
- `character/disableTrait` - Lean into trait for Momentum
- `character/enableTrait` - Re-enable trait (Rally, Reset)
- `character/setActionDots` - Set action rating (creation or advancement)
- `character/addEquipment` - Add equipment
- `character/removeEquipment` - Remove equipment
- `character/useRally` - Mark rally as used
- `character/resetRally` - Reset rally availability

### Crew Commands
- `crew/create` - Create new crew
- `crew/addCharacter` - Add character to crew
- `crew/removeCharacter` - Remove character from crew
- `crew/setMomentum` - Directly set Momentum (e.g., session start)
- `crew/addMomentum` - Add Momentum (from consequences, leaning into trait)
- `crew/spendMomentum` - Spend Momentum (push, flashback) - **validates sufficient Momentum**
- `crew/resetMomentum` - Reset to 5 after Reset event
- `crew/useStim` - **Validates addiction clock not filled** before allowing
- `crew/useConsumable` - **Validates consumable clock not frozen** before allowing

### Clock Commands (Abstract)
- `clock/create` - Create new clock (harm, consumable, or addiction)
- `clock/addSegments` - Add segments to clock
- `clock/clearSegments` - Remove segments from clock
- `clock/delete` - Remove clock entirely
- `clock/updateMetadata` - Update clock metadata (tier, frozen, etc.)
- `clock/changeSubtype` - Change clock subtype (e.g., 4th harm clock replacement)

**Command Examples:**
```typescript
// Create harm clock
{ type: 'clock/create', payload: {
  entityId: 'character-123',
  clockType: 'harm',
  subtype: 'Physical Harm',
  maxSegments: 6
}}

// Use consumable (validated at crew level)
{ type: 'crew/useConsumable', payload: {
  crewId: 'crew-456',
  consumableType: 'frag_grenades'
}}
// This checks if consumable clock is frozen/filled before proceeding

// Use stim (validated at crew level)
{ type: 'crew/useStim', payload: {
  crewId: 'crew-456',
  characterId: 'character-123'
}}
// This checks if addiction clock is filled before proceeding
```

---

## Validation Rules

### Character Validation
- Action dots: 0-4 per action
- Starting total: 12 dots (at creation only)
- Maximum total: TBD (advancement)
- Starting traits: Exactly 2 (1 role, 1 background)
- Max harm clocks: 3 active per character (query: `clocks.byTypeAndEntity['harm:characterId']`)
- Rally: Boolean state, one use per reset

### Crew Validation
- Momentum: 0-10 (excess is lost)
- Cannot spend more Momentum than available
- Character IDs must reference existing characters
- **Stim use validation:** Reject `crew/useStim` if addiction clock is filled (segments >= maxSegments)
- **Consumable use validation:** Reject `crew/useConsumable` if that consumable's clock is frozen or filled

### Clock Validation (Type-Specific)

#### Harm Clocks (`clockType: 'harm'`)
- Segments: 0-6
- Character can have max 3 active harm clocks
- 4th harm clock replaces existing clock with fewest segments
- When clock fills (6/6): character is dying

#### Consumable Clocks (`clockType: 'consumable'`)
- Max segments based on `metadata.rarity`: Common(8), Uncommon(6), Rare(4)
- Segments cannot exceed max
- When filled: `metadata.frozen = true` AND `metadata.tier` downgrades (accessible → inaccessible)
- All other clocks of same subtype freeze at current segment count

#### Addiction Clocks (`clockType: 'addiction'`)
- Max segments: 8
- One per crew (entityId = crewId)
- When filled: Add "Addict" trait to character who triggered it, prevent all stim use for entire crew
- Reduces by 2 (min 0) on Momentum Reset

### Cross-Slice Validation (Crew ↔ Clocks)
These validations happen in crew commands but query clock state:

```typescript
// crew/useStim validation logic
const addictionClock = selectClockByTypeAndEntity(state, 'addiction', crewId);
if (addictionClock && addictionClock.segments >= addictionClock.maxSegments) {
  throw new Error('Stims are locked due to addiction');
}

// crew/useConsumable validation logic
const consumableClock = selectClockByTypeAndSubtype(state, 'consumable', crewId, consumableType);
if (consumableClock?.metadata?.frozen) {
  throw new Error(`${consumableType} are no longer accessible`);
}
```

---

## Testing Strategy

### Unit Tests (Per Reducer)
```typescript
describe('character reducer', () => {
  it('should create a character with valid starting stats', () => {
    const command = createCharacterCommand({...});
    const state = characterReducer(initialState, command);
    expect(state.byId[id].actionDots.shoot).toBe(2);
    // ... assertions
  });

  it('should reject invalid action dot distribution', () => {
    // Test with >12 starting dots, >4 in single action
  });
});
```

### Integration Tests (Cross-Slice)
```typescript
describe('Momentum system', () => {
  it('should cap Momentum at 10 and lose excess', () => {
    // Set Momentum to 9, add 4, verify it's 10
  });

  it('should allow spending Momentum for Push/Flashback', () => {
    // Verify Momentum decrements correctly
  });
});
```

### Property-Based Tests
```typescript
describe('invariants', () => {
  it('character action dots never exceed 4', () => {
    // Generate random command sequences, verify constraint
  });

  it('harm clocks never exceed 3 per character', () => {
    // Generate harm, verify replacement logic
  });
});
```

### Snapshot Tests (Command Replay)
```typescript
describe('command replay', () => {
  it('should reconstruct character from command history', () => {
    const commands = [...]; // Real session log
    const state = commands.reduce(reducer, initialState);
    expect(state).toMatchSnapshot();
  });
});
```

---

## API Layer

**Design Principle:** Never expose Redux store directly to consumers. Instead, provide a clean functional API that abstracts Redux implementation details.

### Character API
```typescript
// src/api/character.ts
export interface CharacterAPI {
  // Creation
  createCharacter(name: string, traits: Trait[], actionDots: ActionDots): string;

  // Traits
  addTrait(characterId: string, trait: Trait): void;
  disableTrait(characterId: string, traitId: string): void;
  enableTrait(characterId: string, traitId: string): void;
  groupTraits(characterId: string, traitIds: [string, string, string], newTrait: Trait): void;

  // Action Dots
  setActionDots(characterId: string, action: keyof ActionDots, dots: number): void;

  // Equipment
  addEquipment(characterId: string, equipment: Equipment): void;
  removeEquipment(characterId: string, equipmentId: string): void;

  // Rally
  useRally(characterId: string): void;
  resetRally(characterId: string): void;

  // Queries
  getCharacter(characterId: string): Character | null;
  getCharacterTraits(characterId: string): Trait[];
  canUseRally(characterId: string): boolean;
}
```

### Crew API
```typescript
// src/api/crew.ts
export interface CrewAPI {
  // Creation
  createCrew(name: string): string;

  // Members
  addCharacter(crewId: string, characterId: string): void;
  removeCharacter(crewId: string, characterId: string): void;

  // Momentum
  setMomentum(crewId: string, amount: number): void;
  addMomentum(crewId: string, amount: number): void;
  spendMomentum(crewId: string, amount: number): void;
  resetMomentum(crewId: string): void;

  // Resources (validated against clocks)
  canUseStim(crewId: string): boolean;
  useStim(crewId: string, characterId: string): void;
  canUseConsumable(crewId: string, consumableType: string): boolean;
  useConsumable(crewId: string, consumableType: string): void;

  // Queries
  getCrew(crewId: string): Crew | null;
  getCurrentMomentum(crewId: string): number;
}
```

### Clock API
```typescript
// src/api/clock.ts
export interface ClockAPI {
  // Creation
  createHarmClock(characterId: string, subtype: string): string;
  createConsumableClock(crewId: string, subtype: string, rarity: 'common' | 'uncommon' | 'rare'): string;
  createAddictionClock(crewId: string): string;

  // Manipulation
  addSegments(clockId: string, amount: number): void;
  clearSegments(clockId: string, amount: number): void;
  deleteClock(clockId: string): void;

  // Queries
  getClock(clockId: string): Clock | null;
  getHarmClocks(characterId: string): Clock[];
  getConsumableClocks(crewId: string): Clock[];
  getAddictionClock(crewId: string): Clock | null;
  isClockFilled(clockId: string): boolean;
}
```

### Game State API
```typescript
// src/api/gameState.ts
export interface GameStateAPI {
  // Export/Import
  exportState(): SerializedState;
  importState(state: SerializedState): void;

  // Command History
  getCommandHistory(): Command[];
  replayCommands(commands: Command[]): void;

  // Undo/Redo (if implemented)
  undo(): boolean;
  redo(): boolean;

  // Configuration
  getConfig(): GameConfig;
  setConfig(config: Partial<GameConfig>): void;
}
```

### API Usage Example
```typescript
import { createGameAPI } from '@fitgd/core';

// Initialize with optional config override
const api = createGameAPI({
  character: { maxTraitCount: 25 }  // Override default
});

// Create character
const charId = api.character.createCharacter(
  "Sergeant Kane",
  [
    { name: "Served with Elite Infantry", category: "role" },
    { name: "Survived Hive Gangs", category: "background" }
  ],
  { shoot: 3, command: 2, /* ... */ }
);

// Create crew
const crewId = api.crew.createCrew("Strike Team Alpha");
api.crew.addCharacter(crewId, charId);

// Take harm
const harmId = api.clock.createHarmClock(charId, "Physical Harm");
api.clock.addSegments(harmId, 3);  // 3 segments from Risky/Standard

// Spend Momentum
if (api.crew.getCurrentMomentum(crewId) >= 1) {
  api.crew.spendMomentum(crewId, 1);  // Push yourself
}
```

**Benefits:**
- **Type-safe:** Full TypeScript support
- **Validated:** All business rules enforced at API boundary
- **Redux-agnostic:** Consumers don't need Redux knowledge
- **Testable:** Easy to mock for integration tests
- **Documented:** Clear contracts for Foundry developers

---

## Foundry VTT Integration Points

### Data Export (Foundry → Redux)
```typescript
interface FoundryAdapter {
  // Serialize current state for Foundry persistence
  exportState(): SerializedState;

  // Export full command history
  exportHistory(): Command[];

  // Export single entity (character, crew, etc.)
  exportEntity(type: string, id: string): unknown;
}
```

### Data Import (Foundry → Redux)
```typescript
interface FoundryAdapter {
  // Load state from Foundry
  importState(state: SerializedState): void;

  // Replay commands (for reconstruction)
  replayCommands(commands: Command[]): void;

  // Import single entity
  importEntity(type: string, data: unknown): void;
}
```

### Using the API
```typescript
// Foundry uses the high-level API, not Redux directly
import { createGameAPI } from '@fitgd/core';

const gameAPI = createGameAPI();

// Character creation in Foundry sheet
async function onCreateCharacter(name, traits, actionDots) {
  const characterId = gameAPI.character.createCharacter(name, traits, actionDots);

  // Store character ID in Foundry Actor
  await actor.setFlag('fitgd', 'characterId', characterId);

  return characterId;
}

// Taking harm from a roll
function onHarmResult(characterId, harmType, segments) {
  const harmId = gameAPI.clock.createHarmClock(characterId, harmType);
  gameAPI.clock.addSegments(harmId, segments);

  // Check if dying
  if (gameAPI.clock.isClockFilled(harmId)) {
    ui.notifications.warn("Character is dying!");
  }
}
```

### State Subscription
```typescript
// Foundry subscribes to state changes
store.subscribe(() => {
  const state = store.getState();
  foundry.updateCharacterSheet(state.characters.byId['...']);
});
```

### Foundry VTT Actor/Item Data Model Mapping

Our Redux entities map cleanly to Foundry's Actor/Item system:

#### Foundry Actors
```typescript
// Character → Foundry Actor (type: "character")
{
  _id: character.id,
  name: character.name,
  type: "character",
  system: {
    traits: character.traits,
    actionDots: character.actionDots,
    rallyAvailable: character.rallyAvailable,
    // Derived data (computed from clocks)
    harmClocks: [], // Fetched via selector: selectHarmClocksByCharacter(id)
  }
}

// Crew → Foundry Actor (type: "crew")
{
  _id: crew.id,
  name: crew.name,
  type: "crew",
  system: {
    momentum: crew.currentMomentum,
    characters: crew.characters, // References to character Actor IDs
    // Derived data (computed from clocks)
    addictionClock: null, // Fetched via selector: selectAddictionClockByCrew(id)
    consumableClocks: [], // Fetched via selector: selectConsumableClocksByCrew(id)
  }
}
```

#### Foundry Items
```typescript
// Equipment → Foundry Item (type: "equipment")
{
  _id: equipment.id,
  name: equipment.name,
  type: "equipment",
  system: {
    tier: equipment.tier,
    category: equipment.category,
    description: equipment.description
  }
}

// Trait → Foundry Item (type: "trait")
{
  _id: trait.id,
  name: trait.name,
  type: "trait",
  system: {
    category: trait.category,
    disabled: trait.disabled,
    description: trait.description,
    acquiredAt: trait.acquiredAt
  }
}
```

#### Clock Storage
Clocks are NOT stored as separate Foundry Items. Instead:
- **Character harm clocks:** Stored in Redux, derived/computed when rendering character Actor sheet
- **Crew clocks (consumable, addiction):** Stored in Redux, derived/computed when rendering crew Actor sheet

**Why?** Clocks are high-frequency state that benefits from centralized management and event sourcing. Foundry persistence only needs the **current snapshot** of clocks, which is hydrated from Redux state.

#### Data Flow
```
Foundry UI → Command Dispatch → Redux Store → Selector → Foundry Actor Update
     ↑                                                            ↓
     └────────────────── Subscription callback ──────────────────┘
```

**Example:**
```typescript
// In Foundry character sheet
onTakingHarm(characterId, harmType, segments) {
  // Dispatch Redux command
  store.dispatch(createClockCommand({
    entityId: characterId,
    clockType: 'harm',
    subtype: harmType,
    segments: segments,
    maxSegments: 6
  }));

  // Redux updates, selector recomputes, Foundry re-renders
}
```

#### Persistence Strategy
- **Foundry saves:** Full Redux state snapshot (RootState) to Foundry's world data or flags
- **On world load:** Hydrate Redux store from saved snapshot
- **Command history:** Optionally saved separately for audit/replay (could be a separate Foundry Journal Entry or world flag)

---

## Project Structure

```
fitgd/
├── src/
│   ├── api/
│   │   ├── index.ts                 # Main API export
│   │   ├── character.ts             # Character API functions
│   │   ├── crew.ts                  # Crew API functions
│   │   ├── clock.ts                 # Clock API functions
│   │   └── gameState.ts             # State queries (get character, etc.)
│   │
│   ├── store/
│   │   ├── index.ts                 # Configure store
│   │   ├── rootReducer.ts           # Combine slices
│   │   └── middleware/
│   │       ├── commandLogger.ts     # Log all commands
│   │       └── validator.ts         # Pre-dispatch validation
│   │
│   ├── slices/
│   │   ├── characterSlice.ts        # Character entity + commands
│   │   ├── crewSlice.ts             # Crew entity + Momentum + validation
│   │   └── clockSlice.ts            # Abstract clock entity (harm, consumable, addiction)
│   │
│   ├── types/
│   │   ├── character.ts
│   │   ├── crew.ts
│   │   ├── clock.ts                 # Clock + ClockType + ClockMetadata
│   │   ├── command.ts
│   │   ├── config.ts                # GameConfig interface
│   │   └── index.ts
│   │
│   ├── config/
│   │   ├── gameConfig.ts            # DEFAULT_CONFIG constant
│   │   └── index.ts
│   │
│   ├── validators/
│   │   ├── characterValidator.ts
│   │   ├── crewValidator.ts         # Includes stim/consumable validation
│   │   └── clockValidator.ts        # Type-specific clock validation
│   │
│   ├── selectors/
│   │   ├── characterSelectors.ts    # Memoized selectors
│   │   ├── crewSelectors.ts
│   │   └── clockSelectors.ts        # selectByTypeAndEntity, etc.
│   │
│   ├── adapters/
│   │   └── foundryAdapter.ts        # Foundry Actor/Item mapping
│   │
│   └── utils/
│       ├── commandFactory.ts        # Helper to create commands
│       └── uuid.ts                  # UUID generation
│
├── tests/
│   ├── unit/
│   │   ├── characterSlice.test.ts
│   │   ├── crewSlice.test.ts
│   │   └── ...
│   │
│   ├── integration/
│   │   ├── api/
│   │   │   ├── characterApi.test.ts # Test API contracts
│   │   │   ├── crewApi.test.ts
│   │   │   └── clockApi.test.ts
│   │   ├── momentum.test.ts
│   │   ├── harmSystem.test.ts
│   │   └── ...
│   │
│   └── fixtures/
│       ├── characters.ts
│       ├── crews.ts
│       └── commands.ts
│
├── package.json
├── tsconfig.json
├── jest.config.js
├── vite.config.ts
└── README.md
```

---

## Implementation Phases

**Total:** 7 phases across ~15 sessions

**Key Architecture Decision:** All clock types (harm, consumable, addiction) use a single abstract `Clock` entity with type-specific metadata, rather than separate entities. This reduces code duplication and simplifies the Redux store structure.

**Phase Overview:**
1. **Foundation** (Sessions 1-2) - Project setup, TypeScript types, TDD infrastructure
2. **Character System** (Sessions 3-5) - Traits, action dots, equipment, rally
3. **Crew & Momentum** (Sessions 6-7) - Shared Momentum pool, spending/generation
4. **Clock System** (Sessions 8-10) - Unified clock abstraction for harm/consumables/addiction
5. **Advanced Features** (Sessions 11-12) - Trait grouping, flashbacks, progression
6. **Foundry Integration** (Sessions 13-14) - Actor/Item mapping, persistence adapter
7. **Polish & Docs** (Session 15) - Documentation, performance, examples

---

### Phase 1: Foundation (Session 1-2)
**Goal:** Basic project setup, core entities, TDD infrastructure

- [ ] Initialize project (Vite + TypeScript + Redux Toolkit)
- [ ] Configure Jest + ts-jest
- [ ] Define TypeScript types for all entities (Character, Crew, Clock, Command)
- [ ] Define GameConfig interface and DEFAULT_CONFIG constant
- [ ] Define Command schema and factory
- [ ] Implement UUID utility
- [ ] Create API layer skeleton (interfaces only)
- [ ] Write test fixtures (sample characters, crews)
- [ ] First passing test (trivial, just to verify setup)

**Deliverable:** Compiling TypeScript project with passing tests and clean API contracts

---

### Phase 2: Character System (Session 3-5)
**Goal:** Character creation, traits, action dots, equipment

#### TDD Cycle:
1. **Tests First:**
   - Character creation with valid starting stats (2 traits, 12 dots)
   - Reject invalid dot distributions (>12 total, >3 per action at start)
   - Add/remove traits
   - Disable/enable traits (Lean into trait, Rally)
   - Add/remove equipment
   - Rally availability tracking

2. **Implementation:**
   - `characterSlice.ts` with reducers
   - Command creators in `commandFactory.ts`
   - Validators in `characterValidator.ts`
   - Selectors for common queries

3. **Verification:**
   - All tests pass
   - 100% coverage of character slice
   - Type safety verified

**Deliverable:** Fully functional character system with comprehensive tests

---

### Phase 3: Crew & Momentum System (Session 6-7)
**Goal:** Crew management, shared Momentum pool

#### TDD Cycle:
1. **Tests First:**
   - Crew creation
   - Add/remove characters to crew
   - Set Momentum (session start at 5)
   - Add Momentum (consequences, lean into trait)
   - Spend Momentum (push, flashback) - reject if insufficient
   - Cap at 10, lose excess
   - Reset to 5

2. **Implementation:**
   - `crewSlice.ts`
   - Momentum validators
   - Selectors for Momentum state

**Deliverable:** Working Momentum economy with edge case handling

---

### Phase 4: Abstract Clock System (Session 8-10)
**Goal:** Unified clock system for harm, consumables, and addiction

#### TDD Cycle:
1. **Tests First:**
   - Create abstract clock entity (harm, consumable, addiction)
   - Add/clear segments with type-specific validation
   - Index maintenance (byEntityId, byType, byTypeAndEntity)
   - **Harm clocks:** Max 3 per character, 4th replaces lowest
   - **Consumable clocks:** Depletion based on rarity, freeze when filled
   - **Addiction clock:** Single per crew, reduce by 2 on Reset
   - Delete/convert clocks (scar traits)
   - Cross-slice validation (crew → clock state for stim/consumable use)

2. **Implementation:**
   - `clockSlice.ts` - single unified slice
   - Type-specific validators in `clockValidator.ts`
   - Selectors for efficient queries (selectByTypeAndEntity, etc.)
   - Update `crewSlice.ts` to validate stim/consumable use against clock state

3. **Verification:**
   - All clock types work with same commands
   - Indexes correctly maintained
   - Cross-slice validation prevents invalid crew actions

**Deliverable:** Complete clock system supporting all game mechanics

---

### Phase 5: Advanced Features (Session 11-12)
**Goal:** Trait grouping, equipment tiers, flashback system

#### TDD Cycle:
1. **Tests First:**
   - Group 3 traits into 1 broader trait
   - Flashback creates new trait + grants advantage
   - Equipment tier validation (accessible vs inaccessible)
   - Action dot advancement (1 dot per milestone, max 4)

2. **Implementation:**
   - Extended character commands
   - Flashback system (just state tracking, no dice)

**Deliverable:** Character progression system

---

### Phase 6: API Implementation & Foundry Integration (Session 13-14)
**Goal:** Complete API layer and Foundry adapter

#### Tasks:
- [ ] Implement complete API layer (Character, Crew, Clock, GameState APIs)
- [ ] API integration tests (test contracts, not implementation)
- [ ] Implement `FoundryAdapter` interface
- [ ] State serialization/deserialization for Foundry Actor/Item system
- [ ] Command replay mechanism
- [ ] Export/import for single entities
- [ ] Actor/Item mapping (Character → Actor, Trait → Item, etc.)
- [ ] Mock Foundry integration example

**Deliverable:** Production-ready API with Foundry adapter and comprehensive integration tests

---

### Phase 7: Polish & Documentation (Session 15)
**Goal:** Production readiness

- [ ] Write README with usage examples
- [ ] API documentation (TypeDoc?)
- [ ] Performance profiling
- [ ] Bundle size optimization
- [ ] Example integration with vanilla JS (Foundry simulation)
- [ ] Migration guide for command schema versioning

**Deliverable:** Production-ready library

---

## Success Criteria

### Functional Requirements
- ✅ All game mechanics from rules_primer.md implemented
- ✅ Event sourcing with full command history
- ✅ Time-travel / undo capability
- ✅ Foundry-agnostic with clean adapter

### Non-Functional Requirements
- ✅ 100% TypeScript type coverage
- ✅ >90% unit test coverage
- ✅ Zero runtime errors on valid commands
- ✅ Validated commands rejected before dispatch
- ✅ Bundle size <50kb (gzipped)

### TDD Compliance
- ✅ Every feature has tests written FIRST
- ✅ Tests verify command → state transformations
- ✅ Property-based tests for invariants
- ✅ Integration tests for cross-slice behavior

---

## Open Questions / Decisions Needed

### Resolved Decisions ✅
1. ✅ **Package Manager:** **pnpm** (REQUIRED - see Implementation Learnings section)
2. ✅ **Selectors:** **RTK's built-in `createSelector`** (implemented)
3. ✅ **Trait Cap:** `GameConfig` parameter (can be adjusted via playtesting)
4. ✅ **Clock Sizes:** Configurable in `GameConfig`

### Remaining Questions
1. **Dev Logging:** Log all commands to console in dev mode?
2. **LocalStorage Adapter:** Include for standalone testing or Foundry-only?

### Can Defer to Later Phases:
- **Command Versioning:** Defer to Phase 7 (Polish)
- **Performance profiling:** Bundle size optimization

---

## Implementation Learnings & Debugging Notes

### Unified IDs: Foundry Actor ID === Redux ID ✅

**Date:** 2025-11-12
**Status:** ✅ **IMPLEMENTED** - ID confusion bug class eliminated

#### The Solution
Redux entities now use Foundry Actor IDs directly as their primary key.

**BEFORE (Dual ID system):**
```javascript
// Two separate IDs, complex mapping
const reduxId = generateId(); // UUID: "e5bc6b24-..."
await actor.setFlag('forged-in-the-grimdark', 'reduxId', reduxId);
const retrieved = actor.getFlag('forged-in-the-grimdark', 'reduxId');
const character = state.characters.byId[retrieved];
```

**AFTER (Unified IDs):**
```javascript
// Single ID, direct access
const characterId = game.fitgd.api.character.create({ id: actor.id, ... });
const character = state.characters.byId[actor.id]; // Direct lookup!
```

#### Architecture Changes

**Redux Slices:**
- `createCharacter`, `createCrew`, `createClock` now accept optional `id` parameter
- If `id` provided, use it; otherwise generate UUID (for non-Foundry contexts)
```typescript
interface CreateCharacterPayload {
  id?: string; // Optional: Foundry Actor ID
  name: string;
  // ...
}
```

**Foundry Actor Hooks:**
```javascript
// Create Redux entity with Foundry Actor ID
const characterId = game.fitgd.api.character.create({
  id: actor.id, // Use Foundry Actor ID directly!
  name: actor.name,
  // ...
});
// No setFlag needed - IDs are unified!
```

**Sheet Access:**
```javascript
// OLD: const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
// NEW:
const reduxId = this.actor.id; // Unified IDs!
const character = game.fitgd.api.character.getCharacter(reduxId);
```

#### Benefits Achieved

✅ **Eliminated ID confusion** - No more mixing Redux UUIDs and Foundry Actor IDs
✅ **Simpler code** - ~100 lines of ID mapping logic removed
✅ **Better debugging** - Same ID in Redux logs and Foundry UI
✅ **Faster access** - No flag lookups, direct state access
✅ **TypeScript ready** - Can now use branded types for compile-time safety

#### Migration for Existing Worlds

For worlds created before this change, run the migration script:

```javascript
// 1. Check if migration needed
game.fitgd.migration.needsMigration();

// 2. Run migration (creates backup automatically)
await game.fitgd.migration.unifyIds();

// 3. Test your world (open sheets, check data)

// 4. If issues, restore backup:
await game.fitgd.migration.restoreBackup();
```

The migration script:
- Transforms all Redux entity IDs from UUIDs to Foundry Actor IDs
- Updates all ID references (crew.characters, clock.entityId, etc.)
- Removes old `reduxId` flags from actors
- Creates automatic backup before making changes

**Migration script location:** `foundry/module/migration/unify-ids-migration.mjs`

#### Key Principle

**With unified IDs, `actor.id` IS the Redux ID.** No translation, no flags, just direct access.

```javascript
// ✅ CORRECT
const character = state.characters.byId[actor.id];

// ❌ WRONG (no longer needed)
const reduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
```

---

### Package Manager: Use pnpm, Not npm ✅

**Date:** 2025-11-14
**Status:** ✅ **CRITICAL** - Always use pnpm for this project

#### The Problem

Running `npm install` fails with cryptic errors about electron dependency downloads (403 Forbidden):

```bash
npm error npm error code 1
npm error npm error path /root/.npm/_cacache/tmp/git-cloneXXX/node_modules/electron
npm error npm error command failed
npm error npm error command sh -c node install.js
npm error npm error HTTPError: Response code 403 (Forbidden)
```

**Root Cause:** The project uses `pnpm` as its package manager (specified in `package.json`):

```json
{
  "packageManager": "pnpm@10.19.0"
}
```

The `pnpm-lock.yaml` lockfile exists, but `npm` tries to install dependencies using its own resolution algorithm, which conflicts with pnpm's setup.

#### The Solution

**✅ ALWAYS use pnpm for this project:**

```bash
# Install dependencies
pnpm install

# Build
pnpm run build:foundry

# Test
pnpm test

# Type check
pnpm run type-check:all
```

**❌ NEVER use npm:**

```bash
# ❌ WRONG - Will fail with 403 errors
npm install
npm run build:foundry
```

#### Why This Matters

1. **Lockfile compatibility** - `pnpm-lock.yaml` is not compatible with `npm`
2. **Dependency resolution** - pnpm uses hard links and a different store structure
3. **Build consistency** - All contributors and CI must use the same package manager

#### Quick Check

If you see `pnpm-lock.yaml` in the project root, use pnpm:

```bash
# Check for pnpm lockfile
ls -la | grep pnpm-lock.yaml

# If it exists, install pnpm globally (if not already installed)
npm install -g pnpm@10.19.0

# Then use pnpm for all operations
pnpm install
```

**Lesson:** Always check `package.json` for `packageManager` field and use the specified package manager. Lockfiles are not interchangeable between package managers.

---

### Command Broadcast Loop Prevention

**Issue:** Commands received via socket were being re-broadcast, creating infinite loops and duplicate clocks.

**Fix:** Update `lastBroadcastCount` immediately after applying socket commands in `receiveCommandsFromSocket()`:

```javascript
// Apply commands incrementally (no store reset!)
const appliedCount = applyCommandsIncremental(data.commands);

if (appliedCount > 0) {
  // Update lastBroadcastCount to prevent re-broadcasting received commands
  const history = game.fitgd.foundry.exportHistory();
  lastBroadcastCount = {
    characters: history.characters.length,
    crews: history.crews.length,
    clocks: history.clocks.length
  };
}
```

**Lesson:** Always update broadcast tracking IMMEDIATELY after receiving commands, not in the next save cycle.

---

### Clock Deletion Refresh

**Issue:** Players didn't see deleted clocks until manual refresh.

**Root Cause:** `refreshAffectedSheets()` tried to resolve `clockId → entityId` AFTER the clock was already deleted from store.

**Fix:** Capture the mapping BEFORE applying commands:

```javascript
// BEFORE applying commands, capture entityIds for clocks that will be deleted
const state = game.fitgd.store.getState();
const clockEntityIds = new Map();
for (const command of data.commands.clocks) {
  if (command.payload?.clockId) {
    const clock = state.clocks.byId[command.payload.clockId];
    if (clock) {
      clockEntityIds.set(command.payload.clockId, clock.entityId);
    }
  }
}

// Apply commands
applyCommandsIncremental(data.commands);

// Refresh affected sheets (pass the captured entityIds for deleted clocks)
refreshAffectedSheets(data.commands, clockEntityIds);
```

**Lesson:** When deleting entities, capture needed data BEFORE the delete operation.

---

### Harm Clock Overflow Behavior

**Issue:** Error when taking harm that would exceed max segments (e.g., 5/6 + 4 harm = error at 9/6).

**Game Design Decision:** Blades in the Dark / Forged in the Dark clocks should **cap at max**, not error. If at 5/6 and take 4 harm, become dying at 6/6.

**Fix:** Remove validation, cap segments:

```typescript
// Cap segments at maxSegments instead of throwing error
const newSegments = clock.segments + amount;
clock.segments = Math.min(newSegments, clock.maxSegments);
```

**Lesson:** Understand the game design intent. Clocks filling is a core mechanic, not an error condition.

---

### Orphaned Commands After Deletion

**Issue:** Console errors on world reload: "Clock X not found" when replaying commands for deleted entities.

**Root Cause:** Command history contains: `[createClock(A), addSegments(A), deleteClock(A)]`, but snapshot taken after deletion has no clock A.

**Fix:** Make command replay resilient to "entity not found":

```typescript
const isEntityNotFoundError = error instanceof Error &&
  (error.message.includes('not found') ||
   error.message.includes('does not exist'));

if (isEntityNotFoundError) {
  console.warn(`Skipped command for deleted entity`);
  skippedCount++;
} else {
  console.error(`Error replaying command:`, error);
}
```

**Lesson:** Event sourcing requires graceful handling of commands for deleted entities. This is expected, not an error.

---

### When to Use `render(true)` vs `render(false)`

**`render(true)` - Force full re-render:**
- Creating new visual elements (clocks, traits)
- Major state changes that add/remove DOM sections
- Ensures `getData()` is called and template is fully re-rendered

**`render(false)` - Minimal re-render:**
- Updating existing values (Momentum changes, clock segments)
- Performance optimization when structure doesn't change
- May only update computed properties

**Rule of Thumb:** When in doubt, use `render(true)` for state changes originating from the user's action. The performance difference is negligible for sheet updates.

---

### Universal Broadcasting Pattern (CRITICAL)

**Date:** 2025-11-09
**Issue:** Redux state changes not propagating to other clients (especially GM), position improvements not being applied

---

## ⚠️ THE GOLDEN RULE OF BROADCASTING ⚠️

**Every `store.dispatch()` in Foundry code MUST be immediately followed by `await game.fitgd.saveImmediate()`**

```javascript
// ✅ CORRECT - Always this pattern
game.fitgd.store.dispatch({ type: 'action', payload: { /* ... */ } });
await game.fitgd.saveImmediate();  // <-- NEVER FORGET THIS LINE

// ❌ WRONG - Missing broadcast
game.fitgd.store.dispatch({ type: 'action', payload: { /* ... */ } });
this.render();  // <-- GM won't see the change!
```

**No exceptions. Ever. If you dispatch, you broadcast.**

---

#### The Problem
This is a **recurring issue** that has appeared multiple times:
1. Player makes a change (toggle push, select trait, etc.)
2. Change is stored in Redux state
3. Player's UI updates locally
4. **BUT**: Other clients (especially GM) don't see the change
5. **ALSO**: Sometimes the change is only stored in a transaction/pending state, but not actually applied to the real state that affects mechanics

#### Root Causes
1. **Missing broadcast:** Forgot to call `game.fitgd.saveImmediate()` after dispatching Redux action
2. **Incomplete state update:** Stored data in a transaction object for display, but didn't dispatch the actual state-changing action
3. **Example from trait flashback:** Position improvement was calculated and shown in UI, but `setPosition` was never dispatched, so the improved position wasn't used in the roll

#### The Universal Pattern

**ALWAYS follow this exact pattern when making Redux state changes in Foundry:**

```javascript
async function makeStateChange() {
  // 1. Get current state if needed
  const state = game.fitgd.store.getState();
  const currentValue = state.someSlice.someValue;

  // 2. Calculate new values
  const newValue = calculateNewValue(currentValue);

  // 3. Dispatch ALL necessary Redux actions
  //    (Not just transaction/pending, but the ACTUAL state changes!)
  game.fitgd.store.dispatch({
    type: 'slice/action',
    payload: { /* ... */ }
  });

  // If you're showing a "pending" change, ALSO dispatch the real change!
  if (needsActualStateChange) {
    game.fitgd.store.dispatch({
      type: 'slice/actualStateChange',
      payload: { /* ... */ }
    });
  }

  // 4. CRITICAL: Broadcast to all clients
  await game.fitgd.saveImmediate();

  // 5. Refresh affected sheets
  refreshSheetsByReduxId([affectedCharacterId], false);

  // 6. User feedback
  ui.notifications.info('Change applied');
}
```

#### Specific Examples

**Example 1: Toggle Push (Widget Button)**
```javascript
async _onTogglePushDie(event) {
  event.preventDefault();

  const currentlyPushedDie = this.playerState?.pushed && this.playerState?.pushType === 'extra-die';

  // Dispatch action
  game.fitgd.store.dispatch({
    type: 'playerRoundState/setImprovements',
    payload: {
      characterId: this.characterId,
      pushed: !currentlyPushedDie,
      pushType: !currentlyPushedDie ? 'extra-die' : undefined,
    },
  });

  // CRITICAL: Broadcast to GM and all clients
  await game.fitgd.saveImmediate();

  // Refresh local UI
  this.render();
}
```

**Example 2: Transaction Pattern (Trait Flashback)**

**IMPORTANT:** Transactions store pending changes that only apply when committed (e.g., on roll). Don't confuse "showing the plan" with "applying the changes"!

**Dialog - Store Transaction (Pending Changes)**
```javascript
async _applyUseExisting() {
  // Store the transaction (PENDING changes only!)
  // This shows the PLAN, doesn't change actual state yet
  game.fitgd.store.dispatch({
    type: 'playerRoundState/setTraitTransaction',
    payload: {
      characterId: this.characterId,
      transaction: {
        mode: 'existing',
        selectedTraitId: this.selectedTraitId,
        positionImprovement: true,  // WILL improve position (not yet applied)
        momentumCost: 1,
      },
    },
  });

  // CRITICAL: Broadcast so GM sees the updated PLAN
  await game.fitgd.saveImmediate();

  // Refresh sheets to show the plan
  refreshSheetsByReduxId([this.characterId], false);
}
```

**Widget - Apply Transaction (On Commit Roll)**
```javascript
async _onCommitRoll(event) {
  const playerState = state.playerRoundState.byCharacterId[this.characterId];

  // Apply trait transaction (if exists)
  if (playerState?.traitTransaction) {
    // Apply trait changes (create/consolidate traits)
    await this._applyTraitTransaction(playerState.traitTransaction);

    // NOW apply position improvement
    if (playerState.traitTransaction.positionImprovement) {
      const currentPosition = playerState.position || 'risky';
      let improvedPosition = currentPosition;

      if (currentPosition === 'desperate') improvedPosition = 'risky';
      else if (currentPosition === 'risky') improvedPosition = 'controlled';

      // Dispatch position change
      if (improvedPosition !== currentPosition) {
        game.fitgd.store.dispatch({
          type: 'playerRoundState/setPosition',
          payload: {
            characterId: this.characterId,
            position: improvedPosition,
          },
        });
      }
    }
  }

  // Continue with roll...
}
```

#### Checklist for Every State Change

When implementing any feature that modifies Redux state, **ALWAYS**:

- [ ] Dispatch Redux action(s) for the state change
- [ ] If there's a "pending" state, ALSO dispatch the actual state change if it should take effect immediately
- [ ] Call `await game.fitgd.saveImmediate()` to broadcast
- [ ] Call `refreshSheetsByReduxId([...affectedIds], force)` to update UI
- [ ] Test that GM sees the change immediately
- [ ] Test that the change actually affects game mechanics (not just display)

#### Common Mistakes

**❌ WRONG: Applying transaction immediately instead of on commit**
```javascript
// In dialog - DON'T dispatch setPosition here!
game.fitgd.store.dispatch({
  type: 'playerRoundState/setTraitTransaction',
  payload: { transaction: { positionImprovement: true } }
});

// ❌ WRONG: Applying position immediately
game.fitgd.store.dispatch({
  type: 'playerRoundState/setPosition',
  payload: { position: 'controlled' }
});
// This breaks the transaction pattern - position should only
// change when the roll is committed, not when planning!
```

**❌ WRONG: Forgetting to broadcast transaction**
```javascript
// Store transaction but forget to broadcast
game.fitgd.store.dispatch({
  type: 'playerRoundState/setTraitTransaction',
  payload: { /* ... */ }
});
this.render(); // Only updates local client!
// Missing: await game.fitgd.saveImmediate()
// Result: GM doesn't see the updated plan!
```

**❌ WRONG: Not applying transaction changes on commit**
```javascript
// In _onCommitRoll - forgetting to apply the transaction
await this._applyTraitTransaction(transaction); // Creates/consolidates traits
// Missing: position improvement dispatch!
// Result: Position doesn't improve even though plan showed it would!
```

**✅ CORRECT: Transaction pattern**
```javascript
// Dialog: Store transaction + broadcast (show plan to GM)
game.fitgd.store.dispatch({ type: 'setTraitTransaction', /* ... */ });
await game.fitgd.saveImmediate();
refreshSheetsByReduxId([characterId], false);

// Widget on commit: Apply transaction changes
await this._applyTraitTransaction(transaction);
if (transaction.positionImprovement) {
  game.fitgd.store.dispatch({ type: 'setPosition', /* improved position */ });
}
await game.fitgd.saveImmediate();
```

#### Why This Is Hard to Remember

1. **Local testing works** - Your own client updates immediately, creating false confidence
2. **Transaction pattern confusion** - Easy to confuse "showing the plan" (store transaction) with "applying changes" (commit transaction). The transaction stores PENDING changes that only apply later.
3. **Split responsibility** - Dialog stores plan, widget applies changes on commit - creates cognitive distance
4. **Async timing** - Easy to forget `await` and move on before broadcast completes
5. **Silent failure** - Other clients just don't update, no error thrown

#### Prevention Strategy

1. **Code review checkpoint:** Search for `store.dispatch` and verify every occurrence has `saveImmediate()` after it
2. **Testing protocol:** ALWAYS test with GM + Player clients open, verify GM sees changes immediately
3. **Template code:** Copy-paste the universal pattern above instead of writing from scratch
4. **JSDoc reminder:** Add comment `// CRITICAL: Broadcast required!` above dispatch blocks

**Key Principle:** If you dispatch a Redux action in Foundry code, you MUST broadcast it with `saveImmediate()`, no exceptions.

---

### Foundry Application Render Lifecycle & Concurrent Render Blocking (CRITICAL)

**Date:** 2025-11-10
**Issue:** Player action widget stuck at "ROLLING..." screen after failed rolls, consequence dialog never appeared

This was a multi-day debugging session that revealed critical issues with both debugging methodology AND architectural design.

---

## ⚠️ DEBUGGING PRINCIPLES - NEVER VIOLATE THESE ⚠️

### 1. NEVER Assume a Fix Worked Without User Confirmation

**What happened:** Multiple times during debugging, I made changes and stated "this should fix it" or explained why the fix would work, without waiting for user confirmation.

**User feedback:** "Not sure what you did but problem persists" - happened MULTIPLE times

**Why this is dangerous:**
- Creates false confidence
- Wastes user's time testing unverified fixes
- Leads to compounding errors built on false assumptions
- Makes debugging harder because you're not sure which change actually worked

**CORRECT approach:**
```
1. Make a change
2. Commit and push
3. Say: "I've pushed a potential fix. Please test and let me know if the issue persists."
4. WAIT for user confirmation before proceeding
5. If still broken, gather MORE diagnostic data before next attempt
```

**NEVER say:** "This fixes it" or "The issue should be resolved now"
**ALWAYS say:** "Please test this and report back what you observe"

---

### 2. NEVER Use Hacky Workarounds When You Don't Understand the Problem

**What happened:** I added `setTimeout()` to delay rendering, thinking it was a timing issue.

**User response:** "So you ignored what I told you about possibly wrong approach, and apart from that you use a hacky wait because you don't understand what's going on?"

**Why this was wrong:**
- `setTimeout` is a band-aid that masks symptoms without fixing root cause
- Shows I didn't understand the Foundry Application render lifecycle
- User had already hinted this was the wrong approach
- Wasted time on a non-solution

**What I SHOULD have done:**
1. **Add diagnostic logging FIRST** to understand what's actually happening
2. Read Foundry Application class source code to understand `_state` and render lifecycle
3. Ask user for more detailed console output
4. Understand the problem BEFORE attempting a fix

**CORRECT debugging process:**
```
Problem → Add Diagnostic Logging → Analyze Logs → Understand Root Cause → Implement Fix → Test
```

**WRONG debugging process:**
```
Problem → Guess at Solution → Try Hack → Still Broken → Try Another Hack → ...
```

---

### 3. When in Doubt, Add Diagnostic Logging IMMEDIATELY

**What worked:** Once I added logging to `render()`, `_render()`, and `getData()`, the problem became obvious:

```javascript
Widget.render() called with force=true, _state=1  // ← AHA! _state=1 means RENDERING
Widget._render() called
[NO getData() log]  // ← Blocked because already rendering
```

**Lesson:** If something isn't working and you don't know why, **STOP** trying fixes and **ADD LOGGING** first.

Diagnostic logging should show:
- Method entry/exit
- State values at key points
- Conditional branches taken
- Async operation boundaries

---

## The Technical Problem: Foundry Application Render Lifecycle

### Understanding Foundry's `_state` Property

Foundry's `Application` class tracks rendering state with an internal `_state` property:

```javascript
Application.RENDER_STATES = {
  CLOSED: 0,
  NONE: 0,
  RENDERING: 1,
  RENDERED: 2,
  ERROR: 3
};
```

**CRITICAL RULE:** When `_state=1` (RENDERING), Foundry **blocks** concurrent render attempts. Calling `render()` while already rendering returns early without calling `getData()` or updating the template.

### The Root Cause: Render Race Conditions

**Pattern 1: Manual Render During Async Operation**

```javascript
// ❌ WRONG
async _onRoll() {
  dispatch(transitionState('ROLLING'));
  await saveImmediate();  // Triggers subscription render

  this.render();  // ← Sets _state=1 (RENDERING)

  // Async dice roll happens...
  const result = await this._rollDice();  // ← Still _state=1!

  dispatch(setRollResult(result));
  dispatch(transitionState('CONSEQUENCE_CHOICE'));
  await saveImmediate();  // ← Subscription tries to render, but _state=1, BLOCKED!
}
```

**Why this fails:**
1. Manual `this.render()` sets `_state=1`
2. Async operations continue while render is in progress
3. Redux subscription fires for state change
4. Subscription calls `this.render(true)`, but Foundry sees `_state=1` and returns early
5. Template never updates with new state

**✅ CORRECT: Let Redux subscription handle ALL rendering**

```javascript
async _onRoll() {
  dispatch(transitionState('ROLLING'));
  await saveImmediate();  // Subscription handles render

  // NO manual render() call here!

  const result = await this._rollDice();

  dispatch(setRollResult(result));
  dispatch(transitionState('CONSEQUENCE_CHOICE'));
  await saveImmediate();  // Subscription handles render
}
```

---

**Pattern 2: Multiple Broadcasts in Quick Succession**

```javascript
// ❌ WRONG
async _onRoll() {
  // First batch of changes
  dispatch(setRollResult(result));
  dispatch(setGmApproved(false));
  await saveImmediate();  // ← Broadcast #1, triggers render #1

  // Second batch of changes
  dispatch(transitionState('CONSEQUENCE_CHOICE'));
  await saveImmediate();  // ← Broadcast #2, triggers render #2 WHILE #1 still rendering!
}
```

**Why this fails:**
1. First `saveImmediate()` triggers Redux subscription → `render()` starts, `_state=1`
2. During async broadcast/render, second `saveImmediate()` completes
3. Second subscription fires, calls `render(true)`, but `_state=1` → BLOCKED!

**✅ CORRECT: Batch all dispatches before single broadcast**

```javascript
async _onRoll() {
  // Batch ALL changes together
  dispatch(setRollResult(result));
  dispatch(setGmApproved(false));
  dispatch(transitionState('CONSEQUENCE_CHOICE'));

  // Single broadcast with complete state
  await saveImmediate();  // ← Only ONE render cycle with all changes
}
```

---

## Universal Pattern for State Changes in Foundry Widgets

**ALWAYS follow this pattern:**

```javascript
async handleAction() {
  // 1. Batch all Redux dispatches together
  dispatch(action1());
  dispatch(action2());
  dispatch(action3());

  // 2. Single broadcast (triggers single render)
  await game.fitgd.saveImmediate();

  // 3. NO manual this.render() calls!
  //    Redux subscription handles all rendering
}
```

**When Redux subscription fires:**
```javascript
store.subscribe(() => {
  const currentState = store.getState();
  const previousState = previousStateSnapshot;

  if (currentState.playerRoundState !== previousState.playerRoundState) {
    this.render(true);  // ← This is the ONLY render() call needed
  }

  previousStateSnapshot = currentState;
});
```

---

## Architectural Issues and Potential Unit Tests

### Issue 1: No Clear Separation Between "Dispatch" and "Broadcast"

**Problem:** It's too easy to forget `saveImmediate()` after `dispatch()`. They feel like separate operations but must always happen together in Foundry code.

**Potential solution:** Create a wrapper that combines them:

```javascript
// Foundry integration helper
async function dispatchAndBroadcast(action) {
  game.fitgd.store.dispatch(action);
  await game.fitgd.saveImmediate();
}

// Usage
await dispatchAndBroadcast(setRollResult(result));
await dispatchAndBroadcast(transitionState('CONSEQUENCE_CHOICE'));
```

**Unit test approach:**
```javascript
describe('dispatchAndBroadcast', () => {
  it('should dispatch action and trigger broadcast', async () => {
    const mockDispatch = jest.fn();
    const mockBroadcast = jest.fn();

    await dispatchAndBroadcast(mockAction);

    expect(mockDispatch).toHaveBeenCalledWith(mockAction);
    expect(mockBroadcast).toHaveBeenCalled();
  });
});
```

---

### Issue 2: Render Race Conditions Not Caught by Tests

**Problem:** The `_state=1` blocking behavior is a Foundry Application class implementation detail. Our core Redux logic works fine, but the Foundry integration breaks.

**Potential solution:** Mock Foundry's Application class and test render blocking:

```javascript
describe('Widget render lifecycle', () => {
  it('should not trigger concurrent renders', async () => {
    const widget = new PlayerActionWidget(characterId);

    // Simulate: render starts (_state=1)
    widget._state = 1;

    // Redux subscription fires
    const subscription = widget._getSubscription();
    subscription();  // Should NOT call render() if _state=1

    expect(widget.render).not.toHaveBeenCalled();
  });

  it('should batch state changes before rendering', async () => {
    const widget = new PlayerActionWidget(characterId);
    const renderSpy = jest.spyOn(widget, 'render');

    // Multiple dispatches
    dispatch(action1());
    dispatch(action2());
    dispatch(action3());
    await saveImmediate();

    // Should only trigger ONE render
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
```

---

### Issue 3: State Transition Validation Not Tested

**Problem:** We have `isValidTransition()` in types, but no integration tests ensuring Foundry code follows the state machine.

**Potential solution:** State machine integration tests:

```javascript
describe('Player round state machine', () => {
  it('should follow valid ROLLING → CONSEQUENCE_CHOICE transition', () => {
    const state = createInitialState('ROLLING');

    const nextState = reducer(state, transitionState('CONSEQUENCE_CHOICE'));

    expect(nextState.state).toBe('CONSEQUENCE_CHOICE');
  });

  it('should reject invalid ROLLING → DECISION_PHASE transition', () => {
    const state = createInitialState('ROLLING');

    expect(() => {
      reducer(state, transitionState('DECISION_PHASE'));
    }).toThrow('Invalid state transition');
  });
});
```

---

## Checklist for Future Widget Development

When creating or debugging Foundry widgets that use Redux:

- [ ] **Subscribe to Redux store in `_render()`, not constructor**
- [ ] **Let Redux subscription handle ALL render() calls** - never call `this.render()` manually in event handlers
- [ ] **Batch all `dispatch()` calls before single `saveImmediate()`** - never interleave them
- [ ] **Add diagnostic logging to `render()`, `_render()`, and `getData()`** during development
- [ ] **Test with GM + Player clients** - don't trust local-only testing
- [ ] **Never use setTimeout as a fix** - it's always a symptom of not understanding the problem
- [ ] **Never assume a fix worked** - always wait for user confirmation
- [ ] **Add logging BEFORE trying fixes** when the problem isn't clear

---

## Summary: What Went Wrong and How to Prevent It

### What Went Wrong (In Order)
1. ✗ Assumed missing broadcasts were the issue → added broadcasts → still broken
2. ✗ Fixed `setActivePlayer` state machine logic → still broken
3. ✗ **Used setTimeout hack** → user called me out, still broken
4. ✗ Changed `render(false)` to `render(true)` → still broken
5. ✓ **Added diagnostic logging** → saw `_state=1` blocking
6. ✗ Removed manual `render()` calls → still broken (different reason)
7. ✓ **Batched dispatches before broadcast** → FINALLY FIXED

### Key Lessons
1. **Diagnostic logging should be FIRST step**, not last resort
2. **Never assume fixes worked** - always confirm with user
3. **Never use hacks** (setTimeout, etc.) when you don't understand the problem
4. **Understand the platform** (Foundry Application lifecycle) before implementing features
5. **Batch Redux dispatches** before broadcasts to avoid render race conditions
6. **Let subscriptions handle rendering** - manual render() calls cause problems

### Prevention
- Read Foundry Application source code before building complex widgets
- Add comprehensive diagnostic logging during development, not just when debugging
- Create helper functions that enforce correct patterns (e.g., `dispatchAndBroadcast`)
- Write integration tests that mock Foundry's render lifecycle
- Always test with multiple clients (GM + Player) before declaring victory

---

**Key Principle:** When debugging complex integration issues, invest time in UNDERSTANDING the platform's internals (like Foundry's render lifecycle) rather than guessing at solutions. Diagnostic logging reveals truth; guesses just waste time.

---

## SOLUTION: Foundry-Redux Bridge API (2025-11-10)

**Status:** ✅ **IMPLEMENTED** - Ready for integration

### The Root Problem

All the documented issues share a common root cause: **Foundry code directly accesses Redux primitives** without any abstraction layer.

Every event handler, dialog, and widget has to remember 3+ steps:
```javascript
// ❌ The pattern that causes ALL the recurring bugs:
game.fitgd.store.dispatch({ type: 'action', payload: {...} });
await game.fitgd.saveImmediate();  // ← Easy to forget → GM doesn't see changes
refreshSheetsByReduxId([id], false);  // ← Easy to forget → UI doesn't update
```

**Failure modes:**
1. Forget `saveImmediate()` → State doesn't propagate to other clients
2. Forget `refreshSheetsByReduxId()` → UI doesn't update
3. Multiple `saveImmediate()` calls → Render race conditions
4. Use Foundry Actor ID instead of Redux ID → Silent failures
5. Interleave dispatches and broadcasts → Render blocking

### The Solution: Abstraction Layer

Created **Foundry-Redux Bridge API** that encapsulates the entire pattern:

**Location:** `foundry/module/foundry-redux-bridge.mjs`

```javascript
// ✅ CORRECT: Single call, impossible to forget steps
await game.fitgd.bridge.execute(
  { type: 'action', payload: {...} }
);
// Automatically: dispatches → broadcasts → refreshes affected sheets
```

### Key Features

1. **Automatic broadcast** - Can't forget, it's part of the call
2. **Automatic sheet refresh** - Detects affected entities and refreshes
3. **Batch support** - Prevents render race conditions:
   ```javascript
   await game.fitgd.bridge.executeBatch([
     { type: 'action1', payload: {...} },
     { type: 'action2', payload: {...} },
     { type: 'action3', payload: {...} }
   ]);
   // Single broadcast, single refresh - no race conditions!
   ```
4. **ID mapping** - Handles Redux ↔ Foundry Actor ID conversion automatically
5. **Query methods** - Safe access to Redux state:
   ```javascript
   const character = game.fitgd.bridge.getCharacter(id);  // Works with either ID type
   const clocks = game.fitgd.bridge.getClocks(entityId, 'harm');
   ```

### Integration

**Step 1:** Add to `fitgd.mjs` initialization:
```javascript
import { createFoundryReduxBridge } from './foundry-redux-bridge.mjs';

// In Hooks.once('init'), after creating store:
game.fitgd.bridge = createFoundryReduxBridge(
  game.fitgd.store,
  game.fitgd.saveImmediate
);
```

**Step 2:** Use Bridge instead of direct dispatch:

**Before:**
```javascript
game.fitgd.store.dispatch({ type: 'clock/addSegments', payload: { clockId, amount: 3 } });
await game.fitgd.saveImmediate();
this.render(false);
refreshSheetsByReduxId([characterId], false);
```

**After:**
```javascript
await game.fitgd.bridge.execute({
  type: 'clock/addSegments',
  payload: { clockId, amount: 3 }
});
// That's it. Everything else is automatic.
```

### Benefits

| Before (Direct Redux Access) | After (Bridge API) |
|------------------------------|-------------------|
| 3-5 lines of code | 1-3 lines of code |
| Easy to forget steps | Impossible to forget |
| Render race conditions | Batching prevents races |
| ID confusion | Automatic ID mapping |
| Hard to test | Easy to mock |
| Error-prone | Safe by default |

### Documentation

Full documentation at: `foundry/module/BRIDGE_API_USAGE.md`

Includes:
- Complete API reference
- Migration guide
- Before/after examples
- Common patterns
- Testing strategies

### Migration Strategy

**No big-bang refactor needed.** Use the Bridge API for:

1. **All new code** - Start immediately
2. **Bug fixes** - Refactor while fixing
3. **Gradual refactoring** - One handler at a time

### Grep Commands to Find Code to Migrate

```bash
# Find all direct dispatch() calls
grep -rn "store.dispatch(" foundry/module/

# Find all saveImmediate() calls
grep -rn "saveImmediate()" foundry/module/

# Find all refreshSheetsByReduxId() calls
grep -rn "refreshSheetsByReduxId(" foundry/module/
```

Any place these patterns appear together should be converted to Bridge API.

### Success Criteria

Once fully adopted, these bugs should be **impossible**:
- ✅ State not propagating to GM (missing broadcast)
- ✅ UI not updating (missing refresh)
- ✅ Widget stuck rendering (render race conditions)
- ✅ Silent failures from ID confusion (automatic mapping)

### Key Principle

**Make the correct pattern the easy pattern.** The Bridge API makes it easier to do the right thing than to make mistakes.

---

## Implementation Status (2025-11-10)

**Bridge API:** ✅ **FULLY INTEGRATED**

### What Was Completed
- ✅ Bridge API implemented and initialized in `fitgd.mjs`
- ✅ All 40 critical dispatch antipatterns eliminated
- ✅ Combat hooks refactored (combatStart, updateCombat, combatEnd)
- ✅ All dialogs converted (AddTrait, FlashbackTraits x3)
- ✅ All widget handlers converted (14 patterns in player-action-widget)
- ✅ Comprehensive documentation created

### Verification
```bash
# Widget antipatterns - should return 0
grep -n "game.fitgd.store.dispatch\|game.fitgd.saveImmediate" \
  foundry/module/widgets/player-action-widget.mjs | wc -l
# Result: 0 ✅
```

---

## Architectural Concerns & Recommendations

### 1. Game API is a Leaky Abstraction ⚠️

**Problem:**
```javascript
// Game API dispatches internally but doesn't broadcast
game.fitgd.api.character.setActionDots({ characterId, action, dots });
await game.fitgd.saveImmediate();  // Still required manually
this.render(false);                 // Still required manually
```

**Why it's leaky:**
- API claims to be "high-level" but requires manual broadcast/refresh
- Defeats the purpose of having an abstraction
- Found in ~15 places (character sheets, dialogs)

**Long-term solution:**
```javascript
// Direct Redux actions through Bridge API
await game.fitgd.bridge.execute(
  { type: 'characters/setActionDots', payload: { characterId, action, dots } },
  { affectedReduxIds: [characterId] }
);
```

**Status:** Low priority - works correctly, just not ideal. Migrate gradually during bug fixes.

---

### 2. Lack of Type Safety in Foundry Integration ⚠️

**Problem:**
- Foundry code is JavaScript, not TypeScript
- ID confusion (Redux UUIDs vs Foundry Actor IDs) caught at runtime, not compile-time
- No type checking for Redux action shapes

**Current mitigation:**
- Bridge API validates IDs at runtime with `_isReduxId()`
- JSDoc comments document types
- Works, but fragile

**Recommendation:**
```typescript
// Convert Foundry integration to TypeScript
type ReduxId = string & { __brand: 'redux' };
type FoundryActorId = string & { __brand: 'foundry' };

// Compile-time prevention of ID confusion
function execute(action: ReduxAction, options: { affectedReduxIds: ReduxId[] }) {
  // TypeScript ensures ReduxId, not FoundryActorId
}
```

**Priority:** Medium - prevents entire class of bugs at compile-time

---

### 3. Manual Subscription Management ⚠️

**Problem:**
```javascript
// Every widget manually manages subscriptions
async _render(force, options) {
  await super._render(force, options);
  if (!this.unsubscribe) {
    this.unsubscribe = game.fitgd.store.subscribe(() => {
      this._onReduxStateChange();  // Fires for ALL state changes
    });
  }
}
```

**Issues:**
- Boilerplate in every widget
- Subscription fires for all state changes (inefficient)
- No selective subscription by characterId
- Easy to forget cleanup (memory leak risk)

**Better pattern:**
```javascript
// Memoized selector subscription (only fires when output changes)
class BaseReduxWidget extends Application {
  useReduxSelector(selector) {
    // Subscribe with memoization
    // Auto-cleanup on close
  }
}
```

**Status:** Low priority - current pattern works fine, cosmetic improvement

---

### 4. Socket Handler Exception (CRITICAL - DO NOT CHANGE) 🔴

**Location:** `fitgd.mjs` lines 984-1050 (`receiveCommandsFromSocket`)

```javascript
// These bare dispatches are INTENTIONAL
for (const [characterId, receivedPlayerState] of Object.entries(data.playerRoundState.byCharacterId)) {
  game.fitgd.store.dispatch({
    type: 'playerRoundState/setPosition',
    payload: { characterId, position: receivedPlayerState.position }
  });
  // NO saveImmediate() - intentionally NOT re-broadcasting
}
```

**Why this is CORRECT:**
- Commands received FROM other clients via socket
- Must NOT be re-broadcasted (would cause infinite loop)
- Bare dispatch updates local state to match remote state

**⚠️ DO NOT REFACTOR THESE TO BRIDGE API!**

---

## Code Quality Improvements

### Separation of Concerns

**Current mixing:**
```javascript
// Widget mixes UI, state management, AND game logic
async _onTakeHarm(event) {
  const segments = selectConsequenceSeverity(position, effect);  // Game logic
  await game.fitgd.bridge.executeBatch([...]);                   // State management
  await game.fitgd.api.harm.take({...});                         // More state management
  ui.notifications.info(`Taking ${segments} harm`);              // UI feedback
  setTimeout(() => this.close(), 500);                           // UI timing
}
```

**Better separation:**
```javascript
// 1. Game Logic Layer (Redux selectors + pure functions)
const consequence = selectConsequenceForRoll(state, characterId);

// 2. State Management Layer (Bridge API)
await game.fitgd.bridge.execute({ type: 'harm/apply', payload: consequence });

// 3. UI Layer (Widget only handles events → state changes)
async _onTakeHarm(event) {
  const consequence = this._calculateConsequence();
  await this._applyConsequence(consequence);
  this._showFeedback(consequence);
}
```

**Benefits:**
- Game logic testable without UI
- State management reusable across UI components
- UI can be swapped without changing logic

---

### Code Reusability

**Current duplication:**
```javascript
// Character sheet
game.fitgd.api.character.setActionDots(...);
await game.fitgd.saveImmediate();
this.render(false);

// Crew sheet (same pattern repeated)
game.fitgd.api.crew.addMomentum(...);
await game.fitgd.saveImmediate();
this.render(false);

// Widget (same pattern again)
game.fitgd.api.harm.take(...);
await game.fitgd.saveImmediate();
refreshSheetsByReduxId([characterId], false);
```

**Reusable abstraction:**
```javascript
// Single place for pattern
class FoundryGameActions {
  async setActionDots(characterId, action, dots) {
    await game.fitgd.bridge.execute(
      { type: 'characters/setActionDots', payload: { characterId, action, dots } },
      { affectedReduxIds: [characterId] }
    );
  }

  async takeHarm(characterId, harmType, position, effect) {
    // Calculate and batch all harm-related actions
    const actions = this._buildHarmActions(characterId, harmType, position, effect);
    await game.fitgd.bridge.executeBatch(actions, { affectedReduxIds: [characterId] });
  }
}
```

**Benefits:**
- Single source of truth for game operations
- Consistent broadcast/refresh behavior
- Easier to test and maintain

---

## Critical Rules (Updated)

### ✅ DO
- Use `game.fitgd.bridge.execute()` for single state changes
- Use `game.fitgd.bridge.executeBatch()` for multiple related changes
- Let Redux subscriptions handle all rendering
- Test with GM + Player clients before declaring done
- **Verify TypeScript builds before committing code** (see Development Workflow below)

### ❌ DO NOT
- Call `game.fitgd.store.dispatch()` directly (except socket handlers)
- Call `game.fitgd.saveImmediate()` manually
- Call `refreshSheetsByReduxId()` manually
- Touch socket handler bare dispatches (lines 984-1050 in fitgd.mjs)
- Commit code without running type-check and build verification

### Exception
Socket handlers in `receiveCommandsFromSocket()` intentionally use bare dispatch to prevent infinite broadcast loops.

---

## Development Workflow

### Before Committing Code

**ALWAYS run these checks before committing:**

```bash
# 1. Type check (catches type errors before commit)
pnpm run type-check:all

# 2. Build verification (ensures code compiles)
pnpm run build:foundry

# 3. Run tests (if applicable)
pnpm test

# 4. If all checks pass, commit
git add .
git commit -m "your message"
git push
```

### Quick Pre-Commit Checklist

- [ ] Code compiles (`pnpm run build:foundry` succeeds)
- [ ] Type check passes or errors are documented (`pnpm run type-check:all`)
- [ ] No new TypeScript errors introduced (check diff)
- [ ] Tested with GM + Player clients (for Foundry changes)
- [ ] Used Bridge API for state changes (not direct dispatch)
- [ ] Added `await saveImmediate()` after Bridge API calls

### Type Error Policy

- **242 type errors currently exist** (49% reduction from 476)
- These are **strictness checks**, not blocking bugs
- **New code should not introduce new type errors**
- If you add type errors, document why in commit message
- Prefer fixing existing errors when touching files

### Common Commands

```bash
# Install dependencies (ALWAYS use pnpm, never npm)
pnpm install

# Type check specific file
pnpm run type-check:foundry | grep "filename.ts"

# Build and watch for changes
pnpm run build:foundry --watch

# Run core Redux tests
pnpm test

# Type check core Redux code
pnpm run type-check:core
```

---

## Priority Recommendations

### High Priority
1. **Integration testing** - Test all refactored patterns with GM + Player clients
2. **Document socket exception** - Add comments warning against refactoring socket handlers

### Medium Priority
1. ✅ ~~**Add TypeScript**~~ - **COMPLETE** (All Foundry files converted, 49% error reduction)
2. **Migrate Game API** - Convert remaining Game API usages to Bridge API pattern (optional optimization)

### Low Priority (Optional Improvements)
1. **Fix remaining TypeScript errors** - 242 errors remain (cosmetic, can fix incrementally)
2. **BaseReduxWidget** - Create base class with memoized subscriptions
3. **Reusable actions** - Create FoundryGameActions helper class
4. **Separation of concerns** - Extract game logic from widget handlers

---

## Status: Production Ready ✅

All critical antipatterns eliminated. Safe by default. Ready for testing.

See `ARCHITECTURAL_ANALYSIS.md` for complete analysis.
