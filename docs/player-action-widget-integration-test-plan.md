# Player Action Widget - Integration Test Refactoring Plan

## Executive Summary

The Player Action Widget (~2,000 lines) currently has excellent Redux layer test coverage (700+ unit tests) but **zero integration tests** for the widget itself. This document outlines a refactoring strategy to enable full integration testability without disrupting the working production code.

**Goal:** Enable comprehensive integration testing of the entire widget workflow (UI → Handlers → Redux → Socket → Sheet refresh) through strategic dependency injection and mock creation.

---

## Current State Analysis

### ✅ What's Already Tested (Redux Layer)

| Component | Test File | Coverage |
|-----------|-----------|----------|
| Redux Slices | `playerRoundStateSlice.test.ts` | Command → state transformations |
| Selectors | `playerRoundStateSelectors.test.ts` | Memoization, dice pool calculation |
| Validators | `playerRoundValidator.test.ts` | Business rule validation |
| Pure Functions | `playerRoundRules.test.ts` | Game rules logic |
| Multi-step Workflows | `playerRoundStateScenarios.test.ts` | Complex state transitions |

**Total:** 700+ tests covering the Redux/business logic layer.

### ❌ What's NOT Tested (Integration Layer)

| Component | Lines of Code | Why Not Tested |
|-----------|---------------|----------------|
| PlayerActionWidget class | ~1,972 | Direct Foundry API dependencies |
| 12 Handler classes | ~2,000+ | Foundry API calls (notifications, dialogs) |
| Socket workflows | N/A | Multi-client synchronization not mocked |
| Foundry-Redux Bridge | ~300 | Real socket broadcasting |
| UI event handlers | ~500 | jQuery events, DOM manipulation |
| Dice rolling flow | ~150 | Foundry Roll API, 3D dice |
| Chat integration | ~100 | ChatMessage API |
| Dialog workflows | ~400 | Foundry Dialog/Application API |

**Total Untested Surface Area:** ~5,500 lines of integration code.

---

## Dependency Analysis

### Category 1: Foundry Global APIs (Mockable)

These are accessed via `game.*` global and can be mocked:

```typescript
// Current dependencies (hard-coded globals)
game.fitgd.store            // Redux store
game.fitgd.bridge           // Foundry-Redux Bridge
game.fitgd.api              // High-level API layer
game.user?.isGM             // Current user context
game.actors.get(id)         // Actor retrieval
ui.notifications?.error()   // Toast notifications
ChatMessage.create()        // Chat system
Roll.create().evaluate()    // Dice rolling
Dialog                      // Dialog system
foundry.utils.randomID()    // ID generation
```

**Testability:** ⚠️ High - Can be mocked, but requires global setup.

**Refactoring Needed:** Extract to injectable dependencies or create Foundry API facade.

### Category 2: UI/DOM Dependencies (Mockable)

```typescript
// jQuery event objects
JQuery.ClickEvent
JQuery.ChangeEvent

// HTML rendering
this.render(true)
super.getData()
this.activateListeners(html)

// Handlebars template
'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html'
```

**Testability:** ⚠️ Medium - Can use jsdom or stub rendering.

**Refactoring Needed:** Minimal - test harness setup required.

### Category 3: Socket System (Complex)

```typescript
// Broadcasting workflow
game.fitgd.bridge.execute(action)          // Dispatch → Broadcast → Refresh
game.fitgd.bridge.executeBatch(actions)    // Atomic batch operations
await game.fitgd.saveImmediate()           // Socket broadcast
refreshSheetsByReduxId([id], force)        // Sheet refresh
```

**Testability:** ⚠️ High complexity - Multi-client scenarios are critical.

**Refactoring Needed:** Create test spy/mock for socket broadcasts, track command history.

### Category 4: Handler Classes (Already Separated)

```typescript
// 12 specialized handlers (ALREADY GOOD ARCHITECTURE)
DiceRollingHandler
ConsequenceResolutionHandler
ConsequenceApplicationHandler
ConsequenceDataResolver
StimsWorkflowHandler
StimsHandler
TraitHandler
TraitImprovementHandler
LeanIntoTraitHandler
UseTraitHandler
PushHandler
RallyHandler
```

**Testability:** ✅ Excellent - Already separated from widget, just need to mock their dependencies.

**Refactoring Needed:** Extract Foundry API calls from handlers (notifications, dialogs).

---

## Refactoring Strategy

### Phase 0: Test Infrastructure Setup

**Goal:** Create mock environment and test harness.

#### 0.1 Create Foundry API Mock Factory

