import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Consequence Flow', () => {
    let harness: WidgetTestHarness;

    describe('Harm consequence application', () => {
        beforeEach(async () => {
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
                },
            });
        });

        afterEach(() => {
            harness.cleanup();
        });

        it('should apply harm and advance clock atomically', async () => {
            // Player accepts consequence
            await harness.acceptConsequence();

            // Get final state
            const finalState = harness.getState();

            // Verify state transition
            expect(finalState.playerRoundState.byCharacterId['char-1']?.state).toBe('APPLYING_EFFECTS');

            // Verify harm clock advancement - THIS IS THE CRITICAL CHECK
            const clock = finalState.clocks.byId['clock-harm-1'];
            expect(clock.segments).toBe(5); // 3 initial + 2 harm = 5

            // Verify consequence transaction was cleared
            expect(finalState.playerRoundState.byCharacterId['char-1']?.consequenceTransaction).toBeUndefined();
        });
    });
});
