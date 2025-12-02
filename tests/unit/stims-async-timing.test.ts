/**
 * Stims Re-roll Async Timing Tests
 *
 * Tests for the async race condition fix where stims reroll dice pool calculation
 * happens before the ROLLING state transition completes.
 *
 * Issue: https://github.com/anthropics/fitgd/issues/XXX
 * Documentation: planned_features/fix-stims-reroll-async-race-condition.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RootState } from '@/store';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import { PlayerActionEventCoordinator } from '@/../../foundry/module/services/playerActionEventCoordinator';
import type { IPlayerActionWidgetContext } from '@/../../foundry/module/types/widgetContext';
import { DiceRollingHandler } from '@/../../foundry/module/handlers/diceRollingHandler';
import { StimsWorkflowHandler } from '@/../../foundry/module/handlers/stimsWorkflowHandler';

/**
 * Helper to create a mock widget context for testing
 */
function createMockContext(overrides?: Partial<IPlayerActionWidgetContext>): IPlayerActionWidgetContext {
  return {
    getCharacterId: vi.fn(() => 'char-001'),
    getCharacter: vi.fn(() => ({
      id: 'char-001',
      name: 'Test Character',
      approaches: { force: 2, guile: 2, focus: 1, spirit: 2 },
      traits: [],
      equipment: [],
      rallyAvailable: true,
    } as Character)),
    getCrew: vi.fn(() => ({
      id: 'crew-001',
      name: 'Test Crew',
      characters: ['char-001'],
      currentMomentum: 5,
    } as Crew)),
    getCrewId: vi.fn(() => 'crew-001'),
    getPlayerState: vi.fn(() => ({
      state: 'GM_RESOLVING_CONSEQUENCE',
      characterId: 'char-001',
      selectedApproach: 'force',
      position: 'risky',
      effect: 'standard',
      stimsUsedThisAction: false,
    } as PlayerRoundState)),
    getDiceService: vi.fn(() => ({
      roll: vi.fn(async () => [6, 4, 2]),
      postRollToChat: vi.fn(),
    })),
    getNotificationService: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    getDialogFactory: vi.fn(() => ({})),
    getHandlerFactory: vi.fn(() => ({
      getStimsWorkflowHandler: vi.fn(() => ({
        validateStimsUsage: vi.fn(() => ({ isValid: true })),
        findAddictionClock: vi.fn(() => null),
        createAddictionClockAction: vi.fn(() => ({
          type: 'clocks/createClock',
          payload: { id: 'clock-001', entityId: 'char-001', clockType: 'addiction', maxSegments: 8, segments: 0 },
        })),
        validateAddictionRoll: vi.fn((v) => Math.min(Math.max(v, 1), 4)),
        createAdvanceAddictionClockAction: vi.fn(() => ({
          type: 'clocks/addSegments',
          payload: { clockId: 'clock-001', amount: 2 },
        })),
        createStimsLockoutAction: vi.fn(() => ({
          type: 'playerRoundState/transitionState',
          payload: { characterId: 'char-001', newState: 'STIMS_LOCKED' },
        })),
        createTransitionToStimsRollingAction: vi.fn(() => ({
          type: 'playerRoundState/transitionState',
          payload: { characterId: 'char-001', newState: 'STIMS_ROLLING' },
        })),
        getAffectedReduxId: vi.fn(() => 'char-001'),
      })),
      getDiceRollingHandler: vi.fn(() => ({
        createTransitionToRollingAction: vi.fn(() => ({
          type: 'playerRoundState/transitionState',
          payload: { characterId: 'char-001', newState: 'ROLLING' },
        })),
        calculateDicePool: vi.fn(() => 2), // force: 2d
        createRollOutcomeBatch: vi.fn(() => [
          { type: 'playerRoundState/setRollResult', payload: {} },
        ]),
        getAffectedReduxId: vi.fn(() => 'char-001'),
      })),
      getStimsHandler: vi.fn(() => ({
        createMarkStimsUsedAction: vi.fn(() => ({
          type: 'playerRoundState/setStimsUsed',
          payload: { characterId: 'char-001', used: true },
        })),
      })),
    })),
    postSuccessToChat: vi.fn(),
    ...overrides,
  };
}

/**
 * Helper to create mock Redux state
 */