```typescript
// tests/mocks/foundryApi.ts
export interface MockFoundryGame {
  fitgd: {
    store: Store<RootState>;
    bridge: MockBridge;
    api: MockApi;
  };
  user?: { isGM: boolean; id: string; name: string };
  actors: MockActorCollection;
}

export function createMockFoundryGame(options: {
  isGM?: boolean;
  initialState?: Partial<RootState>;
}): MockFoundryGame {
  const store = createTestStore(options.initialState);

  return {
    fitgd: {
      store,
      bridge: createMockBridge(store),
      api: createMockApi(store),
    },
    user: {
      isGM: options.isGM ?? false,
      id: 'test-user-id',
      name: 'Test User'
    },
    actors: createMockActorCollection(store),
  };
}
```

**Why:** Provides consistent Foundry environment for all tests.

#### 0.2 Create Bridge Spy/Mock

```typescript
// tests/mocks/bridgeSpy.ts
export interface BridgeSpyResult {
  dispatches: ReduxAction[];
  broadcasts: number;
  affectedIds: ReduxId[];
}

export function createBridgeSpy(store: Store<RootState>): {
  bridge: FoundryReduxBridge;
  spy: BridgeSpyResult;
  reset: () => void;
} {
  const spy: BridgeSpyResult = {
    dispatches: [],
    broadcasts: 0,
    affectedIds: [],
  };

  const mockSave = vi.fn(async () => {
    spy.broadcasts++;
  });

  const bridge = new FoundryReduxBridge(store, mockSave);

  // Wrap execute/executeBatch to track calls
  const originalExecute = bridge.execute.bind(bridge);
  bridge.execute = async (action, options) => {
    spy.dispatches.push(action);
    spy.affectedIds.push(...(options.affectedReduxIds || []));
    return originalExecute(action, options);
  };

  return { bridge, spy, reset: () => { /* clear spy */ } };
}
```

**Why:** Tracks all dispatches, broadcasts, and sheet refreshes for verification.

#### 0.3 Create UI Mock Utilities

```typescript
// tests/mocks/uiMocks.ts
export function createMockNotifications() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

export function createMockChatMessage() {
  return {
    create: vi.fn(async (data) => ({ ...data, id: 'mock-msg-id' })),
    getSpeaker: vi.fn(() => ({ alias: 'Test User' })),
  };
}

export function createMockRoll(result: number[]) {
  return {
    create: vi.fn().mockReturnValue({
      evaluate: vi.fn(async () => ({
        total: result[0],
        dice: [{ results: result.map(r => ({ result: r })) }],
        toMessage: vi.fn(),
      })),
    }),
  };
}
```

**Why:** Mocks Foundry UI systems without requiring full Foundry environment.

#### 0.4 Create Test Harness for Widget

```typescript
// tests/integration/playerActionWidget.harness.ts
export interface WidgetTestHarness {
  widget: PlayerActionWidget;
  game: MockFoundryGame;
  bridge: { spy: BridgeSpyResult };
  ui: { notifications: ReturnType<typeof createMockNotifications> };
  chat: ReturnType<typeof createMockChatMessage>;
  roll: ReturnType<typeof createMockRoll>;

  // Helpers
  simulateApproachChange: (approach: string) => Promise<void>;
  simulateRollClick: () => Promise<void>;
  simulateConsequenceAccept: () => Promise<void>;
  getPlayerState: () => PlayerRoundState;
  advanceToState: (state: string) => Promise<void>;
}

export async function createWidgetHarness(options: {
  characterId: string;
  isGM?: boolean;
  initialState?: Partial<RootState>;
}): Promise<WidgetTestHarness> {
  const game = createMockFoundryGame({
    isGM: options.isGM,
    initialState: options.initialState,
  });

  const { bridge, spy } = createBridgeSpy(game.fitgd.store);
  game.fitgd.bridge = bridge;

  const ui = { notifications: createMockNotifications() };
  const chat = createMockChatMessage();
  const roll = createMockRoll([6, 5, 4]);

  // Inject mocks into global scope
  (global as any).game = game;
  (global as any).ui = ui;
  (global as any).ChatMessage = chat;
  (global as any).Roll = roll;

  const widget = new PlayerActionWidget(options.characterId);

  return {
    widget,
    game,
    bridge: { spy },
    ui,
    chat,
    roll,
    simulateApproachChange: async (approach) => {
      const event = createMockChangeEvent(approach);
      await (widget as any)._onApproachChange(event);
    },
    simulateRollClick: async () => {
      const event = createMockClickEvent();
      await (widget as any)._onRoll(event);
    },
    simulateConsequenceAccept: async () => {
      const event = createMockClickEvent();
      await (widget as any)._onPlayerAcceptConsequence(event);
    },
    getPlayerState: () => game.fitgd.store.getState().playerRoundState.byCharacterId[options.characterId],
    advanceToState: async (targetState) => {
      // Helper to set up widget in specific state
      await game.fitgd.bridge.execute({
        type: 'playerRoundState/transitionState',
        payload: { characterId: options.characterId, newState: targetState },
      });
    },
  };
}
```

