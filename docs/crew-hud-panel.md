# Crew HUD Panel

## Overview

A persistent overlay panel on the left side of the screen that displays the primary crew's status at a glance. The HUD provides quick access to momentum controls, crew clocks, and character actions.

## Features

- **Momentum track** with red-filled boxes (0-10)
- **GM controls**: +1, -1, and full reset buttons
- **Crew clocks** section (progress/threat clocks with SVG previews)
- **Character cards** with:
  - Portrait
  - Name
  - Harm clocks (red SVGs)
  - Addiction clocks (purple-tinted, per-character)
  - Active indicator (pulsing dice icon when taking action)
  - Take Action button

## Architecture & State

### Redux Integration
- Subscribes to store for real-time updates
- Reads from `crews`, `characters`, and `clocks` slices
- Updates on momentum, clock, or character changes
- **Name sync**: Actor name changes in Foundry trigger HUD re-render via `updateActor` hook

### Settings
| Setting | Scope | Purpose |
|---------|-------|---------|
| `primaryCrewId` | World | Which crew to display |
| `hudVisible` | Client | Visibility persistence |
| `hudPosition` | Client | Drag position persistence |

### State Machine
N/A - HUD is a passive display widget

## UI/UX Design

### Visuals
- Dark semi-transparent background matching Foundry theme
- Red momentum boxes (filled = current momentum)
- SVG clock previews (36px for crew clocks, 20px for character clocks)
- Green highlight + pulsing icon for active character

### Interactions
| Action | Result |
|--------|--------|
| Drag header | Reposition HUD (saved to settings) |
| Click +/- | Add/spend 1 momentum (GM only) |
| Click redo icon | Perform full momentum reset (GM only) |
| Double-click character | Open character sheet |
| Click Take Action | Open Player Action Widget |

### GM vs Player View
- **GM**: Sees momentum controls (+, -, reset), can Take Action for any character
- **Player**: No momentum controls, can only Take Action for owned characters

## Implementation Details

### Files
| File | Purpose |
|------|---------|
| [crew-hud-panel.ts](file:///workspaces/fitgd/foundry/module/widgets/crew-hud-panel.ts) | Singleton widget class |
| [crew-hud-panel.html](file:///workspaces/fitgd/foundry/templates/widgets/crew-hud-panel.html) | Handlebars template |
| [crew-hud-panel.css](file:///workspaces/fitgd/foundry/templates/styles/crew-hud-panel.css) | Scoped styles |
| [hud-hooks.ts](file:///workspaces/fitgd/foundry/module/hooks/hud-hooks.ts) | Scene controls + auto-restore |
| [system-settings.ts](file:///workspaces/fitgd/foundry/module/settings/system-settings.ts) | Settings registration |

### API Exposure
```typescript
game.fitgd.hud.show(crewId?)  // Show HUD
game.fitgd.hud.hide()         // Hide HUD
game.fitgd.hud.isVisible()    // Check visibility
```

### Crew Sheet Integration
- "Set as Primary" button in crew sheet header
- Updates `primaryCrewId` setting
- Refreshes HUD if visible

## Rules Integration

### Primary Rules
- Momentum: 0-10 scale, used for Push/Flashback
- Momentum Reset: Resets to starting value, recovers harm/addiction clocks

### Edge Cases
- No primary crew set: Warning notification, HUD doesn't open
- No characters in crew: "No characters in crew" message
- Addiction clocks only appear after stims usage
