# Forged in the Grimdark - Redux Core

A **TypeScript + Redux Toolkit** event-sourced state management system for "Forged in the Grimdark" character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

## Features

- ✅ Event-sourced architecture with complete command history
- ✅ Full TypeScript type safety
- ✅ High-level API for gameplay verbs (push, flashback, take harm, etc.)
- ✅ TDD approach with 777 passing tests (100% coverage)
- ✅ Foundry VTT adapter for seamless integration
- ✅ Abstract clock system (harm, consumables, addiction, progress)
- ✅ Momentum-based resource economy (not stress/trauma)
- ✅ Character traits, action dots, equipment management
- ✅ Equipment system with load limits, flashback acquisition, and augmentations
- ✅ Crew management with shared Momentum pool

## Installation

### For Foundry VTT Users

The system is available on [GitHub Releases](https://github.com/mevsgame/fitgd/releases). To install in Foundry:

1. Go to the system installation dialog in Foundry
2. Paste this manifest URL:
   ```
   https://github.com/mevsgame/fitgd/releases/latest/download/system.json
   ```
3. Click "Install" and enable the system for your world

For developers:

```bash
pnpm install
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

**For more examples**, see [docs/EXAMPLES.md](./docs/EXAMPLES.md) which includes:
- Character creation and advancement
- Action resolution (push, flashback, consequences)
- Harm management and recovery
- Momentum economy
- Traits and Rally mechanics
- Resources and consumables
- Progress clocks
- Complete mission flow examples
- Foundry VTT integration patterns

## For Claude Code Sessions

**If you are a Claude Code session working on this project:**
→ Read [SESSION_START.md](./SESSION_START.md) first for required context and critical rules.

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
- **Equipment**: Manage loadout with 5-item limit. Acquire rare items via flashback (1M cost)
- **Harm**: Physical, Morale (6-segment clocks, max 3 active)
- **Momentum**: Shared crew resource, spent on push/flashback, gained from consequences/leaning into traits
- **Rally**: Recover trait/harm at low Momentum (0-3)
- **Augmentations**: Permanent enhancements (don't count toward load, GM-activated on rolls)
- **Consumables**: Single-use items that can be depleted and replenished at reset

## API Reference

### Documentation

- **[Full API Documentation](./docs/api/)** - Complete TypeDoc-generated API reference with type definitions
- **[Usage Examples](./docs/EXAMPLES.md)** - Comprehensive code examples for common scenarios
- **[Implementation Plan](./CLAUDE.md)** - Complete development roadmap and architecture details

### Main API Modules

- **CharacterAPI**: create, leanIntoTrait, useRally, advanceActionDots, groupTraits
- **ActionAPI**: push, flashback, applyConsequences
- **ResourceAPI**: useConsumable, useStim
- **EquipmentAPI**: equipItem, unequipItem, acquireFlashback, selectCurrentLoad, selectAugmentations
- **CrewAPI**: create, member management, Momentum operations, performReset
- **HarmAPI**: take, recover, convertToScar
- **ClockAPI**: createProgress, advance, reduce, delete
- **QueryAPI**: canUseRally, canUseStim, isDying, getMomentum, trait/clock queries

To generate API documentation locally:
```bash
pnpm run docs  # Generates docs in ./docs/api/
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Releases & Deployment

This project uses **automated GitHub Actions** to build and release artifacts on version tags.

### Creating a Release

1. **Update version in `package.json` and `foundry/system.json`**:
   ```bash
   # Update version in both files
   # package.json: "version": "0.2.0"
   # foundry/system.json: "version": "0.2.0"
   ```

2. **Create and push a version tag**:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. **GitHub Actions automatically**:
   - ✅ Installs dependencies
   - ✅ Runs type checking
   - ✅ Builds the Foundry system (`pnpm run build:foundry`)
   - ✅ Creates release assets:
     - `system.json` (manifest for Foundry)
     - Built JavaScript in `dist/` folder
     - `forged-in-the-grimdark.zip` (complete system package)
   - ✅ Publishes to [GitHub Releases](https://github.com/mevsgame/fitgd/releases)

### Manifest URLs (Auto-Updated)

The `system.json` in the repo is pre-configured to point to releases:

```json
{
  "manifest": "https://github.com/mevsgame/fitgd/releases/latest/download/system.json",
  "download": "https://github.com/mevsgame/fitgd/releases/latest/download/forged-in-the-grimdark.zip"
}
```

These URLs always point to the **latest release**, so Foundry will automatically update when you release a new version.

### Workflow File

See [`.github/workflows/build-on-release.yml`](.github/workflows/build-on-release.yml) for implementation details.

## Development Status

### Completed
- ✅ Core Redux system (TypeScript, event sourcing, TDD)
- ✅ Character & Crew management (traits, action dots, Momentum)
- ✅ Abstract Clock System (harm, consumables, addiction, progress)
- ✅ Advanced mechanics (trait grouping, flashbacks, Rally)
- ✅ Equipment System (load management, flashback acquisition, augmentations, consumables)
- ✅ High-Level Game API (verb-based gameplay actions)
- ✅ Foundry VTT Integration (sheets, dialogs, macros, persistence)
- ✅ Bridge API Pattern (safe state management, broadcast handling)

### Production Ready
All core features implemented and tested. Bridge API eliminates common integration bugs.

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