**Why:** Provides high-level API for testing complex widget workflows.

---

### Phase 1: Non-Breaking Refactors

**Goal:** Improve testability WITHOUT changing behavior or breaking production code.

#### 1.1 Extract Dice Rolling to Injectable Service

**Current Code (widget line ~1446):**
```typescript
private async _rollDice(dicePool: number): Promise<number[]> {
  let roll: Roll;
  if (dicePool === 0) {
    roll = await Roll.create('2d6kl').evaluate({ async: true });
    // ...
  } else {
    roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true });
    // ...
  }

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: game.actors.get(this.characterId) }),
    flavor: `${this.character!.name} - ${approach} approach`,
  });

  return results;
}
```

**Refactored Code:**
```typescript
// Create injectable service
// foundry/module/services/diceService.ts
export interface DiceService {
  roll(dicePool: number): Promise<number[]>;
  postRollToChat(result: number[], characterId: string, flavor: string): Promise<void>;
}

export class FoundryDiceService implements DiceService {
  async roll(dicePool: number): Promise<number[]> {
    let roll: Roll;
    if (dicePool === 0) {
      roll = await Roll.create('2d6kl').evaluate({ async: true });
      return [roll.total];
    } else {
      roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true });
      return (roll.dice[0].results as any[])
        .map((r: any) => r.result)
        .sort((a, b) => b - a);
    }
  }

  async postRollToChat(result: number[], characterId: string, flavor: string): Promise<void> {
    // ... post to chat
  }
}

// Widget constructor injection
export class PlayerActionWidget extends Application {
  constructor(
    characterId: string,
    options: any = {},
    private diceService: DiceService = new FoundryDiceService() // Default to real implementation
  ) {
    super(options);
    this.characterId = characterId;
  }

  private async _rollDice(dicePool: number): Promise<number[]> {
    return this.diceService.roll(dicePool);
  }
}
```

**Benefits:**
- ✅ Tests can inject mock dice service with deterministic results
- ✅ Production code uses real Foundry dice (default parameter)
- ✅ Zero breaking changes (backward compatible)
- ✅ Separates concerns (dice rolling vs widget logic)

#### 1.2 Extract Notification Service

**Current Code (scattered throughout widget):**
```typescript
ui.notifications?.error('Insufficient Momentum!');
ui.notifications?.info('Stims used! Rerolling...');
ui.notifications?.warn('Select target character first');
```

**Refactored Code:**
```typescript
// foundry/module/services/notificationService.ts
export interface NotificationService {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class FoundryNotificationService implements NotificationService {
  info(message: string): void {
    ui.notifications?.info(message);
  }

  warn(message: string): void {
    ui.notifications?.warn(message);
  }

  error(message: string): void {
    ui.notifications?.error(message);
  }
}

// Widget injection
export class PlayerActionWidget extends Application {
  constructor(
    characterId: string,
    options: any = {},
    private diceService: DiceService = new FoundryDiceService(),
    private notificationService: NotificationService = new FoundryNotificationService()
  ) {
    super(options);
    this.characterId = characterId;
  }

  private async _onRoll(event: JQuery.ClickEvent): Promise<void> {
    // Replace: ui.notifications?.error('Insufficient Momentum!');
    this.notificationService.error('Insufficient Momentum!');
  }
}
```

**Benefits:**
- ✅ Tests can verify exact notification messages
- ✅ Can count notification calls
- ✅ No visual notifications in test runs
- ✅ Backward compatible (default to real service)

#### 1.3 Extract Dialog Factory

**Current Code (widget lines ~1028, ~1109, ~1138):**
```typescript
const dialog = new RallyDialog(this.characterId, this.crewId!);
dialog.render(true);

const dialog = new FlashbackTraitsDialog(this.characterId, this.crewId!);
dialog.render(true);

new Dialog({
  title: "Flashback Item",
  content: content,
  buttons: { /* ... */ },
}).render(true);
```

