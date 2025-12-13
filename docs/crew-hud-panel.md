# Crew HUD Panel

## Overview

The **Crew HUD Panel** is a persistent, always-visible overlay on the left side of the screen that provides at-a-glance status for the **primary crew**. It displays crew momentum, active clocks (with SVG previews), and compact character cards with harm status and quick-action buttons.

**Why this is useful:**
During gameplay, players and GMs often need to reference crew status without opening the full Crew Sheet. The HUD provides instant visibility of:
- Current Momentum (with GM controls)
- Active progress/threat clocks
- Each character's harm clocks
- Quick "Take Action" buttons for initiating the Player Action Widget

## Architecture & State

### Primary Crew Concept

Only one crew can be designated as "primary" at a time. The GM sets this via a button on the Crew Sheet.

**World Setting:**
- `primaryCrewId` (world scope) - The crew ID that the HUD displays

**Client Settings:**
- `hudVisible` (client scope) - Whether the HUD is currently shown (persists across sessions)

### Redux Integration

**Reads:**
- `crewSlice` - Crew name, momentum, character list
- `clockSlice` - Crew clocks (progress, threat) and character harm clocks
- `characterSlice` - Character names (for card display)

**Writes:** None - HUD is read-only except for momentum controls (dispatched via Bridge API)

### Foundry Integration

**Actor Data:**
- Token portraits fetched from Foundry Actor (`actor.img`)
- Character sheet opened via `actor.sheet.render(true)`

## UI/UX Design

### Panel Layout

```
┌─────────────────────────┐
│  Crew Name              │
│  ■■■■■□□□□□  [+][-]     │
│  (Momentum: 5/10)       │
├─────────────────────────┤
│  CLOCKS                 │
│  [SVG] Patrol 2/6       │
│  [SVG] Alarm 4/8        │
├─────────────────────────┤
│ ┌────┬──────────┬───┐   │
│ │ 📷 │ Marcus   │ 🎲│   │
│ │    │ [SVG][SVG]│   │   │
│ └────┴──────────┴───┘   │
│ ┌────┬──────────┬───┐   │
│ │ 📷 │ Lyra     │ 🎲│   │
│ │    │ [SVG]    │   │   │
│ └────┴──────────┴───┘   │
└─────────────────────────┘
```

### Visual Elements

| Element | Description |
|---------|-------------|
| **Crew Header** | Crew name and momentum track (10 boxes) |
| **Momentum Controls** | +/- buttons (GM only) |
| **Crew Clocks** | SVG clock images with names (progress/threat clocks) |
| **Character Cards** | Portrait thumbnail, name, harm clocks (SVG), Take Action button |

### Interactions

| Action | Behavior |
|--------|----------|
| Double-click character card | Opens character sheet |
| Click "Take Action" button | Opens Player Action Widget for that character |
| Click momentum +/- | Adds/spends 1 momentum (GM only) |
| Scene controls toggle | Shows/hides the HUD |

### Clock SVG Display

Clocks display using the existing SVG assets from `assets/clocks/themes/`:

| Clock Type | Color Theme | Example Path |
|------------|-------------|--------------|
| Harm | Red | `themes/red/6clock_3.svg` |
| Progress | Blue | `themes/blue/8clock_4.svg` |
| Threat | Red | `themes/red/6clock_2.svg` |

The clock image path is computed based on:
- Color theme (by clock type)
- Max segments (4/6/8/12)
- Current segments

## Implementation Details

### Entry Points

1. **Crew Sheet "Set as Primary" Button** (GM only)
   - Sets `primaryCrewId` world setting
   - Button shows filled star when crew is primary
   
2. **Scene Controls Toggle**
   - Added to token controls group via `getSceneControlButtons` hook
   - Icon: `fas fa-users`
   - Toggles HUD visibility

### Session Persistence

The HUD auto-restores on page load:
1. On `ready` hook, check `hudVisible` client setting
2. If true, retrieve `primaryCrewId` from world settings
3. Call `CrewHUDPanel.show(primaryCrewId)` after slight delay

### Widget Class

**Singleton Pattern:**
```typescript
class CrewHUDPanel extends Application {
  private static _instance: CrewHUDPanel | null = null;
  
  static show(crewId?: string): void { ... }
  static hide(): void { ... }
  static isVisible(): boolean { ... }
}
```

**Application Options:**
- `popOut: false` - Renders as inline HTML, not a draggable window
- Fixed position via CSS (not Foundry window management)

### Redux Subscription

The HUD subscribes to the Redux store for real-time updates:
```typescript
this.storeUnsubscribe = store.subscribe(() => {
  if (this.rendered) {
    this.render(false);  // Re-render on any state change
  }
});
```

This ensures momentum changes, clock updates, and character modifications are immediately reflected.

### Permission Checks

| Control | Visibility |
|---------|------------|
| Momentum +/- buttons | GM only |
| Take Action button | Character owner OR GM |
| Set as Primary button | GM only |

## Rules Integration

- **Momentum**: Displays current crew momentum (0-10), enforces max via Redux
- **Clocks**: Shows all crew progress clocks and per-character harm clocks
- **Take Action**: Invokes same flow as combat turn or character sheet button

## Related Features

- [Crew Sheet](./crew-sheet.md) - Full crew management interface
- [Character Sheet](./character-sheet.md) - Full character management
- [Player Action Widget](./player-action-widget.md) - Action resolution flow
