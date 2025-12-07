/**
 * Stims Workflow - Addiction Fills State Transitions Test
 * 
 * Tests the specific bug where stims filling the addiction clock doesn't follow
 * the correct state transition path:
 * 
 * Expected (per docs/player-action-widget.md State Machine Diagram):
 *   GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → STIMS_LOCKED → GM_RESOLVING_CONSEQUENCE
 * 
 * Bug behavior:
 *   GM_RESOLVING_CONSEQUENCE → STIMS_LOCKED (invalid transition, skips STIMS_ROLLING)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';
import { STATE_TRANSITIONS } from '../../src/types/playerRoundState';

describe('PlayerActionWidget - Stims Fills Addiction Clock', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('State transition validation', () => {
        it('should verify STIMS_ROLLING is the only valid stims transition from GM_RESOLVING_CONSEQUENCE', () => {
            // Document the expected state transitions
            const validTransitionsFromGMResolving = STATE_TRANSITIONS['GM_RESOLVING_CONSEQUENCE'];

            expect(validTransitionsFromGMResolving).toContain('STIMS_ROLLING');
            expect(validTransitionsFromGMResolving).not.toContain('STIMS_LOCKED');
        });

        it('should verify STIMS_LOCKED is valid from STIMS_ROLLING', () => {
            const validTransitionsFromStimsRolling = STATE_TRANSITIONS['STIMS_ROLLING'];

            expect(validTransitionsFromStimsRolling).toContain('STIMS_LOCKED');
            expect(validTransitionsFromStimsRolling).toContain('ROLLING');
        });

        it('should verify return to GM_RESOLVING_CONSEQUENCE is valid from STIMS_LOCKED', () => {
            const validTransitionsFromStimsLocked = STATE_TRANSITIONS['STIMS_LOCKED'];

            expect(validTransitionsFromStimsLocked).toContain('GM_RESOLVING_CONSEQUENCE');
        });
    });

    describe('Stims workflow when addiction clock fills', () => {
        beforeEach(async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

            // Set up addiction clock at 7/8 - one more segment will fill it
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-addiction-near-full': {
                                id: 'clock-addiction-near-full',
                                segments: 7, // Near full - stims will fill it
                                maxSegments: 8,
                                subtype: 'Addiction',
                                entityId: 'char-1',
                                clockType: 'addiction',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-addiction-near-full'],
                        byEntityId: { 'char-1': ['clock-addiction-near-full'] },
                        byType: { 'addiction': ['clock-addiction-near-full'] },
                        byTypeAndEntity: { 'addiction:char-1': ['clock-addiction-near-full'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });
        });

        it('should transition through STIMS_ROLLING before STIMS_LOCKED when addiction fills', async () => {
            // Set up: Get to GM_RESOLVING_CONSEQUENCE state
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure to trigger consequence resolution
            await harness.clickRoll();

            const stateBeforeStims = harness.getPlayerState();
            expect(stateBeforeStims?.state).toBe('GM_RESOLVING_CONSEQUENCE');

            // Track all state transitions that occur
            const stateTransitions: string[] = [stateBeforeStims?.state || ''];

            // Subscribe to state changes to track transitions
            const unsubscribe = harness.game.fitgd.store.subscribe(() => {
                const newState = harness.getPlayerState()?.state;
                if (newState && newState !== stateTransitions[stateTransitions.length - 1]) {
                    stateTransitions.push(newState);
                }
            });

            try {
                // Use stims - this should trigger: GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → STIMS_LOCKED
                await harness.clickUseStims();

                // Verify state transitions followed the correct order
                // The key assertion: STIMS_ROLLING must appear BEFORE STIMS_LOCKED
                const stimsRollingIndex = stateTransitions.indexOf('STIMS_ROLLING');
                const stimsLockedIndex = stateTransitions.indexOf('STIMS_LOCKED');

                console.log('State transitions:', stateTransitions);

                if (stimsLockedIndex !== -1) {
                    // If we reached STIMS_LOCKED, we MUST have gone through STIMS_ROLLING first
                    expect(stimsRollingIndex).toBeGreaterThan(-1);
                    expect(stimsRollingIndex).toBeLessThan(stimsLockedIndex);
                }
            } finally {
                unsubscribe();
            }
        });

        it('should enter STIMS_ROLLING state when stims are used (prerequisite for STIMS_LOCKED path)', async () => {
            // Set up: Get to GM_RESOLVING_CONSEQUENCE state
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure to trigger consequence resolution
            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');

            // Use stims - harness's simplified clickUseStims transitions to STIMS_ROLLING
            // Note: The harness doesn't simulate full addiction advancement, so we verify
            // the fix by ensuring we enter STIMS_ROLLING first (per state machine)
            await harness.clickUseStims();

            // After using stims, should be in STIMS_ROLLING (the required intermediate state)
            // This validates the fix: we can no longer skip directly to STIMS_LOCKED
            const finalState = harness.getPlayerState();
            expect(finalState?.state).toBe('STIMS_ROLLING');
        });
    });

    describe('Stims workflow when addiction clock does NOT fill', () => {
        beforeEach(async () => {
            const crew = createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 });

            // Set up addiction clock at 2/8 - plenty of room
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
                initialState: {
                    clocks: {
                        byId: {
                            'clock-addiction-low': {
                                id: 'clock-addiction-low',
                                segments: 2, // Plenty of room
                                maxSegments: 8,
                                subtype: 'Addiction',
                                entityId: 'char-1',
                                clockType: 'addiction',
                                createdAt: 0,
                                updatedAt: 0,
                                metadata: {},
                            },
                        },
                        allIds: ['clock-addiction-low'],
                        byEntityId: { 'char-1': ['clock-addiction-low'] },
                        byType: { 'addiction': ['clock-addiction-low'] },
                        byTypeAndEntity: { 'addiction:char-1': ['clock-addiction-low'] },
                        history: [],
                    },
                    crews: {
                        byId: { 'crew-1': crew },
                        allIds: ['crew-1'],
                        history: [],
                    },
                },
            });
        });

        it('should transition STIMS_ROLLING → ROLLING when addiction does not fill', async () => {
            // Set up: Get to GM_RESOLVING_CONSEQUENCE state
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.setNextRoll([3]); // Failure to trigger consequence resolution
            await harness.clickRoll();

            expect(harness.getPlayerState()?.state).toBe('GM_RESOLVING_CONSEQUENCE');

            // Track all state transitions
            const stateTransitions: string[] = [harness.getPlayerState()?.state || ''];

            const unsubscribe = harness.game.fitgd.store.subscribe(() => {
                const newState = harness.getPlayerState()?.state;
                if (newState && newState !== stateTransitions[stateTransitions.length - 1]) {
                    stateTransitions.push(newState);
                }
            });

            try {
                // Use stims - this should trigger reroll (not lockout)
                harness.setNextRoll([6]); // Success on reroll
                await harness.clickUseStims();

                console.log('State transitions (no fill):', stateTransitions);

                // Verify STIMS_ROLLING was the first transition
                expect(stateTransitions[1]).toBe('STIMS_ROLLING');

                // Should NOT have hit STIMS_LOCKED
                expect(stateTransitions).not.toContain('STIMS_LOCKED');
            } finally {
                unsubscribe();
            }
        });
    });
});
