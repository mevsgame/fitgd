# Action Roll Dialog

## Overview
The **Action Roll Dialog** provides a standard, modal-based interface for resolving actions. Unlike the persistent [Player Action Widget](./player-action-widget.md), which manages a complex negotiation state, this dialog is designed for immediate, self-contained rolls.

**Use Cases:**
- Quick checks outside of structured encounters.
- Simple rolls where full position/effect negotiation isn't needed.
- GM testing or ad-hoc resolutions.

## Architecture & State

### Isolation
This component is largely stateless and isolated from the global `playerRoundState`.
- **Input**: Takes `characterId` and `crewId` to fetch current stats.
- **Output**: Posts a chat message and optionally triggers side effects (spending Momentum, opening Harm dialogs).
- **No Redux Subscription**: It does not subscribe to real-time updates. It reads state once upon opening.

### Features

#### Dice Pool Calculation
The dialog automatically calculates the dice pool based on:
1.  **Action Rating**: Dots in the selected action.
2.  **Push**: Adds +1d (checks for available Momentum).
3.  **Devil's Bargain**: Adds +1d (flag only, GM handles narrative cost).
4.  **Bonus Dice**: Manual input for assists or other advantages.

#### Zero-Dot Logic
If the final pool is 0 or less (e.g., 0 dots and no bonuses), it correctly implements the "Desperate Roll" rule:
- Rolls **2d6**.
- Keeps the **lowest** result.

## Implementation Details

### Roll Workflow
1.  **Configuration**: User selects Action, Position, Effect, and modifiers.
2.  **Validation**: If "Push" is selected, it verifies the crew has at least 1 Momentum.
3.  **Execution**:
    - Spends Momentum (if Pushing).
    - Rolls dice using Foundry's `Roll` class.
    - Evaluates outcome (Critical/Success/Partial/Failure).
4.  **Reporting**: Posts a rich HTML chat message with the breakdown.
5.  **Consequences**:
    - **Failure**: Automatically calculates harm based on Position (Controlled: 1, Risky: 2, Desperate: 3) and opens the `TakeHarmDialog`.
    - **Partial**: Prompts the user with a confirmation dialog listing options (Reduced Effect, Complication, etc.).

## Rules Integration
- **Momentum**: Directly interfaces with `crewApi` to spend Momentum for pushing.
- **Position/Harm**: Hardcodes the standard harm values for each position level.
