/**
 * Unit Tests: Crew Slice - Active Player Action
 *
 * Tests for the widget lifecycle synchronization feature.
 * These tests verify that crews can track which player action is currently in progress.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import crewReducer, {
    createCrew,
    startPlayerAction,
    commitToRoll,
    abortPlayerAction,
} from '../../src/slices/crewSlice';
import type { ActivePlayerAction } from '../../src/types/crew';

describe('crewSlice - Active Player Action', () => {
    const createTestStore = () =>
        configureStore({
            reducer: { crews: crewReducer },
        });

    let store: ReturnType<typeof createTestStore>;
    const crewId = 'crew-1';
    const characterId = 'char-1';
    const playerId = 'player-1';

    beforeEach(() => {
        store = createTestStore();
        // Create a crew for testing
        store.dispatch(createCrew({ id: crewId, name: 'Test Crew' }));
    });

    describe('startPlayerAction', () => {
        it('should set activePlayerAction on the crew', () => {
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );

            const crew = store.getState().crews.byId[crewId];
            expect(crew.activePlayerAction).toBeDefined();
            expect(crew.activePlayerAction?.characterId).toBe(characterId);
            expect(crew.activePlayerAction?.playerId).toBe(playerId);
            expect(crew.activePlayerAction?.crewId).toBe(crewId);
            expect(crew.activePlayerAction?.committedToRoll).toBe(false);
            expect(crew.activePlayerAction?.startedAt).toBeGreaterThan(0);
        });

        it('should fail if another action is already in progress', () => {
            // Start first action
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId: 'char-1',
                    playerId: 'player-1',
                })
            );

            // Try to start second action - should throw
            expect(() =>
                store.dispatch(
                    startPlayerAction({
                        crewId,
                        characterId: 'char-2',
                        playerId: 'player-2',
                    })
                )
            ).toThrow(/already in progress/i);
        });

        it('should allow restarting same character action (idempotent)', () => {
            // Start action
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );

            // Restart same action - should work (idempotent)
            expect(() =>
                store.dispatch(
                    startPlayerAction({
                        crewId,
                        characterId,
                        playerId,
                    })
                )
            ).not.toThrow();
        });
    });

    describe('commitToRoll', () => {
        it('should set committedToRoll to true', () => {
            // Setup: start action first
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );

            // Commit to roll
            store.dispatch(commitToRoll({ crewId }));

            const crew = store.getState().crews.byId[crewId];
            expect(crew.activePlayerAction?.committedToRoll).toBe(true);
        });

        it('should fail if no action is in progress', () => {
            expect(() => store.dispatch(commitToRoll({ crewId }))).toThrow(
                /no active player action/i
            );
        });
    });

    describe('abortPlayerAction', () => {
        it('should clear activePlayerAction', () => {
            // Setup: start action first
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );

            // Abort
            store.dispatch(abortPlayerAction({ crewId }));

            const crew = store.getState().crews.byId[crewId];
            expect(crew.activePlayerAction).toBeNull();
        });

        it('should be a no-op if no action is in progress', () => {
            // Should not throw
            expect(() =>
                store.dispatch(abortPlayerAction({ crewId }))
            ).not.toThrow();

            const crew = store.getState().crews.byId[crewId];
            expect(crew.activePlayerAction).toBeNull();
        });

        it('should work even if committed to roll (GM abort)', () => {
            // Setup: start and commit
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );
            store.dispatch(commitToRoll({ crewId }));

            // GM abort should still work
            store.dispatch(abortPlayerAction({ crewId }));

            const crew = store.getState().crews.byId[crewId];
            expect(crew.activePlayerAction).toBeNull();
        });
    });

    describe('Permission Checks (via selectors)', () => {
        // Note: These will be tested in selector tests, but we verify the state shape here

        it('should allow determining if player can close (pre-commit)', () => {
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );

            const crew = store.getState().crews.byId[crewId];
            const action = crew.activePlayerAction!;

            // Pre-commit: player can close
            expect(action.committedToRoll).toBe(false);
            // Selector would return: playerId matches AND !committedToRoll
            const canPlayerClose =
                action.playerId === playerId && !action.committedToRoll;
            expect(canPlayerClose).toBe(true);
        });

        it('should prevent player close after commit', () => {
            store.dispatch(
                startPlayerAction({
                    crewId,
                    characterId,
                    playerId,
                })
            );
            store.dispatch(commitToRoll({ crewId }));

            const crew = store.getState().crews.byId[crewId];
            const action = crew.activePlayerAction!;

            // Post-commit: player cannot close
            expect(action.committedToRoll).toBe(true);
            const canPlayerClose =
                action.playerId === playerId && !action.committedToRoll;
            expect(canPlayerClose).toBe(false);
        });
    });
});
