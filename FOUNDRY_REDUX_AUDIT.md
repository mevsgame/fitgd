# Foundry-Redux Separation of Concerns Audit

**Date:** 2025-11-15
**Auditor:** Claude Code
**Purpose:** Identify mixed responsibilities between Foundry (client layer) and Redux (business logic layer)

---

## Executive Summary

This audit identifies areas where business logic, game rules, and state transformations have leaked into the Foundry layer when they should reside in Redux. The goal is to maintain clean separation where:

- **Redux layer:** Business logic, game rules, validations, state transformations, calculations
- **Foundry layer:** UI presentation, Foundry API integration (dice, chat, actors), user input handling, dialogs

### Key Findings

- **17 instances** of business logic in Foundry that should be Redux selectors
- **2 instances** of hard-coded game config values
- **3 instances** of manual state object construction that should use Redux helpers
- **2 instances** of validation logic that should be Redux validators

---

## 1. Business Logic in Foundry (Should Be Redux Selectors)

### 🔴 HIGH PRIORITY

#### 1.1 Position/Effect Calculations (`player-action-widget.ts`)

**Location:** Lines 454-526

**Current (Foundry):**
```typescript
// player-action-widget.ts:454-468
private _computeImprovedPosition(): Position {
  if (!this.playerState?.traitTransaction?.positionImprovement) {
    return this.playerState?.position || 'risky';
  }

  const currentPosition = this.playerState.position || 'risky';

  // Improve position by one step
  if (currentPosition === 'impossible') return 'desperate';
  if (currentPosition === 'desperate') return 'risky';
  if (currentPosition === 'risky') return 'controlled';

  return currentPosition;
}

// Similar: _computeImprovedEffect() (473-488)
// Similar: _getEffectivePosition() (494-507)
// Similar: _getEffectiveEffect() (510-526)
```

**Problem:**
- Position/effect improvement logic duplicated in 4 separate methods
- Game rules ("improve by one step") are business logic, not presentation
- Not reusable by other parts of the system

**Solution:** Move to Redux selector

**Proposed (Redux):**
```typescript
// src/selectors/playerRoundStateSelectors.ts
/**
 * Calculate effective position for roll (ephemeral - does NOT mutate state)
 * Applies trait transaction position improvement if applicable
 */
export const selectEffectivePosition = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (playerState): Position => {
    const basePosition = playerState?.position || 'risky';

    // Check if trait transaction improves position
    if (playerState?.traitTransaction?.positionImprovement) {
      return improvePosition(basePosition);
    }

    return basePosition;
  }
);

/**
 * Improve position by one step (pure function)
 */
export function improvePosition(position: Position): Position {
  switch (position) {
    case 'impossible': return 'desperate';
    case 'desperate': return 'risky';
    case 'risky': return 'controlled';
    case 'controlled': return 'controlled'; // Already at best
    default: return position;
  }
}

/**
 * Calculate effective effect for roll (ephemeral - does NOT mutate state)
 * Applies push effect improvement if applicable
 */
export const selectEffectiveEffect = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
  ],
  (playerState): Effect => {
    const baseEffect = playerState?.effect || 'standard';

    // Check if Push (Effect) is active
    if (playerState?.pushed && playerState?.pushType === 'improved-effect') {
      return improveEffect(baseEffect);
    }

    return baseEffect;
  }
);

/**
 * Improve effect by one level (pure function)
 */
export function improveEffect(effect: Effect): Effect {
  switch (effect) {
    case 'limited': return 'standard';
    case 'standard': return 'great';
    case 'great': return 'spectacular';
    case 'spectacular': return 'spectacular'; // Already at best
    default: return effect;
  }
}
```

**Benefits:**
- ✅ Single source of truth for position/effect improvement rules
- ✅ Testable pure functions
- ✅ Reusable across entire application
- ✅ Memoized with Redux selectors (performance)

---

#### 1.2 Stims Lock Validation (`player-action-widget.ts`)

**Location:** Lines 592-609

**Current (Foundry):**
```typescript
// player-action-widget.ts:592-609
private _areStimsLocked(state: RootState): boolean {
  if (!this.crewId) return false;

  const crew = state.crews.byId[this.crewId];
  if (!crew) return false;

  // Check if ANY character in crew has filled addiction clock
  for (const characterId of crew.characters) {
    const characterAddictionClock = Object.values(state.clocks.byId).find(
      clock => clock.entityId === characterId && clock.clockType === 'addiction'
    );
    if (characterAddictionClock && characterAddictionClock.segments >= characterAddictionClock.maxSegments) {
      return true;
    }
  }

  return false;
}
```

