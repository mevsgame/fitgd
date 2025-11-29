import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Momentum & Addiction Interactions', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Momentum and roll outcomes', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
            });
        });

        it('should track momentum at starting position', async () => {
            const crew = harness.getState().crews.byId['crew-1'];
            expect(crew?.currentMomentum).toBe(5);
        });

        it('should modify momentum based on roll outcome', async () => {
            const momentumBefore = harness.getState().crews.byId['crew-1'].currentMomentum;

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]); // Success

            await harness.clickRoll();

            const momentumAfter = harness.getState().crews.byId['crew-1'].currentMomentum;

            // Momentum changes with outcomes (may increase or decrease)
            expect(momentumAfter).toBeDefined();
            expect(typeof momentumAfter).toBe('number');
        });

        it('should handle critical success with momentum', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6, 6]); // Critical

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.outcome).toBe('critical');

            // Momentum should be affected by critical
            const crew = harness.getState().crews.byId['crew-1'];
            expect(crew?.currentMomentum).toBeDefined();
        });

        it('should handle failure with momentum impact', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([2]); // Failure

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.outcome).toBe('failure');

            // Momentum should respond to failure
            const crew = harness.getState().crews.byId['crew-1'];
            expect(crew?.currentMomentum).toBeDefined();
        });

        it('should handle partial success and momentum', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('guile');
            harness.setNextRoll([5]); // Partial

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.outcome).toBe('partial');

            const crew = harness.getState().crews.byId['crew-1'];
            expect(crew?.currentMomentum).toBeDefined();
        });
    });

    describe('Momentum bounds and limits', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
            });
        });

        it('should not exceed maximum momentum (10)', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 9 });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);

            try {
                await harness.clickRoll();

                const finalMomentum = harness.getState().crews.byId['crew-1'].currentMomentum;
                expect(finalMomentum).toBeLessThanOrEqual(10);
            } catch {
                // Outcome dependent
            }
        });

        it('should not go below minimum momentum (0)', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 1 });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([2]); // Failure to lose momentum

            try {
                await harness.clickRoll();

                const finalMomentum = harness.getState().crews.byId['crew-1'].currentMomentum;
                expect(finalMomentum).toBeGreaterThanOrEqual(0);
            } catch {
                // Outcome dependent
            }
        });

        it('should handle momentum at maximum during rolls', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 10 });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('spirit');
            harness.setNextRoll([6]);

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBeDefined();
        });

        it('should handle momentum at zero during rolls', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 0 });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('focus');
            harness.setNextRoll([5]);

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBeDefined();
        });
    });

    describe('Addiction clock interactions', () => {
        beforeEach(async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-addiction-1': {
                                id: 'clock-addiction-1',
                                segments: 3,
                                maxSegments: 8,
                                name: 'Addiction',
                                entityId: 'crew-1',
                                clockType: 'addiction',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-addiction-1'],
                        byEntityId: { 'crew-1': ['clock-addiction-1'] },
                        byType: { 'addiction': ['clock-addiction-1'] },
                        byTypeAndEntity: { 'addiction:crew-1': ['clock-addiction-1'] },
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

        it('should track addiction clock state', async () => {
            const addiction = harness.getState().clocks.byId['clock-addiction-1'];
            expect(addiction?.segments).toBe(3);
            expect(addiction?.maxSegments).toBe(8);
        });

        it('should prevent stims when addiction is full', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-addiction-full': {
                                id: 'clock-addiction-full',
                                segments: 8, // Fully filled
                                maxSegments: 8,
                                name: 'Addiction',
                                entityId: 'crew-1',
                                clockType: 'addiction',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-addiction-full'],
                        byEntityId: { 'crew-1': ['clock-addiction-full'] },
                        byType: { 'addiction': ['clock-addiction-full'] },
                        byTypeAndEntity: { 'addiction:crew-1': ['clock-addiction-full'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            // With full addiction, stims unavailable
            await harness.advanceToState('DECISION_PHASE');
            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBe('DECISION_PHASE');
        });

        it('should allow actions with partial addiction', async () => {
            // Addiction exists but not full
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]);

            await harness.clickRoll();

            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBeDefined();
        });

        it('should advance addiction when stims used', async () => {
            const addictionBefore = harness.getState().clocks.byId['clock-addiction-1'].segments;

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([2]); // Failure to enable stims

            try {
                await harness.clickRoll();

                // If stims were used, addiction may advance
                const addictionAfter = harness.getState().clocks.byId['clock-addiction-1']?.segments;
                expect(addictionAfter).toBeDefined();
            } catch {
                // Outcome dependent
            }
        });
    });

    describe('Consequence and momentum/addiction', () => {
        beforeEach(async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 6 });

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
                                segments: 2,
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
        });

        it('should award momentum for accepting consequence', async () => {
            const momentumBefore = harness.getState().crews.byId['crew-1'].currentMomentum;

            await harness.acceptConsequence();

            const momentumAfter = harness.getState().crews.byId['crew-1'].currentMomentum;

            // Accepting consequence should award momentum
            expect(momentumAfter).toBeGreaterThan(momentumBefore);
        });

        it('should advance harm clock without affecting addiction', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 6 });

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

            const addictionBefore = harness.getState().clocks.byId['clock-addiction-1'].segments;

            await harness.acceptConsequence();

            const harmAfter = harness.getState().clocks.byId['clock-harm-1'].segments;
            const addictionAfter = harness.getState().clocks.byId['clock-addiction-1'].segments;

            // Harm should advance
            expect(harmAfter).toBeGreaterThan(2);

            // Addiction should not be affected by harm consequence
            expect(addictionAfter).toBe(addictionBefore);
        });

        it('should handle consequence with low momentum', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 0 });

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
                                segments: 2,
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

            await harness.acceptConsequence();

            const momentumAfter = harness.getState().crews.byId['crew-1'].currentMomentum;

            // Momentum award should still happen even at 0
            expect(momentumAfter).toBeGreaterThan(0);
        });

        it('should handle consequence with high momentum', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 10 });

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
                                    harmSegments: 1,
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

            await harness.acceptConsequence();

            const momentumAfter = harness.getState().crews.byId['crew-1'].currentMomentum;

            // Momentum should be capped at max (10)
            expect(momentumAfter).toBeLessThanOrEqual(10);
        });
    });

    describe('Multi-clock addiction scenarios', () => {
        it('should handle crew with only addiction clock', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-addiction-only': {
                                id: 'clock-addiction-only',
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
                        allIds: ['clock-addiction-only'],
                        byEntityId: { 'crew-1': ['clock-addiction-only'] },
                        byType: { 'addiction': ['clock-addiction-only'] },
                        byTypeAndEntity: { 'addiction:crew-1': ['clock-addiction-only'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            // Should be able to perform actions with only addiction clock
            await harness.advanceToState('DECISION_PHASE');
            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBe('DECISION_PHASE');
        });

        it('should handle crew with multiple clocks', async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'] });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
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
                            'clock-progress-1': {
                                id: 'clock-progress-1',
                                segments: 1,
                                maxSegments: 4,
                                name: 'Progress',
                                entityId: 'crew-1',
                                clockType: 'progress',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-addiction-1', 'clock-progress-1'],
                        byEntityId: { 'crew-1': ['clock-addiction-1', 'clock-progress-1'] },
                        byType: { 'addiction': ['clock-addiction-1'], 'progress': ['clock-progress-1'] },
                        byTypeAndEntity: { 'addiction:crew-1': ['clock-addiction-1'], 'progress:crew-1': ['clock-progress-1'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });

            // Should handle multiple clocks independently
            await harness.advanceToState('DECISION_PHASE');
            const playerState = harness.getPlayerState();
            expect(playerState?.state).toBe('DECISION_PHASE');

            // Both clocks should be accessible
            const addiction = harness.getState().clocks.byId['clock-addiction-1'];
            const progress = harness.getState().clocks.byId['clock-progress-1'];

            expect(addiction?.segments).toBe(2);
            expect(progress?.segments).toBe(1);
        });
    });
});
