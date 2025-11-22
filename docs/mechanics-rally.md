# Mechanic: Rally

## Overview
**Rally** is a teamwork mechanic that allows a character to assist a teammate during an action roll. It represents the crew coming together to support one another in high-stakes situations.

## Architecture & State

### Handler Logic
The logic is encapsulated in `RallyHandler`.
- **Validation**:
    - Character must be in a crew.
    - Crew must have other teammates (cannot rally alone).
    - Character must not have already rallied this round.

### Redux Integration
- **Reads**: `crewSlice` (to check membership and teammates).
- **Writes**: Dispatches `playerRoundState/transitionState` to `RALLYING`.

## Implementation Details

### The Rally Workflow
1.  **Trigger**: Player clicks the "Rally" button in the [Player Action Widget](./player-action-widget.md).
2.  **Validation**: System checks if the character is eligible.
3.  **Transition**: The widget enters the `RALLYING` state (handled by `RallyDialog`).
4.  **Effect**:
    - The rallying character provides a bonus (e.g., +1d) to the active character.
    - This often costs **Stress** (2 stress) for the rallying character.

### Resetting Rally
Rally availability is reset via the [Crew Sheet](./crew-sheet.md) using the **Momentum Reset** function or manually by the GM. This ensures characters can't spam assist actions indefinitely without cost.