**Problem:**
- Business logic (stims lock validation) in Foundry
- Inefficient: iterates all clocks instead of using indexes
- **DUPLICATES Redux selector `selectCanUseStims`** (already exists in `playerRoundStateSelectors.ts:281`)

**Solution:** Use existing Redux selector

**Proposed (Foundry - just use existing selector):**
```typescript
// player-action-widget.ts - REMOVE _areStimsLocked(), use existing selector
import { selectStimsAvailable } from '@/selectors/clockSelectors';

// In getData():
stimsLocked: !selectStimsAvailable(state, this.crewId || ''),
```

**Note:** The Redux selector `selectStimsAvailable` already exists! This is pure duplication.

---

#### 1.3 Dice Outcome Calculation (`player-action-widget.ts`)

**Location:** Lines 1110-1118

**Current (Foundry):**
```typescript
// player-action-widget.ts:1110-1118
private _calculateOutcome(rollResult: number[]): 'critical' | 'success' | 'partial' | 'failure' {
  const sixes = rollResult.filter(d => d === 6).length;
  const highest = Math.max(...rollResult);

  if (sixes >= 2) return 'critical';
  if (highest === 6) return 'success';
  if (highest >= 4) return 'partial';
  return 'failure';
}
```

**Problem:**
- Game rules (outcome determination) are business logic
- Not reusable for API testing or other dice-rolling scenarios
- Should be testable independently of Foundry

**Solution:** Move to Redux utility or selector

**Proposed (Redux):**
```typescript
// src/utils/diceRules.ts
/**
 * Calculate roll outcome based on Blades in the Dark rules
 * @param diceResults - Array of d6 results (e.g., [6, 5, 3])
 * @returns Outcome type
 */
export function calculateOutcome(diceResults: number[]): 'critical' | 'success' | 'partial' | 'failure' {
  const sixes = diceResults.filter(d => d === 6).length;
  const highest = Math.max(...diceResults);

  if (sixes >= 2) return 'critical';
  if (highest === 6) return 'success';
  if (highest >= 4) return 'partial';
  return 'failure';
}
```

**Benefits:**
- ✅ Testable without Foundry
- ✅ Reusable by API layer, CLI tools, or other UIs
- ✅ Clear documentation of game rules

---

#### 1.4 Improvements Preview Text (`player-action-widget.ts`)

**Location:** Lines 531-585

**Current (Foundry):**
```typescript
// player-action-widget.ts:531-585
private _computeImprovements(): string[] {
  if (!this.playerState) return [];

  const improvements: string[] = [];

  // Trait transaction (new system)
  if (this.playerState.traitTransaction) {
    const transaction = this.playerState.traitTransaction;

    if (transaction.mode === 'existing') {
      const trait = this.character!.traits.find(t => t.id === transaction.selectedTraitId);
      if (trait) {
        improvements.push(`Using trait: '${trait.name}' (Position +1) [1M]`);
      }
    } else if (transaction.mode === 'new') {
      improvements.push(`Creating new trait: '${transaction.newTrait!.name}' (Position +1) [1M]`);
    }
    // ... more modes
  }

  // Push improvement
  if (this.playerState.pushed) {
    const pushLabel = this.playerState.pushType === 'extra-die' ? '+1d' : 'Effect +1';
    improvements.push(`Push Yourself (${pushLabel}) [1M]`);
  }

  return improvements;
}
```

**Problem:**
- Business logic (what improvements are active) mixed with presentation (text formatting)
- Not reusable for other UI contexts (e.g., API queries, chat commands)

**Solution:** Split into selector (data) + formatter (presentation)

