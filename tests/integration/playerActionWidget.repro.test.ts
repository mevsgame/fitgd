import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';

describe('PlayerActionWidget - Full Success Repro', () => {
    let harness: WidgetTestHarness;

    beforeEach(async () => {
        harness = await createWidgetHarness({
            characterId: 'char-repro-1',
            isGM: true,
            character: createMockCharacter({ id: 'char-repro-1', name: 'Repro Character' }),
        });
    });

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    it('should correctly store selected clock ID when selecting a clock during Full Success', async () => {
        // 1. Setup State: SUCCESS_COMPLETE (Full Success)
        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');
        await harness.advanceToState('ROLLING'); // Required transition
        await harness.game.fitgd.bridge.execute({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-repro-1', newState: 'SUCCESS_COMPLETE' }
        });

        // Ensure no transaction exists initially
        const initialState = harness.getPlayerState();
        expect(initialState?.consequenceTransaction).toBeUndefined();

        // 2. Simulate User Picking a Clock via Side Panel (User's workflow)
        const mockClockId = 'clock-progress-user-1';

        // Call the method directly as simulating UI clicks is flaky without full DOM
        // This validates the coordinator logic against the Full Success state
        await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

        // 3. Verify State Update
        const updatedState = harness.getPlayerState();

        // This matches the User's Log: harm, add... BUT IS IT MISSING THE ID?
        // If my fix works, successClockId should be set.
        expect(updatedState?.consequenceTransaction).toBeDefined();
        // User saw "harm" type in logs, let's verify if my fix defaults to "harm" or "crew-clock"
        // My fix sets default to "crew-clock". User log had "harm". 
        // This implies the User MIGHT NOT HAVE MY FIX YET or another codepath triggered it.

        expect(updatedState?.consequenceTransaction?.successClockId).toBe(mockClockId);
    });
});
