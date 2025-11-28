/**
 * Player Action Widget Test Harness
 *
 * Provides a high-level API for integration testing of the Player Action Widget.
 * Sets up complete mock environment and provides helper methods for common test scenarios.
 *
 * Usage:
 * ```typescript
 * const harness = await createWidgetHarness({
 *   characterId: 'char-1',
 *   isGM: false,
 * });
 *
 * // Simulate user interactions
 * await harness.selectApproach('force');
 * await harness.clickRoll();
 *
 * // Verify state
 * expect(harness.getPlayerState().state).toBe('GM_RESOLVING_CONSEQUENCE');
 * expect(harness.spy.data.broadcasts).toBe(2);
 * ```
 */

import { vi, beforeEach, afterEach } from 'vitest';
import type { RootState } from '@/store';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { Clock } from '@/types/clock';
import {
  createMockFoundryGame,
  createMockCharacter,
  createMockCrew,
  createMockActor,
  type MockFoundryGame,
} from '../mocks/foundryApi';
import { createBridgeSpy, type BridgeSpy } from '../mocks/bridgeSpy';
import {
  setupUIMocks,
  cleanupUIMocks,
  createMockClickEvent,
  createMockChangeEvent,
  type MockNotifications,
  type MockChatMessageConstructor,
  type MockRollConstructor,
} from '../mocks/uiMocks';

/* -------------------------------------------- */
/*  Type Definitions                            */
/* -------------------------------------------- */

export interface WidgetHarnessOptions {
  /** Character ID for the widget */
  characterId: string;

  /** Is current user GM? */
  isGM?: boolean;

  /** Initial Redux state */
  initialState?: Partial<RootState>;

  /** Default dice roll results */
  rollResults?: number[];

  /** Character data (if not in initialState) */
  character?: Character;

  /** Crew data (if not in initialState) */
  crew?: Crew;
}

export interface WidgetTestHarness {
  /** The widget instance */
  widget: any; // Will be PlayerActionWidget once we inject dependencies

  /** Mock Foundry game environment */
  game: MockFoundryGame;

  /** Bridge spy for tracking dispatches */
  spy: BridgeSpy;

  /** UI mocks */
  mocks: {
    notifications: MockNotifications;
    ChatMessage: MockChatMessageConstructor;
    Roll: MockRollConstructor;
  };

  /* -------------------------------------------- */
  /*  State Query Helpers                         */
  /* -------------------------------------------- */

  /** Get current player round state */
  getPlayerState: () => PlayerRoundState | undefined;

  /** Get character from Redux state */
  getCharacter: () => Character | undefined;

  /** Get crew from Redux state */
  getCrew: () => Crew | undefined;

  /** Get all clocks for character */
  getClocks: (clockType?: string) => Clock[];

  /** Get current Redux state */
  getState: () => RootState;

  /* -------------------------------------------- */
  /*  Action Simulation Helpers                   */
  /* -------------------------------------------- */

  /** Simulate approach selection */
  selectApproach: (approach: string) => Promise<void>;

  /** Simulate secondary approach/equipment selection */
  selectSecondary: (value: string) => Promise<void>;

  /** Simulate GM position change */
  setPosition: (position: 'controlled' | 'risky' | 'desperate') => Promise<void>;

  /** Simulate GM effect change */
  setEffect: (effect: 'limited' | 'standard' | 'great') => Promise<void>;

  /** Simulate GM passive equipment approval */
  approvePassive: (equipmentId: string) => Promise<void>;

  /** Simulate roll button click */
  clickRoll: () => Promise<void>;

  /** Simulate push die button click */
  clickPushDie: () => Promise<void>;

  /** Simulate push effect button click */
  clickPushEffect: () => Promise<void>;

  /** Simulate rally button click */
  clickRally: () => Promise<void>;

  /** Simulate use trait button click */
  clickUseTrait: () => Promise<void>;

  /** Simulate use stims button click */
  clickUseStims: () => Promise<void>;

  /** Simulate player accepting consequence */
  acceptConsequence: () => Promise<void>;

