# Mechanic: Traits & Flashbacks

## Overview
Traits are the defining characteristics of a character. This system allows players to leverage their traits for mechanical advantages, either by "leaning into" them for better positioning or using "flashbacks" to introduce new narrative elements.

## Architecture & State

### Handlers
The logic is split across three specialized handlers:
- **`TraitHandler`**: Manages the lifecycle of traits (creation, removal, consolidation).
- **`LeanIntoTraitHandler`**: Validates eligibility for improving position.
- **`UseTraitHandler`**: Manages the toggle state of using a trait for a roll.

### Transaction Pattern
Trait operations use a **Transaction** pattern (`TraitTransaction`) stored in `playerRoundState`.
- **Ephemeral**: Changes are staged in the transaction and only applied when the roll is committed.
- **Modes**:
    - `existing`: Using a trait you already have.
    - `new`: Creating a temporary "Flashback" trait.
    - `consolidate`: Merging 3 traits into a permanent "Grouped" trait.

## Implementation Details

### Leaning Into a Trait
- **Goal**: Improve **Position** (e.g., Risky -> Controlled).
- **Cost**: The trait becomes **disabled** (marked as used) until the next downtime or Momentum Reset.
- **Validation**:
    - Must be in a crew.
    - Must have at least one non-disabled trait.

### Flashbacks
- **Goal**: Add a new trait relevant to the current situation (retroactively prepared).
- **Cost**: Costs **Momentum** (usually 1 or 2).
- **Workflow**:
    1.  Player clicks "Use Trait" -> "Flashback".
    2.  Enters details in `FlashbackTraitsDialog`.
    3.  Transaction is created with mode `new`.
    4.  On roll commit, the new trait is added to the character.

### Using a Trait
- **Goal**: Improve **Effect** or gain other narrative advantages.
- **Validation**: Cannot use if Position is already Controlled (balance rule).
- **Toggle**: Clicking "Use Trait" again cancels the transaction.
