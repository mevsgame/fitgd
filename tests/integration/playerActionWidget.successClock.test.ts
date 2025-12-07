import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';
import { game } from '../mocks/foundryApi';

describe('PlayerActionWidget - Success Clock Selection', () => {
    let harness: WidgetTestHarness;

    beforeEach(async () => {
        harness = await createWidgetHarness({
            characterId: 'char-1',
            isGM: true,
            character: createMockCharacter({ id: 'char-1', name: 'Test Character' }),
        });
    });

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    it('should correctly store selected clock ID when selecting a clock during Critical Success (No pre-existing transaction)', async () => {
        // 1. Setup State: SUCCESS_COMPLETE (Critical)
        // Critical success normally skips GM_RESOLVING_CONSEQUENCE, so no transaction is created.
        await harness.advanceToState('DECISION_PHASE');
        await harness.advanceToState('ROLLING');
        await harness.game.fitgd.bridge.execute({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
        });

        // Ensure no transaction exists initially (standard behavior for Critical)
        const initialState = harness.getPlayerState();
        expect(initialState?.consequenceTransaction).toBeUndefined();

        // 2. Simulate User Picking a Clock via Side Panel
        // This invokes coordinator.handleSidePanelClockSelect('success', clockId)
        const mockClockId = 'test-clock-123';

        // We call the method directly to test the coordinator logic
        // (Simulating the side panel click)
        await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

        // 3. Verify State Update
        // We expect a consequenceTransaction to be created/updated with the successClockId
        const updatedState = harness.getPlayerState();

        expect(updatedState?.consequenceTransaction).toBeDefined();
        expect(updatedState?.consequenceTransaction?.successClockId).toBe(mockClockId);
    });
});
