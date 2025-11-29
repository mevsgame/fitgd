import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Consequence Flow', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Harm consequence application', () => {
        beforeEach(async () => {
            const character = createMockCharacter({ id: 'char-1' });
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

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
                                metadata: {}
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
        });

        it('should apply harm and advance clock atomically', async () => {
            await harness.acceptConsequence();

            const finalState = harness.getState();

            // Verify state transition
            expect(finalState.playerRoundState.byCharacterId['char-1']?.state).toBe('APPLYING_EFFECTS');

            // Verify harm clock advancement
            const clock = finalState.clocks.byId['clock-harm-1'];
            expect(clock.segments).toBe(5); // 3 initial + 2 harm = 5

            // Verify consequence transaction was cleared
            expect(finalState.playerRoundState.byCharacterId['char-1']?.consequenceTransaction).toBeUndefined();
        });

        it('should cap harm clock at maximum segments', async () => {
            // Set up harm clock that's already near max
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
                                    harmClockId: 'clock-harm-1',
                                    harmSegments: 5, // Large harm value
                                },
                            } as any,
                        },
                        history: [],
                    },
                    clocks: {
                        byId: {
                            'clock-harm-1': {
                                id: 'clock-harm-1',
                                segments: 5,
                                maxSegments: 6,
                                name: 'Harm',
                                entityId: 'char-1',
                                clockType: 'harm',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {}
                            },
                        },
                        allIds: ['clock-harm-1'],
                        byEntityId: { 'char-1': ['clock-harm-1'] },
                        byType: { 'harm': ['clock-harm-1'] },
                        byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'] },
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

            const finalState = harness.getState();
            const clock = finalState.clocks.byId['clock-harm-1'];

            // Should not exceed max (5 + 5 would be 10, but cap is 6)
            expect(clock.segments).toBeLessThanOrEqual(clock.maxSegments);
            expect(clock.segments).toBe(6); // Capped at max
        });

        it('should award momentum when accepting harm consequence', async () => {
            const crewBefore = harness.getState().crews.byId['crew-1'];
            const momentumBefore = crewBefore?.currentMomentum || 0;

            await harness.acceptConsequence();

            const crewAfter = harness.getState().crews.byId['crew-1'];
            const momentumAfter = crewAfter?.currentMomentum || 0;

            // Accepting consequence awards momentum to crew
            expect(momentumAfter).toBeGreaterThan(momentumBefore);
        });

        it('should handle harm overflow (damage more than available segments)', async () => {
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
                                    harmClockId: 'clock-harm-1',
                                    harmSegments: 3, // Segments to add
                                },
                            } as any,
                        },
                        history: [],
                    },
                    clocks: {
                        byId: {
                            'clock-harm-1': {
                                id: 'clock-harm-1',
                                segments: 4,
                                maxSegments: 6,
                                name: 'Harm',
                                entityId: 'char-1',
                                clockType: 'harm',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {}
                            },
                        },
                        allIds: ['clock-harm-1'],
                        byEntityId: { 'char-1': ['clock-harm-1'] },
                        byType: { 'harm': ['clock-harm-1'] },
                        byTypeAndEntity: { 'harm:char-1': ['clock-harm-1'] },
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

            const finalState = harness.getState();
            const clock = finalState.clocks.byId['clock-harm-1'];

            // Should handle overflow by capping at max
            expect(clock.segments).toBeLessThanOrEqual(clock.maxSegments);
            expect(clock.segments).toBe(6); // 4 + 3 = 7, but capped at 6
        });
    });

    describe('Consequence with multiple clocks', () => {
        it('should maintain other clocks when applying harm consequence', async () => {
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
                                segments: 2,
                                maxSegments: 6,
                                name: 'Harm',
                                entityId: 'char-1',
                                clockType: 'harm',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {}
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
                                metadata: {}
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

            const finalState = harness.getState();

            // Harm clock should advance
            expect(finalState.clocks.byId['clock-harm-1'].segments).toBe(4);

            // Addiction clock should remain unchanged
            expect(finalState.clocks.byId['clock-addiction-1'].segments).toBe(1);
        });
    });
});
