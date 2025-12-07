import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';

describe('PlayerActionWidget - Success Phase Close Button', () => {
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

    it('should transition to TURN_COMPLETE when Close handler is called in SUCCESS_COMPLETE phase (Critical Success)', async () => {
        // 1. Setup State: SUCCESS_COMPLETE (Critical)
        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');
        harness.setNextRoll([6, 6, 5]); // Critical
        await harness.clickRoll();

        expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');
        expect(harness.getPlayerState()?.outcome).toBe('critical');

        // Spy on widget close
        harness.widget.close = vi.fn();

        // 2. Call handler directly
        // Cast to any to access private property for testing
        await (harness.widget as any).coordinator.handleAcceptSuccessClock();

        // 3. Verify Actions
        await new Promise(resolve => setTimeout(resolve, 50));

        // CHECK 1: State transition
        const transitionAction = harness.spy.data.dispatches.find(
            (a: any) => a.type === 'playerRoundState/transitionState' && a.payload.newState === 'TURN_COMPLETE'
        );
        expect(transitionAction).toBeDefined(); // Failing point expecting undefined currently

        // CHECK 2: Widget closed
        expect(harness.widget.close).toHaveBeenCalled();
    });

    it('should transition to TURN_COMPLETE when Close handler is called in SUCCESS_COMPLETE phase (Full Success)', async () => {
        // 1. Setup State: SUCCESS_COMPLETE (Full Success)
        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');
        harness.setNextRoll([6, 4, 2]); // Full Success
        await harness.clickRoll();

        expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');

        harness.widget.close = vi.fn();

        // 2. Call handler
        await (harness.widget as any).coordinator.handleAcceptSuccessClock();

        // 3. Verify Actions
        await new Promise(resolve => setTimeout(resolve, 50));

        const transitionAction = harness.spy.data.dispatches.find(
            (a: any) => a.type === 'playerRoundState/transitionState' && a.payload.newState === 'TURN_COMPLETE'
        );
        expect(transitionAction).toBeDefined();
        expect(harness.widget.close).toHaveBeenCalled();
    });
});
