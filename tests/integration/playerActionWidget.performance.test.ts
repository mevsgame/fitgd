import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Performance Baselines', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Operation latency', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should transition to DECISION_PHASE in <100ms', async () => {
            const startTime = performance.now();
            await harness.advanceToState('DECISION_PHASE');
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(100);
            expect(harness.getPlayerState()?.state).toBe('DECISION_PHASE');
        });

        it('should select approach in <50ms', async () => {
            await harness.advanceToState('DECISION_PHASE');

            const startTime = performance.now();
            await harness.selectApproach('force');
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(50);
            expect(harness.getPlayerState()?.selectedApproach).toBe('force');
        });

        it('should complete full roll cycle (decision→rolling→result) in <200ms', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);

            const startTime = performance.now();
            await harness.clickRoll();
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(200);

            const finalState = harness.getPlayerState();
            expect(['ROLLING', 'SUCCESS_COMPLETE', 'GM_RESOLVING_CONSEQUENCE', 'APPLYING_EFFECTS']).toContain(
                finalState?.state
            );
        });

        it('should apply consequence in <150ms', async () => {
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
                        activeCharacterId: null,
                    },
                    clocks: {
                        byId: {
                            'clock-harm-1': {
                                id: 'clock-harm-1',
                                segments: 3,
                                maxSegments: 6,
                                subtype: 'Harm',
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

            const startTime = performance.now();
            await harness.acceptConsequence();
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(150);
            expect(harness.getPlayerState()?.state).toBe('TURN_COMPLETE');
        });
    });

    describe('Broadcast efficiency', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should limit broadcasts for single operation', async () => {
            const broadcastsBefore = harness.spy.data.broadcasts;

            await harness.advanceToState('DECISION_PHASE');

            const broadcastsAfter = harness.spy.data.broadcasts;
            const broadcastCount = broadcastsAfter - broadcastsBefore;

            // Single operation should trigger 1-2 broadcasts, not more
            expect(broadcastCount).toBeLessThanOrEqual(2);
        });

        it('should batch broadcasts for multi-step operation', async () => {
            const broadcastsBefore = harness.spy.data.broadcasts;

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);
            await harness.clickRoll();

            const broadcastsAfter = harness.spy.data.broadcasts;
            const broadcastCount = broadcastsAfter - broadcastsBefore;

            // 4 operations with multiple handlers should generate reasonable broadcasts
            // Current batching strategy produces ~5-6 broadcasts
            expect(broadcastCount).toBeLessThanOrEqual(6);
        });

        it('should avoid duplicate broadcasts', async () => {
            const dispatchesBefore = harness.spy.data.dispatches.length;
            const broadcastsBefore = harness.spy.data.broadcasts;

            await harness.advanceToState('DECISION_PHASE');

            const dispatchesAfter = harness.spy.data.dispatches.length;
            const broadcastsAfter = harness.spy.data.broadcasts;

            const dispatchCount = dispatchesAfter - dispatchesBefore;
            const broadcastCount = broadcastsAfter - broadcastsBefore;

            // Broadcasts should be fewer than or equal to dispatches (batching)
            expect(broadcastCount).toBeLessThanOrEqual(dispatchCount);
        });

        it('should broadcast consequence application atomically', async () => {
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
                        activeCharacterId: null,
                    },
                    clocks: {
                        byId: {
                            'clock-harm-1': {
                                id: 'clock-harm-1',
                                segments: 3,
                                maxSegments: 6,
                                subtype: 'Harm',
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

            const broadcastsBefore = harness.spy.data.broadcasts;
            const dispatchesBefore = harness.spy.data.dispatches.length;

            await harness.acceptConsequence();

            const broadcastsAfter = harness.spy.data.broadcasts;
            const dispatchesAfter = harness.spy.data.dispatches.length;

            const broadcastCount = broadcastsAfter - broadcastsBefore;
            const dispatchCount = dispatchesAfter - dispatchesBefore;

            // Should batch all consequence operations into 1 broadcast
            expect(broadcastCount).toBe(1);
            // But may have multiple dispatches (state + clock + momentum)
            expect(dispatchCount).toBeGreaterThan(0);
            expect(dispatchCount).toBeLessThanOrEqual(8);
        });
    });

    describe('State query performance', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should query state in <10ms', async () => {
            const startTime = performance.now();
            const state = harness.getState();
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(10);
            expect(state).toBeDefined();
        });

        it('should query player state in <5ms', async () => {
            await harness.advanceToState('DECISION_PHASE');

            const startTime = performance.now();
            const playerState = harness.getPlayerState();
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(5);
            expect(playerState).toBeDefined();
        });

        it('should query character in <5ms', async () => {
            const startTime = performance.now();
            const character = harness.getCharacter();
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(5);
            expect(character).toBeDefined();
        });

        it('should handle 100 rapid state queries in <50ms total', async () => {
            const startTime = performance.now();

            for (let i = 0; i < 100; i++) {
                harness.getState();
            }

            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(50);
        });
    });

    describe('Memory efficiency', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should maintain reasonable memory footprint during workflow', async () => {
            // Get initial state size (rough estimate via JSON)
            const initialState = JSON.stringify(harness.getState());
            const initialSize = initialState.length;

            // Execute workflow
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // Get final state size
            const finalState = JSON.stringify(harness.getState());
            const finalSize = finalState.length;

            // Memory shouldn't balloon (allows 4x growth for command history logging)
            const growth = finalSize - initialSize;
            expect(growth).toBeLessThan(initialSize * 4);
        });

        it('should not leak dispatch history during operation', async () => {
            const dispatchesBefore = harness.spy.data.dispatches.length;

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);
            await harness.clickRoll();

            const dispatchesAfter = harness.spy.data.dispatches.length;
            const dispatchCount = dispatchesAfter - dispatchesBefore;

            // Should have bounded dispatch count (not growing infinitely)
            expect(dispatchCount).toBeLessThan(50);
        });
    });

    describe('Scale performance', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: Array.from({ length: 20 }, (_, i) => ({
                        id: `eq-${i}`,
                        name: `Equipment ${i}`,
                        tier: ['common', 'rare', 'epic'][i % 3] as any,
                        category: ['active', 'passive', 'consumable'][i % 3] as any,
                        slots: (i % 5) + 1,
                        locked: false,
                        equipped: false,
                        consumed: false,
                        createdAt: 0,
                        updatedAt: 0,
                        description: 'Test equipment',
                        acquiredAt: 0,
                    })),
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should select equipment from large inventory quickly', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            const startTime = performance.now();
            await harness.selectSecondary('eq-15');
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(50);
            expect(harness.getPlayerState()?.equippedForAction).toContain('eq-15');
        });

        it('should handle character with many clocks efficiently', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });
            const clocks: any = {};
            const allIds: string[] = [];
            const byEntityId: any = { 'char-1': [], 'crew-1': [] };
            const byType: any = {};
            const byTypeAndEntity: any = {};

            // Create 15 clocks
            for (let i = 0; i < 15; i++) {
                const clockType = i < 10 ? 'harm' : 'addiction';
                const entityId = i < 10 ? 'char-1' : 'crew-1';
                const clockId = `clock-${clockType}-${i}`;

                clocks[clockId] = {
                    id: clockId,
                    segments: i % 6,
                    maxSegments: clockType === 'harm' ? 6 : 8,
                    name: `${clockType} ${i}`,
                    entityId,
                    clockType,
                    createdAt: 0,
                    updatedAt: 0,
                    metadata: {},
                };

                allIds.push(clockId);
                if (!byEntityId[entityId]) byEntityId[entityId] = [];
                byEntityId[entityId].push(clockId);

                if (!byType[clockType]) byType[clockType] = [];
                byType[clockType].push(clockId);

                const key = `${clockType}:${entityId}`;
                if (!byTypeAndEntity[key]) byTypeAndEntity[key] = [];
                byTypeAndEntity[key].push(clockId);
            }

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: clocks,
                        allIds,
                        byEntityId,
                        byType,
                        byTypeAndEntity,
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            const startTime = performance.now();
            await harness.advanceToState('DECISION_PHASE');
            const elapsed = performance.now() - startTime;

            // Should still be fast even with many clocks
            expect(elapsed).toBeLessThan(100);
            expect(harness.getPlayerState()?.state).toBe('DECISION_PHASE');
        });
    });
});
