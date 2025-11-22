# Player Action Widget

## Overview
The **Player Action Widget** is a persistent, floating UI element that guides players through the core action resolution loop. It implements a complex state machine to handle the transition from decision-making to dice rolling, GM approval, and consequence resolution.

**Why this is critical:**
It serves as the primary interface for the game's core mechanic, enforcing rules like momentum costs, load limits, and position/effect negotiation in real-time.

## Architecture & State

### State Machine
The widget derives its UI state primarily from `playerRoundStateSlice`. The key states are:

1.  **DECISION_PHASE**:
    - **Approach Selection**: Player chooses their approach (Force, Guile, etc.).
    - **Roll Modes**:
        - **Standard**: Uses a single approach.
        - **Synergy**: Combines two approaches (Primary + Secondary) for a larger dice pool.
        - **Equipment**: Uses an item's bonus in place of a secondary approach.
    - **Modifiers**: Player can [Rally](./mechanics-rally.md), [Lean Into Traits](./mechanics-traits.md), or use [Flashbacks](./mechanics-traits.md).
    - **GM Controls**: GM sets Position and Effect.
2.  **ROLLING**:
    - System validates costs (Momentum).
    - Dice are rolled (3D dice integration).
    - Results are calculated and batched.
3.  **AWAITING_APPROVAL** (Optional):
    - GM reviews the roll outcome before it commits (if configured).
4.  **GM_RESOLVING_CONSEQUENCE**:
    - Triggered on Failure/Partial Success.
    - GM selects consequences (Harm, Complication, Clock ticks).
    - Player can interrupt with **Stims**.
5.  **COMPLETE**:
    - Turn ends, widget closes or resets.

### Synchronized Views (GM vs Player)
The widget is designed as a **shared experience**. Both the GM and the Player see the same widget state in real-time, but their available controls differ based on the current phase.

#### The "Turn Passing" Flow
1.  **Decision Phase**:
    - **Player**: Controls Approach, Equipment, and Modifiers.
    - **GM**: Controls Position and Effect.
    - *Sync*: When the GM changes Position, the Player sees it update instantly.
2.  **Rolling**:
    - **Both**: See the 3D dice roll animation simultaneously.
3.  **Consequence Phase**:
    - **GM**: Has controls to select Harm, Ticks, or Complications.
    - **Player**: View is read-only *unless* they trigger an interrupt (Stims).
    - *Interrupt*: If the Player clicks "Use Stims", the GM's controls are temporarily locked or overridden until the interrupt resolves.
    - **Augmentation Management**: The GM sees a list of the player's installed augmentations. They can toggle checkboxes to "Enable" specific augmentations for the current roll. Enabled augmentations are reflected in the "Current Plan" and may modify the transaction (bonuses/penalties).

### Redux Integration
- **Reads**: `playerRoundState`, `characters`, `crews`, `clocks`.
- **Writes**: Dispatches actions via `FoundryReduxBridge` to update round state, spend resources, and apply consequences.
- **Subscription**: The widget subscribes to the Redux store to trigger real-time re-renders when *any* relevant state changes (e.g., GM changes Position, Player sees it instantly).

## Implementation Details

### Handlers Pattern
To avoid a massive "God Class", business logic is delegated to specialized handlers:
- `DiceRollingHandler`: Calculates dice pools, validates rolls, batches outcomes.
- `ConsequenceResolutionHandler`: Manages the GM's flow of selecting harm/clocks.
- `StimsWorkflowHandler`: Handles the complex "resist consequence" logic (Addiction roll + Reroll).
- `TraitHandler` & `EquipmentHandler`: Manage static bonuses.
- `RallyHandler`: Manages the [Rally](./mechanics-rally.md) logic.

### Transaction Pattern
The widget uses a **Transaction Pattern** to handle complex state changes that require "staging" or "previewing" before being committed to the permanent game state. This ensures atomicity and allows users to cancel operations without side effects.

