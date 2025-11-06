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

### Before Phase 1:
1. **Package Manager:** npm, yarn, or pnpm? (Recommendation: **pnpm** for speed)
2. **Dev Logging:** Log all commands to console in dev mode?
3. **Selectors:** Use Reselect or RTK's built-in `createSelector`? (Recommendation: **RTK built-in**)
4. **LocalStorage Adapter:** Include for standalone testing or Foundry-only?

### Can Defer to Later Phases:
- **Trait Cap:** Now a `GameConfig` parameter, can be set during playtesting
- **Command Versioning:** Defer to Phase 7 (Polish)
- **Clock Sizes:** Now configurable in `GameConfig`

---

## Implementation Learnings & Debugging Notes

### Redux ID vs Foundry Actor ID (Critical)

**Date:** 2025-11-06
**Issue:** Sheet refresh bug - creators don't see newly created clocks/traits until manually reopening sheet

#### The Problem
When a user created a harm clock, consumable clock, or trait via a dialog, their own sheet would not refresh to show the new element. However:
- Other users saw the update immediately via socket broadcast ✓
- The element WAS created in Redux ✓
- Manual reopen showed the element ✓

#### Root Cause
The Foundry integration uses **TWO DIFFERENT ID SYSTEMS**:

1. **Redux IDs** - UUIDs generated by our Redux store
   - Stored in: `state.characters.byId[reduxId]`
   - Example: `"e5bc6b24-350f-4b15-8acf-b0f6d5f26bfd"`

2. **Foundry Actor IDs** - Foundry document IDs
   - Stored in: `game.actors.get(foundryId)`
   - Example: `"Actor.abc123def456"`

**The Redux ID is stored in the Foundry Actor's flags:**
```javascript
actor.getFlag('forged-in-the-grimdark', 'reduxId')
```

#### The Bug
Dialogs were calling:
```javascript
game.actors.get(characterId)?.sheet.render(true);
```

But `characterId` is a **Redux ID**, not a Foundry Actor ID! This returned `undefined`, so the render call had no effect.

#### Why It Worked for Other Clients
Socket broadcast → `receiveCommandsFromSocket()` → `refreshAffectedSheets()` → iterates `ui.windows` → matches by Redux ID flag ✓

The socket path CORRECTLY found sheets by Redux ID, but the dialog path tried to use Redux IDs as Foundry IDs ✗

#### The Fix
Created `refreshSheetsByReduxId()` helper that mirrors the socket refresh logic:

```javascript
function refreshSheetsByReduxId(reduxIds, force = true) {
  const affectedReduxIds = new Set(reduxIds.filter(id => id));

  for (const app of Object.values(ui.windows)) {
    if (app.constructor.name === 'FitGDCharacterSheet' ||
        app.constructor.name === 'FitGDCrewSheet') {
      // Look up Redux ID from Foundry actor flags
      const reduxId = app.actor?.getFlag('forged-in-the-grimdark', 'reduxId');
      if (reduxId && affectedReduxIds.has(reduxId)) {
        app.render(force);
      }
    }
  }
}
```

Updated all dialogs and sheet handlers to use this helper instead of `game.actors.get()`.

#### Key Takeaway
**NEVER use `game.actors.get(reduxId)` - it will fail silently!**

Always:
1. Use `refreshSheetsByReduxId([reduxId], force)` for sheet refresh
2. Or iterate `ui.windows` and match via `getFlag('forged-in-the-grimdark', 'reduxId')`

#### Why This Was Hard to Debug
1. **Silent failure** - `game.actors.get(undefined)` returns `undefined`, optional chaining makes it silent
2. **Partial success** - Socket refresh worked, creating false confidence in the render logic
3. **Worked after reload** - Manual reopen used different code path that worked
4. **Subtle timing** - Initially suspected async/timing issues rather than ID mismatch

#### Prevention
- Add JSDoc comments clarifying when IDs are Redux vs Foundry IDs
- Consider TypeScript branded types: `type ReduxId = string & { __brand: 'redux' }`
- Grep for `game.actors.get(` during code review and verify it's using Foundry IDs

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

## Next Steps

1. **Answer Phase 1 questions** above
2. **Session 1: Begin Phase 1** - Initialize project with Vite + TypeScript + Redux Toolkit
3. **Establish TDD workflow** - Write first failing test together

Ready to proceed when you are! 🎲
