import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';
import { BridgeSpy } from '../mocks/bridgeSpy';

describe('PlayerActionWidget - Auto Close on TURN_COMPLETE', () => {
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

    it('should automatically close the widget when state becomes TURN_COMPLETE via Redux update', async () => {
        // 1. Setup State: DECISION -> ROLLING -> SUCCESS_COMPLETE
        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');
        await harness.game.fitgd.bridge.execute({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'ROLLING' }
        });
        await harness.game.fitgd.bridge.execute({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
        });

        // Ensure widget is open and rendered (calling _render to trigger subscription setup)
        await (harness.widget as any)._render(true, {});
        harness.widget.close = vi.fn();

        // 2. Simulate external state change to TURN_COMPLETE
        await harness.game.fitgd.bridge.execute({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'TURN_COMPLETE' }
        });

        // 3. Verify widget.close() was called
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(harness.widget.close).toHaveBeenCalled();
    });
});
