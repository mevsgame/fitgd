# Forged in the Grimdark - Redux Implementation Plan

## Project Overview

A **TypeScript + Redux Toolkit** event-sourced state management system for character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

---

## Core Architecture Principles

### 1. Event Sourcing
- **Full snapshot + complete command history** stored
- Current state is the single source of truth
- Command history allows reconstruction, undo, and audit trails
- Each command is immutable and timestamped

### 2. Entity Separation
**High-change entities** (separate stores with full history):
- `HarmClock` - references `characterId`
- `ConsumableClock` - team-wide depletion tracking
- `AddictionClock` - team-wide stim addiction
- `Momentum` - crew-level shared resource

**Low-change entities** (snapshot with history):
- `Character` - traits, action dots, equipment
- `Crew` - metadata, campaign info

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

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| State Management | Redux Toolkit (RTK) | Excellent TS support, built-in Immer, small bundle |
| Language | TypeScript 5+ | Type safety, excellent tooling |
| Testing | Jest + ts-jest | Industry standard, great TS support |
| Build | Vite | Fast, modern, tree-shakeable |
| Package Manager | npm/pnpm | TBD based on preference |

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

#### HarmClock
```typescript
interface HarmClock {
  id: string;
  characterId: string;
  type: string;                    // e.g., "Physical Harm", "Shaken Morale"
  segments: number;                // 0-6
  maxSegments: 6;
  createdAt: number;
  updatedAt: number;
}
```

#### ConsumableClock
```typescript
interface ConsumableClock {
  id: string;
  crewId: string;
  itemType: string;                // e.g., "frag_grenades", "stims"
  rarity: 'common' | 'uncommon' | 'rare';
  segments: number;                // Current depletion
  maxSegments: number;             // 8, 6, or 4
  tier: 'accessible' | 'inaccessible';
  frozen: boolean;                 // When clock fills
  createdAt: number;
  updatedAt: number;
}
```

#### AddictionClock
```typescript
interface AddictionClock {
  id: string;
  crewId: string;
  segments: number;                // 0-8
  maxSegments: 8;
  stimsLocked: boolean;            // True when filled
  createdAt: number;
  updatedAt: number;
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

  harmClocks: {
    byId: Record<string, HarmClock>;
    allIds: string[];
    byCharacterId: Record<string, string[]>; // Index for lookups
    history: Command[];
  };

  consumableClocks: {
    byId: Record<string, ConsumableClock>;
    allIds: string[];
    byCrewId: Record<string, string[]>;
    history: Command[];
  };

  addictionClocks: {
    byId: Record<string, AddictionClock>;
    allIds: string[];
    byCrewId: Record<string, string[]>;
    history: Command[];
  };
}
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
- `crew/spendMomentum` - Spend Momentum (push, flashback)
- `crew/resetMomentum` - Reset to 5 after Reset event

### HarmClock Commands
- `harmClock/create` - Create new harm clock for character
- `harmClock/addSegments` - Add segments (taking harm)
- `harmClock/clearSegments` - Remove segments (recovery)
- `harmClock/delete` - Remove clock entirely (healed or converted to trait)
- `harmClock/changeType` - Replace clock type (4th harm clock)

### ConsumableClock Commands
- `consumableClock/create` - Create consumable clock
- `consumableClock/addSegments` - Advance depletion after use
- `consumableClock/freeze` - Mark as frozen when filled
- `consumableClock/changeTier` - Downgrade availability
- `consumableClock/restore` - Story-based restoration

### AddictionClock Commands
- `addictionClock/create` - Initialize for crew
- `addictionClock/addSegments` - Advance after stim use
- `addictionClock/reduceSegments` - Reduce by 2 after Reset
- `addictionClock/lockStims` - Lock stims when filled

---

## Validation Rules

### Character Validation
- Action dots: 0-4 per action
- Starting total: 12 dots (at creation only)
- Maximum total: TBD (advancement)
- Starting traits: Exactly 2 (1 role, 1 background)
- Max harm clocks: 3 active per character
- Rally: Boolean state, one use per reset

### Crew Validation
- Momentum: 0-10 (excess is lost)
- Cannot spend more Momentum than available
- Character IDs must reference existing characters

### HarmClock Validation
- Segments: 0-6
- Character can have max 3 active harm clocks
- 4th harm replaces clock with fewest segments

### ConsumableClock Validation
- Max segments based on rarity: Common(8), Uncommon(6), Rare(4)
- Segments cannot exceed max
- When filled, tier downgrades and frozen=true

### AddictionClock Validation
- Max segments: 8
- When filled: stimsLocked=true, trait "Addict" added to triggering character
- Reduces by 2 (min 0) on Momentum Reset

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

### Command Dispatching
```typescript
// Foundry can dispatch commands via standard Redux pattern
store.dispatch({
  type: 'character/addTrait',
  payload: { characterId: '...', trait: {...} },
  timestamp: Date.now(),
  version: 1,
  userId: 'foundry-user-id',
  commandId: uuid(),
});
```

### State Subscription
```typescript
// Foundry subscribes to state changes
store.subscribe(() => {
  const state = store.getState();
  foundry.updateCharacterSheet(state.characters.byId['...']);
});
```

---

## Project Structure

```
fitgd/
├── src/
│   ├── store/
│   │   ├── index.ts                 # Configure store
│   │   ├── rootReducer.ts           # Combine slices
│   │   └── middleware/
│   │       ├── commandLogger.ts     # Log all commands
│   │       └── validator.ts         # Pre-dispatch validation
│   │
│   ├── slices/
│   │   ├── characterSlice.ts
│   │   ├── crewSlice.ts
│   │   ├── harmClockSlice.ts
│   │   ├── consumableClockSlice.ts
│   │   └── addictionClockSlice.ts
│   │
│   ├── types/
│   │   ├── character.ts
│   │   ├── crew.ts
│   │   ├── clocks.ts
│   │   ├── commands.ts
│   │   └── index.ts
│   │
│   ├── validators/
│   │   ├── characterValidator.ts
│   │   ├── crewValidator.ts
│   │   └── clockValidator.ts
│   │
│   ├── selectors/
│   │   ├── characterSelectors.ts    # Memoized selectors
│   │   ├── crewSelectors.ts
│   │   └── clockSelectors.ts
│   │
│   ├── adapters/
│   │   └── foundryAdapter.ts        # Foundry integration layer
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

