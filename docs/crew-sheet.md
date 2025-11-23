# Crew Sheet

## Overview
The **Crew Sheet** represents the collective resources and state of the party. It serves as the central hub for managing shared mechanics like Momentum, long-term projects, and group addiction.

## Architecture & State

### Redux Integration
- **`crewSlice`**: Source of truth for Momentum and member lists.
- **`clockSlice`**: Stores all crew-related clocks (Addiction, Consumables, Progress).
- **`characterSlice`**: Referenced to display member names and link to their sheets.

### Unified IDs
Like characters, Crews use Unified IDs (Foundry Actor ID === Redux Crew ID).

## Implementation Details

### Momentum Management
Momentum is the party's primary resource, capped at 10.
- **Add/Spend (GM Only)**: Buttons allow quick adjustment.
- **Reset (GM Only)**: A powerful maintenance action that:
    - Sets Momentum to **5**.
    - Resets **Rally** status for all members.
    - Re-enables all **Traits**.
    - Reduces **Addiction** by 2 segments.
    - Recovers **Dying** clocks (6/6 -> 5/6).

### Clock Categories
The sheet organizes clocks into three distinct sections:
1.  **Addiction**: A special, persistent clock that tracks the crew's reliance on Stims.
2.  **Consumables**: Tracks shared supplies like Grenades or Medkits.
3.  **Progress**: Generic clocks for long-term goals or threats.

### Member Management
- **Linking**: Characters are added to the crew by selecting from existing Foundry Actors.
- **Validation**: Prevents adding the same character twice.

## Rules Integration
- **Momentum Cap**: Enforced at 10.
- **Addiction**: The Addiction clock is a critical mechanic for balancing the powerful "Stims" interrupt.
- **Rally**: The sheet manages the "Rally" state, which allows characters to assist each other.