**Refactored Code:**
```typescript
// foundry/module/services/dialogFactory.ts
export interface DialogFactory {
  createRallyDialog(characterId: string, crewId: string): { render: (force: boolean) => void };
  createFlashbackTraitsDialog(characterId: string, crewId: string): { render: (force: boolean) => void };
  createFlashbackItemDialog(onSubmit: (data: any) => Promise<void>): { render: (force: boolean) => void };
}

export class FoundryDialogFactory implements DialogFactory {
  createRallyDialog(characterId: string, crewId: string) {
    return new RallyDialog(characterId, crewId);
  }

  createFlashbackTraitsDialog(characterId: string, crewId: string) {
    return new FlashbackTraitsDialog(characterId, crewId);
  }

  createFlashbackItemDialog(onSubmit: (data: any) => Promise<void>) {
    return new Dialog({ /* ... */ });
  }
}

// Widget injection
export class PlayerActionWidget extends Application {
  constructor(
    characterId: string,
    options: any = {},
    private diceService: DiceService = new FoundryDiceService(),
    private notificationService: NotificationService = new FoundryNotificationService(),
    private dialogFactory: DialogFactory = new FoundryDialogFactory()
  ) {
    super(options);
    this.characterId = characterId;
  }

  private async _onRally(event: JQuery.ClickEvent): Promise<void> {
    // Replace: const dialog = new RallyDialog(this.characterId, this.crewId!);
    const dialog = this.dialogFactory.createRallyDialog(this.characterId, this.crewId!);
    dialog.render(true);
  }
}
```

**Benefits:**
- ✅ Tests can mock dialog interactions
- ✅ Can verify dialog creation with correct parameters
- ✅ No actual UI dialogs in tests
- ✅ Backward compatible

#### 1.4 Refactor Handlers to Use Services

**Current Code (handler files):**
```typescript
// handlers/consequenceResolutionHandler.ts
export class ConsequenceResolutionHandler {
  // Direct Foundry API calls
  async selectConsequence() {
    ui.notifications?.warn('Select target character first');
  }
}
```

**Refactored Code:**
```typescript
export class ConsequenceResolutionHandler {
  constructor(
    private config: ConsequenceResolutionHandlerConfig,
    private notificationService: NotificationService = new FoundryNotificationService()
  ) {}

  async selectConsequence() {
    this.notificationService.warn('Select target character first');
  }
}

// Widget creates handlers with injected services
this.consequenceHandler = new ConsequenceResolutionHandler(
  { characterId: this.characterId, crewId: this.crewId, playerState: this.playerState },
  this.notificationService  // Share notification service
);
```

**Benefits:**
- ✅ Handlers become testable in isolation
- ✅ Consistent notification behavior
- ✅ Single mock for entire widget tree
- ✅ Backward compatible (default parameters)

---

### Phase 2: Create Comprehensive Integration Tests

**Goal:** Write integration tests covering full widget workflows.

#### 2.1 State Machine Transition Tests

```typescript
// tests/integration/playerActionWidget.stateMachine.test.ts
describe('PlayerActionWidget - State Machine', () => {
  describe('DECISION_PHASE → ROLLING → GM_RESOLVING_CONSEQUENCE', () => {
    it('should transition through states on failed roll', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: false,
        initialState: {
          characters: { byId: { 'char-1': createMockCharacter() }, allIds: ['char-1'] },
          playerRoundState: { byCharacterId: { 'char-1': createDecisionPhaseState() } },
        },
      });

      // Set up roll to return failure
      harness.roll.create.mockReturnValue({
        evaluate: vi.fn(async () => ({
          total: 3,
          dice: [{ results: [{ result: 3 }] }],
          toMessage: vi.fn(),
        })),
      });

      // Step 1: Select approach
      await harness.simulateApproachChange('force');
      expect(harness.getPlayerState().selectedApproach).toBe('force');
      expect(harness.bridge.spy.broadcasts).toBe(1);

      // Step 2: Click roll button
      await harness.simulateRollClick();

      // Verify state transition
      expect(harness.getPlayerState().state).toBe('GM_RESOLVING_CONSEQUENCE');
      expect(harness.getPlayerState().rollResult).toEqual([3]);
      expect(harness.getPlayerState().outcome).toBe('failure');

      // Verify broadcasts
      expect(harness.bridge.spy.broadcasts).toBe(3); // Approach + Roll transition + Roll outcome

      // Verify notifications
      expect(harness.ui.notifications.info).not.toHaveBeenCalled();
      expect(harness.ui.notifications.error).not.toHaveBeenCalled();
    });
  });

  describe('Invalid state transitions', () => {
    it('should not allow GM_RESOLVING_CONSEQUENCE → TURN_COMPLETE directly', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: true,
        initialState: {
          playerRoundState: {
            byCharacterId: {
              'char-1': {
                state: 'GM_RESOLVING_CONSEQUENCE',
                /* ... */
              },
            },
          },
        },
      });

      // Attempt invalid transition
      await expect(async () => {
        await harness.game.fitgd.bridge.execute({
          type: 'playerRoundState/transitionState',
          payload: { characterId: 'char-1', newState: 'TURN_COMPLETE' },
        });
      }).rejects.toThrow('Invalid state transition');
    });
  });
});
```