**Proposed (Redux - data):**
```typescript
// src/selectors/playerRoundStateSelectors.ts
export interface ActiveImprovement {
  type: 'trait_transaction' | 'push' | 'equipment' | 'flashback';
  label: string;
  momentumCost: number;
  effect: '+1d' | 'position+1' | 'effect+1';
}

export const selectActiveImprovements = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => state.characters.byId[characterId],
  ],
  (playerState, character): ActiveImprovement[] => {
    if (!playerState) return [];

    const improvements: ActiveImprovement[] = [];

    // Trait transaction
    if (playerState.traitTransaction) {
      const transaction = playerState.traitTransaction;
      let label = 'Using trait';

      if (transaction.mode === 'existing') {
        const trait = character?.traits.find(t => t.id === transaction.selectedTraitId);
        if (trait) label = `Using trait: '${trait.name}'`;
      } else if (transaction.mode === 'new') {
        label = `Creating new trait: '${transaction.newTrait?.name}'`;
      } else if (transaction.mode === 'consolidate') {
        label = `Consolidating traits → '${transaction.consolidation?.newTrait.name}'`;
      }

      improvements.push({
        type: 'trait_transaction',
        label,
        momentumCost: transaction.momentumCost,
        effect: 'position+1',
      });
    }

    // Push
    if (playerState.pushed) {
      improvements.push({
        type: 'push',
        label: 'Push Yourself',
        momentumCost: 1,
        effect: playerState.pushType === 'extra-die' ? '+1d' : 'effect+1',
      });
    }

    // Equipment
    if (playerState.equippedForAction?.length > 0) {
      const equipment = character?.equipment.filter(e =>
        playerState.equippedForAction!.includes(e.id)
      );
      equipment?.forEach(eq => {
        improvements.push({
          type: 'equipment',
          label: `Using ${eq.name}`,
          momentumCost: 0,
          effect: '+1d',
        });
      });
    }

    return improvements;
  }
);
```

**Proposed (Foundry - presentation):**
```typescript
// player-action-widget.ts - just format the data
import { selectActiveImprovements } from '@/selectors/playerRoundStateSelectors';

override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  // ...
  const activeImprovements = selectActiveImprovements(state, this.characterId);

  return {
    // ...
    improvements: activeImprovements.map(imp =>
      `${imp.label} (${imp.effect}) [${imp.momentumCost}M]`
    ),
  };
}
```

**Benefits:**
- ✅ Business logic (what improvements are active) in Redux
- ✅ Presentation (text formatting) in Foundry
- ✅ Reusable structured data for other UIs

---

#### 1.5 Trait Eligibility Check (`FlashbackTraitsDialog.ts`)

**Location:** Lines 132-148

**Current (Foundry):**
```typescript
// FlashbackTraitsDialog.ts:132-148
private _checkTraitEligibility(): boolean {
  const state = game.fitgd.store.getState();
  const crewCharacters = this.crew.characters;

  // Count traits for all characters in crew
  const traitCounts = crewCharacters.map(charId => {
    const char = state.characters.byId[charId];
    return { id: charId, count: char?.traits.length || 0 };
  });

  // Find minimum trait count
  const minCount = Math.min(...traitCounts.map(tc => tc.count));

  // Check if this character has the minimum (or tied for minimum)
  const myCount = traitCounts.find(tc => tc.id === this.characterId)?.count || 0;
  return myCount === minCount;
}
```

**Problem:**
- Business logic (trait eligibility calculation) in dialog
- Game rule ("character with fewest traits can create new") is business logic
- Not reusable

**Solution:** Move to Redux selector

**Proposed (Redux):**
```typescript
// src/selectors/characterSelectors.ts
/**
 * Check if character is eligible to create new flashback traits
 * Rule: Character must have the fewest (or tied for fewest) traits in crew
 */
export const selectCanCreateFlashbackTrait = createSelector(
  [
    (state: RootState, characterId: string) => state.characters.byId[characterId],
    (state: RootState, _characterId: string, crewId: string) => state.crews.byId[crewId],
    (state: RootState) => state.characters.byId,
  ],
  (character, crew, allCharacters) => {
    if (!character || !crew) return false;

    // Count traits for all characters in crew
    const traitCounts = crew.characters.map(charId => {
      const char = allCharacters[charId];
      return char?.traits.length || 0;
    });

    const minCount = Math.min(...traitCounts);
    const myCount = character.traits.length;

    return myCount === minCount;
  }
);
```

---

### 🟡 MEDIUM PRIORITY

#### 1.6 Consequence Data Resolver (`player-action-widget.ts`)

**Location:** Lines 618-691 (`_getConsequenceData`)

**Current:** 200+ lines of data resolution and calculation logic in Foundry

**Problem:**
- Resolves IDs to objects (should be selector)
- Calculates harm segments and momentum gain (should be selector)
- Determines if consequence is configured (should be validator)

**Solution:** Move to Redux selector

