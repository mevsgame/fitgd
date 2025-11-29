# Phase 2: Decompose getData() Implementation Guide

## Overview

This guide provides step-by-step instructions for breaking down the large `getData()` method (~200 lines) into focused, testable helper methods.

**Duration**: 3-4 hours
**Risk Level**: Medium
**Breaking Changes**: None (data structure unchanged)
**Prerequisite**: Phase 1 (Handler Factory) should be complete

---

## What We're Solving

**Current Problem**:
```typescript
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  // 200 lines of mixed concerns:
  // 1. Entity loading (character, crew, playerState)
  // 2. UI state flag computation (isDecisionPhase, isRolling, etc.)
  // 3. Selector evaluation (dicePool, momentumCost, harmClocks, etc.)
  // 4. Handler initialization (now delegated to factory)
  // 5. Template data preparation (merge all above)
  // 6. Conditional data for GM_RESOLVING_CONSEQUENCE state
}
```

**New Pattern**:
```typescript
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  const data = await super.getData(options) as Partial<PlayerActionWidgetData>;

  if (!game.fitgd) {
    console.error('FitGD | FitGD not initialized');
    return data as PlayerActionWidgetData;
  }

  // Load entities from Redux store
  const entities = await this._loadEntities();
  if (!entities) return data as PlayerActionWidgetData;

  // Build UI state flags
  const uiState = this._buildUIState(entities);

  // Compute derived values from selectors
  const derivedData = this._computeDerivedData(entities);

  // Prepare template-specific data
  const templateData = this._prepareTemplateData(entities, uiState, derivedData);

  // Handle state-specific data
  const stateSpecificData = this._getStateSpecificData(entities, derivedData);

  return {
    ...data,
    ...templateData,
    ...uiState,
    ...derivedData,
    ...stateSpecificData,
  };
}
```

---

## Implementation Steps

### Step 1: Extract Entity Loading

**Method Name**: `_loadEntities()`
**Responsibility**: Fetch character, crew, and player round state from Redux store
**Lines**: ~30
**Testability**: Can be tested with Redux fixtures

**File**: `D:\GitHub\fitgd\foundry\module\widgets\player-action-widget.ts`

```typescript
/**
 * Load core entities from Redux store
 *
 * Fetches character, crew, and player round state for the current action.
 * Updates widget properties (this.character, this.crew, this.crewId, this.playerState)
 * and syncs factory with crew ID.
 *
 * @returns Object with loaded entities, or null if character not found
 */
private async _loadEntities(): Promise<{
  character: Character;
  crew: Crew | null;
  crewId: string | null;
  playerState: PlayerRoundState | null;
  state: RootState;
} | null> {
  // Get character from Redux store
  this.character = game.fitgd.api.character.getCharacter(this.characterId);
  if (!this.character) {
    this.notificationService.error('Character not found');
    return null;
  }

  // Get Redux state
  const state = game.fitgd.store.getState();

  // Find crew containing this character
  const crewId = Object.values(state.crews.byId)
    .find(crew => crew.characters.includes(this.characterId))?.id;

  // Update widget crew reference
  if (crewId && crewId !== this.crewId) {
    this.crewId = crewId;
    // Sync factory with new crew ID (Phase 1)
    this.handlerFactory = new PlayerActionHandlerFactory(
      this.characterId,
      crewId,
      this.character
    );
  }

  // Load crew entity
  let crew: Crew | null = null;
  if (crewId) {
    crew = game.fitgd.api.crew.getCrew(crewId);
    this.crew = crew;
  } else {
    this.crew = null;
  }

  // Get player round state
  const playerState = state.playerRoundState.byCharacterId[this.characterId];

  // Update factory with character (Phase 1)
  this.handlerFactory.setCharacter(this.character);

  return {
    character: this.character,
    crew,
    crewId,
    playerState,
    state,
  };
}
```

---

### Step 2: Extract UI State Computation

**Method Name**: `_buildUIState()`
**Responsibility**: Compute boolean flags for current phase (isDecisionPhase, isRolling, etc.)
**Lines**: ~15
**Testability**: Pure function, can test with mock playerState