#### 2.2 Equipment Integration Tests

```typescript
// tests/integration/playerActionWidget.equipment.test.ts
describe('PlayerActionWidget - Equipment Integration', () => {
  describe('Active Equipment Selection', () => {
    it('should lock equipment and spend momentum on roll', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: false,
        initialState: {
          characters: {
            byId: {
              'char-1': createMockCharacter({
                equipment: [
                  { id: 'eq-1', name: 'Chainsword', tier: 'rare', locked: false, category: 'active' },
                ],
              }),
            },
            allIds: ['char-1'],
          },
          crews: {
            byId: { 'crew-1': { id: 'crew-1', currentMomentum: 5 } },
            allIds: ['crew-1'],
          },
        },
      });

      // Select equipment
      await harness.widget.activateListeners(createMockHtml({
        '.secondary-approach-select': { value: 'eq-1' },
      }));

      // Trigger roll
      await harness.simulateRollClick();

      // Verify equipment locked
      const character = harness.game.fitgd.store.getState().characters.byId['char-1'];
      expect(character.equipment[0].locked).toBe(true);

      // Verify momentum spent (1M for first-lock of Rare item)
      const crew = harness.game.fitgd.store.getState().crews.byId['crew-1'];
      expect(crew.currentMomentum).toBe(4); // 5 - 1 = 4

      // Verify single broadcast (atomic batch)
      expect(harness.bridge.spy.broadcasts).toBe(1);
    });
  });

  describe('Passive Equipment Approval (GM)', () => {
    it('should allow GM to approve passive equipment', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: true,
        initialState: {
          characters: {
            byId: {
              'char-1': createMockCharacter({
                equipment: [
                  { id: 'eq-passive', name: 'Power Armor', tier: 'epic', category: 'passive' },
                ],
              }),
            },
            allIds: ['char-1'],
          },
        },
      });

      // GM approves passive
      await harness.widget.activateListeners(createMockHtml({
        '.passive-equipment-radio': { value: 'eq-passive', checked: true },
      }));

      // Verify state updated
      expect(harness.getPlayerState().approvedPassiveId).toBe('eq-passive');

      // Verify chat message posted
      expect(harness.chat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Power Armor'),
        })
      );
    });
  });
});
```

#### 2.3 Consequence Flow Tests

```typescript
// tests/integration/playerActionWidget.consequences.test.ts
describe('PlayerActionWidget - Consequence Flow', () => {
  describe('Harm consequence application', () => {
    it('should apply harm and advance clock atomically', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: false,
        initialState: {
          playerRoundState: {
            byCharacterId: {
              'char-1': {
                state: 'GM_RESOLVING_CONSEQUENCE',
                consequenceTransaction: {
                  consequenceType: 'harm',
                  harmTargetCharacterId: 'char-1',
                  harmClockId: 'clock-harm-1',
                  harmSegments: 2,
                },
              },
            },
          },
          clocks: {
            byId: {
              'clock-harm-1': { id: 'clock-harm-1', segments: 3, maxSegments: 6 },
            },
            allIds: ['clock-harm-1'],
          },
        },
      });

      // Player accepts consequence
      await harness.simulateConsequenceAccept();

      // Verify state transition
      expect(harness.getPlayerState().state).toBe('APPLYING_EFFECTS');

      // Verify harm advanced
      const clock = harness.game.fitgd.store.getState().clocks.byId['clock-harm-1'];
      expect(clock.segments).toBe(5); // 3 + 2 = 5

      // Verify transaction cleared
      expect(harness.getPlayerState().consequenceTransaction).toBeNull();

      // Verify single broadcast (atomic batch)
      expect(harness.bridge.spy.broadcasts).toBe(1);

      // Verify notification
      expect(harness.ui.notifications.info).toHaveBeenCalledWith(
        expect.stringContaining('Harm applied')
      );
    });
  });

  describe('Stims interrupt workflow', () => {
    it('should advance addiction clock and trigger reroll', async () => {
      const harness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: false,
        initialState: {
          playerRoundState: {
            byCharacterId: {
              'char-1': {
                state: 'GM_RESOLVING_CONSEQUENCE',
                outcome: 'failure',
              },
            },
          },
          clocks: {
            byId: {
              'clock-addiction-1': {
                id: 'clock-addiction-1',
                clockType: 'addiction',
                segments: 3,
                maxSegments: 8
              },
            },
            allIds: ['clock-addiction-1'],
            byEntityId: { 'crew-1': ['clock-addiction-1'] },
          },
        },
      });

      // Mock addiction roll (d6 = 4)
      harness.roll.create.mockReturnValueOnce({
        evaluate: vi.fn(async () => ({
          total: 4,
          toMessage: vi.fn(),
        })),
      });

      // Mock reroll (d6 = 6)
      harness.roll.create.mockReturnValueOnce({
        evaluate: vi.fn(async () => ({
          total: 6,
          dice: [{ results: [{ result: 6 }] }],
          toMessage: vi.fn(),
        })),
      });

      // Click Use Stims button
      const event = createMockClickEvent();
      await (harness.widget as any)._onUseStims(event);

      // Verify addiction advanced by 1 (roll 4 = +1 segment)
      const clock = harness.game.fitgd.store.getState().clocks.byId['clock-addiction-1'];
      expect(clock.segments).toBe(4); // 3 + 1 = 4

      // Verify reroll occurred
      expect(harness.roll.create).toHaveBeenCalledTimes(2);

      // Verify state transitions: GM_RESOLVING → STIMS_ROLLING → ROLLING → SUCCESS_COMPLETE
      expect(harness.getPlayerState().state).toBe('SUCCESS_COMPLETE');
      expect(harness.getPlayerState().outcome).toBe('success');

      // Verify multiple broadcasts (each state transition + clock advancement)
      expect(harness.bridge.spy.broadcasts).toBeGreaterThanOrEqual(3);
    });
  });
});
```

