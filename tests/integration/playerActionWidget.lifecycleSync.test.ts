/**
 * Integration Tests: Player Action Widget - Lifecycle Sync
 *
 * Tests for the bidirectional widget open/close synchronization between GM and Player.
 * 
 * Key behaviors tested:
 * - Player opens widget → activePlayerAction set → GM widget can detect
 * - Player can close widget pre-roll
 * - Player cannot close widget post-roll (committedToRoll)
 * - GM can always abort (clears activePlayerAction)
 * - State persists for disconnect resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';
import {
    selectActivePlayerAction,
    selectCanPlayerCloseWidget,
    selectIsPlayerActionInProgress,
} from '../../src/selectors/crewSelectors';

describe('PlayerActionWidget - Lifecycle Synchronization', () => {
    let harness: WidgetTestHarness;
    const crewId = 'crew-1';
    const characterId = 'char-1';
    const playerId = 'player-1';

    beforeEach(async () => {
        harness = await createWidgetHarness({
            characterId,
            isGM: false,
            character: createMockCharacter({ id: characterId, name: 'Test Hero' }),
            crew: createMockCrew({ id: crewId, characters: [characterId] }),
        });
    });

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Starting Player Action', () => {
        it('should set activePlayerAction when player widget dispatches startPlayerAction', async () => {
            // Dispatch startPlayerAction (simulating widget open)
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Verify activePlayerAction is set
            const state = harness.getState();
            const action = selectActivePlayerAction(state, crewId);
            expect(action).not.toBeNull();
            expect(action?.characterId).toBe(characterId);
            expect(action?.playerId).toBe(playerId);
            expect(action?.committedToRoll).toBe(false);
        });

        it('should detect action in progress via selector', async () => {
            // Initially no action
            expect(selectIsPlayerActionInProgress(harness.getState(), crewId)).toBe(false);

            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Now action is in progress
            expect(selectIsPlayerActionInProgress(harness.getState(), crewId)).toBe(true);
        });
    });

    describe('Player Close Permission (Pre-Roll)', () => {
        it('should allow player to close widget before committing to roll', async () => {
            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Check permission
            const canClose = selectCanPlayerCloseWidget(harness.getState(), crewId, playerId);
            expect(canClose).toBe(true);
        });

        it('should clear activePlayerAction when player aborts pre-roll', async () => {
            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Abort
            await harness.game.fitgd.bridge.execute({
                type: 'crews/abortPlayerAction',
                payload: { crewId },
            });

            // Verify cleared
            const action = selectActivePlayerAction(harness.getState(), crewId);
            expect(action).toBeNull();
        });
    });

    describe('Player Close Permission (Post-Roll)', () => {
        it('should prevent player from closing widget after committing to roll', async () => {
            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Commit to roll
            await harness.game.fitgd.bridge.execute({
                type: 'crews/commitToRoll',
                payload: { crewId },
            });

            // Check permission - should be false now
            const canClose = selectCanPlayerCloseWidget(harness.getState(), crewId, playerId);
            expect(canClose).toBe(false);
        });

        it('should set committedToRoll flag after committing', async () => {
            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Commit
            await harness.game.fitgd.bridge.execute({
                type: 'crews/commitToRoll',
                payload: { crewId },
            });

            // Verify flag
            const action = selectActivePlayerAction(harness.getState(), crewId);
            expect(action?.committedToRoll).toBe(true);
        });
    });

    describe('GM Abort Capability', () => {
        it('should allow GM to abort action even after player commits to roll', async () => {
            // Start and commit
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });
            await harness.game.fitgd.bridge.execute({
                type: 'crews/commitToRoll',
                payload: { crewId },
            });

            // Verify committed
            expect(selectActivePlayerAction(harness.getState(), crewId)?.committedToRoll).toBe(true);

            // GM aborts
            await harness.game.fitgd.bridge.execute({
                type: 'crews/abortPlayerAction',
                payload: { crewId },
            });

            // Verify cleared
            const action = selectActivePlayerAction(harness.getState(), crewId);
            expect(action).toBeNull();
        });
    });

    describe('State Persistence (Disconnect Resilience)', () => {
        it('should persist activePlayerAction in crew state after action', async () => {
            // Start action
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Get crew from state (simulating what would be saved)
            const crewState = harness.getState().crews.byId[crewId];

            // Verify activePlayerAction is on the crew object (persisted state)
            expect(crewState.activePlayerAction).toBeDefined();
            expect(crewState.activePlayerAction?.characterId).toBe(characterId);
        });

        it('should maintain committedToRoll state for reconnecting player', async () => {
            // Start and commit
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });
            await harness.game.fitgd.bridge.execute({
                type: 'crews/commitToRoll',
                payload: { crewId },
            });

            // Simulate "reconnect" by checking state is still there
            const crewState = harness.getState().crews.byId[crewId];
            expect(crewState.activePlayerAction?.committedToRoll).toBe(true);

            // Reconnected player would still not be able to close
            const canClose = selectCanPlayerCloseWidget(harness.getState(), crewId, playerId);
            expect(canClose).toBe(false);
        });
    });

    describe('Broadcast Integration', () => {
        it('should broadcast startPlayerAction for multi-client sync', async () => {
            harness.spy.reset();

            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });

            // Verify broadcast occurred
            expect(harness.spy.data.broadcasts).toBe(1);
        });

        it('should broadcast commitToRoll for multi-client sync', async () => {
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });
            harness.spy.reset();

            await harness.game.fitgd.bridge.execute({
                type: 'crews/commitToRoll',
                payload: { crewId },
            });

            expect(harness.spy.data.broadcasts).toBe(1);
        });

        it('should broadcast abortPlayerAction for multi-client sync', async () => {
            await harness.game.fitgd.bridge.execute({
                type: 'crews/startPlayerAction',
                payload: { crewId, characterId, playerId },
            });
            harness.spy.reset();

            await harness.game.fitgd.bridge.execute({
                type: 'crews/abortPlayerAction',
                payload: { crewId },
            });

            expect(harness.spy.data.broadcasts).toBe(1);
        });
    });
});
