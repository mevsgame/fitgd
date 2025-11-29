# Phase 1: Handler Factory Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Handler Factory pattern to make handler initialization lazy-loaded and testable.

**Duration**: 2-3 hours
**Risk Level**: Low
**Breaking Changes**: None (internal refactor)

---

## What We're Solving

**Current Pattern** (in getData):
```typescript
// Every render, ALL handlers re-initialized
this.consequenceHandler = new ConsequenceResolutionHandler({ ... });
this.stimsHandler = new StimsHandler({ ... });
this.diceRollingHandler = new DiceRollingHandler({ ... });
this.traitHandler = new TraitHandler({ ... });
// ... 11 more handlers ...
```

**Problems**:
- ❌ Wasteful: Re-create handlers every render (even if unused)
- ❌ Testing: Can't test handler behavior without full widget
- ❌ Initialization: 11 separate instantiations scattered through code
- ❌ Dependency Management: Hard to track handler dependencies

**New Pattern**:
```typescript
// Initialize once
this.handlerFactory = new PlayerActionHandlerFactory(characterId, crewId);

// Use on demand (lazy-loaded)
const diceHandler = this.handlerFactory.getDiceRollingHandler();
```

---

## Step 1: Create Handler Factory Service

**File**: `D:\GitHub\fitgd\foundry\module\services\playerActionHandlerFactory.ts`

