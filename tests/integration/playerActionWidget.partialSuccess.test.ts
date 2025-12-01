import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import type { RootState } from '../../src/store';
import { charactersReducer } from '../../src/slices/characterSlice';
import { crewsReducer } from '../../src/slices/crewSlice';
import { clocksReducer } from '../../src/slices/clockSlice';
import playerRoundStateReducer from '../../src/slices/playerRoundStateSlice';
import { selectEffectiveEffect } from '../../src/selectors/playerRoundStateSelectors';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';

describe('PlayerActionWidget - Partial Success with Defensive Success', () => {
    describe('selectEffectiveEffect with useDefensiveSuccess', () => {
        it('should return reduced effect (LIMITED) when defensive success is chosen with STANDARD effect', () => {
            const store = configureStore({
                reducer: {
                    characters: charactersReducer,
                    crews: crewsReducer,
                    clocks: clocksReducer,
                    playerRoundState: playerRoundStateReducer,
                },
            });

            const characterId = 'char-1';

            // Setup character
            store.dispatch({
                type: 'characters/add',
                payload: {
                    id: characterId,
                    name: 'Test Character',
                    crewId: 'crew-1',
                    approaches: {
                        assault: 2,
                        discipline: 1,
                        maneuver: 1,
                        study: 1,
                        consort: 1,
                        sway: 1,
                    },
                    equipment: [],
                    traits: [],
                },
            });

            // Setup player state with STANDARD effect and defensive success
            store.dispatch({
                type: 'playerRoundState/initializePlayerState',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setActivePlayer',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setPosition',
                payload: {
                    characterId,
                    position: 'risky',
                },
            });

            store.dispatch({
                type: 'playerRoundState/setEffect',
                payload: {
                    characterId,
                    effect: 'standard', // Base effect
                },
            });

            // Transition to ROLLING
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'ROLLING',
                },
            });

            // Transition to GM_RESOLVING_CONSEQUENCE (Partial Success)
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'GM_RESOLVING_CONSEQUENCE',
                },
            });

            // Player chooses DEFENSIVE SUCCESS
            store.dispatch({
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                    characterId,
                    updates: { useDefensiveSuccess: true },
                },
            });

            const state = store.getState() as RootState;

            // ASSERTION: selectEffectiveEffect should return LIMITED (reduced from STANDARD)
            const effectiveEffect = selectEffectiveEffect(state, characterId);
            expect(effectiveEffect).toBe('limited');

            // ASSERTION: Success clock segments should be 1 (LIMITED), not 3 (STANDARD)
            const expectedSegments = DEFAULT_CONFIG.resolution.successSegments[effectiveEffect];
            expect(expectedSegments).toBe(1);
        });

        it('should return original effect (STANDARD) when defensive success is NOT chosen', () => {
            const store = configureStore({
                reducer: {
                    characters: charactersReducer,
                    crews: crewsReducer,
                    clocks: clocksReducer,
                    playerRoundState: playerRoundStateReducer,
                },
            });

            const characterId = 'char-1';

            // Setup character
            store.dispatch({
                type: 'characters/add',
                payload: {
                    id: characterId,
                    name: 'Test Character',
                    crewId: 'crew-1',
                    approaches: {
                        assault: 2,
                        discipline: 1,
                        maneuver: 1,
                        study: 1,
                        consort: 1,
                        sway: 1,
                    },
                    equipment: [],
                    traits: [],
                },
            });

            // Setup player state with STANDARD effect, NO defensive success
            store.dispatch({
                type: 'playerRoundState/initializePlayerState',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setActivePlayer',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setPosition',
                payload: {
                    characterId,
                    position: 'risky',
                },
            });

            store.dispatch({
                type: 'playerRoundState/setEffect',
                payload: {
                    characterId,
                    effect: 'standard', // Base effect
                },
            });

            // Transition to ROLLING
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'ROLLING',
                },
            });

            // Transition to GM_RESOLVING_CONSEQUENCE (Partial Success)
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'GM_RESOLVING_CONSEQUENCE',
                },
            });

            // Player does NOT choose defensive success (useDefensiveSuccess defaults to false/undefined)

            const state = store.getState() as RootState;

            // ASSERTION: selectEffectiveEffect should return STANDARD (no reduction)
            const effectiveEffect = selectEffectiveEffect(state, characterId);
            expect(effectiveEffect).toBe('standard');

            // ASSERTION: Success clock segments should be 2 (STANDARD)
            const expectedSegments = DEFAULT_CONFIG.resolution.successSegments[effectiveEffect];
            expect(expectedSegments).toBe(2);
        });

        it('should reduce effect from GREAT to STANDARD when defensive success is chosen', () => {
            const store = configureStore({
                reducer: {
                    characters: charactersReducer,
                    crews: crewsReducer,
                    clocks: clocksReducer,
                    playerRoundState: playerRoundStateReducer,
                },
            });

            const characterId = 'char-1';

            // Setup character
            store.dispatch({
                type: 'characters/add',
                payload: {
                    id: characterId,
                    name: 'Test Character',
                    crewId: 'crew-1',
                    approaches: {
                        assault: 2,
                        discipline: 1,
                        maneuver: 1,
                        study: 1,
                        consort: 1,
                        sway: 1,
                    },
                    equipment: [],
                    traits: [],
                },
            });

            // Setup player state with GREAT effect and defensive success
            store.dispatch({
                type: 'playerRoundState/initializePlayerState',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setActivePlayer',
                payload: { characterId },
            });

            store.dispatch({
                type: 'playerRoundState/setPosition',
                payload: {
                    characterId,
                    position: 'risky',
                },
            });

            store.dispatch({
                type: 'playerRoundState/setEffect',
                payload: {
                    characterId,
                    effect: 'great', // Base effect
                },
            });

            // Transition to ROLLING
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'ROLLING',
                },
            });

            // Transition to GM_RESOLVING_CONSEQUENCE (Partial Success)
            store.dispatch({
                type: 'playerRoundState/transitionState',
                payload: {
                    characterId,
                    newState: 'GM_RESOLVING_CONSEQUENCE',
                },
            });

            // Player chooses DEFENSIVE SUCCESS
            store.dispatch({
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                    characterId,
                    updates: { useDefensiveSuccess: true },
                },
            });

            const state = store.getState() as RootState;

            // ASSERTION: selectEffectiveEffect should return STANDARD (reduced from GREAT)
            const effectiveEffect = selectEffectiveEffect(state, characterId);
            expect(effectiveEffect).toBe('standard');

            // ASSERTION: Success clock segments should be 2 (STANDARD), not 4 (GREAT)
            const expectedSegments = DEFAULT_CONFIG.resolution.successSegments[effectiveEffect];
            expect(expectedSegments).toBe(2);
        });
    });
});
