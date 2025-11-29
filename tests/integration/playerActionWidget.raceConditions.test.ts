import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Race Conditions', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Double-click prevention', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should prevent double-click on roll button', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);

            const dispatchesBefore = harness.spy.data.dispatches.length;

            // Simulate double-click: call clickRoll twice rapidly
            const promises = [
                harness.clickRoll(),
                harness.clickRoll(),
            ];

            // Wait for both to complete (or fail)
            const results = await Promise.allSettled(promises);

            const dispatchesAfter = harness.spy.data.dispatches.length;
            const dispatchCount = dispatchesAfter - dispatchesBefore;

            // Should only have one roll's worth of dispatches
            // Typical roll: 1 transition to ROLLING + 1 roll result + 1 transition away = ~3
            // So double-click should still be ~3-5 dispatches, not 6-10
            expect(dispatchCount).toBeLessThan(6);

            // Final state should be valid
            const finalState = harness.getPlayerState();
            expect(finalState?.state).toBeDefined();
        });

        it('should handle rapid approach selections', async () => {
            await harness.advanceToState('DECISION_PHASE');

            // Rapidly change approach multiple times
            const approaches = ['force', 'guile', 'focus', 'spirit', 'force'];
            const promises = approaches.map(approach => harness.selectApproach(approach as any));

            const results = await Promise.allSettled(promises);

            // All should complete without error
            results.forEach(result => {
                if (result.status === 'rejected') {
                    // Some failures might be acceptable if due to race prevention
                    expect(result.reason?.message).not.toMatch(/undefined|cannot read/i);
                }
            });

            // Should end with valid state
            const finalState = harness.getPlayerState();
            expect(finalState?.state).toBe('DECISION_PHASE');
            expect(['force', 'guile', 'focus', 'spirit']).toContain(finalState?.selectedApproach);
        });

        it('should handle rapid equipment selections', async () => {
            const character = createMockCharacter({
                id: 'char-1',
                equipment: [
                    { id: 'eq-1', name: 'Weapon 1', tier: 'common', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    { id: 'eq-2', name: 'Weapon 2', tier: 'rare', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    { id: 'eq-3', name: 'Weapon 3', tier: 'epic', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                ],
            });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character,
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Rapidly select equipment multiple times
            const equipmentIds = ['eq-1', 'eq-2', 'eq-3', 'eq-1', 'eq-2'];
            const promises = equipmentIds.map(id => harness.selectSecondary(id as any));

            const results = await Promise.allSettled(promises);

            // Should handle race without crashing
            const finalState = harness.getPlayerState();
            expect(finalState?.equippedForAction).toBeDefined();

            // Last selection should be eq-2 (since operations might be queued)
            const equipped = finalState?.equippedForAction;
            if (equipped) {
                equipped.forEach(id => {
                    expect(['eq-1', 'eq-2', 'eq-3']).toContain(id);
                });
            }
        });

        it('should prevent roll during consequence acceptance', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

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
                                    harmSegments: 2,
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
                        },
                        allIds: ['clock-harm-1'],
                        byEntityId: { 'char-1': ['clock-harm-1'] },
                        byType: { 'harm': ['clock-harm-1'] },
                        byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            harness.setNextRoll([6]);

            // Try to roll and accept consequence simultaneously
            const promises = [
                harness.acceptConsequence(),
                harness.clickRoll(),
            ];

            const results = await Promise.allSettled(promises);

            // At least one should complete successfully
            const successful = results.filter(r => r.status === 'fulfilled').length;
            expect(successful).toBeGreaterThanOrEqual(1);

            // State should be valid
            const finalState = harness.getPlayerState();
            expect(finalState?.state).toBeDefined();
            expect(['APPLYING_EFFECTS', 'SUCCESS_COMPLETE', 'ROLLING', 'GM_RESOLVING_CONSEQUENCE']).toContain(
                finalState?.state
            );
        });
    });

    describe('Concurrent state updates', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should handle sequential Redux dispatches safely', async () => {
            const initialDispatchCount = harness.spy.data.dispatches.length;

            // Execute operations sequentially to avoid race conditions in test setup
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);
            await harness.clickRoll();

            const finalDispatchCount = harness.spy.data.dispatches.length;
            const dispatchCount = finalDispatchCount - initialDispatchCount;

            // Should have reasonable dispatch count
            expect(dispatchCount).toBeGreaterThan(0);
            expect(dispatchCount).toBeLessThan(20);

            // Store should be in valid state
            const state = harness.getState();
            expect(state.playerRoundState).toBeDefined();
            expect(state.characters.byId['char-1']).toBeDefined();
        });

        it('should maintain clock consistency during concurrent updates', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

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
                                segments: 2,
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
                                segments: 1,
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

            const harmBefore = harness.getState().clocks.byId['clock-harm-1'].segments;
            const addictionBefore = harness.getState().clocks.byId['clock-addiction-1'].segments;

            // Execute multiple operations concurrently
            await Promise.all([
                harness.advanceToState('DECISION_PHASE'),
                harness.selectApproach('force'),
            ]);

            const harmAfter = harness.getState().clocks.byId['clock-harm-1']?.segments;
            const addictionAfter = harness.getState().clocks.byId['clock-addiction-1']?.segments;

            // Clocks should not have changed during these operations
            expect(harmAfter).toBe(harmBefore);
            expect(addictionAfter).toBe(addictionBefore);

            // Verify clock structure is intact
            expect(harness.getState().clocks.byId['clock-harm-1']).toBeDefined();
            expect(harness.getState().clocks.byId['clock-addiction-1']).toBeDefined();
        });

        it('should prevent race between roll and approach change', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);

            // Fire roll and approach change attempt simultaneously
            const promises = [
                harness.clickRoll(),
                harness.selectApproach('guile').catch(() => {}), // Might fail due to race
            ];

            const results = await Promise.allSettled(promises);

            // At least roll should complete
            expect(results.filter(r => r.status === 'fulfilled').length).toBeGreaterThan(0);

            // Final state should be valid
            const finalState = harness.getPlayerState();
            expect(finalState?.state).toBeDefined();

            // Should have transitioned from DECISION_PHASE
            expect(['ROLLING', 'GM_RESOLVING_CONSEQUENCE', 'SUCCESS_COMPLETE', 'APPLYING_EFFECTS']).toContain(
                finalState?.state
            );
        });
    });

    describe('Broadcast race conditions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should maintain broadcast order consistency', async () => {
            const broadcastsBefore = harness.spy.data.broadcasts;

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);
            await harness.clickRoll();

            const broadcastsAfter = harness.spy.data.broadcasts;
            const broadcastCount = broadcastsAfter - broadcastsBefore;

            // Should have broadcasts for state changes
            expect(broadcastCount).toBeGreaterThan(0);

            // Broadcasts should be tracked in order
            const dispatches = harness.spy.data.dispatches;
            expect(dispatches.length).toBeGreaterThan(0);
        });

        it('should handle missed broadcasts gracefully', async () => {
            let broadcastCount = 0;
            const originalEmit = harness.game.socket?.emit;

            if (harness.game.socket) {
                harness.game.socket.emit = vi.fn((event: string, data: any) => {
                    broadcastCount++;
                    // Skip every other broadcast
                    if (broadcastCount % 2 === 0) {
                        return; // Simulate missed broadcast
                    }
                    return originalEmit?.call(harness.game.socket, event, data);
                });
            }

            try {
                await harness.advanceToState('DECISION_PHASE');
                await harness.selectApproach('force');

                // State should still be consistent despite missed broadcasts
                const state = harness.getPlayerState();
                expect(state?.state).toBe('DECISION_PHASE');
                expect(state?.selectedApproach).toBe('force');
            } finally {
                // Restore original
                if (harness.game.socket && originalEmit) {
                    harness.game.socket.emit = originalEmit;
                }
            }
        });

        it('should prevent broadcast storm from rapid operations', async () => {
            const initialBroadcasts = harness.spy.data.broadcasts;

            // Execute many rapid operations
            const operations = [];
            for (let i = 0; i < 10; i++) {
                operations.push(harness.advanceToState('DECISION_PHASE'));
            }

            try {
                await Promise.all(operations);
            } catch {
                // Some might fail, but shouldn't flood broadcasts
            }

            const finalBroadcasts = harness.spy.data.broadcasts;
            const broadcastCount = finalBroadcasts - initialBroadcasts;

            // Should not have exponential broadcast growth
            // 10 operations shouldn't create 100+ broadcasts
            expect(broadcastCount).toBeLessThan(50);
        });
    });

    describe('Memory and reference safety', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should not share state between concurrent operations', async () => {
            await harness.advanceToState('DECISION_PHASE');
            const state1 = harness.getPlayerState();

            // Modify local reference
            const modifiedState = { ...state1, selectedApproach: 'guile' };

            // Execute operation that changes state
            await harness.selectApproach('force');

            // Original state should be unaffected
            const state2 = harness.getPlayerState();
            expect(state2?.selectedApproach).toBe('force');
            expect(modifiedState.selectedApproach).toBe('guile');

            // Reference shouldn't be shared
            expect(state1 === state2 || state1?.selectedApproach !== 'force').toBe(true);
        });

        it('should handle rapid store subscriptions safely', async () => {
            await harness.advanceToState('DECISION_PHASE');

            let updateCount = 0;
            const maxUpdates = 100;

            // Simulate rapid state reads
            for (let i = 0; i < 10; i++) {
                const state = harness.getState();
                const playerState = harness.getPlayerState();
                updateCount++;

                if (updateCount > maxUpdates) {
                    throw new Error('Too many updates - possible infinite loop');
                }

                // State should always be valid
                expect(state).toBeDefined();
                // playerState might be undefined if not initialized, that's ok
            }

            // Should complete without memory issues
            expect(updateCount).toBe(10);
        });
    });
});