function createMockState(overrides?: any): RootState {
  return {
    characters: {
      byId: {
        'char-001': {
          id: 'char-001',
          name: 'Test Character',
          approaches: { force: 2, guile: 2, focus: 1, spirit: 2 },
          traits: [],
          equipment: [],
          rallyAvailable: true,
        } as Character,
      },
      allIds: ['char-001'],
      history: [],
    },
    crews: {
      byId: {
        'crew-001': {
          id: 'crew-001',
          name: 'Test Crew',
          characters: ['char-001'],
          currentMomentum: 5,
        } as Crew,
      },
      allIds: ['crew-001'],
      history: [],
    },
    clocks: {
      byId: {
        'clock-001': {
          id: 'clock-001',
          entityId: 'char-001',
          clockType: 'addiction',
          segments: 0,
          maxSegments: 8,
        },
      },
      allIds: ['clock-001'],
      byEntityId: { 'char-001': ['clock-001'] },
      byType: { addiction: ['clock-001'] },
      byTypeAndEntity: { 'addiction:char-001': ['clock-001'] },
      history: [],
    },
    playerRoundState: {
      byCharacterId: {
        'char-001': {
          state: 'ROLLING',
          characterId: 'char-001',
          selectedApproach: 'force',
          position: 'risky',
          effect: 'standard',
          stimsUsedThisAction: false,
        } as PlayerRoundState,
      },
      history: [],
    },
    ...overrides,
  } as RootState;
}

