# Forged in the Grimdark - Foundry VTT System

This directory contains the Foundry VTT integration for the FitGD game system.

## Installation

### Option 1: Install from Manifest URL

1. In Foundry VTT, go to the "Game Systems" tab
2. Click "Install System"
3. Paste this manifest URL:
   ```
   https://github.com/mevsgame/fitgd/releases/latest/download/system.json
   ```
4. Click "Install"

### Option 2: Manual Installation

1. Copy this entire `foundry` directory to your Foundry VTT systems directory:
   ```
   [Foundry Data]/Data/systems/forged-in-the-grimdark/
   ```
2. Restart Foundry VTT
3. Create a new world and select "Forged in the Grimdark" as the game system

## Building from Source

Before installing in Foundry, you must build the core library:

```bash
# From the project root
npm install
npm run build

# This creates dist/fitgd-core.js which Foundry loads
```

## Architecture

The Foundry integration uses a **Redux-first architecture**:

1. **Redux Store** is the single source of truth for all game state
2. **Foundry Actors/Items** sync from Redux state (read-only view)
3. **All mutations** go through Redux actions (event sourcing)
4. **Command history** is stored in Foundry world settings for persistence

### Data Flow

```
UI Event → Dialog → Game API → Redux Store → Foundry Actor Update
                                    ↓
                              Auto-save to World Settings
```

## Files Overview

- **system.json** - Foundry system manifest
- **template.json** - Actor/Item data model definitions
- **module/fitgd.mjs** - Main module entry point
- **module/dialogs.mjs** - Dialog classes for game mechanics
- **templates/** - Handlebars templates for sheets
- **templates/styles/** - CSS styles
- **lang/** - Localization files

## Creating Characters

1. Create a new Actor of type "Character"
2. The character is automatically added to Redux state
3. Fill in traits and action dots
4. Create or join a Crew

## Creating Crews

1. Create a new Actor of type "Crew"
2. The crew is automatically added to Redux state
3. Add characters to the crew
4. Track Momentum (starts at 5/10)

## Game Mechanics

All core game mechanics from the rules primer are implemented:

### Actions
- **Take Harm** - Opens dialog to select harm type, position, and effect
- **Lean into Trait** - Click button on trait to disable it and gain Momentum
- **Rally** - Re-enable a disabled trait (available at 0-3 Momentum)
- **Push Yourself** - Spend 1 Momentum for advantage
- **Flashback** - Spend 1 Momentum to add a new trait

### Clocks
- **Harm Clocks** - Track physical and morale harm (max 3 per character)
- **Consumable Clocks** - Track grenades, stims, etc.
- **Addiction Clock** - Fills when using stims
- **Progress Clocks** - Track mission objectives and threats

### Momentum System
- Crew-wide shared resource (0-10)
- Starts at 5, resets to 5 on Reset
- Gain from consequences, leaning into traits
- Spend for Push, Flashback, Rally

## Dialogs

The system includes the following dialogs:

- **ActionRollDialog** - Full dice rolling with Position/Effect, Push, Devil's Bargain
- **TakeHarmDialog** - Select harm type, position, effect
- **RallyDialog** - Choose trait to re-enable
- **PushDialog** - Choose push type (extra die, improved effect/position)
- **FlashbackDialog** - Add new trait and describe flashback
- **AddTraitDialog** - Manually add trait
- **AddClockDialog** - Create progress/threat clock

## Macro System

**FitGD fully supports Foundry VTT macros!** All game mechanics are accessible via the `game.fitgd.api` interface, allowing players and GMs to create custom hotbar macros for common actions.

### Quick Start

1. Open **Macro Directory** (dice icon in Foundry)
2. Create new **Script** macro
3. Use the game API: `game.fitgd.api.character.methodName()`
4. Drag to hotbar for one-click access

### Example Macros

```javascript
// Action Roll for selected character
const tokens = canvas.tokens.controlled;
const actor = tokens[0]?.actor;
const reduxId = actor?.getFlag('forged-in-the-grimdark', 'reduxId');
new ActionRollDialog(reduxId, crewId).render(true);

// Add 2 Momentum (GM)
game.fitgd.api.crew.addMomentum({ crewId, amount: 2 });

// Lean into Trait
game.fitgd.api.character.leanIntoTrait({
  characterId,
  traitId,
  crewId
});
```

### Available APIs

- **game.fitgd.api.character** - Character management, traits, action dots
- **game.fitgd.api.crew** - Crew management, Momentum
- **game.fitgd.api.action** - Push, Flashback, Rally, Lean into Trait, Apply Consequences
- **game.fitgd.api.harm** - Take harm, recover, convert to scars
- **game.fitgd.api.clock** - Progress clocks, threat clocks
- **game.fitgd.api.resource** - Consumables, stims, addiction
- **game.fitgd.api.query** - Read-only state queries

### Documentation

See **[MACROS.md](./MACROS.md)** for:
- 15+ ready-to-use macro examples
- Player and GM macro libraries
- Helper functions and patterns
- Console debugging commands

See **[VERBS_MAPPING.md](./VERBS_MAPPING.md)** for:
- Complete mapping of game verbs to API methods
- Implementation status (85% coverage)
- Recommended macro setups

## Event Sourcing

All state changes are recorded as immutable commands:

```javascript
// View command history
game.fitgd.store.getState().characters.history

// Export full history
game.fitgd.foundry.exportHistory()

// Replay commands (reconstruction)
game.fitgd.foundry.replayCommands(history)
```

## Console Commands (Debugging)

Open the browser console (F12) and use:

```javascript
// Access the store
window.fitgd.store()

// Access the API
window.fitgd.api()

// Get current state
window.fitgd.getState()

// Export history
window.fitgd.exportHistory()
```

## Configuration

Auto-save interval can be configured in Foundry's Game Settings:
- **Auto-save Interval** - Seconds between auto-saves (default: 30, set to 0 to disable)

## Clock SVG Assets

The clock visuals use SVG assets from the **Blades in the Dark** Foundry VTT system by Dez384 and Megastruktur, used under MIT License.

To download the assets:

```bash
cd /path/to/fitgd
./scripts/download-clock-assets.sh
```

This downloads 7 color themes:
- **Red** - Physical Harm, Threats
- **Grey** - Morale Harm
- **Blue** - Progress Clocks
- **Yellow** - Addiction Clock
- **Green** - Consumable Clocks
- **White** - Personal Goals
- **Black** - Faction Clocks

## Known Limitations

This is an early integration with the following limitations:

1. **No Dice Roller** - Foundry's dice roller is not yet integrated
2. **No Chat Messages** - Actions don't post to chat yet
3. **No Compendiums** - No pre-made traits/equipment packs
4. **No Macros** - No macro support yet
5. **Templates Only** - Templates need further styling/polish

## Troubleshooting

### "Module not found" error

Ensure you've built the core library:
```bash
npm run build
```

### State not persisting

Check the browser console for auto-save errors. Ensure the world has write permissions.

### Sheet not rendering

Check that all template files are present in `foundry/templates/`.

## Contributing

See the main project README for development setup and testing instructions.

## License

MIT License - See LICENSE file in project root.

Clock SVG assets: MIT License from Blades in the Dark Foundry VTT system.