```typescript
/**
 * Build UI state flags based on current playerRoundState
 *
 * These flags determine which sections of the template are rendered.
 * Each flag corresponds to a phase in the action resolution state machine.
 *
 * @param entities - Loaded entities with playerState
 * @returns Object with boolean flags for each state
 */
private _buildUIState(entities: {
  playerState: PlayerRoundState | null;
}): {
  isDecisionPhase: boolean;
  isRolling: boolean;
  isStimsRolling: boolean;
  isStimsLocked: boolean;
  isSuccess: boolean;
  isGMResolvingConsequence: boolean;
  isGM: boolean;
} {
  const { playerState } = entities;

  return {
    isDecisionPhase: playerState?.state === 'DECISION_PHASE',
    isRolling: playerState?.state === 'ROLLING',
    isStimsRolling: playerState?.state === 'STIMS_ROLLING',
    isStimsLocked: playerState?.state === 'STIMS_LOCKED',
    isSuccess: playerState?.state === 'SUCCESS_COMPLETE',
    isGMResolvingConsequence: playerState?.state === 'GM_RESOLVING_CONSEQUENCE',
    isGM: game.user?.isGM || false,
  };
}
```

---

### Step 3: Extract Derived Data Computation

**Method Name**: `_computeDerivedData()`
**Responsibility**: Evaluate Redux selectors and compute game values
**Lines**: ~50
**Testability**: Test with state fixtures and mock selectors

```typescript
/**
 * Compute derived game values using Redux selectors
 *
 * This includes all selector evaluations, equipment data, harm clocks,
 * momentum values, and computed bonuses.
 *
 * @param entities - Loaded entities with state and character
 * @returns Object with all derived/computed values
 */
private _computeDerivedData(entities: {
  character: Character;
  crew: Crew | null;
  crewId: string | null;
  state: RootState;
  playerState: PlayerRoundState | null;
}): {
  approaches: string[];
  equippedItems: Equipment[];
  activeEquipmentItem: Equipment | undefined;
  passiveEquipment: Equipment[];
  secondaryOptions: Array<any>;
  selectedSecondaryId: string | null;
  selectedSecondaryName: string | null;
  equipmentEffects: any;
  equipmentModifiedPosition: Position;
  equipmentModifiedEffect: Effect;
  harmClocks: Array<Clock & { status?: string }>;
  isDying: boolean;
  momentum: number;
  maxMomentum: number;
  canRally: boolean;
  dicePool: number;
  momentumCost: number;
  improvements: string[];
  improvedPosition: Position;
  improvedEffect: Effect;
  stimsLocked: boolean;
  approvedPassiveEquipment: Equipment | undefined;
} {
  const { character, crew, crewId, state, playerState } = entities;

  // Basic character info
  const approaches = Object.keys(character.approaches);

  // Equipment selections
  const equippedItems = selectActiveEquipment(character).filter(
    item => !item.consumed
  );
  const activeEquipmentItem = playerState?.equippedForAction?.[0]
    ? character.equipment.find(e => e.id === playerState!.equippedForAction![0])
    : undefined;
  const passiveEquipment = selectPassiveEquipment(character);

  // Secondary approach/equipment dropdown options
  const secondaryOptions = this._buildSecondaryOptions(
    playerState?.selectedApproach,
    character
  );
  const selectedSecondaryId = playerState?.equippedForAction?.[0]
    || playerState?.secondaryApproach
    || null;
  const selectedSecondaryName = this._getSelectedSecondaryName(
    playerState,
    character
  );

  // Equipment effects and modifiers
  const equipmentEffects = selectEquipmentEffects(state, this.characterId);
  const equipmentModifiedPosition = selectEquipmentModifiedPosition(
    state,
    this.characterId
  );
  const equipmentModifiedEffect = selectEquipmentModifiedEffect(
    state,
    this.characterId
  );

  // Harm and status
  const harmClocks = selectHarmClocksWithStatus(state, this.characterId);
  const isDying = selectIsDying(state, this.characterId);

  // Momentum
  const momentum = crew?.currentMomentum || 0;
  const maxMomentum = DEFAULT_CONFIG.crew.maxMomentum;

  // Rally eligibility
  const canRally = crewId ? selectCanUseRally(state, this.characterId) : false;

  // Dice pool and costs
  const dicePool = selectDicePool(state, this.characterId);
  const momentumCost = selectMomentumCost(playerState);

  // Trait improvements
  const traitImprovementHandler = this.handlerFactory.getTraitImprovementHandler();
  const improvements = traitImprovementHandler.computeImprovements(playerState);

  // Position and effect improvements
  const improvedPosition = selectEffectivePosition(state, this.characterId);
  const improvedEffect = selectEffectiveEffect(state, this.characterId);

  // Stims availability
  const stimsLocked = !selectStimsAvailable(state);

  // Approved passive equipment
  const approvedPassiveEquipment = playerState?.approvedPassiveId
    ? character.equipment.find(e => e.id === playerState!.approvedPassiveId)
    : undefined;

  return {
    approaches,
    equippedItems,
    activeEquipmentItem,
    passiveEquipment,
    secondaryOptions,
    selectedSecondaryId,
    selectedSecondaryName,
    equipmentEffects,
    equipmentModifiedPosition,
    equipmentModifiedEffect,
    harmClocks,
    isDying,
    momentum,
    maxMomentum,
    canRally,
    dicePool,
    momentumCost,
    improvements,
    improvedPosition,
    improvedEffect,
    stimsLocked,
    approvedPassiveEquipment,
  };
}
```