#### 2.4 GM/Player Synchronization Tests

```typescript
// tests/integration/playerActionWidget.sync.test.ts
describe('PlayerActionWidget - Multi-Client Synchronization', () => {
  it('should synchronize GM position changes to player widget', async () => {
    // Create two harnesses (GM + Player)
    const gmHarness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: true,
      initialState: createSharedState(),
    });

    const playerHarness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
      initialState: createSharedState(),
    });

    // GM changes position
    await gmHarness.widget.activateListeners(createMockHtml({
      '.position-select': { value: 'desperate' },
    }));

    // Simulate socket broadcast
    const broadcastedState = gmHarness.game.fitgd.store.getState();
    playerHarness.game.fitgd.store.dispatch({
      type: 'HYDRATE_STATE',
      payload: broadcastedState,
    });

    // Verify player sees change
    expect(playerHarness.getPlayerState().position).toBe('desperate');

    // Verify both widgets have same state
    expect(gmHarness.getPlayerState()).toEqual(playerHarness.getPlayerState());
  });

  it('should synchronize player roll result to GM widget', async () => {
    const gmHarness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: true,
      initialState: createSharedState(),
    });

    const playerHarness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
      initialState: createSharedState(),
    });

    // Player rolls dice
    await playerHarness.simulateRollClick();

    // Simulate socket broadcast
    const broadcastedState = playerHarness.game.fitgd.store.getState();
    gmHarness.game.fitgd.store.dispatch({
      type: 'HYDRATE_STATE',
      payload: broadcastedState,
    });

    // Verify GM sees roll result
    expect(gmHarness.getPlayerState().state).toBe('GM_RESOLVING_CONSEQUENCE');
    expect(gmHarness.getPlayerState().rollResult).toEqual(playerHarness.getPlayerState().rollResult);
  });
});
```

#### 2.5 Handler Unit Tests

```typescript
// tests/unit/handlers/diceRollingHandler.test.ts
describe('DiceRollingHandler', () => {
  describe('validateRoll', () => {
    it('should reject roll when no approach selected', () => {
      const handler = new DiceRollingHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const result = handler.validateRoll(
        createMockState(),
        { selectedApproach: null } as any,
        { currentMomentum: 5 }
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('no-action-selected');
    });

    it('should reject roll when insufficient momentum', () => {
      const handler = new DiceRollingHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const result = handler.validateRoll(
        createMockState(),
        { selectedApproach: 'force', pushed: true } as any, // Push costs 1M
        { currentMomentum: 0 }
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('insufficient-momentum');
      expect(result.momentumNeeded).toBe(1);
      expect(result.momentumAvailable).toBe(0);
    });
  });

  describe('createRollOutcomeBatch', () => {
    it('should create correct actions for success outcome', () => {
      const handler = new DiceRollingHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const batch = handler.createRollOutcomeBatch(3, [6, 5, 4], 'success');

      expect(batch).toHaveLength(3);
      expect(batch[0].type).toBe('playerRoundState/setRollResult');
      expect(batch[1].type).toBe('playerRoundState/setGmApproved');
      expect(batch[2].type).toBe('playerRoundState/transitionState');
      expect(batch[2].payload.newState).toBe('SUCCESS_COMPLETE');
    });

    it('should create correct actions for failure outcome', () => {
      const handler = new DiceRollingHandler({
        characterId: 'char-1',
        crewId: 'crew-1',
      });

      const batch = handler.createRollOutcomeBatch(2, [3, 2], 'failure');

      expect(batch[2].payload.newState).toBe('GM_RESOLVING_CONSEQUENCE');
    });
  });
});
```