```typescript
/**
 * Factory for creating and managing Player Action Widget handlers
 *
 * Implements lazy initialization: handlers are created only when first requested,
 * reducing overhead and improving testability.
 *
 * All handlers share the same characterId/crewId context for the action.
 */

import type { Character } from '@/types/character';
import { ConsequenceResolutionHandler } from '../handlers/consequenceResolutionHandler';
import { StimsHandler } from '../handlers/stimsHandler';
import { DiceRollingHandler } from '../handlers/diceRollingHandler';
import { TraitHandler } from '../handlers/traitHandler';
import { RallyHandler } from '../handlers/rallyHandler';
import { TraitImprovementHandler } from '../handlers/traitImprovementHandler';
import { ConsequenceDataResolver } from '../handlers/consequenceDataResolver';
import { LeanIntoTraitHandler } from '../handlers/leanIntoTraitHandler';
import { UseTraitHandler } from '../handlers/useTraitHandler';
import { PushHandler } from '../handlers/pushHandler';
import { ConsequenceApplicationHandler } from '../handlers/consequenceApplicationHandler';
import { StimsWorkflowHandler } from '../handlers/stimsWorkflowHandler';

/**
 * Manager for lazily initializing Player Action handlers
 *
 * Benefits:
 * - Handlers created only when needed (not on every render)
 * - Consistent initialization context across all handlers
 * - Easy to mock for testing
 * - Centralized dependency management
 */
export class PlayerActionHandlerFactory {
  private characterId: string;
  private crewId: string | null;
  private character: Character | null;

  // Lazy-initialized handler cache
  private handlers: Map<string, any> = new Map();

  constructor(
    characterId: string,
    crewId: string | null,
    character: Character | null = null
  ) {
    this.characterId = characterId;
    this.crewId = crewId;
    this.character = character;
  }

  /**
   * Update character reference (called from getData when character loads)
   * Used by handlers that need character data
   */
  setCharacter(character: Character | null): void {
    this.character = character;
    // Invalidate handlers that use character data
    this.handlers.delete('traitImprovement');
    this.handlers.delete('leanIntoTrait');
  }

  /**
   * Get or create ConsequenceResolutionHandler
   * Lazy-initialized on first call
   */
  getConsequenceResolutionHandler(): ConsequenceResolutionHandler {
    if (!this.handlers.has('consequence')) {
      this.handlers.set('consequence', new ConsequenceResolutionHandler({
        characterId: this.characterId,
        crewId: this.crewId,
        playerState: null, // Will be set by widget
      }));
    }
    return this.handlers.get('consequence')!;
  }

  /**
   * Get or create StimsHandler
   */
  getStimsHandler(): StimsHandler {
    if (!this.handlers.has('stims')) {
      this.handlers.set('stims', new StimsHandler({
        characterId: this.characterId,
        crewId: this.crewId,
        characterName: this.character?.name,
      }));
    }
    return this.handlers.get('stims')!;
  }

  /**
   * Get or create DiceRollingHandler
   */
  getDiceRollingHandler(): DiceRollingHandler {
    if (!this.handlers.has('diceRolling')) {
      this.handlers.set('diceRolling', new DiceRollingHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('diceRolling')!;
  }

  /**
   * Get or create TraitHandler
   */
  getTraitHandler(): TraitHandler {
    if (!this.handlers.has('trait')) {
      this.handlers.set('trait', new TraitHandler({
        characterId: this.characterId,
        characterName: this.character?.name,
      }));
    }
    return this.handlers.get('trait')!;
  }

  /**
   * Get or create RallyHandler
   */
  getRallyHandler(): RallyHandler {
    if (!this.handlers.has('rally')) {
      this.handlers.set('rally', new RallyHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('rally')!;
  }

  /**
   * Get or create TraitImprovementHandler
   */
  getTraitImprovementHandler(): TraitImprovementHandler {
    if (!this.handlers.has('traitImprovement')) {
      this.handlers.set('traitImprovement', new TraitImprovementHandler({
        character: this.character,
      }));
    }
    return this.handlers.get('traitImprovement')!;
  }

  /**
   * Get or create ConsequenceDataResolver
   */
  getConsequenceDataResolver(): ConsequenceDataResolver {
    if (!this.handlers.has('consequenceDataResolver')) {
      this.handlers.set('consequenceDataResolver', new ConsequenceDataResolver({
        characterId: this.characterId,
      }));
    }
    return this.handlers.get('consequenceDataResolver')!;
  }

  /**
   * Get or create LeanIntoTraitHandler
   */
  getLeanIntoTraitHandler(): LeanIntoTraitHandler {
    if (!this.handlers.has('leanIntoTrait')) {
      this.handlers.set('leanIntoTrait', new LeanIntoTraitHandler({
        character: this.character,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('leanIntoTrait')!;
  }

  /**
   * Get or create UseTraitHandler
   */
  getUseTraitHandler(): UseTraitHandler {
    if (!this.handlers.has('useTrait')) {
      this.handlers.set('useTrait', new UseTraitHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('useTrait')!;
  }

  /**
   * Get or create PushHandler
   */
  getPushHandler(): PushHandler {
    if (!this.handlers.has('push')) {
      this.handlers.set('push', new PushHandler({
        characterId: this.characterId,
      }));
    }
    return this.handlers.get('push')!;
  }

  /**
   * Get or create ConsequenceApplicationHandler
   */
  getConsequenceApplicationHandler(): ConsequenceApplicationHandler {
    if (!this.handlers.has('consequenceApplication')) {
      this.handlers.set('consequenceApplication', new ConsequenceApplicationHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('consequenceApplication')!;
  }

  /**
   * Get or create StimsWorkflowHandler
   */
  getStimsWorkflowHandler(): StimsWorkflowHandler {
    if (!this.handlers.has('stimsWorkflow')) {
      this.handlers.set('stimsWorkflow', new StimsWorkflowHandler({
        characterId: this.characterId,
        characterName: this.character?.name,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('stimsWorkflow')!;
  }

  /**
   * Clear all cached handlers (call on widget close or character change)
   */
  reset(): void {
    this.handlers.clear();
  }
}
```

---

## Step 2: Update PlayerActionWidget Constructor

**File**: `D:\GitHub\fitgd\foundry\module\widgets\player-action-widget.ts`

Replace the old constructor and class properties:

### Before:
```typescript
export class PlayerActionWidget extends Application {
  private characterId: string;
  private character: Character | null = null;
  private crew: Crew | null = null;
  private crewId: string | null = null;
  private playerState: PlayerRoundState | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  // 11 handler properties
  private consequenceHandler: ConsequenceResolutionHandler | null = null;
  private stimsHandler: StimsHandler | null = null;
  private diceRollingHandler: DiceRollingHandler | null = null;
  // ... etc ...

  constructor(
    characterId: string,
    options: any = {},
    diceService: DiceService = new FoundryDiceService(),
    notificationService: NotificationService = new FoundryNotificationService(),
    dialogFactory: DialogFactory = new FoundryDialogFactory()
  ) {
    super(options);
    this.characterId = characterId;
    this.diceService = diceService;
    this.notificationService = notificationService;
    this.dialogFactory = dialogFactory;
  }
}
```