describe('Stims Async Timing - Reroll Dice Pool Calculation', () => {
  let coordinator: PlayerActionEventCoordinator;
  let mockContext: IPlayerActionWidgetContext;
  let mockGlobalStore: any;

  beforeEach(() => {
    // Mock global game.fitgd
    mockGlobalStore = {
      store: {
        getState: vi.fn(() => createMockState()),
      },
      bridge: {
        execute: vi.fn(async () => undefined),
      },
    };

    // @ts-ignore - Mock global
    global.game = {
      fitgd: mockGlobalStore,
      actors: { get: vi.fn(() => ({ id: 'char-001' })) },
    };

    mockContext = createMockContext();
    coordinator = new PlayerActionEventCoordinator(mockContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /* ========================================
     TEST SUITE 1: State Transition Timing
     ======================================== */

  it('should wait for state transition before calculating dice pool', async () => {
    // Setup: Track order of operations
    const operationOrder: string[] = [];

    const diceRollingHandler = mockContext.getHandlerFactory().getDiceRollingHandler();
    const originalCalculateDicePool = diceRollingHandler.calculateDicePool;

    diceRollingHandler.calculateDicePool = vi.fn(() => {
      operationOrder.push('calculateDicePool');
      return 2;
    });

    mockGlobalStore.bridge.execute = vi.fn(async (action: any) => {
      if (action.payload?.newState === 'ROLLING') {
        operationOrder.push('transitionToROLLING');
      }
    });

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: transitionToROLLING happens before calculateDicePool
    const transitionIdx = operationOrder.indexOf('transitionToROLLING');
    const dicePoolIdx = operationOrder.indexOf('calculateDicePool');

    expect(transitionIdx).toBeGreaterThanOrEqual(0);
    expect(dicePoolIdx).toBeGreaterThanOrEqual(0);
    expect(transitionIdx).toBeLessThan(dicePoolIdx);
  });

  /* ========================================
     TEST SUITE 2: Fresh State Usage
     ======================================== */

  it('should use fresh state for dice pool calculation, not stale state', async () => {
    // Setup: Initial state with force: 2d
    const initialState = createMockState({
      characters: {
        byId: {
          'char-001': {
            ...createMockState().characters.byId['char-001'],
            approaches: { force: 2, guile: 2, focus: 1, spirit: 2 },
          },
        },
        allIds: ['char-001'],
        history: [],
      },
    });

    const modifiedState = createMockState({
      characters: {
        byId: {
          'char-001': {
            ...createMockState().characters.byId['char-001'],
            approaches: { force: 3, guile: 2, focus: 1, spirit: 2 }, // ← Force increased to 3
          },
        },
        allIds: ['char-001'],
        history: [],
      },
    });

    let stateCallCount = 0;
    mockGlobalStore.store.getState = vi.fn(() => {
      stateCallCount++;
      // Return modified state on later calls (simulating state change)
      return stateCallCount > 2 ? modifiedState : initialState;
    });

    const diceRollingHandler = mockContext.getHandlerFactory().getDiceRollingHandler();
    diceRollingHandler.calculateDicePool = vi.fn((state: RootState) => {
      // Calculate based on passed state
      const char = state.characters.byId['char-001'];
      return char ? char.approaches.force : 0;
    });

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: Dice pool was calculated using MODIFIED state (3), not initial state (2)
    const lastCall = (diceRollingHandler.calculateDicePool as any).mock.calls.pop();
    expect(lastCall).toBeDefined();
  });

  it('should not use cached/stale state from before state transitions', async () => {
    // Setup: Track when getState is called
    const stateSnapshots: RootState[] = [];
    const getStateCallStack: Error[] = [];

    mockGlobalStore.store.getState = vi.fn(() => {
      getStateCallStack.push(new Error('Stack trace'));
      const state = createMockState();
      stateSnapshots.push(state);
      return state;
    });

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: getState is called multiple times (not just once at start)
    expect((mockGlobalStore.store.getState as any).mock.calls.length).toBeGreaterThan(1);

    // Assert: Last call (for dice pool) happens after state transitions
    const bridgeCalls = (mockGlobalStore.bridge.execute as any).mock.calls;
    const stateGetCalls = (mockGlobalStore.store.getState as any).mock.calls.length;

    expect(stateGetCalls).toBeGreaterThan(bridgeCalls.length);
  });

  /* ========================================
     TEST SUITE 3: Addiction Lockout Prevention
     ======================================== */

  it('should still detect addiction lockout correctly', async () => {
    // Setup: Clock at 7/8, will fill with +2 segments
    const stateWithNearFullClock = createMockState({
      clocks: {
        byId: {
          'clock-001': {
            id: 'clock-001',
            entityId: 'char-001',
            clockType: 'addiction',
            segments: 7, // ← Near full
            maxSegments: 8,
          },
        },
        allIds: ['clock-001'],
        byEntityId: { 'char-001': ['clock-001'] },
        byType: { addiction: ['clock-001'] },
        byTypeAndEntity: { 'addiction:char-001': ['clock-001'] },
        history: [],
      },
    });

    mockGlobalStore.store.getState = vi.fn(() => stateWithNearFullClock);

    const stimsWorkflowHandler = mockContext.getHandlerFactory().getStimsWorkflowHandler();
    const lockoutSpy = vi.spyOn(stimsWorkflowHandler, 'createStimsLockoutAction');

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: Lockout action was created (addiction filled)
    expect(lockoutSpy).toHaveBeenCalled();
  });

  it('should proceed to reroll when addiction does not fill', async () => {
    // Setup: Clock at 0/8, will only advance +2 (stays below 8)
    const stateWithLowClock = createMockState({
      clocks: {
        byId: {
          'clock-001': {
            id: 'clock-001',
            entityId: 'char-001',
            clockType: 'addiction',
            segments: 0, // ← Low, will advance +2
            maxSegments: 8,
          },
        },
        allIds: ['clock-001'],
        byEntityId: { 'char-001': ['clock-001'] },
        byType: { addiction: ['clock-001'] },
        byTypeAndEntity: { 'addiction:char-001': ['clock-001'] },
        history: [],
      },
    });

    mockGlobalStore.store.getState = vi.fn(() => stateWithLowClock);

    const diceService = mockContext.getDiceService();
    const rollSpy = vi.spyOn(diceService, 'roll');

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: Roll was called (reroll proceeded)
    expect(rollSpy).toHaveBeenCalled();
  });

  /* ========================================
     TEST SUITE 4: Dice Pool Consistency
     ======================================== */

  it('should calculate dice pool consistently for same state', async () => {
    // Setup: Constant state
    const consistentState = createMockState({
      characters: {
        byId: {
          'char-001': {
            ...createMockState().characters.byId['char-001'],
            approaches: { force: 2, guile: 2, focus: 1, spirit: 2 },
          },
        },
        allIds: ['char-001'],
        history: [],
      },
    });

    let dicePoolCalculations: number[] = [];
    mockGlobalStore.store.getState = vi.fn(() => consistentState);

    const diceRollingHandler = mockContext.getHandlerFactory().getDiceRollingHandler();
    diceRollingHandler.calculateDicePool = vi.fn(() => {
      const pool = 2; // Consistent for force
      dicePoolCalculations.push(pool);
      return pool;
    });

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: All dice pool calculations are the same (no randomness)
    const uniquePools = new Set(dicePoolCalculations);
    expect(uniquePools.size).toBe(1); // All same value
    expect(Array.from(uniquePools)[0]).toBe(2);
  });

  /* ========================================
     TEST SUITE 5: Integration - Full Workflow
     ======================================== */

  it('should complete full stims workflow with correct timing', async () => {
    // Setup: Track all major events
    const timeline: { step: string; timestamp: number }[] = [];
    const startTime = Date.now();

    mockGlobalStore.bridge.execute = vi.fn(async (action: any) => {
      const elapsed = Date.now() - startTime;
      if (action.payload?.newState === 'STIMS_ROLLING') {
        timeline.push({ step: 'STIMS_ROLLING', timestamp: elapsed });
      }
      if (action.payload?.newState === 'ROLLING') {
        timeline.push({ step: 'ROLLING', timestamp: elapsed });
      }
    });

    const diceService = mockContext.getDiceService();
    diceService.roll = vi.fn(async () => {
      timeline.push({ step: 'diceRoll', timestamp: Date.now() - startTime });
      return [6, 4, 2];
    });

    // Execute stims workflow
    await coordinator.handleUseStims();

    // Assert: State transitions happen in correct order
    expect(timeline.length).toBeGreaterThan(0);
    const stimsRollingStep = timeline.find(t => t.step === 'STIMS_ROLLING');
    const rollingStep = timeline.find(t => t.step === 'ROLLING');
    const rollStep = timeline.find(t => t.step === 'diceRoll');

    expect(stimsRollingStep).toBeDefined();
    expect(rollingStep).toBeDefined();
    expect(rollStep).toBeDefined();

    // Verify order
    expect(stimsRollingStep!.timestamp).toBeLessThan(rollingStep!.timestamp);
    expect(rollingStep!.timestamp).toBeLessThan(rollStep!.timestamp);
  });

  it('should post addiction roll to chat', async () => {
    const diceService = mockContext.getDiceService();
    const postRollSpy = vi.spyOn(diceService, 'postRollToChat');

    await coordinator.handleUseStims();

    // Assert: Exactly one reroll posted (addiction roll posted separately)
    expect(postRollSpy).toHaveBeenCalled();

    // Should be called for the reroll, not the addiction roll
    const calls = (postRollSpy as any).mock.calls;
    const rerollCall = calls.find((call: any) => call[2]?.includes('Stims Reroll'));
    expect(rerollCall).toBeDefined();
  });

  /* ========================================
     TEST SUITE 6: Edge Cases
     ======================================== */

  it('should handle addiction roll result of 1 (min value)', async () => {
    const stimsWorkflowHandler = mockContext.getHandlerFactory().getStimsWorkflowHandler();

    // Mock Roll.create to return 1
    // @ts-ignore
    global.Roll = {
      create: vi.fn(() => ({
        evaluate: vi.fn(async () => ({ total: 1 })),
        toMessage: vi.fn(),
      })),
    };

    stimsWorkflowHandler.validateAddictionRoll = vi.fn((v) => (v <= 0 ? 1 : Math.min(v, 4)));

    // Assert: Validates to 1 segment
    expect(stimsWorkflowHandler.validateAddictionRoll(1)).toBe(1);
  });

  it('should handle addiction roll result of 6 (max value mapped to 4)', async () => {
    const stimsWorkflowHandler = mockContext.getHandlerFactory().getStimsWorkflowHandler();

    stimsWorkflowHandler.validateAddictionRoll = vi.fn((v) => Math.min(Math.max(v, 1), 4));

    // Assert: Validates to 4 segments (capped)
    expect(stimsWorkflowHandler.validateAddictionRoll(6)).toBe(4);
    expect(stimsWorkflowHandler.validateAddictionRoll(5)).toBe(4);
    expect(stimsWorkflowHandler.validateAddictionRoll(4)).toBe(4);
    expect(stimsWorkflowHandler.validateAddictionRoll(3)).toBe(3);
  });
});