**Proposed (Redux):**
```typescript
// src/selectors/playerRoundStateSelectors.ts
export interface ResolvedConsequenceData {
  transaction: ConsequenceTransaction | null;
  harmTargetCharacter: Character | null;
  selectedHarmClock: Clock | null;
  selectedCrewClock: Clock | null;
  calculatedHarmSegments: number;
  calculatedMomentumGain: number;
  effectivePosition: Position;
  effectiveEffect: Effect;
  isFullyConfigured: boolean;
}

export const selectResolvedConsequenceData = createSelector(
  [
    (state: RootState, characterId: string) => selectPlayerState(state, characterId),
    (state: RootState, characterId: string) => selectEffectivePosition(state, characterId),
    (state: RootState, characterId: string) => selectEffectiveEffect(state, characterId),
    (state: RootState) => state.characters.byId,
    (state: RootState) => state.clocks.byId,
  ],
  (playerState, effectivePosition, effectiveEffect, characters, clocks): ResolvedConsequenceData => {
    const transaction = playerState?.consequenceTransaction;

    if (!transaction) {
      return {
        transaction: null,
        harmTargetCharacter: null,
        selectedHarmClock: null,
        selectedCrewClock: null,
        calculatedHarmSegments: 0,
        calculatedMomentumGain: 0,
        effectivePosition,
        effectiveEffect,
        isFullyConfigured: false,
      };
    }

    // Resolve IDs to objects
    const harmTargetCharacter = transaction.harmTargetCharacterId
      ? characters[transaction.harmTargetCharacterId] || null
      : null;

    const selectedHarmClock = transaction.harmClockId
      ? clocks[transaction.harmClockId] || null
      : null;

    const selectedCrewClock = transaction.crewClockId
      ? clocks[transaction.crewClockId] || null
      : null;

    // Calculate values
    const calculatedHarmSegments = selectConsequenceSeverity(effectivePosition);
    const calculatedMomentumGain = selectMomentumGain(effectivePosition);

    // Validate completeness
    let isFullyConfigured = false;
    if (transaction.consequenceType === 'harm') {
      isFullyConfigured = Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      isFullyConfigured = Boolean(transaction.crewClockId && transaction.crewClockSegments > 0);
    }

    return {
      transaction,
      harmTargetCharacter,
      selectedHarmClock,
      selectedCrewClock,
      calculatedHarmSegments,
      calculatedMomentumGain,
      effectivePosition,
      effectiveEffect,
      isFullyConfigured,
    };
  }
);
```

---

## 2. Hard-Coded Game Config (Should Use GameConfig)

### 🔴 HIGH PRIORITY

#### 2.1 Max Momentum Hard-Coded

**Location:** `player-action-widget.ts:296`

**Current:**
```typescript
maxMomentum: 10,
```

**Problem:** Game config value hard-coded instead of using `DEFAULT_CONFIG`

**Solution:**
```typescript
// Import config
import { DEFAULT_CONFIG } from '@/config/gameConfig';

// In getData():
maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
```

---

#### 2.2 Addiction Clock Segments Hard-Coded

**Location:** `player-action-widget.ts:1631`

**Current:**
```typescript
maxSegments: 8,
```

**Problem:** Game config value hard-coded

**Solution:**
```typescript
// Import config
import { DEFAULT_CONFIG } from '@/config/gameConfig';

// In _useStims():
maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
```

---

## 3. State Object Construction (Should Use Redux Helpers)

### 🟡 MEDIUM PRIORITY

#### 3.1 Manual Trait Construction

**Location:** `player-action-widget.ts:387-404, 422-437, 1673-1680`

**Current:**
```typescript
// Manual Trait object construction
const newTrait: Trait = {
  id: foundry.utils.randomID(),
  name: transaction.newTrait!.name,
  description: transaction.newTrait!.description,
  category: 'flashback',
  disabled: false,
  acquiredAt: Date.now(),
};
```

**Problem:**
- Trait structure defined in Foundry instead of Redux
- No validation of required fields
- Duplicate trait creation logic in 3 places

**Solution:** Create Redux helper factory