#### 1. Trait Transaction (Phase: `DECISION_PHASE`)
- **Purpose**: Manages temporary changes to character traits that are contingent on the roll being made.
- **Types**:
    - **Flashback**: Creating a new trait on the fly.
    - **Leaning**: Disabling an existing trait to improve Position.
    - **Consolidation**: Merging traits.
- **Lifecycle**:
    1.  **Stage**: User configures the trait (e.g., enters Flashback details). A `TraitTransaction` object is saved to `playerRoundState`.
    2.  **Preview**: The UI shows the *potential* effect (e.g., "Position: Risky -> Controlled").
    3.  **Commit**: When the roll is made, the transaction is executed (Trait added/disabled/removed).
    4.  **Rollback**: If the user cancels or changes their mind, the transaction is simply cleared from `playerRoundState`.

#### 2. Consequence Transaction (Phase: `GM_RESOLVING_CONSEQUENCE`)
- **Purpose**: Allows the GM to configure complex consequences (e.g., "Take Level 2 Harm AND tick the Alarm clock") before applying them.
- **Lifecycle**:
    1.  **Stage**: GM selects "Harm" or "Clock Tick". A `ConsequenceTransaction` object is created.
    2.  **Preview**: The Player sees exactly what is about to happen (e.g., "Taking 2 Harm: Broken Leg").
    3.  **Interrupt**: The Player can use **Stims** to resist. This pauses the transaction.
    4.  **Commit**: GM clicks "Apply". The Harm is added to the character and Clocks are updated in a single atomic batch.

### Roll Modes
The widget supports three distinct roll modes, selectable by the player during the Decision Phase:

1.  **Standard Mode**:
    - **Dice Pool**: `Primary Approach` rating.
    - **Use Case**: Default action roll.

2.  **Synergy Mode**:
    - **Dice Pool**: `Primary Approach` + `Secondary Approach` ratings.
    - **Use Case**: Combining two skills (e.g., Force + Guile) for a complex action.
    - **UI**: Reveals a "Secondary Approach" dropdown when active.

3.  **Equipment Mode**:
    - **Dice Pool**: `Primary Approach` + `Equipment Bonus` (if any).
    - **Use Case**: Relying heavily on a specific item.
    - **UI**: Reveals an "Active Equipment" dropdown. Selecting an item may grant dice pool modifiers or position/effect changes.
    - **Flashback Item**: Players can also create a temporary "Flashback Item" (costing Momentum) via the equipment dialog if they need a specific tool they didn't equip. See [Equipment Management](./mechanics-equipment.md).

### Complex Workflows

#### The Roll Workflow
1.  **Validation**: Checks Momentum, Load, and valid Action.
2.  **Cost**: Spends Momentum immediately.
3.  **Traits**: Applies temporary trait transactions (e.g., "Flashback" bonuses).
4.  **Execution**: Rolls dice (async).
5.  **Batch Update**: Dispatches `setRollResult`, `applyOutcome`, and `transitionState` in a single `executeBatch` call to ensure atomicity.

#### The Stims Interrupt
See **[Stims Mechanics](mechanics-stims.md)** for comprehensive documentation.

**Widget Integration:**
- **State**: Available in `GM_RESOLVING_CONSEQUENCE` (post-roll consequence resolution)
- **Handler**: Delegates to `StimsWorkflowHandler` for orchestration
- **Validation**: Enforces "once per action" via `stimsUsedThisAction` flag (independent of Push/Flashback)
- **Flow**: Validate → Addiction 1d6 roll → Advance clock → Mark used → Check lockout → Auto-reroll
- **Lockout**: Disabled if crew addiction filled, persists until cleared via Rally/Reset

The stims interrupt is a last-resort mechanic for desperate situations, advancing the character's addiction clock at the cost of a reroll opportunity.

## Rules Integration
- **Position & Effect**: The widget is the authoritative source for negotiating these values.
- **Load**: Enforces `maxLoad` when equipping items during the decision phase.
- **Momentum**: Enforces crew momentum limits for bonus dice and flashbacks.