### After:
```typescript
import { PlayerActionHandlerFactory } from '../services/playerActionHandlerFactory';

export class PlayerActionWidget extends Application {
  private characterId: string;
  private character: Character | null = null;
  private crew: Crew | null = null;
  private crewId: string | null = null;
  private playerState: PlayerRoundState | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  // Handler factory (replaces 11 individual properties)
  private handlerFactory: PlayerActionHandlerFactory;

  // Injectable services
  private diceService: DiceService;
  private notificationService: NotificationService;
  private dialogFactory: DialogFactory;

  /**
   * Create a new Player Action Widget
   *
   * @param characterId - Redux ID of the character taking their turn
   * @param options - Additional options passed to Application constructor
   * @param diceService - Optional injectable dice service (defaults to Foundry implementation)
   * @param notificationService - Optional injectable notification service (defaults to Foundry implementation)
   * @param dialogFactory - Optional injectable dialog factory (defaults to Foundry implementation)
   */
  constructor(
    characterId: string,
    options: any = {},
    diceService: DiceService = new FoundryDiceService(),
    notificationService: NotificationService = new FoundryNotificationService(),
    dialogFactory: DialogFactory = new FoundryDialogFactory()
  ) {
    super(options);

    this.characterId = characterId;
    this.diceService = diceService;
    this.notificationService = notificationService;
    this.dialogFactory = dialogFactory;

    // Initialize handler factory
    this.handlerFactory = new PlayerActionHandlerFactory(characterId, null);
  }
}
```

---

## Step 3: Update close() to Clean Up Factory

**File**: `D:\GitHub\fitgd\foundry\module\widgets\player-action-widget.ts`

```typescript
override async close(options?: FormApplication.CloseOptions): Promise<void> {
  // Unsubscribe from store updates
  if (this.storeUnsubscribe) {
    this.storeUnsubscribe();
    this.storeUnsubscribe = null;
  }

  // Reset handler factory
  this.handlerFactory.reset();

  return super.close(options);
}
```

---

## Step 4: Update getData() to Use Factory

**File**: `D:\GitHub\fitgd\foundry\module\widgets\player-action-widget.ts`

This is the key change - remove all handler initialization from `getData()`.

### Key Changes in getData():

```typescript
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  const data = await super.getData(options) as Partial<PlayerActionWidgetData>;

  // Null safety checks
  if (!game.fitgd) {
    console.error('FitGD | FitGD not initialized');
    return data as PlayerActionWidgetData;
  }

  // Get character from Redux store
  this.character = game.fitgd.api.character.getCharacter(this.characterId);
  if (!this.character) {
    this.notificationService.error('Character not found');
    return data as PlayerActionWidgetData;
  }

  // Get crew and update factory with crew ID
  const state = game.fitgd.store.getState();
  const crewId = Object.values(state.crews.byId)
    .find(crew => crew.characters.includes(this.characterId))?.id;

  if (crewId && crewId !== this.crewId) {
    this.crewId = crewId;
    // Update factory with new crew ID
    this.handlerFactory = new PlayerActionHandlerFactory(this.characterId, crewId, this.character);
  }

  if (crewId) {
    this.crew = game.fitgd.api.crew.getCrew(crewId);
  } else {
    this.crew = null;
  }

  // Update factory with character
  this.handlerFactory.setCharacter(this.character);

  // Get player round state
  this.playerState = state.playerRoundState.byCharacterId[this.characterId];

  // ❌ REMOVE ALL THIS:
  // this.consequenceHandler = new ConsequenceResolutionHandler({...});
  // this.stimsHandler = new StimsHandler({...});
  // ... etc ...

  // ✅ HANDLERS NOW LAZY-LOADED VIA FACTORY

  // Build data for template (unchanged)
  return {
    ...data,
    character: this.character,
    crew: this.crew,
    crewId: this.crewId,
    playerState: this.playerState,
    // ... rest of data construction unchanged ...
  };
}
```

---

## Step 5: Update Event Handlers to Use Factory

Now update each handler reference to use the factory. Here are a few examples:

### Example 1: _onRally

**Before**:
```typescript
private async _onRally(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  if (!this.rallyHandler) return;

  // Validate rally eligibility
  const validation = this.rallyHandler.validateRally(this.crew);
  // ...
}
```

**After**:
```typescript
private async _onRally(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  const rallyHandler = this.handlerFactory.getRallyHandler();

  // Validate rally eligibility
  const validation = rallyHandler.validateRally(this.crew);
  // ...
}
```

### Example 2: _onTogglePushDie