**Proposed (Redux):**
```typescript
// src/utils/entityFactories.ts
import { DEFAULT_CONFIG } from '@/config/gameConfig';

export function createTrait(params: {
  id?: string;
  name: string;
  description?: string;
  category: Trait['category'];
  disabled?: boolean;
}): Trait {
  return {
    id: params.id || generateId(),
    name: params.name,
    description: params.description,
    category: params.category,
    disabled: params.disabled ?? false,
    acquiredAt: Date.now(),
  };
}

export function createAddictTrait(id?: string): Trait {
  return createTrait({
    id,
    name: 'Addict',
    description: 'Addicted to combat stims. Stims are now locked for the entire crew.',
    category: 'scar',
    disabled: false,
  });
}
```

**Proposed (Foundry):**
```typescript
// player-action-widget.ts
import { createTrait, createAddictTrait } from '@/utils/entityFactories';

// Instead of manual construction:
const newTrait = createTrait({
  name: transaction.newTrait!.name,
  description: transaction.newTrait!.description,
  category: 'flashback',
});
```

---

## 4. Validation Logic (Should Be Redux Validators)

### 🟡 MEDIUM PRIORITY

#### 4.1 Momentum Spending Validation

**Location:** `player-action-widget.ts:968-983`

**Current:**
```typescript
// Validate sufficient momentum BEFORE committing
if (this.crewId && momentumCost > 0) {
  const crew = game.fitgd.api.crew.getCrew(this.crewId);
  if (crew.currentMomentum < momentumCost) {
    ui.notifications?.error(`Insufficient Momentum! Need ${momentumCost}, have ${crew.currentMomentum}`);
    return;
  }

  // Spend momentum NOW (before rolling)
  try {
    game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: momentumCost });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ui.notifications?.error(`Failed to spend Momentum: ${errorMessage}`);
    return;
  }
}
```

**Problem:**
- Validation logic in Foundry event handler
- Duplicate of validation that should already be in Redux reducer

**Solution:** Let Redux reducer handle validation

**Proposed (Redux - already exists in crewSlice):**
```typescript
// src/slices/crewSlice.ts (validation already exists)
// Just ensure reducer throws clear errors

case 'crews/spendMomentum':
  if (crew.currentMomentum < payload.amount) {
    throw new Error(`Insufficient Momentum! Need ${payload.amount}, have ${crew.currentMomentum}`);
  }
```

**Proposed (Foundry - just catch and display):**
```typescript
// player-action-widget.ts
// Let API/Redux handle validation, just catch errors
try {
  game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: momentumCost });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  ui.notifications?.error(errorMessage);
  return;
}
```

---

#### 4.2 Consequence Transaction Validation

**Location:** `player-action-widget.ts:1455-1465`

**Current:**
```typescript
// Validate transaction is complete
if (transaction.consequenceType === 'harm') {
  if (!transaction.harmTargetCharacterId || !transaction.harmClockId) {
    ui.notifications?.warn('Please select target character and harm clock');
    return;
  }
} else if (transaction.consequenceType === 'crew-clock') {
  if (!transaction.crewClockId || !transaction.crewClockSegments) {
    ui.notifications?.warn('Please select clock and segments');
    return;
  }
}
```

**Problem:**
- Validation logic in Foundry
- Should be Redux validator

**Solution:** Create Redux validator

**Proposed (Redux):**
```typescript
// src/validators/playerRoundStateValidators.ts
export function validateConsequenceTransaction(
  transaction: ConsequenceTransaction
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (transaction.consequenceType === 'harm') {
    if (!transaction.harmTargetCharacterId) {
      errors.push('Target character must be selected');
    }
    if (!transaction.harmClockId) {
      errors.push('Harm clock must be selected');
    }
  } else if (transaction.consequenceType === 'crew-clock') {
    if (!transaction.crewClockId) {
      errors.push('Crew clock must be selected');
    }
    if (!transaction.crewClockSegments || transaction.crewClockSegments <= 0) {
      errors.push('Segments must be greater than 0');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Proposed (Foundry):**
```typescript
// player-action-widget.ts
import { validateConsequenceTransaction } from '@/validators/playerRoundStateValidators';

