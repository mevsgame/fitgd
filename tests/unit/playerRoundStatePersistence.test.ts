/**
 * Player Round State Persistence Tests
 *
 * TDD tests for migrating playerRoundState from ephemeral to full Redux state
 * with command history tracking and persistence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import {
    initializePlayerState,
    setActivePlayer,
    setActionPlan,
    setPosition,
    setEffect,
    setGmApproved,
    setImprovements,
    setRollResult,
    transitionState,
    clearAllStates,
    // These will be new exports we need to add:
    // hydratePlayerRoundState,
    // pruneHistory,
} from '../../src/slices/playerRoundStateSlice';

describe('playerRoundStateSlice - Persistence & Command History', () => {
    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        store = configureStore();
    });

    describe('history tracking', () => {
        it('should have an empty history array in initial state', () => {
            const state = store.getState().playerRoundState;

            // This test will fail until we add history: [] to initial state
            expect(state.history).toBeDefined();
            expect(state.history).toEqual([]);
        });

        it('should append command to history when setActivePlayer is dispatched', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));

            const state = store.getState().playerRoundState;

            // Should have at least one command in history
            expect(state.history.length).toBeGreaterThan(0);

            // Last command should be setActivePlayer
            const lastCommand = state.history[state.history.length - 1];
            expect(lastCommand.type).toBe('playerRoundState/setActivePlayer');
            expect(lastCommand.payload).toEqual({ characterId });
            expect(lastCommand.timestamp).toBeDefined();
            expect(lastCommand.commandId).toBeDefined();
        });

        it('should append command to history when setPosition is dispatched (GM action)', () => {
            const characterId = 'char-123';

            // Initialize first
            store.dispatch(setActivePlayer({ characterId }));

            // GM sets position
            store.dispatch(setPosition({ characterId, position: 'desperate' }));

            const state = store.getState().playerRoundState;
            const lastCommand = state.history[state.history.length - 1];

            expect(lastCommand.type).toBe('playerRoundState/setPosition');
            expect(lastCommand.payload.position).toBe('desperate');
        });

        it('should append command to history when setEffect is dispatched (GM action)', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setEffect({ characterId, effect: 'great' }));

            const state = store.getState().playerRoundState;
            const lastCommand = state.history[state.history.length - 1];

            expect(lastCommand.type).toBe('playerRoundState/setEffect');
            expect(lastCommand.payload.effect).toBe('great');
        });

        it('should append command to history when setActionPlan is dispatched (Player action)', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setActionPlan({
                characterId,
                approach: 'force',
                position: 'risky',
                effect: 'standard',
            }));

            const state = store.getState().playerRoundState;
            const lastCommand = state.history[state.history.length - 1];

            expect(lastCommand.type).toBe('playerRoundState/setActionPlan');
            expect(lastCommand.payload.approach).toBe('force');
        });

        it('should append command to history when setRollResult is dispatched (Player action)', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setRollResult({
                characterId,
                dicePool: 3,
                rollResult: [6, 5, 3],
                outcome: 'critical',
            }));

            const state = store.getState().playerRoundState;
            const lastCommand = state.history[state.history.length - 1];

            expect(lastCommand.type).toBe('playerRoundState/setRollResult');
            expect(lastCommand.payload.outcome).toBe('critical');
        });

        it('should track command ownership (userId) for GM vs Player actions', () => {
            const characterId = 'char-123';
            const gmUserId = 'gm-user';
            const playerUserId = 'player-user';

            store.dispatch(setActivePlayer({ characterId }));

            // GM action with userId
            store.dispatch(setPosition({ characterId, position: 'controlled', userId: gmUserId } as any));

            // Player action with userId
            store.dispatch(setActionPlan({
                characterId,
                approach: 'guile',
                position: 'risky',
                effect: 'standard',
                userId: playerUserId,
            } as any));

            const state = store.getState().playerRoundState;

            // Find the setPosition command
            const positionCommand = state.history.find(c => c.type === 'playerRoundState/setPosition');
            expect(positionCommand?.userId).toBe(gmUserId);

            // Find the setActionPlan command
            const actionPlanCommand = state.history.find(c => c.type === 'playerRoundState/setActionPlan');
            expect(actionPlanCommand?.userId).toBe(playerUserId);
        });
    });

    describe('clearAllStates', () => {
        it('should clear history when clearAllStates is dispatched', () => {
            const characterId = 'char-123';

            // Build up some history
            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setPosition({ characterId, position: 'desperate' }));
            store.dispatch(setEffect({ characterId, effect: 'great' }));

            expect(store.getState().playerRoundState.history.length).toBeGreaterThan(0);

            // Clear all states
            store.dispatch(clearAllStates());

            const state = store.getState().playerRoundState;

            expect(state.history).toEqual([]);
            expect(state.byCharacterId).toEqual({});
            expect(state.activeCharacterId).toBeNull();
        });
    });

    describe('hydratePlayerRoundState', () => {
        it('should restore state from snapshot', () => {
            // This tests a new reducer we need to add
            const snapshot = {
                byCharacterId: {
                    'char-123': {
                        characterId: 'char-123',
                        state: 'DECISION_PHASE' as const,
                        position: 'risky' as const,
                        effect: 'standard' as const,
                        selectedApproach: 'force' as const,
                        stateEnteredAt: Date.now(),
                    },
                },
                activeCharacterId: 'char-123',
            };

            // Dispatch hydrate action (this will fail until we implement it)
            store.dispatch({
                type: 'playerRoundState/hydratePlayerRoundState',
                payload: snapshot,
            });

            const state = store.getState().playerRoundState;

            expect(state.byCharacterId['char-123']).toBeDefined();
            expect(state.byCharacterId['char-123'].state).toBe('DECISION_PHASE');
            expect(state.byCharacterId['char-123'].position).toBe('risky');
            expect(state.activeCharacterId).toBe('char-123');
            expect(state.history).toEqual([]); // History cleared on hydrate
        });
    });

    describe('pruneHistory', () => {
        it('should clear history when pruneHistory is dispatched', () => {
            const characterId = 'char-123';

            // Build up history
            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setPosition({ characterId, position: 'desperate' }));
            store.dispatch(setEffect({ characterId, effect: 'great' }));

            expect(store.getState().playerRoundState.history.length).toBeGreaterThan(0);

            // Prune history (this will fail until we implement it)
            store.dispatch({ type: 'playerRoundState/pruneHistory' });

            const state = store.getState().playerRoundState;

            // History should be cleared, but state preserved
            expect(state.history).toEqual([]);
            expect(state.byCharacterId[characterId]).toBeDefined();
            expect(state.byCharacterId[characterId].position).toBe('desperate');
        });
    });

    describe('command structure', () => {
        it('should generate unique commandId for each command', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setPosition({ characterId, position: 'desperate' }));
            store.dispatch(setEffect({ characterId, effect: 'great' }));

            const state = store.getState().playerRoundState;
            const commandIds = state.history.map(c => c.commandId);
            const uniqueIds = new Set(commandIds);

            expect(uniqueIds.size).toBe(commandIds.length);
        });

        it('should include version field in commands', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));

            const state = store.getState().playerRoundState;
            const command = state.history[0];

            expect(command.version).toBe(1);
        });
    });
});

describe('playerRoundStateSlice - Command Ownership Model', () => {
    let store: ReturnType<typeof configureStore>;

    beforeEach(() => {
        store = configureStore();
    });

    describe('Player-owned commands', () => {
        it('setActionPlan should be tracked as Player action', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setActionPlan({
                characterId,
                approach: 'force',
                position: 'risky',
                effect: 'standard',
            }));

            const state = store.getState().playerRoundState;
            const command = state.history.find(c => c.type === 'playerRoundState/setActionPlan');

            expect(command).toBeDefined();
            // Player commands modify: approach, secondaryApproach, rollMode, equippedForAction
            expect(command?.payload.approach).toBeDefined();
        });

        it('setImprovements should be tracked as Player action', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setImprovements({
                characterId,
                pushed: true,
                pushType: 'extra-die',
            }));

            const state = store.getState().playerRoundState;
            const command = state.history.find(c => c.type === 'playerRoundState/setImprovements');

            expect(command).toBeDefined();
        });
    });

    describe('GM-owned commands', () => {
        it('setPosition should be tracked as GM action', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setPosition({ characterId, position: 'desperate' }));

            const state = store.getState().playerRoundState;
            const command = state.history.find(c => c.type === 'playerRoundState/setPosition');

            expect(command).toBeDefined();
        });

        it('setEffect should be tracked as GM action', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setEffect({ characterId, effect: 'great' }));

            const state = store.getState().playerRoundState;
            const command = state.history.find(c => c.type === 'playerRoundState/setEffect');

            expect(command).toBeDefined();
        });

        it('setGmApproved should be tracked as GM action', () => {
            const characterId = 'char-123';

            store.dispatch(setActivePlayer({ characterId }));
            store.dispatch(setGmApproved({ characterId, approved: true }));

            const state = store.getState().playerRoundState;
            const command = state.history.find(c => c.type === 'playerRoundState/setGmApproved');

            expect(command).toBeDefined();
        });
    });
});