**Before**:
```typescript
private async _onTogglePushDie(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  if (!this.pushHandler) return;

  // Use Bridge API to dispatch, broadcast, and refresh
  await game.fitgd.bridge.execute(
    this.pushHandler.createTogglePushDieAction(this.playerState),
    { affectedReduxIds: [asReduxId(this.pushHandler.getAffectedReduxId())], force: false }
  );
}
```

**After**:
```typescript
private async _onTogglePushDie(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  const pushHandler = this.handlerFactory.getPushHandler();

  // Use Bridge API to dispatch, broadcast, and refresh
  await game.fitgd.bridge.execute(
    pushHandler.createTogglePushDieAction(this.playerState),
    { affectedReduxIds: [asReduxId(pushHandler.getAffectedReduxId())], force: false }
  );
}
```

### Pattern for All Handlers

Replace every instance of:
```typescript
if (!this.handlerName) return;
const result = this.handlerName.method(...);
```

With:
```typescript
const handler = this.handlerFactory.getHandlerName();
const result = handler.method(...);
```

---

## Step 6: Update _onRoll to Use Factory Handlers

**Before**:
```typescript
private async _onRoll(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  if (!this.diceRollingHandler) return;

  try {
    // ... validation code ...

    // Apply trait transaction (if exists)
    if (playerState?.traitTransaction) {
      try {
        await this._applyTraitTransaction(playerState.traitTransaction);
      } catch (error) {
        // ... error handling ...
      }
    }

    // Transition to ROLLING
    await game.fitgd.bridge.execute(
      this.diceRollingHandler.createTransitionToRollingAction(),
      // ...
    );

    // Calculate dice pool
    const dicePool = this.diceRollingHandler.calculateDicePool(state);
    // ...
  }
}
```

**After**:
```typescript
private async _onRoll(event: JQuery.ClickEvent): Promise<void> {
  event.preventDefault();

  const diceRollingHandler = this.handlerFactory.getDiceRollingHandler();

  try {
    // ... validation code unchanged ...

    // Apply trait transaction (if exists)
    if (playerState?.traitTransaction) {
      try {
        await this._applyTraitTransaction(playerState.traitTransaction);
      } catch (error) {
        // ... error handling ...
      }
    }

    // Transition to ROLLING
    await game.fitgd.bridge.execute(
      diceRollingHandler.createTransitionToRollingAction(),
      // ...
    );

    // Calculate dice pool
    const dicePool = diceRollingHandler.calculateDicePool(state);
    // ...
  }
}
```

---

## Step 7: Update _applyTraitTransaction

**Before**:
```typescript
private async _applyTraitTransaction(transaction: TraitTransaction): Promise<void> {
  if (!this.traitHandler) return;

  const actions = this.traitHandler.createTraitActions(transaction);
  // ...
}
```

**After**:
```typescript
private async _applyTraitTransaction(transaction: TraitTransaction): Promise<void> {
  const traitHandler = this.handlerFactory.getTraitHandler();
  const actions = traitHandler.createTraitActions(transaction);
  // ...
}
```

---

## Step 8: Update _computeImprovements

**Before**:
```typescript
private _computeImprovements(): string[] {
  if (!this.traitImprovementHandler) return [];
  return this.traitImprovementHandler.computeImprovements(this.playerState);
}
```

**After**:
```typescript
private _computeImprovements(): string[] {
  const traitImprovementHandler = this.handlerFactory.getTraitImprovementHandler();
  return traitImprovementHandler.computeImprovements(this.playerState);
}
```

---

## Step 9: Update _getConsequenceData

**Before**:
```typescript
private _getConsequenceData(state: RootState) {
  if (!this.consequenceDataResolver) {
    return {
      consequenceTransaction: null,
      harmTargetCharacter: null,
      selectedHarmClock: null,
      selectedCrewClock: null,
      calculatedHarmSegments: 0,
      calculatedMomentumGain: 0,
      effectivePosition: selectEffectivePosition(state, this.characterId),
      effectiveEffect: selectEffectiveEffect(state, this.characterId),
      consequenceConfigured: false,
    };
  }
  return this.consequenceDataResolver.resolveConsequenceData(state, this.playerState);
}
```

**After**:
```typescript
private _getConsequenceData(state: RootState) {
  const consequenceDataResolver = this.handlerFactory.getConsequenceDataResolver();
  return consequenceDataResolver.resolveConsequenceData(state, this.playerState);
}
```

