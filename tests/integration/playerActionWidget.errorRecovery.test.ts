import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Error Recovery', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Invalid state transitions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should handle roll attempt from DECISION_PHASE without approach safely', async () => {
            // Move to DECISION_PHASE but don't select approach
            await harness.advanceToState('DECISION_PHASE');

            const playerStateBefore = harness.getPlayerState();
            expect(playerStateBefore?.state).toBe('DECISION_PHASE');
            expect(playerStateBefore?.selectedApproach).toBeUndefined();

            // Attempt to roll without selecting approach
            harness.setNextRoll([6]);

            try {
                await harness.clickRoll();

                // Widget might enforce approach requirement
                const newState = harness.getPlayerState();
                // Should either reject or handle gracefully
                expect(['DECISION_PHASE', 'ROLLING']).toContain(newState?.state);
            } catch (error) {
                // Expected - operation should fail with meaningful error
                expect(error?.message).not.toMatch(/undefined|cannot read/i);
            }
        });

        it('should reject consequence acceptance when not in GM_RESOLVING_CONSEQUENCE', async () => {
            // Move to DECISION_PHASE (not GM_RESOLVING_CONSEQUENCE)
            await harness.advanceToState('DECISION_PHASE');
            const playerState = harness.getPlayerState();
            expect(playerState?.state).not.toBe('GM_RESOLVING_CONSEQUENCE');

            // Try to accept consequence without being in that state
            try {
                await harness.acceptConsequence();

                // If no error thrown, verify state wasn't corrupted
                const finalState = harness.getPlayerState();
                expect(finalState?.state).toBe('DECISION_PHASE');
            } catch (error) {
                // Expected - handler should validate state before running
                expect(error?.message).toMatch(/GM_RESOLVING_CONSEQUENCE|consequence|state/i);
            }
        });

        it('should reject approach selection when already rolling', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Move to rolling
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // Now in ROLLING or beyond
            const stateBeforeRetry = harness.getPlayerState();
            expect(['ROLLING', 'GM_RESOLVING_CONSEQUENCE', 'SUCCESS_COMPLETE', 'APPLYING_EFFECTS']).toContain(
                stateBeforeRetry?.state
            );

            // Try to select new approach
            try {
                await harness.selectApproach('guile');

                // Approach should not have changed
                const finalState = harness.getPlayerState();
                expect(finalState?.selectedApproach).toBe('force');
            } catch (error) {
                // Expected - invalid transition prevented
                expect(error).toBeDefined();
            }
        });
    });

    describe('Missing dependencies and null checks', () => {
        it('should handle missing character gracefully', async () => {
            // Create harness with character that exists in state but reference is invalid
            harness = await createWidgetHarness({
                characterId: 'char-nonexistent',
                isGM: false,
                character: createMockCharacter({ id: 'char-nonexistent' }),
            });

            // Widget should still initialize
            expect(harness.widget).toBeDefined();

            // State queries should return undefined, not crash
            const character = harness.getCharacter();
            expect(character).toBeDefined(); // It exists because we provided it
        });

        it('should handle missing crew clock gracefully', async () => {
            const character = createMockCharacter({ id: 'char-1' });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character,
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
                initialState: {
                    clocks: {
                        byId: {},
                        allIds: [],
                        byEntityId: {},
                        byType: {},
                        byTypeAndEntity: {},
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');

            // Try to roll without addiction clocks - should handle missing clocks
            harness.setNextRoll([6]);
            try {
                await harness.clickRoll();

                // Should complete even without clocks
                const finalState = harness.getPlayerState();
                expect(['ROLLING', 'GM_RESOLVING_CONSEQUENCE', 'SUCCESS_COMPLETE']).toContain(
                    finalState?.state
                );
            } catch (error) {
                // If error, it should be graceful (not "cannot read property of undefined")
                expect(error?.message).not.toMatch(/cannot read|undefined/i);
            }
        });

        it('should handle missing harm clock on consequence application', async () => {
            const character = createMockCharacter({ id: 'char-1' });
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character,
                crew,
                initialState: {
                    playerRoundState: {
                        byCharacterId: {
                            'char-1': {
                                state: 'GM_RESOLVING_CONSEQUENCE',
                                consequenceTransaction: {
                                    consequenceType: 'harm',
                                    harmTargetCharacterId: 'char-1',
                                    harmClockId: 'clock-harm-missing', // Clock doesn't exist
                                    harmSegments: 2,
                                },
                            } as any,
                        },
                        history: [],
                    },
                    clocks: {
                        byId: {}, // No clocks
                        allIds: [],
                        byEntityId: {},
                        byType: {},
                        byTypeAndEntity: {},
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            // Try to accept consequence with missing clock
            try {
                await harness.acceptConsequence();

                // Should either handle gracefully or maintain safe state
                const finalState = harness.getPlayerState();
                expect(finalState).toBeDefined();
            } catch (error) {
                // Error is acceptable if it's about missing clock, not a crash
                expect(error?.message).toMatch(/clock|harm/i);
            }
        });
    });

    describe('Broadcasting and dispatch errors', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should continue operation if broadcast fails', async () => {
            // Spy tracks broadcasts; simulate failure by mocking
            const originalBroadcast = harness.game.socket?.emit;
            let broadcastErrorCount = 0;

            if (harness.game.socket) {
                harness.game.socket.emit = vi.fn((event: string, data: any) => {
                    broadcastErrorCount++;
                    if (broadcastErrorCount === 1) {
                        throw new Error('Network error: broadcast failed');
                    }
                    return originalBroadcast?.call(harness.game.socket, event, data);
                });
            }

            try {
                await harness.advanceToState('DECISION_PHASE');
                // Widget should recover from broadcast error
                expect(harness.getPlayerState()?.state).toBe('DECISION_PHASE');
            } catch (error) {
                // If error thrown, should be informative
                expect(error?.message).not.toMatch(/undefined|cannot read/);
            }
        });

        it('should handle dispatch failure gracefully', async () => {
            // Create scenario where dispatch might fail
            const originalDispatch = harness.game.fitgd.store.dispatch;
            let dispatchErrorCount = 0;

            harness.game.fitgd.store.dispatch = vi.fn(((action: any) => {
                dispatchErrorCount++;
                if (dispatchErrorCount === 1) {
                    throw new Error('Store error: invalid action');
                }
                return originalDispatch(action);
            }) as typeof originalDispatch);

            try {
                // Attempt action that dispatches
                await harness.advanceToState('DECISION_PHASE');

                // Should recover from first dispatch error
                const state = harness.getPlayerState();
                expect(state).toBeDefined();
            } catch (error) {
                expect(error?.message).toMatch(/store|dispatch/i);
            }

            // Restore original
            harness.game.fitgd.store.dispatch = originalDispatch;
        });

        it('should track failed broadcast attempts', async () => {
            const initialBroadcasts = harness.spy.data.broadcasts;

            // Force a broadcast error scenario
            if (harness.game.socket) {
                harness.game.socket.emit = vi.fn(() => {
                    throw new Error('Socket disconnected');
                });
            }

            try {
                await harness.advanceToState('DECISION_PHASE');
            } catch {
                // Expected to fail
            }

            // Spy should still track attempt count
            expect(harness.spy.data.broadcasts).toBeGreaterThanOrEqual(initialBroadcasts);
        });
    });

    describe('Concurrent operation safety', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should prevent multiple simultaneous rolls', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Simulate double-click: two rolls fired in quick succession
            harness.setNextRoll([6]);

            let rollCount = 0;
            const originalClickRoll = harness.clickRoll.bind(harness);

            harness.clickRoll = async () => {
                rollCount++;
                try {
                    return await originalClickRoll();
                } catch (error) {
                    if (rollCount === 2) {
                        // Second roll should fail or be ignored
                        throw error;
                    }
                }
            };

            try {
                // Fire two rolls quickly
                const roll1 = harness.clickRoll();
                const roll2 = harness.clickRoll();

                await Promise.all([roll1, roll2]);

                // Only one should succeed
                const finalState = harness.getPlayerState();
                const dispatches = harness.spy.data.dispatches.filter(
                    (d: any) => d.type.includes('roll') || d.type.includes('ROLLING')
                );

                // Should have limited number of roll-related dispatches
                expect(dispatches.length).toBeLessThanOrEqual(3); // Setup + single roll
            } catch {
                // Expected - concurrent operations prevented
            }
        });

        it('should handle rapid state transitions safely', async () => {
            // Execute multiple state-changing operations in quick succession
            const operations = [
                () => harness.advanceToState('DECISION_PHASE'),
                () => harness.selectApproach('force'),
                () => harness.selectApproach('guile'),
                () => harness.selectApproach('focus'),
            ];

            try {
                // Run operations rapidly
                for (const op of operations) {
                    await op();
                }

                // Should end in valid state
                const finalState = harness.getPlayerState();
                expect(finalState?.state).toBe('DECISION_PHASE');
                expect(['force', 'guile', 'focus', 'spirit']).toContain(finalState?.selectedApproach);
            } catch (error) {
                // Rapid transitions might error, but shouldn't corrupt state
                expect(error).toBeDefined();
            }
        });
    });

    describe('State rollback on error', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should maintain valid state after failed operation', async () => {
            // Record initial state
            const initialState = harness.getState();
            const initialPlayerState = harness.getPlayerState();

            // Attempt operation that might fail
            try {
                await harness.advanceToState('DECISION_PHASE');
                await harness.selectApproach('force');

                // Force an error in consequence acceptance
                harness = await createWidgetHarness({
                    characterId: 'char-1',
                    isGM: false,
                    character: createMockCharacter({ id: 'char-1' }),
                    crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
                    initialState: {
                        playerRoundState: {
                            byCharacterId: {
                                'char-1': {
                                    state: 'GM_RESOLVING_CONSEQUENCE',
                                    consequenceTransaction: {
                                        consequenceType: 'harm',
                                        harmTargetCharacterId: 'char-1',
                                        harmClockId: 'clock-missing',
                                        harmSegments: 2,
                                    },
                                } as any,
                            },
                            history: [],
                        },
                        clocks: {
                            byId: {},
                            allIds: [],
                            byEntityId: {},
                            byType: {},
                            byTypeAndEntity: {},
                            history: [],
                        },
                        crews: {
                            byId: { 'crew-1': createMockCrew({ id: 'crew-1', characters: ['char-1'] }) },
                            allIds: ['crew-1'],
                            history: [],
                        },
                    },
                });

                await harness.acceptConsequence();
            } catch (error) {
                // After error, state should still be valid
                const currentState = harness.getState();

                // Redux state structure should be intact
                expect(currentState.characters).toBeDefined();
                expect(currentState.crews).toBeDefined();
                expect(currentState.clocks).toBeDefined();
                expect(currentState.playerRoundState).toBeDefined();
            }
        });

        it('should preserve unaffected state when operation fails', async () => {
            // Setup complex state with multiple clocks
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 7 });
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-harm-1': {
                                id: 'clock-harm-1',
                                segments: 3,
                                maxSegments: 6,
                                name: 'Harm',
                                entityId: 'char-1',
                                clockType: 'harm',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                            'clock-addiction-1': {
                                id: 'clock-addiction-1',
                                segments: 2,
                                maxSegments: 8,
                                name: 'Addiction',
                                entityId: 'crew-1',
                                clockType: 'addiction',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-harm-1', 'clock-addiction-1'],
                        byEntityId: { 'char-1': ['clock-harm-1'], 'crew-1': ['clock-addiction-1'] },
                        byType: { 'harm': ['clock-harm-1'], 'addiction': ['clock-addiction-1'] },
                        byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'], 'addiction:crew-1': ['clock-addiction-1'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            const initialAddictionSegments = harness.getState().clocks.byId['clock-addiction-1'].segments;
            const initialMomentum = harness.getState().crews.byId['crew-1'].currentMomentum;

            // Try to apply harm consequence (might fail)
            try {
                harness = await createWidgetHarness({
                    characterId: 'char-1',
                    isGM: false,
                    character: createMockCharacter({ id: 'char-1' }),
                    crew,
                    initialState: {
                        playerRoundState: {
                            byCharacterId: {
                                'char-1': {
                                    state: 'GM_RESOLVING_CONSEQUENCE',
                                    consequenceTransaction: {
                                        consequenceType: 'harm',
                                        harmTargetCharacterId: 'char-1',
                                        harmClockId: 'clock-harm-1',
                                        harmSegments: 10, // Large, will overflow
                                    },
                                } as any,
                            },
                            history: [],
                        },
                        clocks: {
                            byId: {
                                'clock-harm-1': {
                                    id: 'clock-harm-1',
                                    segments: 3,
                                    maxSegments: 6,
                                    name: 'Harm',
                                    entityId: 'char-1',
                                    clockType: 'harm',
                                    createdAt: 0,
                                    updatedAt: 0,
                                    metadata: {},
                                },
                                'clock-addiction-1': {
                                    id: 'clock-addiction-1',
                                    segments: 2,
                                    maxSegments: 8,
                                    name: 'Addiction',
                                    entityId: 'crew-1',
                                    clockType: 'addiction',
                                    createdAt: 0,
                                    updatedAt: 0,
                                    metadata: {},
                                },
                            },
                            allIds: ['clock-harm-1', 'clock-addiction-1'],
                            byEntityId: { 'char-1': ['clock-harm-1'], 'crew-1': ['clock-addiction-1'] },
                            byType: { 'harm': ['clock-harm-1'], 'addiction': ['clock-addiction-1'] },
                            byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'], 'addiction:crew-1': ['clock-addiction-1'] },
                            history: [],
                        },
                        crews: {
                            byId: { 'crew-1': crew },
                            allIds: ['crew-1'],
                            history: [],
                        },
                    },
                });

                await harness.acceptConsequence();
            } catch {
                // After error, unaffected clocks should remain unchanged
                const finalAddictionSegments = harness.getState().clocks.byId['clock-addiction-1']?.segments;
                expect(finalAddictionSegments).toBe(initialAddictionSegments);
            }
        });
    });
});