---

### Phase 3: Advanced Testing Scenarios

**Goal:** Cover edge cases and complex workflows.

#### 3.1 Error Recovery Tests

```typescript
describe('PlayerActionWidget - Error Recovery', () => {
  it('should recover from failed socket broadcast', async () => {
    const harness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
    });

    // Mock broadcast failure
    const saveImmediate = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    harness.game.fitgd.bridge = new FoundryReduxBridge(
      harness.game.fitgd.store,
      saveImmediate
    );

    // Attempt roll
    await expect(harness.simulateRollClick()).rejects.toThrow('Network error');

    // Verify state unchanged (rollback)
    expect(harness.getPlayerState().state).toBe('DECISION_PHASE');

    // Verify error notification
    expect(harness.ui.notifications.error).toHaveBeenCalledWith(
      expect.stringContaining('Network error')
    );
  });
});
```

#### 3.2 Race Condition Tests

```typescript
describe('PlayerActionWidget - Race Conditions', () => {
  it('should prevent double-clicking roll button', async () => {
    const harness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
    });

    // Simulate rapid double-click
    const promise1 = harness.simulateRollClick();
    const promise2 = harness.simulateRollClick(); // Second click while first is processing

    await Promise.all([promise1, promise2]);

    // Verify only one roll occurred
    expect(harness.roll.create).toHaveBeenCalledTimes(1);
    expect(harness.bridge.spy.broadcasts).toBe(1);
  });
});
```

#### 3.3 Complex Multi-Step Workflows

```typescript
describe('PlayerActionWidget - Complete Action Resolution', () => {
  it('should complete full workflow: Decision → Roll → Consequence → Complete', async () => {
    const harness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
      initialState: createFullState(),
    });

    // Step 1: Select approach
    await harness.simulateApproachChange('force');

    // Step 2: Push (+1d)
    await harness.widget.activateListeners(createMockHtml({
      '[data-action="push-die"]': { click: true },
    }));

    // Step 3: Select equipment
    await harness.widget.activateListeners(createMockHtml({
      '.secondary-approach-select': { value: 'eq-chainsword' },
    }));

    // Step 4: Roll
    await harness.simulateRollClick();

    // Step 5: GM configures consequence
    await harness.game.fitgd.bridge.execute({
      type: 'playerRoundState/setConsequenceTransaction',
      payload: {
        characterId: 'char-1',
        transaction: {
          consequenceType: 'harm',
          harmTargetCharacterId: 'char-1',
          harmClockId: 'clock-1',
          harmSegments: 2,
        },
      },
    });

    // Step 6: Player accepts consequence
    await harness.simulateConsequenceAccept();

    // Verify final state
    expect(harness.getPlayerState().state).toBe('APPLYING_EFFECTS');

    // Verify all side effects
    const state = harness.game.fitgd.store.getState();
    expect(state.clocks.byId['clock-1'].segments).toBe(2); // Harm applied
    expect(state.characters.byId['char-1'].equipment[0].locked).toBe(true); // Equipment locked
    expect(state.crews.byId['crew-1'].currentMomentum).toBe(3); // 5 - 1 (Push) - 1 (Equipment lock)

    // Verify broadcasts
    expect(harness.bridge.spy.broadcasts).toBe(6); // Each step + final apply
  });
});
```

---

## Implementation Checklist

### Phase 0: Infrastructure ✅
- [ ] Create `tests/mocks/foundryApi.ts` - Mock Foundry global APIs
- [ ] Create `tests/mocks/bridgeSpy.ts` - Track dispatches/broadcasts
- [ ] Create `tests/mocks/uiMocks.ts` - Mock notifications, chat, dice
- [ ] Create `tests/integration/playerActionWidget.harness.ts` - Test harness
- [ ] Set up vitest config for integration tests

### Phase 1: Non-Breaking Refactors ✅
- [ ] Extract `DiceService` interface + implementation
- [ ] Inject `DiceService` into widget (default parameter)
- [ ] Extract `NotificationService` interface + implementation
- [ ] Inject `NotificationService` into widget and handlers
- [ ] Extract `DialogFactory` interface + implementation
- [ ] Inject `DialogFactory` into widget
- [ ] Update all 12 handlers to accept `NotificationService`
- [ ] Run existing tests to verify no regressions