---

### Step 4: Extract Template Data Preparation

**Method Name**: `_prepareTemplateData()`
**Responsibility**: Assemble data in format expected by Handlebars template
**Lines**: ~30
**Testability**: Pure data transformation, easily testable

```typescript
/**
 * Prepare data specifically for Handlebars template rendering
 *
 * This method organizes all entity and derived data into the shape
 * expected by the template. Serves as the "contract" between TypeScript
 * and Handlebars.
 *
 * @param entities - Loaded entities
 * @param uiState - UI state flags
 * @param derivedData - Computed values
 * @returns Template-ready data
 */
private _prepareTemplateData(
  entities: {
    character: Character;
    crew: Crew | null;
    crewId: string | null;
    playerState: PlayerRoundState | null;
  },
  uiState: {
    isDecisionPhase: boolean;
    isRolling: boolean;
    isStimsRolling: boolean;
    isStimsLocked: boolean;
    isSuccess: boolean;
    isGMResolvingConsequence: boolean;
    isGM: boolean;
  },
  derivedData: any
): Partial<PlayerActionWidgetData> {
  const { character, crew, crewId, playerState } = entities;

  return {
    character,
    crew,
    crewId,
    playerState,
    ...uiState,
    approaches: derivedData.approaches,
    equippedItems: derivedData.equippedItems,
    activeEquipmentItem: derivedData.activeEquipmentItem,
    passiveEquipment: derivedData.passiveEquipment,
    selectedPassiveId: playerState?.approvedPassiveId,
    approvedPassiveEquipment: derivedData.approvedPassiveEquipment,
    secondaryOptions: derivedData.secondaryOptions,
    selectedSecondaryId: derivedData.selectedSecondaryId,
    selectedSecondaryName: derivedData.selectedSecondaryName,
    equipmentEffects: derivedData.equipmentEffects,
    equipmentModifiedPosition: derivedData.equipmentModifiedPosition,
    equipmentModifiedEffect: derivedData.equipmentModifiedEffect,
    harmClocks: derivedData.harmClocks,
    isDying: derivedData.isDying,
    momentum: derivedData.momentum,
    maxMomentum: derivedData.maxMomentum,
    canRally: derivedData.canRally,
    dicePool: derivedData.dicePool,
    momentumCost: derivedData.momentumCost,
    improvements: derivedData.improvements,
    improvedPosition: derivedData.improvedPosition,
    improvedEffect: derivedData.improvedEffect,
    stimsLocked: derivedData.stimsLocked,
  };
}
```

---

### Step 5: Extract State-Specific Data

**Method Name**: `_getStateSpecificData()`
**Responsibility**: Load additional data only needed for specific states (e.g., GM_RESOLVING_CONSEQUENCE)
**Lines**: ~20
**Testability**: Test with state-specific fixtures