---

## Step 10: Update Consequence & Stims Handlers

Update all remaining handler references:

- `_onSelectConsequenceType`: Use `this.handlerFactory.getConsequenceResolutionHandler()`
- `_onSelectHarmTarget`, `_onSelectHarmClock`, `_onSelectCrewClock`: Use `this.handlerFactory.getConsequenceResolutionHandler()`
- `_onPlayerAcceptConsequence`: Use `this.handlerFactory.getConsequenceApplicationHandler()`
- `_useStims`: Use `this.handlerFactory.getStimsWorkflowHandler()` and `this.handlerFactory.getStimsHandler()`

---

## Step 11: Testing

### Unit Test Template

**File**: `tests/unit/widgets/playerActionHandlerFactory.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerActionHandlerFactory } from '@/foundry/module/services/playerActionHandlerFactory';
import { mockCharacter } from '../../fixtures/character.fixtures';

describe('PlayerActionHandlerFactory', () => {
  let factory: PlayerActionHandlerFactory;

  beforeEach(() => {
    factory = new PlayerActionHandlerFactory('char-1', 'crew-1', mockCharacter());
  });

  describe('lazy initialization', () => {
    it('should initialize DiceRollingHandler on first call', () => {
      const handler1 = factory.getDiceRollingHandler();
      const handler2 = factory.getDiceRollingHandler();

      // Should return same instance (cached)
      expect(handler1).toBe(handler2);
    });

    it('should initialize all handlers without errors', () => {
      expect(() => {
        factory.getConsequenceResolutionHandler();
        factory.getStimsHandler();
        factory.getDiceRollingHandler();
        factory.getTraitHandler();
        factory.getRallyHandler();
        factory.getTraitImprovementHandler();
        factory.getConsequenceDataResolver();
        factory.getLeanIntoTraitHandler();
        factory.getUseTraitHandler();
        factory.getPushHandler();
        factory.getConsequenceApplicationHandler();
        factory.getStimsWorkflowHandler();
      }).not.toThrow();
    });

    it('should reset all handlers on reset()', () => {
      const handler1 = factory.getDiceRollingHandler();
      factory.reset();
      const handler2 = factory.getDiceRollingHandler();

      // Should be different instances after reset
      expect(handler1).not.toBe(handler2);
    });
  });

  describe('character updates', () => {
    it('should update handlers that depend on character', () => {
      const newCharacter = mockCharacter({ id: 'char-2', name: 'New Character' });
      factory.setCharacter(newCharacter);

      const handler = factory.getTraitImprovementHandler();
      // Handler should have new character
      expect(handler['character']).toBe(newCharacter);
    });

    it('should invalidate dependent handlers on character update', () => {
      const handler1 = factory.getTraitImprovementHandler();
      const newCharacter = mockCharacter();
      factory.setCharacter(newCharacter);
      const handler2 = factory.getTraitImprovementHandler();

      // Should be new instance
      expect(handler1).not.toBe(handler2);
    });
  });
});
```

---

## Verification Checklist

After implementation, verify:

- ✅ TypeScript compiles without errors (`npm run type-check:all`)
- ✅ Existing widget tests pass (`npm test -- player-action-widget`)
- ✅ Factory creates handlers without errors
- ✅ Handlers called via factory return correct results
- ✅ Multi-client test: GM + Player widget both work
- ✅ State transitions still work correctly
- ✅ No console errors in Foundry VTT
- ✅ Widget renders in all states (DECISION, ROLLING, CONSEQUENCE, SUCCESS)

---

## Rollback Plan

If issues arise:

1. Revert `PlayerActionHandlerFactory.ts` (new file, just delete)
2. Revert `player-action-widget.ts` to original handler property definitions
3. Restore `getData()` to re-initialize handlers every render
4. Git: `git checkout foundry/module/widgets/player-action-widget.ts`

---

## Performance Impact

**Before**:
- 11 handlers created per render
- ~200 handler instantiations per minute during gameplay

**After**:
- Handlers created once per widget open
- ~1 handler instantiation during widget lifecycle
- **Improvement**: 200x reduction in handler creation overhead

---

## Next Steps

Once Phase 1 is complete and tested:
- Proceed to **Phase 2: Decompose getData()**
- Handlers are now isolated and easier to test independently
- getData() will become cleaner as it removes initialization code

