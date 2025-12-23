import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { receiveCommandsFromSocket } from '../../foundry/module/socket/socket-handler';

// Mock dependencies
vi.mock('../../foundry/module/autosave/autosave-manager', () => ({
    updateBroadcastTracking: vi.fn(),
    applyCommandsIncremental: vi.fn().mockReturnValue(0),
    refreshAffectedSheets: vi.fn(),
    reloadStateFromSettings: vi.fn(),
}));

vi.mock('../../foundry/module/helpers/sheet-helpers', () => ({
    refreshSheetsByReduxId: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Socket Handler Synchronization', () => {
    let dispatchSpy: any;
    let getStateSpy: any;

    beforeEach(() => {
        dispatchSpy = vi.fn();
        getStateSpy = vi.fn().mockReturnValue({
            playerRoundState: {
                byCharacterId: {
                    'char-1': {
                        state: 'ROLLING',
                        // Initial state has no result or old result
                        rollResult: undefined,
                        outcome: undefined
                    }
                },
                activeCharacterId: 'char-1'
            },
            characters: { byId: {} },
            crews: { byId: {} },
            clocks: { byId: {} }
        });

        // Mock global game object
        (global as any).game = {
            fitgd: {
                store: {
                    dispatch: dispatchSpy,
                    getState: getStateSpy,
                    subscribe: vi.fn()
                },
                syncActivePlayerActionsTracking: vi.fn(),
                foundry: {
                    exportHistory: vi.fn()
                }
            },
            user: { isGM: false },
            actors: { get: vi.fn() }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete (global as any).game;
    });

    it('should dispatch roll result BEFORE state transition', async () => {
        const receivedData = {
            type: 'commandsAdded',
            commands: { characters: [], crews: [], clocks: [], playerRoundState: [] },
            playerRoundState: {
                byCharacterId: {
                    'char-1': {
                        state: 'GM_RESOLVING_CONSEQUENCE',
                        rollResult: [1, 2, 3],
                        dicePool: 3,
                        outcome: 'failure'
                    }
                }
            }
        };

        await receiveCommandsFromSocket(receivedData);

        // Verify dispatch calls
        const calls = dispatchSpy.mock.calls.map((call: any[]) => call[0].type);

        // Find indices
        const rollResultIndex = calls.indexOf('playerRoundState/setRollResult');
        const transitionIndex = calls.indexOf('playerRoundState/forceTransitionState');

        expect(rollResultIndex).not.toBe(-1); // "setRollResult should be dispatched"
        expect(transitionIndex).not.toBe(-1); // "forceTransitionState should be dispatched"
        expect(rollResultIndex).toBeLessThan(transitionIndex); // "setRollResult should precede forceTransitionState"
    });
});