private async _onApproveConsequence(event: JQuery.ClickEvent): Promise<void> {
  const transaction = this.playerState?.consequenceTransaction;
  if (!transaction) {
    ui.notifications?.error('No consequence configured');
    return;
  }

  const validation = validateConsequenceTransaction(transaction);
  if (!validation.valid) {
    ui.notifications?.warn(validation.errors.join('; '));
    return;
  }

  // Proceed with consequence...
}
```

---

## 5. Correctly Placed Foundry-Specific Code ✅

These are examples of code that is **correctly** in Foundry because they use Foundry-specific APIs:

### ✅ Dice Rolling (Foundry Roll API)
```typescript
// player-action-widget.ts:1084-1105
private async _rollDice(dicePool: number): Promise<number[]> {
  let roll: Roll;

  if (dicePool === 0) {
    roll = await new Roll('2d6kl').evaluate();
  } else {
    roll = await new Roll(`${dicePool}d6`).evaluate();
  }

  await roll.toMessage({...});
  return results;
}
```
**Reason:** Uses Foundry's `Roll` class - correctly placed

---

### ✅ Chat Messages
```typescript
ChatMessage.create({
  content: `<strong>${this.character!.name}</strong> selected action: <strong>${actionName}</strong>`,
  speaker: ChatMessage.getSpeaker(),
});
```
**Reason:** Foundry's `ChatMessage` API - correctly placed

---

### ✅ Dialog Rendering
```typescript
const dialog = new FlashbackTraitsDialog(this.characterId, this.crewId);
dialog.render(true);
```
**Reason:** Foundry's Application framework - correctly placed

---

### ✅ Bridge API Usage
```typescript
await game.fitgd.bridge.execute(
  {
    type: 'playerRoundState/setPosition',
    payload: { characterId, position },
  },
  { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
);
```
**Reason:** Proper use of abstraction layer - correctly placed

---

## Summary of Recommendations

### Immediate Actions (High Priority)

1. **Create new Redux selectors:**
   - `selectEffectivePosition()`
   - `selectEffectiveEffect()`
   - `improvePosition()` utility
   - `improveEffect()` utility
   - `selectResolvedConsequenceData()`

2. **Replace hard-coded config:**
   - Use `DEFAULT_CONFIG.crew.maxMomentum`
   - Use `DEFAULT_CONFIG.clocks.addiction.segments`

3. **Remove duplicate logic:**
   - Delete `_areStimsLocked()`, use existing `selectStimsAvailable()`

4. **Move outcome calculation:**
   - Create `src/utils/diceRules.ts` with `calculateOutcome()`

### Medium Priority

5. **Create entity factories:**
   - `src/utils/entityFactories.ts` with `createTrait()`, `createAddictTrait()`

6. **Create validators:**
   - `validateConsequenceTransaction()` in Redux validators

7. **Refactor improvements preview:**
   - Split into `selectActiveImprovements()` (Redux) + formatter (Foundry)

8. **Move trait eligibility:**
   - `selectCanCreateFlashbackTrait()` selector

### Low Priority (Nice to Have)

9. **Comprehensive entity factories:**
   - `createClock()`, `createCharacter()`, etc. for all entities

10. **Typed error classes:**
    - Redux validators return typed errors instead of strings

---

## Testing Strategy

For each refactored selector/validator:

1. **Write unit tests in Redux:**
   ```typescript
   describe('selectEffectivePosition', () => {
     it('should improve position when trait transaction has position improvement', () => {
       // Test position improvement logic
     });

     it('should return base position when no improvements', () => {
       // Test default case
     });
   });
   ```

2. **Verify Foundry integration:**
   - Test with GM + Player clients
   - Verify UI displays computed values correctly
   - Ensure state propagates to all clients

---

## Migration Checklist

- [ ] Create new selectors (effective position, effective effect)
- [ ] Create dice rules utility (`calculateOutcome`)
- [ ] Replace hard-coded config values
- [ ] Remove duplicate `_areStimsLocked()` method
- [ ] Create entity factories (`createTrait`, etc.)
- [ ] Create validators (`validateConsequenceTransaction`)
- [ ] Refactor improvements preview
- [ ] Move trait eligibility check
- [ ] Write unit tests for all new Redux code
- [ ] Test integration with Foundry UI
- [ ] Update documentation

---

## Long-Term Architecture Goals

1. **Redux layer should be Foundry-agnostic:**
   - All business logic, game rules, calculations in Redux
   - Should be usable in CLI, API, or other UIs without Foundry

2. **Foundry layer should be presentation-focused:**
   - UI rendering, event handling, Foundry API integration
   - No business logic or game rule calculations

3. **Clear API boundaries:**
   - Bridge API for state changes (already exists ✅)
   - Selectors for computed data (needs expansion)
   - Validators for business rules (needs creation)
   - Entity factories for object construction (needs creation)

---

**End of Audit**