```typescript
/**
 * Get state-specific data that's only needed in certain phases
 *
 * For example, consequence configuration data is only needed when
 * playerState.state === 'GM_RESOLVING_CONSEQUENCE'.
 *
 * This avoids computing unnecessary data on every render.
 *
 * @param entities - Loaded entities
 * @param derivedData - Computed values
 * @returns State-specific data or empty object
 */
private _getStateSpecificData(
  entities: {
    state: RootState;
    playerState: PlayerRoundState | null;
  },
  derivedData: any
): Partial<PlayerActionWidgetData> {
  const { state, playerState } = entities;

  // Only load consequence data if in GM_RESOLVING_CONSEQUENCE state
  if (playerState?.state === 'GM_RESOLVING_CONSEQUENCE') {
    return this._getConsequenceData(state);
  }

  return {};
}
```

---

### Step 6: Replace Main getData() Method

Now update the main `getData()` to use all the decomposed methods:

**File**: `D:\GitHub\fitgd\foundry\module\widgets\player-action-widget.ts`

```typescript
/**
 * Get template data for rendering the widget
 *
 * Fetches character, crew, and player round state from Redux store,
 * calculates derived values (dice pool, improvements, state flags),
 * and prepares all data needed by the Handlebars template.
 *
 * @param options - Render options
 * @returns Template data with character, crew, playerState, and UI flags
 */
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  const data = await super.getData(options) as Partial<PlayerActionWidgetData>;

  // Null safety check
  if (!game.fitgd) {
    console.error('FitGD | FitGD not initialized');
    return data as PlayerActionWidgetData;
  }

  // Step 1: Load entities from Redux store
  const entities = await this._loadEntities();
  if (!entities) return data as PlayerActionWidgetData;

  // Step 2: Build UI state flags
  const uiState = this._buildUIState(entities);

  // Step 3: Compute derived values from selectors
  const derivedData = this._computeDerivedData(entities);

  // Step 4: Prepare template-specific data
  const templateData = this._prepareTemplateData(entities, uiState, derivedData);

  // Step 5: Get state-specific data (consequence config, etc.)
  const stateSpecificData = this._getStateSpecificData(entities, derivedData);

  // Combine all data for template
  return {
    ...data,
    ...templateData,
    ...stateSpecificData,
  } as PlayerActionWidgetData;
}
```

---

## Existing Helper Methods to Keep

These methods already exist and don't need changes. Keep them as-is:

```typescript
// These stay the same - they're already focused:
private _buildSecondaryOptions(...) { ... }
private _getSelectedSecondaryName(...) { ... }
private _calculateTotalMomentumCost(...) { ... }
private _computeImprovements(...) { ... }  // Now uses factory
private _getConsequenceData(...) { ... }
private _applyTraitTransaction(...) { ... }
```

No changes needed to these - they already have single responsibilities.

---

## Step 7: Testing Strategy

### Test 1: Entity Loading

**File**: `tests/unit/widgets/playerActionWidget.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerActionWidget } from '@/foundry/module/widgets/player-action-widget';
import { mockCharacter, mockCrew } from '../../fixtures';
import { mockRootState } from '../../fixtures/redux.fixtures';

describe('PlayerActionWidget._loadEntities()', () => {
  let widget: PlayerActionWidget;
  let mockGameFitgd: any;

  beforeEach(() => {
    widget = new PlayerActionWidget('char-1');

    // Mock game.fitgd
    mockGameFitgd = {
      api: {
        character: {
          getCharacter: vi.fn(() => mockCharacter()),
        },
        crew: {
          getCrew: vi.fn(() => mockCrew()),
        },
      },
      store: {
        getState: vi.fn(() => mockRootState()),
      },
    };

    // @ts-ignore
    global.game = { fitgd: mockGameFitgd };
  });

  it('should load character, crew, and player state', async () => {
    const entities = await widget._loadEntities();

    expect(entities).toBeDefined();
    expect(entities?.character).toBeDefined();
    expect(entities?.crew).toBeDefined();
    expect(entities?.playerState).toBeDefined();
  });

  it('should update widget properties', async () => {
    await widget._loadEntities();

    expect(widget['character']).toBeDefined();
    expect(widget['crewId']).toBeTruthy();
  });

  it('should return null if character not found', async () => {
    mockGameFitgd.api.character.getCharacter.mockReturnValue(null);

    const entities = await widget._loadEntities();

    expect(entities).toBeNull();
  });
});
```

### Test 2: UI State Building

