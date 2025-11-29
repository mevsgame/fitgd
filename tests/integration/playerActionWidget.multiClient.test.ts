import { describe, it, expect } from 'vitest';
import { createWidgetHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';

describe('PlayerActionWidget - Multi-Client Synchronization', () => {
    describe('Broadcast Verification', () => {
        it('should broadcast Position changes for multi-client sync', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                initialState: {
                    characters: {
                        byId: { 'char-1': createMockCharacter({ id: 'char-1' }) },
                        allIds: ['char-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            harness.spy.reset();

            // GM changes Position
            await harness.setPosition('desperate');

            // Verify Position was set
            expect(harness.getPlayerState()?.position).toBe('desperate');

            // Verify broadcast occurred (would notify other clients)
            expect(harness.spy.data.broadcasts).toBe(1);

            // TODO: Verify the affected Redux ID includes the character
            // Note: affectedIds tracking may not be fully implemented in BridgeSpy
            // expect(harness.spy.data.affectedIds).toContain('char-1');
        });

        it('should broadcast Effect changes for multi-client sync', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                initialState: {
                    characters: {
                        byId: { 'char-1': createMockCharacter({ id: 'char-1' }) },
                        allIds: ['char-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            harness.spy.reset();

            // GM changes Effect
            await harness.setEffect('great');

            // Verify Effect was set
            expect(harness.getPlayerState()?.effect).toBe('great');

            // Verify broadcast occurred
            expect(harness.spy.data.broadcasts).toBe(1);
        });

        it('should broadcast passive equipment approval for multi-client sync', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                initialState: {
                    characters: {
                        byId: {
                            'char-1': createMockCharacter({
                                id: 'char-1',
                                equipment: [
                                    {
                                        id: 'passive-1',
                                        name: 'Power Armor',
                                        category: 'passive',
                                        tier: 'epic',
                                        slots: 2,
                                        description: 'Heavy armor',
                                        equipped: true,
                                        locked: false,
                                        consumed: false,
                                        acquiredAt: 0
                                    },
                                ],
                            }),
                        },
                        allIds: ['char-1'],
                        history: [],
                    },
                },
            });

            await harness.advanceToState('DECISION_PHASE');
            harness.spy.reset();

            // GM approves passive equipment
            await harness.approvePassive('passive-1');

            // Verify approval was set
            expect(harness.getPlayerState()?.approvedPassiveId).toBe('passive-1');

            // Verify broadcast occurred (Player would see this update)
            expect(harness.spy.data.broadcasts).toBe(1);
        });
    });

    describe('State Synchronization Patterns', () => {
        it('should maintain consistent state across roll workflow', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                initialState: {
                    characters: {
                        byId: { 'char-1': createMockCharacter({ id: 'char-1' }) },
                        allIds: ['char-1'],
                        history: [],
                    },
                },
            });

            // Player workflow
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            harness.spy.reset();
            harness.setNextRoll([3]); // Failure
            await harness.clickRoll();

            // Verify state transition was broadcast
            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');
            expect(harness.spy.data.broadcasts).toBeGreaterThan(0);

            // Verify roll result is in state (GM would see this)
            expect(harness.getPlayerState()?.rollResult).toEqual([3]);
            expect(harness.getPlayerState()?.outcome).toBe('failure');
        });
    });
});

