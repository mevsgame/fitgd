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

### Phase 6: Foundry Integration Layer (Session 13-14)
**Goal:** Adapter pattern for Foundry VTT

#### Tasks:
- [ ] Implement `FoundryAdapter` interface
- [ ] State serialization/deserialization for Foundry Actor/Item system
- [ ] Command replay mechanism
- [ ] Export/import for single entities
- [ ] Actor/Item mapping (Character → Actor, Trait → Item, etc.)
- [ ] Integration tests with mock Foundry

**Deliverable:** Clean API for Foundry to consume, with proper Actor/Item mapping

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