  /* -------------------------------------------- */
  /*  Test Setup Helpers                          */
  /* -------------------------------------------- */

  /** Set custom roll results for next roll */
  setNextRoll: (results: number[]) => void;

  /** Advance to a specific state (for setup) */
  advanceToState: (state: string) => Promise<void>;

  /** Set up a complete action plan */
  setupActionPlan: (plan: {
    approach: string;
    secondary?: string;
    position?: string;
    effect?: string;
    pushed?: boolean;
  }) => Promise<void>;

  /** Clean up harness (call in afterEach) */
  cleanup: () => void;
}

/* -------------------------------------------- */
/*  Harness Factory                             */
/* -------------------------------------------- */

/**
 * Create a widget test harness
 *
 * @param options - Harness configuration
 * @returns Test harness with widget and helper methods
 *
 * @example
 * ```typescript
 * describe('PlayerActionWidget', () => {
 *   let harness: WidgetTestHarness;
 *
 *   beforeEach(async () => {
 *     harness = await createWidgetHarness({
 *       characterId: 'char-1',
 *       isGM: false,
 *       character: createMockCharacter({ name: 'Test Hero' }),
 *       crew: createMockCrew({ currentMomentum: 5 }),
 *     });
 *   });
 *
 *   afterEach(() => {
 *     harness.cleanup();
 *   });
 *
 *   it('should transition to ROLLING when roll clicked', async () => {
 *     await harness.selectApproach('force');
 *     await harness.clickRoll();
 *
 *     expect(harness.getPlayerState().state).toBe('ROLLING');
 *   });
 * });
 * ```
 */
