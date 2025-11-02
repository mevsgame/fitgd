# Forged in the Grimdark - Redux Core

A **TypeScript + Redux Toolkit** event-sourced state management system for "Forged in the Grimdark" character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

## Features

- ✅ Event-sourced architecture with complete command history
- ✅ Full TypeScript type safety
- ✅ High-level API for gameplay verbs (push, flashback, take harm, etc.)
- ✅ TDD approach with 146 passing tests (100% coverage)
- ✅ Foundry VTT adapter for seamless integration
- ✅ Abstract clock system (harm, consumables, addiction, progress)
- ✅ Momentum-based resource economy (not stress/trauma)
- ✅ Character traits, action dots, equipment management
- ✅ Crew management with shared Momentum pool

## Installation

```bash
npm install
```

## Usage

```typescript
import { createGameAPI, configureStore } from '@fitgd/core';

// Initialize the store
const store = configureStore();

// Create the game API
const game = createGameAPI(store);

// Create a character
const charId = game.character.create({
  name: "Sergeant Kane",
  traits: [
    { name: "Served with Elite Infantry", category: "role", disabled: false },
    { name: "Survived Hive Gangs", category: "background", disabled: false }
  ],
  actionDots: {
    shoot: 3, command: 2, skirmish: 1, skulk: 1,
    wreck: 1, finesse: 1, survey: 1, study: 1,
    tech: 0, attune: 0, consort: 1, sway: 1
  }
});

// Create a crew
const crewId = game.crew.create("Strike Team Alpha");
game.crew.addCharacter({ crewId, characterId: charId });

// Take harm
const harmResult = game.harm.take({
  characterId: charId,
  harmType: "Physical Harm",
  position: "risky",
  effect: "standard"
});
console.log(`Took ${harmResult.segmentsAdded} harm, now at ${harmResult.newSegments}/6`);

// Spend Momentum to push
game.action.push({ crewId, type: "extra-die" });
```

## Architecture

### Event Sourcing
- Full snapshot + complete command history stored
- Current state is the single source of truth
- Command history allows reconstruction, undo, and audit trails
- Each command is immutable and timestamped

### Entity Separation
- **High-change entities** (separate stores with full history): Clock, Momentum
- **Low-change entities** (snapshot with history): Character, Crew
- **Abstract clocks**: Generic entity used for harm, consumables, addiction, progress

### Technology Stack
- **State Management**: Redux Toolkit (RTK)
- **Language**: TypeScript 5+
- **Testing**: Jest + ts-jest (146 tests, 100% pass rate)
- **Build**: Vite
- **Package Manager**: npm

## Game Rules (FitGD, NOT Blades in the Dark)

**Important:** This system implements "Forged in the Grimdark" rules, which differ from standard Blades in the Dark:

### Key Differences from Blades
- **Momentum** (0-10, starts at 5) instead of Stress
- **Harm Clocks** (6 segments, max 3) instead of Stress track
- **Rally** mechanic (available at 0-3 Momentum)
- **Consumables** (grenades, stims) with depletion clocks
- **Addiction Clock** (crew-wide, 8 segments)
- **No Trauma system** (scars are traits)

### Core Mechanics
- **12 starting action dots** (0-4 per action)
- **2 starting traits** (role + background)
- **Harm**: Physical, Morale (6-segment clocks, max 3 active)
- **Momentum**: Shared crew resource, spent on push/flashback, gained from consequences/leaning into traits
- **Rally**: Recover trait/harm at low Momentum (0-3)

## API Reference

See [CLAUDE.md](./CLAUDE.md) for complete implementation plan and API documentation.

### Main API Modules

- **CharacterAPI**: create, leanIntoTrait, useRally, advanceActionDots, groupTraits
- **ActionAPI**: push, flashback, applyConsequences
- **ResourceAPI**: useConsumable, useStim
- **CrewAPI**: create, member management, Momentum operations, performReset
- **HarmAPI**: take, recover, convertToScar
- **ClockAPI**: createProgress, advance, reduce, delete
- **QueryAPI**: canUseRally, canUseStim, isDying, getMomentum, trait/clock queries

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Development Status

### Completed Phases
- ✅ Phase 1: Foundation (TypeScript, Redux, TDD setup)
- ✅ Phase 2: Character System (traits, action dots, equipment)
- ✅ Phase 3: Crew & Momentum System
- ✅ Phase 4: Abstract Clock System (harm, consumables, addiction)
- ✅ Phase 5: Advanced Features (trait grouping, flashbacks, progression)
- ✅ Phase 6.1: High-Level Game API (verb-based gameplay actions)

### In Progress
- 🚧 Phase 6.2: Foundry VTT Adapter (Actor/Item mapping, sheets)

### Planned
- ⏳ Phase 7: Polish & Documentation

## Foundry VTT Integration

The system provides a clean adapter for Foundry VTT integration:

```typescript
import { createFoundryAdapter } from '@fitgd/core/adapters';

const adapter = createFoundryAdapter(store);

// Export state for Foundry persistence
const state = adapter.exportState();

// Sync to Foundry Actor
adapter.syncToActor(characterId, foundryActor);
```

## Credits & Attributions

### Visual Assets & UI Inspiration
This project uses clock visual assets and UI design inspiration from the excellent **Blades in the Dark system for Foundry VTT** by Dez384 and Megastruktur:

- Repository: [https://github.com/Dez384/foundryvtt-blades-in-the-dark](https://github.com/Dez384/foundryvtt-blades-in-the-dark)
- License: MIT
- Assets Used: Clock SVG files (themes/*/\*clock_\*.svg)

We are grateful for their work on the original Foundry VTT implementation, which provided excellent reference for UI/UX patterns and visual styling. Their character sheets, clock visualization, and interaction patterns helped shape our own Foundry integration.

**Note:** While we borrow visual assets and UI patterns, our core mechanics implement "Forged in the Grimdark" rules, NOT standard Blades in the Dark. The state management, game logic, and data structures are entirely custom and event-sourced.

### Game Design
- "Forged in the Dark" by John Harper (Evil Hat Productions)
- "Forged in the Grimdark" variant rules by [Game Designer]

## License

MIT License - See [LICENSE](./LICENSE) file for details

## Contributing

This project follows TDD principles. Please ensure all tests pass before submitting PRs:

```bash
npm test
```

## Contact

For questions, issues, or contributions, please open an issue on GitHub.