```typescript
describe('PlayerActionWidget._buildUIState()', () => {
  let widget: PlayerActionWidget;

  beforeEach(() => {
    widget = new PlayerActionWidget('char-1');
  });

  it('should set isDecisionPhase true when state is DECISION_PHASE', () => {
    const entities = {
      playerState: {
        state: 'DECISION_PHASE',
      } as any,
    };

    const uiState = widget._buildUIState(entities);

    expect(uiState.isDecisionPhase).toBe(true);
    expect(uiState.isRolling).toBe(false);
    expect(uiState.isGMResolvingConsequence).toBe(false);
  });

  it('should set isRolling true when state is ROLLING', () => {
    const entities = {
      playerState: {
        state: 'ROLLING',
      } as any,
    };

    const uiState = widget._buildUIState(entities);

    expect(uiState.isRolling).toBe(true);
    expect(uiState.isDecisionPhase).toBe(false);
  });

  it('should set all flags false when playerState is null', () => {
    const entities = { playerState: null };

    const uiState = widget._buildUIState(entities);

    expect(uiState.isDecisionPhase).toBe(false);
    expect(uiState.isRolling).toBe(false);
    expect(uiState.isSuccess).toBe(false);
  });
});
```

### Test 3: Derived Data Computation

```typescript
describe('PlayerActionWidget._computeDerivedData()', () => {
  let widget: PlayerActionWidget;

  beforeEach(() => {
    widget = new PlayerActionWidget('char-1');
  });

  it('should compute all required derived data fields', () => {
    const entities = {
      character: mockCharacter(),
      crew: mockCrew(),
      crewId: 'crew-1',
      state: mockRootState(),
      playerState: {
        selectedApproach: 'force',
        position: 'risky',
        effect: 'standard',
      } as any,
    };

    const derivedData = widget._computeDerivedData(entities);

    expect(derivedData.approaches).toBeDefined();
    expect(derivedData.dicePool).toBeGreaterThan(0);
    expect(derivedData.momentum).toBeGreaterThanOrEqual(0);
    expect(derivedData.improvements).toBeDefined();
  });
});
```

---

## Verification Checklist

After implementation:

- ✅ TypeScript compiles without errors
- ✅ All 5 helper methods exist and have correct signatures
- ✅ `getData()` calls all 5 methods in correct order
- ✅ Template receives identical data structure (no breaking changes)
- ✅ Widget renders in all states (DECISION, ROLLING, CONSEQUENCE, SUCCESS)
- ✅ Unit tests pass for each decomposed method
- ✅ Integration test passes (full widget lifecycle)
- ✅ No console errors in Foundry VTT
- ✅ No performance regression

---

## Performance Characteristics

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| getData() lines | 200 | ~50 | -75% |
| Helper methods | 2 | 7 | Better organization |
| Testable units | 2 | 7 | 3.5x more testable |
| Max method length | 200 | ~50 | More readable |
| Data transformation clarity | Low | High | Better maintainability |

---

## Common Pitfalls to Avoid

1. ❌ **Changing data structure**: Template must receive exact same fields
   - ✅ Use `_prepareTemplateData()` to maintain exact shape

2. ❌ **Over-decomposing**: Don't create too many tiny methods
   - ✅ 5 methods is right balance (not 20)

3. ❌ **Duplicating selector calls**: Calling selector twice
   - ✅ Call once in `_computeDerivedData()`, reuse result

4. ❌ **Moving too much logic**: Keep it simple
   - ✅ Each method does one job: load, flag, compute, prepare, handle-state

5. ❌ **Forgetting factory updates**: Entity loading must sync factory
   - ✅ Call `handlerFactory.setCharacter()` and recreate if crew changes

---

## Next Steps

Once Phase 2 is complete and tested:

1. **Verify Phase 1 + 2 together**: Full widget lifecycle works
2. **Proceed to Phase 3**: Event handler organization
3. **Proceed to Phase 4**: Template refactoring (uses organized data better)

---

## Summary

Phase 2 transforms `getData()` from a 200-line monolith into a clean pipeline of 5 focused methods:

```
getData() → _loadEntities() → _buildUIState() → _computeDerivedData()
         → _prepareTemplateData() → _getStateSpecificData()
         → Combine and return
```

Each method:
- Has a single responsibility
- Is independently testable
- Is under 50 lines
- Can be debugged in isolation
- Contributes to the final data structure

The end result is **cleaner, more maintainable, and more testable code** while keeping the exact same functionality and template interface.