export async function createWidgetHarness(
  options: WidgetHarnessOptions
): Promise<WidgetTestHarness> {
  const {
    characterId,
    isGM = false,
    initialState = {},
    rollResults = [6, 5, 4],
    character,
    crew,
  } = options;

  // Merge character and crew into initial state if provided
  const mergedState: Partial<RootState> = { ...initialState };

  if (character) {
    mergedState.characters = {
      byId: { [character.id]: character },
      allIds: [character.id],
      history: [],
      ...mergedState.characters,
    };
  }

  if (crew) {
    mergedState.crews = {
      byId: { [crew.id]: crew },
      allIds: [crew.id],
      history: [],
      ...mergedState.crews,
    };

    // Add character to crew if not already there
    if (character && !crew.characters.includes(character.id)) {
      crew.characters = [...crew.characters, character.id];
    }
  }

  // Create mock Foundry environment
  const game = createMockFoundryGame({
    isGM,
    initialState: mergedState,
    actors: character ? [createMockActor(character)] : [],
  });

  // Create bridge spy
  const { bridge, spy } = createBridgeSpy(game.fitgd.store);
  game.fitgd.bridge = bridge as any;

  // Set up UI mocks
  const uiMocks = setupUIMocks({ rollResults });

  // Inject mocks into global scope
  (global as any).game = game;

  // NOTE: Widget creation will happen in Phase 1 when we add dependency injection
  // For now, we'll create a placeholder
  const widget = {
    characterId,
    _initialized: false,
    // Widget methods will be added when we refactor in Phase 1
  };

  /* -------------------------------------------- */
  /*  State Query Helpers                         */
  /* -------------------------------------------- */

  const getPlayerState = (): PlayerRoundState | undefined => {
    return game.fitgd.store.getState().playerRoundState.byCharacterId[characterId];
  };

  const getCharacter = (): Character | undefined => {
    return game.fitgd.store.getState().characters.byId[characterId];
  };

  const getCrew = (): Crew | undefined => {
    const state = game.fitgd.store.getState();
    const crewId = Object.values(state.crews.byId).find(crew =>
      crew.characters.includes(characterId)
    )?.id;
    return crewId ? state.crews.byId[crewId] : undefined;
  };

  const getClocks = (clockType?: string): Clock[] => {
    return game.fitgd.bridge.getClocks(characterId, clockType || null);
  };

  const getState = (): RootState => {
    return game.fitgd.store.getState();
  };

  /* -------------------------------------------- */
  /*  Action Simulation Helpers                   */
  /* -------------------------------------------- */

  const selectApproach = async (approach: string): Promise<void> => {
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setActionPlan',
      payload: {
        characterId,
        approach,
        position: getPlayerState()?.position || 'risky',
        effect: getPlayerState()?.effect || 'standard',
      },
    });
  };

  const selectSecondary = async (value: string): Promise<void> => {
    const currentState = getPlayerState();
    const char = getCharacter();

    // Check if value is an approach or equipment
    const isApproach = char?.approaches && Object.keys(char.approaches).includes(value);

    if (isApproach) {
      await game.fitgd.bridge.execute({
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId,
          approach: currentState?.selectedApproach || 'force',
          secondaryApproach: value,
          equippedForAction: [],
          position: currentState?.position || 'risky',
          effect: currentState?.effect || 'standard',
        },
      });
    } else {
      await game.fitgd.bridge.execute({
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId,
          approach: currentState?.selectedApproach || 'force',
          secondaryApproach: undefined,
          equippedForAction: [value],
          position: currentState?.position || 'risky',
          effect: currentState?.effect || 'standard',
        },
      });
    }
  };

  const setPosition = async (position: 'controlled' | 'risky' | 'desperate'): Promise<void> => {
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setPosition',
      payload: { characterId, position },
    });
  };

  const setEffect = async (effect: 'limited' | 'standard' | 'great'): Promise<void> => {
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setEffect',
      payload: { characterId, effect },
    });
  };

  const approvePassive = async (equipmentId: string): Promise<void> => {
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setApprovedPassive',
      payload: { characterId, equipmentId },
    });
  };

  const clickRoll = async (): Promise<void> => {
    // This will call the widget's _onRoll method once we have dependency injection
    // For now, simulate the core roll workflow
    const currentState = getPlayerState();

    if (!currentState?.selectedApproach) {
      throw new Error('No approach selected');
    }

    // Transition to ROLLING
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/transitionState',
      payload: { characterId, newState: 'ROLLING' },
    });

    // Simulate dice roll
    const roll = await uiMocks.Roll.create('3d6').evaluate();

    // Determine outcome
    const maxDie = Math.max(...roll.dice[0].results.map(r => r.result));
    const sixes = roll.dice[0].results.filter(r => r.result === 6).length;
    const outcome = sixes >= 2 ? 'critical' : maxDie >= 6 ? 'success' : maxDie >= 4 ? 'partial' : 'failure';

    // Set roll result and transition
    const nextState = outcome === 'critical' || outcome === 'success' ? 'SUCCESS_COMPLETE' : 'GM_RESOLVING_CONSEQUENCE';

    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/setRollResult',
        payload: {
          characterId,
          dicePool: 3,
          rollResult: roll.dice[0].results.map(r => r.result),
          outcome,
        },
      },
      {
        type: 'playerRoundState/transitionState',
        payload: { characterId, newState: nextState },
      },
    ]);
  };

  const clickPushDie = async (): Promise<void> => {
    const currentState = getPlayerState();
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setPushed',
      payload: {
        characterId,
        pushed: !(currentState?.pushed || false),
      },
    });
  };

  const clickPushEffect = async (): Promise<void> => {
    const currentState = getPlayerState();
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setPushEffect',
      payload: {
        characterId,
        pushEffect: !(currentState?.pushEffect || false),
      },
    });
  };

  const clickRally = async (): Promise<void> => {
    // Rally opens a dialog - we'll mock the dialog interaction
    // For now, just verify rally is available
    const char = getCharacter();
    if (!char?.rallyAvailable) {
      throw new Error('Rally not available');
    }
  };

  const clickUseTrait = async (): Promise<void> => {
    // Use Trait opens a dialog - we'll mock the dialog interaction
    // For now, create a basic trait transaction
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setTraitTransaction',
      payload: {
        characterId,
        transaction: {
          mode: 'flashback',
          traitName: 'Test Trait',
          momentumCost: 1,
        },
      },
    });
  };

  const clickUseStims = async (): Promise<void> => {
    // Stims workflow is complex - simulate the core steps
    const crewData = getCrew();
    if (!crewData) {
      throw new Error('No crew found');
    }

    // Mark stims as used
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/setActionPlan',
      payload: {
        characterId,
        approach: getPlayerState()?.selectedApproach || 'force',
        stimsUsedThisAction: true,
      },
    });

    // Transition to STIMS_ROLLING
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/transitionState',
      payload: { characterId, newState: 'STIMS_ROLLING' },
    });
  };

  const acceptConsequence = async (): Promise<void> => {
    const currentState = getPlayerState();
    if (currentState?.state !== 'GM_RESOLVING_CONSEQUENCE') {
      throw new Error('Not in GM_RESOLVING_CONSEQUENCE state');
    }

    // Transition to APPLYING_EFFECTS
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/transitionState',
      payload: { characterId, newState: 'APPLYING_EFFECTS' },
    });
  };

  /* -------------------------------------------- */
  /*  Test Setup Helpers                          */
  /* -------------------------------------------- */

  const setNextRoll = (results: number[]): void => {
    // Reset the Roll mock with new results
    (uiMocks.Roll.create as any).mockReturnValueOnce({
      evaluate: vi.fn(async () => ({
        total: Math.max(...results),
        dice: [{ results: results.map(r => ({ result: r })) }],
        toMessage: vi.fn(),
      })),
    });
  };

  const advanceToState = async (state: string): Promise<void> => {
    await game.fitgd.bridge.execute({
      type: 'playerRoundState/transitionState',
      payload: { characterId, newState: state },
    });
  };

  const setupActionPlan = async (plan: {
    approach: string;
    secondary?: string;
    position?: string;
    effect?: string;
    pushed?: boolean;
  }): Promise<void> => {
    await selectApproach(plan.approach);

    if (plan.secondary) {
      await selectSecondary(plan.secondary);
    }

    if (plan.position) {
      await setPosition(plan.position as any);
    }

    if (plan.effect) {
      await setEffect(plan.effect as any);
    }

    if (plan.pushed) {
      await clickPushDie();
    }
  };

  const cleanup = (): void => {
    cleanupUIMocks();
    delete (global as any).game;
    spy.reset();
  };

  /* -------------------------------------------- */
  /*  Return Harness                              */
  /* -------------------------------------------- */

  return {
    widget,
    game,
    spy,
    mocks: {
      notifications: uiMocks.notifications,
      ChatMessage: uiMocks.ChatMessage,
      Roll: uiMocks.Roll,
    },

    // State queries
    getPlayerState,
    getCharacter,
    getCrew,
    getClocks,
    getState,

    // Action simulations
    selectApproach,
    selectSecondary,
    setPosition,
    setEffect,
    approvePassive,
    clickRoll,
    clickPushDie,
    clickPushEffect,
    clickRally,
    clickUseTrait,
    clickUseStims,
    acceptConsequence,

    // Test setup
    setNextRoll,
    advanceToState,
    setupActionPlan,
    cleanup,
  };
}

/* -------------------------------------------- */
/*  Vitest Setup Helpers                        */
/* -------------------------------------------- */

/**
 * Set up harness for use in vitest describe block
 *
 * Automatically handles cleanup in afterEach.
 *
 * @param options - Harness options
 * @returns Ref to harness (will be populated in beforeEach)
 *
 * @example
 * ```typescript
 * describe('PlayerActionWidget', () => {
 *   const harness = setupHarnessForTests({
 *     characterId: 'char-1',
 *     isGM: false,
 *   });
 *
 *   it('should work', async () => {
 *     await harness.current.selectApproach('force');
 *     // ...
 *   });
 * });
 * ```
 */
export function setupHarnessForTests(
  options: WidgetHarnessOptions
): { current: WidgetTestHarness } {
  const ref: { current: WidgetTestHarness } = { current: null as any };

  beforeEach(async () => {
    ref.current = await createWidgetHarness(options);
  });

  afterEach(() => {
    if (ref.current) {
      ref.current.cleanup();
    }
  });

  return ref;
}
