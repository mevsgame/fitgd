# Foundry-Redux Bridge

## Overview
The **Foundry-Redux Bridge** is the critical integration layer that synchronizes the external Redux state store with Foundry VTT's internal data structures and UI. It ensures that state changes made in Redux are correctly propagated to all connected clients and that the relevant UI sheets are refreshed.

**Why this is critical:**
Foundry VTT and Redux have fundamentally different state management paradigms. Without this bridge, state changes would be local-only or fail to trigger UI updates, leading to desynchronized game states.

## Architecture & State

### Core Concept: The "Dispatch-Broadcast-Refresh" Cycle
Every state change in the system must go through a strict three-step lifecycle to ensure consistency:
1.  **Dispatch**: The action is applied to the local Redux store.
2.  **Broadcast**: The updated state is serialized and sent to other clients via Foundry's socket/database mechanism (`saveImmediate`).
3.  **Refresh**: The UI components (Sheets, Widgets) that depend on the changed data are re-rendered.

The `FoundryReduxBridge` class encapsulates this lifecycle, preventing developers from accidentally missing a step.

### Key Methods

#### `execute(action, options)`
Executes a single Redux action.
- **Usage**: Standard user interactions (e.g., clicking a checkbox).
- **Automatic ID Detection**: Analyzes the action payload to determine which Actors (Characters/Crews) are affected and refreshes only their sheets.

#### `executeBatch(actions, options)`
Executes multiple Redux actions as a single atomic transaction.
- **Usage**: Complex operations like "Start Round" or "Flashback" that involve multiple state updates.
- **Race Condition Prevention**: Crucially, this performs **one** broadcast for **many** actions. If you called `execute()` in a loop, you would trigger multiple network broadcasts, leading to race conditions and UI flickering.

## Implementation Details

### Bridge API
The bridge is exposed globally as `game.fitgd.bridge`.

```typescript
// BAD: Never do this
store.dispatch(someAction());

// GOOD: Use the bridge
await game.fitgd.bridge.execute(someAction());
```

### Sheet Refresh Logic
The bridge uses a smart refresh system to minimize performance impact:
1.  It inspects the `action.payload` for keys like `characterId`, `crewId`, or `clockId`.
2.  It resolves these to the corresponding Foundry Actor IDs.
3.  It iterates through **open windows** and calls `.render()` only on the sheets that match the affected IDs.

### Unified IDs
The system uses "Unified IDs", meaning the Redux ID is identical to the Foundry Actor ID. This simplifies the logic significantly compared to older versions that required translation tables.

## Rules Integration
- **State Authority**: While Foundry is the transport layer, Redux is the source of truth for game mechanics (Clocks, Stress, Position/Effect).
- **Concurrency**: The `executeBatch` method is the primary mechanism for ensuring rule atomicity (e.g., spending stress AND marking a clock must happen together).
