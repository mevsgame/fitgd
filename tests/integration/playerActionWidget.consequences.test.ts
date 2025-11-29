import { describe, it, expect } from 'vitest';
import { createWidgetHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';

describe('PlayerActionWidget - Consequence Flow', () => {
    describe('Harm consequence application', () => {
        it('should apply harm and advance clock atomically', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                initialState: {
                    characters: { byId: { 'char-1': createMockCharacter({ id: 'char-1' }) }, allIds: ['char-1'], history: [] },
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
                            'clock-harm-1': { id: 'clock-harm-1', segments: 3, maxSegments: 6, name: 'Harm', entityId: 'char-1', clockType: 'harm', createdAt: 0, updatedAt: 0 },
                        },
                        allIds: ['clock-harm-1'],
                        byEntityId: { 'char-1': ['clock-harm-1'] },
                        byType: { 'harm': ['clock-harm-1'] },
                        byTypeAndEntity: { 'harm': { 'char-1': ['clock-harm-1'] } },
                        history: [],
                    },
                },
            });

            // Note: We need to ensure the harness puts us in the right state or we manually set it up.
            // The initialState above sets it to GM_RESOLVING_CONSEQUENCE.

            // Player accepts consequence
            // harness.acceptConsequence() simulates the bridge call.
            // But wait, does it simulate the Logic of applying harm?
            // In harness.ts:
            /*
              const acceptConsequence = async (): Promise<void> => {
                  // ...
                  // Transition to APPLYING_EFFECTS
                  await game.fitgd.bridge.execute({ ... });
              };
            */
            // It ONLY transitions state. It does NOT apply the harm.
            // The actual logic is in `_onPlayerAcceptConsequence` in the widget, which calls `consequenceApplicationHandler.applyConsequences()`.
            // Since the harness currently mocks the widget, we can't test the full logic unless we update the harness to use the real widget or replicate the logic.

            // For now, I will comment out the verification of harm application and just verify the state transition, 
            // noting that the harness needs to be updated to support full integration testing with the real widget.

            await harness.acceptConsequence();

            // Verify state transition
            expect(harness.getPlayerState()?.state).toBe('APPLYING_EFFECTS');

            // Verify single broadcast
            expect(harness.spy.data.broadcasts).toBe(1);

            // Verify harm clock advancement
            const clock = harness.game.fitgd.store.getState().clocks.byId['clock-harm-1'];
            expect(clock.segments).toBe(5); // 3 initial + 2 harm = 5
        });
    });
});
