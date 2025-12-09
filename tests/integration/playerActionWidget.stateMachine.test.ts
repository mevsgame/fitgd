import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

declare const game: any;

describe('PlayerActionWidget - State Machine', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Basic State Transitions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('DECISION_PHASE → ROLLING (via roll button)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6]); // Success
            harness.spy.reset();

            await harness.clickRoll();

            // Should transition to ROLLING momentarily, then to SUCCESS_COMPLETE
            expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');
            expect(harness.getPlayerState()?.outcome).toBe('success');
        });

        it('DECISION_PHASE → ROLLING → GM_RESOLVING_CONSEQUENCE (failure)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure
            harness.spy.reset();

            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');
            expect(harness.getPlayerState()?.outcome).toBe('failure');
            expect(harness.getPlayerState()?.rollResult).toEqual([3]);
        });

        it('ROLLING → SUCCESS_COMPLETE (critical success)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6, 6, 5]); // Critical (2+ sixes)
            harness.spy.reset();

            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');
            expect(harness.getPlayerState()?.outcome).toBe('critical');
        });

        it('ROLLING → SUCCESS_COMPLETE (standard success)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([6, 5, 3]); // Success (one 6)
            harness.spy.reset();

            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');
            expect(harness.getPlayerState()?.outcome).toBe('success');
        });

        it('ROLLING → GM_RESOLVING_CONSEQUENCE (partial success)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([5, 4, 3]); // Partial (4-5)
            harness.spy.reset();

            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');
            expect(harness.getPlayerState()?.outcome).toBe('partial');
        });

        it('should track state transitions in broadcast sequence', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]);
            harness.spy.reset();

            await harness.clickRoll();

            // Verify: 1 (approach) was already counted, now clickRoll does:
            // 1 (ROLLING transition) + 1 (batch: result + GM_RESOLVING)
            expect(harness.spy.data.broadcasts).toBeGreaterThanOrEqual(2);
            expect(harness.spy.data.dispatches.length).toBeGreaterThan(0);
        });
    });

    describe('Consequence Flow State Transitions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure to get to GM_RESOLVING_CONSEQUENCE
            await harness.clickRoll();
            harness.spy.reset();
        });

        it('should be in GM_RESOLVING_CONSEQUENCE after failure roll', async () => {
            // We're already set up for this in beforeEach
            // Just verify we're in the correct state
            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');
            expect(harness.getPlayerState()?.outcome).toBe('failure');
            expect(harness.getPlayerState()?.rollResult).toBeDefined();
        });



        it('should prevent invalid transition from GM_RESOLVING_CONSEQUENCE to DECISION_PHASE', async () => {
            await expect(async () => {
                await game.fitgd.bridge.execute({
                    type: 'playerRoundState/transitionState',
                    payload: { characterId: 'char-1', newState: 'DECISION_PHASE' },
                });
            }).rejects.toThrow('Invalid state transition');
        });
    });

    describe('Approach & Modifier Management', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    approaches: { force: 3, guile: 2, focus: 2, spirit: 1 },
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
            await harness.advanceToState('DECISION_PHASE');
        });

        it('should update selected approach', async () => {
            await harness.selectApproach('guile');
            expect(harness.getPlayerState()?.selectedApproach).toBe('guile');

            await harness.selectApproach('spirit');
            expect(harness.getPlayerState()?.selectedApproach).toBe('spirit');
        });

        it('should update position setting', async () => {
            await harness.setPosition('controlled');
            expect(harness.getPlayerState()?.position).toBe('controlled');

            await harness.setPosition('desperate');
            expect(harness.getPlayerState()?.position).toBe('desperate');
        });

        it('should update effect setting', async () => {
            await harness.setEffect('limited');
            expect(harness.getPlayerState()?.effect).toBe('limited');

            await harness.setEffect('great');
            expect(harness.getPlayerState()?.effect).toBe('great');
        });

        it('should toggle push die status', async () => {
            const initialState = harness.getPlayerState();
            const initialPushed = initialState?.pushed || false;
            const initialPushType = initialState?.pushType;

            // Click push die - should set extra-die
            await harness.clickPushDie();
            let currentState = harness.getPlayerState();
            expect(currentState?.pushed).toBe(true);
            expect(currentState?.pushType).toBe('extra-die');

            // Click again - should toggle off
            await harness.clickPushDie();
            currentState = harness.getPlayerState();
            expect(currentState?.pushed).toBe(false);
        });

        it('should toggle push effect status', async () => {
            // Click push effect - should set improved-effect
            await harness.clickPushEffect();
            let currentState = harness.getPlayerState();
            expect(currentState?.pushed).toBe(true);
            expect(currentState?.pushType).toBe('improved-effect');

            // Click again - should toggle off
            await harness.clickPushEffect();
            currentState = harness.getPlayerState();
            expect(currentState?.pushed).toBe(false);
        });
    });

    describe('Complex State Sequences', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    approaches: { force: 3, guile: 2, focus: 2, spirit: 1 },
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
            });
        });

        it('should handle complete action sequence: decision → roll → result', async () => {
            // Start at DECISION_PHASE
            await harness.advanceToState('DECISION_PHASE');
            expect(harness.getPlayerState()?.state).toBe('DECISION_PHASE');

            // Configure action
            await harness.selectApproach('force');
            await harness.setPosition('risky');
            await harness.setEffect('standard');
            expect(harness.getPlayerState()?.selectedApproach).toBe('force');
            expect(harness.getPlayerState()?.position).toBe('risky');
            expect(harness.getPlayerState()?.effect).toBe('standard');

            // Roll
            harness.setNextRoll([6, 5, 4]); // Success
            await harness.clickRoll();

            // Should reach SUCCESS_COMPLETE
            expect(harness.getPlayerState()?.state).toBe('SUCCESS_COMPLETE');
            expect(harness.getPlayerState()?.outcome).toBe('success');
        });

        it('should maintain state consistency across multiple decisions', async () => {
            await harness.advanceToState('DECISION_PHASE');

            // First decision
            await harness.selectApproach('force');
            expect(harness.getPlayerState()?.selectedApproach).toBe('force');

            // Change approach
            await harness.selectApproach('guile');
            expect(harness.getPlayerState()?.selectedApproach).toBe('guile');

            // Change position
            await harness.setPosition('desperate');
            expect(harness.getPlayerState()?.position).toBe('desperate');

            // Verify approach is still guile (not reset)
            expect(harness.getPlayerState()?.selectedApproach).toBe('guile');
        });

        it('should verify state isolation between characters', async () => {
            const harness2 = await createWidgetHarness({
                characterId: 'char-2',
                isGM: false,
                character: createMockCharacter({ id: 'char-2' }),
            });

            // Set different states
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            await harness2.advanceToState('DECISION_PHASE');
            await harness2.selectApproach('guile');

            // Verify isolation
            expect(harness.getPlayerState()?.selectedApproach).toBe('force');
            expect(harness2.getPlayerState()?.selectedApproach).toBe('guile');

            harness2.cleanup();
        });
    });

    describe('Invalid Transitions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                character: createMockCharacter({ id: 'char-1' }),
            });
        });

        it('should reject DECISION_PHASE → TURN_COMPLETE', async () => {
            await harness.advanceToState('DECISION_PHASE');

            await expect(async () => {
                await game.fitgd.bridge.execute({
                    type: 'playerRoundState/transitionState',
                    payload: { characterId: 'char-1', newState: 'TURN_COMPLETE' },
                });
            }).rejects.toThrow('Invalid state transition');
        });

        it('should reject GM_RESOLVING_CONSEQUENCE → DECISION_PHASE (backward transition)', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]);
            await harness.clickRoll(); // Get to GM_RESOLVING_CONSEQUENCE

            await expect(async () => {
                await game.fitgd.bridge.execute({
                    type: 'playerRoundState/transitionState',
                    payload: { characterId: 'char-1', newState: 'DECISION_PHASE' },
                });
            }).rejects.toThrow('Invalid state transition');
        });

        it('should reject rolling when no approach selected', async () => {
            await harness.advanceToState('DECISION_PHASE');

            // Try to roll without selecting approach
            harness.setNextRoll([6]);
            await expect(harness.clickRoll()).rejects.toThrow();
        });
    });
});
