import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';

/**
 * Test Suite: Success Clock Segment Calculation
 * 
 * Verifies that success clock segments are calculated correctly according to rules_primer.md:
 * - Limited = 1 segment
 * - Standard = 2 segments
 * - Great = 4 segments
 * - Spectacular = 6 segments
 * 
 * Bug Report: User observed clock increasing by incorrect number of segments.
 * Root Cause: playerActionEventCoordinator.ts had hardcoded effectSegments with wrong values.
 */
describe('PlayerActionWidget - Success Clock Segment Calculation', () => {
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

    describe('Config Verification', () => {
        it('should have correct successSegments values in gameConfig matching rules_primer.md', () => {
            // Verify gameConfig.ts matches rules_primer.md line 205
            expect(DEFAULT_CONFIG.resolution.successSegments.limited).toBe(1);
            expect(DEFAULT_CONFIG.resolution.successSegments.standard).toBe(2);
            expect(DEFAULT_CONFIG.resolution.successSegments.great).toBe(4);
            expect(DEFAULT_CONFIG.resolution.successSegments.spectacular).toBe(6);
        });
    });

    describe('Side Panel Clock Selection - Segment Calculation', () => {
        it('should calculate 3 segments for Standard effect when selecting success clock', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Standard effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Standard
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'standard' }
            });

            await harness.advanceToState('ROLLING');
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-standard';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: calculatedSuccessClockSegments should be 2
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(2);
        });

        it('should calculate 4 segments for Great effect when selecting success clock', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Great effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Great
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'great' }
            });

            await harness.advanceToState('ROLLING');
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-great';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: calculatedSuccessClockSegments should be 4 (not 3)
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(4);
        });

        it('should calculate 6 segments for Spectacular effect when selecting success clock', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Spectacular effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Spectacular
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'spectacular' }
            });

            await harness.advanceToState('ROLLING');
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-spectacular';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: calculatedSuccessClockSegments should be 6 (not 5)
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(6);
        });

        it('should calculate 1 segment for Limited effect when selecting success clock', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Limited effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Limited
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'limited' }
            });

            await harness.advanceToState('ROLLING');
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-limited';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: calculatedSuccessClockSegments should be 1
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(1);
        });
    });

    describe('Critical Success - Enhanced Segments', () => {
        it('should calculate enhanced segments for Critical success with Standard effect (3 base -> 4 critical)', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Critical outcome and Standard effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Standard and outcome to Critical
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'standard' }
            });

            await harness.advanceToState('ROLLING');

            // Set roll result with critical outcome
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setRollResult',
                payload: {
                    characterId: 'char-1',
                    dicePool: 3,
                    rollResult: [6, 6, 4],
                    outcome: 'critical'
                }
            });

            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-critical-standard';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: Critical success should enhance Standard (2) by one tier to Great (4)
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(4);
        });

        it('should calculate enhanced segments for Critical success with Great effect (4 base -> 6 critical)', async () => {
            // Setup: Advance to SUCCESS_COMPLETE with Critical outcome and Great effect
            await harness.advanceToState('DECISION_PHASE');

            // Set effect to Great and outcome to Critical
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setEffect',
                payload: { characterId: 'char-1', effect: 'great' }
            });

            await harness.advanceToState('ROLLING');

            // Set roll result with critical outcome
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setRollResult',
                payload: {
                    characterId: 'char-1',
                    dicePool: 3,
                    rollResult: [6, 6, 4],
                    outcome: 'critical'
                }
            });

            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' }
            });

            // Refresh widget's internal state
            await (harness.widget as any).getData();

            // Simulate selecting a clock via side panel
            const mockClockId = 'test-clock-critical-great';
            await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

            // Verify: Critical success should enhance Great (4) by one tier to Spectacular (6)
            const updatedState = harness.getPlayerState();
            expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(6);
        });
    });
});
