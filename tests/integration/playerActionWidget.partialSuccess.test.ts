import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter } from '../mocks/foundryApi';
import { ConsequenceType } from '../../src/types/playerRoundState';

describe('PlayerActionWidget - Partial Success Repro', () => {
    let harness: WidgetTestHarness;

    beforeEach(async () => {
        harness = await createWidgetHarness({
            characterId: 'char-repro-partial',
            isGM: true,
            character: createMockCharacter({ id: 'char-repro-partial', name: 'Repro Partial' }),
        });
    });

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    it('should correctly store selected clock ID when selecting a clock during Partial Success', async () => {
        // 1. Setup State: GM_RESOLVING_CONSEQUENCE -> PARTIAL SUCCESS
        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');
        await harness.advanceToState('ROLLING');

        // Transition to Consequence Resolution first (Partial Success flow)
        await (harness.game.fitgd.bridge.execute as any)({
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-repro-partial', newState: 'GM_RESOLVING_CONSEQUENCE' }
        });

        // Set a consequence (e.g. Harm)
        await (harness.game.fitgd.bridge.execute as any)({
            type: 'playerRoundState/setConsequenceTransaction',
            payload: {
                characterId: 'char-repro-partial',
                transaction: { consequenceType: 'harm', consequenceValue: 2 }
            }
        });

        // Apply Consequence -> SUCCESS_COMPLETE (Partial)
        await (harness.game.fitgd.bridge.executeBatch as any)([
            {
                type: 'playerRoundState/setConsequence',
                payload: { characterId: 'char-repro-partial', consequenceType: 'harm', consequenceValue: 2 }
            },
            {
                type: 'playerRoundState/setRollResult', // Outcome needs to be partial
                payload: {
                    characterId: 'char-repro-partial',
                    outcome: 'partial',
                    dicePool: 1,
                    rollResult: [4]
                }
            },
            {
                type: 'playerRoundState/transitionState',
                payload: { characterId: 'char-repro-partial', newState: 'SUCCESS_COMPLETE' }
            }
        ]);

        // State Check: ConsequenceTransaction might still be there from the previous step?
        // Or cleared?
        // In the user logs, it was THERE: { consequenceType: 'harm', successClockOperation: 'add' }
        // Let's ensure we match that state.
        // It seems `setConsequenceTransaction` payload above sets it. 
        // `transitionState` does NOT clear it.

        // 2. Simulate User Picking a Clock via Side Panel
        const mockClockId = 'clock-progress-partial-1';

        // Direct call to coordinator to verify logic
        await (harness.widget as any).coordinator.handleSidePanelClockSelect('success', mockClockId);

        // 3. Verify State Update
        const updatedState = harness.getPlayerState();

        expect(updatedState?.consequenceTransaction).toBeDefined();
        // This is where it failed for the user (missing ID)
        expect(updatedState?.consequenceTransaction?.successClockId).toBe(mockClockId);
        // Verify segments were calculated (Standard effect = 2 per rules_primer.md)
        expect(updatedState?.consequenceTransaction?.calculatedSuccessClockSegments).toBe(2);
    });
});