### Phase 1: Foundation (Session 1-2)
**Goal:** Basic project setup, core entities, TDD infrastructure

- [ ] Initialize project (Vite + TypeScript + Redux Toolkit)
- [ ] Configure Jest + ts-jest
- [ ] Define TypeScript types for all entities
- [ ] Define Command schema and factory
- [ ] Implement UUID utility
- [ ] Write test fixtures (sample characters, crews)

**Deliverable:** Compiling TypeScript project with passing tests (even if trivial)

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

### Phase 4: Harm Clock System (Session 8-9)
**Goal:** Harm tracking, recovery, dying state

#### TDD Cycle:
1. **Tests First:**
   - Create harm clock for character
   - Add segments (Position × Effect table)
   - Max 3 clocks per character
   - 4th clock replaces lowest
   - Clear segments (recovery)
   - Delete clock (fully healed)
   - Convert clock to trait (scar)

2. **Implementation:**
   - `harmClockSlice.ts`
   - Index by characterId for fast lookups
   - Validators for max 3 clocks, replacement logic

**Deliverable:** Complete harm system matching rules

---

### Phase 5: Consumable & Addiction Clocks (Session 10-11)
**Goal:** Depletion tracking, stim addiction

#### TDD Cycle:
1. **Tests First:**
   - Create consumable clock (Common/Uncommon/Rare)
   - Advance depletion after use
   - Fill clock → freeze + tier downgrade
   - Create addiction clock
   - Advance after stim use
   - Reduce by 2 on Reset
   - Fill → lock stims + add "Addict" trait

2. **Implementation:**
   - `consumableClockSlice.ts`
   - `addictionClockSlice.ts`
   - Cross-slice logic (addiction → character trait)

**Deliverable:** Resource management system

---

### Phase 6: Advanced Features (Session 12-13)
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

### Phase 7: Foundry Integration Layer (Session 14-15)
**Goal:** Adapter pattern for Foundry VTT

#### Tasks:
- [ ] Implement `FoundryAdapter` interface
- [ ] State serialization/deserialization
- [ ] Command replay mechanism
- [ ] Export/import for single entities
- [ ] Integration tests with mock Foundry

**Deliverable:** Clean API for Foundry to consume

---

### Phase 8: Polish & Documentation (Session 16)
**Goal:** Production readiness

- [ ] Write README with usage examples
- [ ] API documentation (TypeDoc?)
- [ ] Performance profiling
- [ ] Bundle size optimization
- [ ] Example integration with vanilla JS (Foundry simulation)

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

1. **Package Manager:** npm, yarn, or pnpm?
2. **Trait Cap:** Should we enforce a maximum trait count, or leave it open for playtesting?
3. **Command Versioning:** How aggressive should schema migration be? (We can defer this to Phase 7)
4. **Middleware:** Should we log all commands to console in dev mode for debugging?
5. **Selectors:** Use Reselect for memoization, or RTK's built-in `createSelector`?
6. **Persistence:** Should we provide a LocalStorage adapter in addition to Foundry?

---

## Next Steps

1. **Answer open questions** (package manager, etc.)
2. **Session 1: Begin Phase 1** - Initialize project structure
3. **Establish TDD workflow** - Write first failing test together

Ready to proceed when you are! 🎲
