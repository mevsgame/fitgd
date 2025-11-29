import { describe, it, expect } from 'vitest';
import { createWidgetHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';

describe('PlayerActionWidget - State Machine', () => {
    describe('DECISION_PHASE → ROLLING → GM_RESOLVING_CONSEQUENCE', () => {
        it('should transition through states on failed roll', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                initialState: {
                    characters: { byId: { 'char-1': createMockCharacter({ id: 'char-1' }) }, allIds: ['char-1'], history: [] },
                },
            });

            // Initialize state
            await harness.advanceToState('DECISION_PHASE');
            harness.spy.reset();

            // Set up roll to return failure
            harness.setNextRoll([3]);

            // Step 1: Select approach
            await harness.selectApproach('force');
            expect(harness.getPlayerState()?.selectedApproach).toBe('force');
            expect(harness.spy.data.broadcasts).toBe(1);

            // Step 2: Click roll button
            await harness.clickRoll();

            // Verify state transition
            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');
            expect(harness.getPlayerState()?.rollResult).toEqual([3]);
            expect(harness.getPlayerState()?.outcome).toBe('failure');

            // Verify broadcasts (Transition to ROLLING + Set Result + Transition to GM_RESOLVING)
            // Note: clickRoll does execute (ROLLING) then executeBatch (Result + GM_RESOLVING)
            // So expected broadcasts: 1 (ROLLING) + 1 (Batch) = 2
            expect(harness.spy.data.broadcasts).toBe(3); // 1 (Approach) + 1 (ROLLING) + 1 (Batch)

            // Verify notifications
            expect(harness.mocks.notifications.info).not.toHaveBeenCalled();
            expect(harness.mocks.notifications.error).not.toHaveBeenCalled();
        });
    });

    describe('Invalid state transitions', () => {
        it('should not allow GM_RESOLVING_CONSEQUENCE → TURN_COMPLETE directly', async () => {
            const harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                initialState: {
                    characters: { byId: { 'char-1': createMockCharacter({ id: 'char-1' }) }, allIds: ['char-1'], history: [] },
                },
            });

            // First initialize the player state and advance to GM_RESOLVING_CONSEQUENCE
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure roll
            await harness.clickRoll(); // This will transition to GM_RESOLVING_CONSEQUENCE

            // Attempt invalid transition directly to TURN_COMPLETE (should fail)
            await expect(async () => {
                await harness.game.fitgd.bridge.execute({
                    type: 'playerRoundState/transitionState',
                    payload: { characterId: 'char-1', newState: 'TURN_COMPLETE' },
                });
            }).rejects.toThrow('Invalid state transition');
        });
    });
});
