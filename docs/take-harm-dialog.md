# Take Harm Dialog

## Overview
The **Take Harm Dialog** is a specialized interface for applying negative consequences to a character. It standardizes the rules for taking harm based on **Position** and ensures that the corresponding **Momentum** is generated for the crew.

## Architecture & State

### Isolation
Like the [Action Roll Dialog](./action-roll-dialog.md), this component is ephemeral and does not maintain its own persistent state.
- **Input**: `characterId`, `crewId`, `defaultPosition`.
- **Output**: Calls `api.action.applyConsequences` to update Redux state.

### Redux Integration
- **Writes**:
    - `clockSlice`: Creates or advances harm clocks.
    - `crewSlice`: Adds Momentum (generated from taking harm).
    - `characterSlice`: Updates character status (e.g., if Dying).

## Implementation Details

### Workflow
1.  **Trigger**: Automatically opened by the [Action Roll Dialog](./action-roll-dialog.md) on failure, or manually by the GM.
2.  **Configuration**:
    - **Harm Type**: Physical Harm or Shaken Morale.
    - **Position**: Controlled (1), Risky (3), Desperate (5), or Impossible (6).
    - **Effect**: Informational only (does not change harm amount).
3.  **Execution**:
    - Calculates harm segments based on Position.
    - Finds an appropriate Harm Clock (or creates a new one).
    - Adds segments.
    - Generates Momentum (equal to segments taken, usually).
4.  **Feedback**: Notifies if the character is now **Dying** (Harm Clock full).

## Rules Integration
- **Position-Based Harm**: Enforces the strict mapping of Position to Harm Segments (1/3/5/6).
- **Momentum Generation**: Automates the rule that "taking harm generates Momentum".
- **Dying State**: Detects when a harm clock reaches 6/6 segments.