### Phase 2: Integration Tests ✅
- [ ] Write state machine transition tests (20+ scenarios)
- [ ] Write equipment integration tests (10+ scenarios)
- [ ] Write consequence flow tests (15+ scenarios)
- [ ] Write GM/Player sync tests (10+ scenarios)
- [ ] Write handler unit tests (50+ tests)
- [ ] Achieve 80%+ integration test coverage

### Phase 3: Advanced Testing ✅
- [ ] Write error recovery tests (5+ scenarios)
- [ ] Write race condition tests (5+ scenarios)
- [ ] Write complex multi-step workflow tests (10+ scenarios)
- [ ] Write performance tests (latency, broadcast count)
- [ ] Document test patterns and best practices

---

## Success Criteria

### Quantitative
- [ ] **Integration test coverage:** 80%+ of widget + handler code
- [ ] **Test count:** 100+ integration tests
- [ ] **Zero breaking changes:** All existing tests pass
- [ ] **Build passes:** `npm run type-check:all` succeeds
- [ ] **Performance:** Integration tests run in < 5 seconds

### Qualitative
- [ ] **Confidence:** Can refactor widget internals without fear
- [ ] **Documentation:** Clear examples of how to test widget workflows
- [ ] **Maintainability:** New features require integration tests
- [ ] **Debugging:** Test failures pinpoint exact issue
- [ ] **CI/CD Ready:** Tests run reliably in automated pipelines

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking production code | Low | High | Use default parameters, extensive manual testing |
| Tests flaky due to async | Medium | Medium | Use proper async/await patterns, mock timers |
| Mocks drift from real APIs | Medium | Low | Regular validation against production |
| Performance degradation | Low | Low | Benchmark before/after, optimize if needed |
| Incomplete test coverage | Medium | Medium | Track coverage metrics, prioritize critical paths |

---

## Next Steps

1. **Review this plan with team** - Get feedback on approach
2. **Create Phase 0 infrastructure** - Set up mocks and harness
3. **Pilot refactor on one handler** - Validate pattern works
4. **Iterate on remaining handlers** - Apply lessons learned
5. **Write integration tests** - Cover critical workflows first
6. **Expand to edge cases** - Achieve comprehensive coverage
7. **Document patterns** - Create guide for future tests

---

## Appendix: Key Architectural Insights

### Why Handlers Are Already Good
The widget's handler pattern is **excellent architecture**:
- ✅ Separates concerns (dice rolling, consequence, stims)
- ✅ Encapsulates complex logic (130+ lines → single handler)
- ✅ Reusable across multiple widgets
- ✅ Testable in isolation (once dependencies are injectable)

**We should NOT refactor the handler pattern itself - just inject their dependencies.**

### Why Bridge API Is Critical
The Foundry-Redux Bridge enforces the "dispatch → broadcast → refresh" pattern:
- ✅ Prevents forgotten broadcasts (common bug)
- ✅ Prevents render race conditions (atomic batches)
- ✅ Validates state transitions (catches batching errors)
- ✅ Centralizes ID mapping (Redux ↔ Foundry)

**Bridge API is production-proven (56+ usages) and should remain as-is.**

### Why Socket Mocking Is Key
Multi-client scenarios are critical to test:
- GM changes position → Player sees update instantly
- Player rolls dice → GM sees result immediately
- Player accepts consequence → Both widgets close

**Without socket mocking, we cannot test the core value proposition of synchronized views.**

### Why Default Parameters Are Perfect
Using default parameters preserves backward compatibility:
```typescript
constructor(
  characterId: string,
  options: any = {},
  private diceService: DiceService = new FoundryDiceService() // ← Default to real implementation
) { }
```

**Production code uses real services, tests inject mocks - zero breaking changes.**

---

## Conclusion

This refactoring plan enables **comprehensive integration testing** of the Player Action Widget through:

1. **Non-breaking dependency injection** (default parameters)
2. **Strategic service extraction** (dice, notifications, dialogs)
3. **Mock infrastructure** (Foundry APIs, socket broadcasts)
4. **Test harness** (high-level API for complex scenarios)
5. **Comprehensive test suites** (state machine, equipment, consequences, sync)

**The handler architecture is already excellent - we just need to inject dependencies and write tests.**

**Estimated Effort:** 2-3 weeks for full implementation
**Risk Level:** Low (non-breaking approach)
**Value:** High (confidence in critical game mechanic)
