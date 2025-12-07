/**
 * State Transition Validator Middleware
 *
 * Validates all playerRoundState transitions to prevent invalid state machine transitions.
 * This middleware provides comprehensive validation across the entire application,
 * complementing the batch validation in foundry-redux-bridge.ts.
 *
 * BEHAVIOR:
 * - Development mode: Throws errors for immediate feedback
 * - Production mode: Logs warnings and blocks invalid transitions
 *
 * See: docs/redux-batching-rules.md, planned_tasks/state-machine-architectural-improvements.md
 */

import type { Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import { isValidTransition, STATE_TRANSITIONS } from '../types/playerRoundState';
import type { PlayerRoundStateType } from '../types/playerRoundState';
import { logger } from '@/utils/logger';

/**
 * Redux middleware that validates all playerRoundState transitions
 *
 * Prevents invalid state machine transitions at the Redux level,
 * catching bugs that might slip through application logic.
 */
export const stateTransitionValidator: Middleware<{}, RootState> = store => next => (action: unknown) => {
    // Only validate state transitions
    if (typeof action !== 'object' || action === null || !('type' in action)) {
        return next(action);
    }

    if ((action as any).type !== 'playerRoundState/transitionState') {
        return next(action);
    }

    const { characterId, newState } = (action as any).payload as {
        characterId: string;
        newState: PlayerRoundStateType;
    };

    const currentState = store.getState().playerRoundState.byCharacterId[characterId]?.state as PlayerRoundStateType | undefined;

    // Allow initialization (no current state)
    if (!currentState) {
        return next(action);
    }

    // Validate transition
    if (!isValidTransition(currentState, newState)) {
        const validTransitions = STATE_TRANSITIONS[currentState] || [];

        logger.error('Invalid state transition detected!');
        logger.error(`   From: ${currentState}`);
        logger.error(`   To: ${newState}`);
        logger.error(`   Valid transitions from ${currentState}:`, validTransitions);
        logger.error(`   Character: ${characterId}`);
        // logger.trace('Stack trace:'); // Logger doesn't have trace, and trace is noisy in tests anyway

        // In development or tests: throw error for immediate feedback
        // Check for Vitest environment in addition to NODE_ENV
        const isTestOrDev = process.env.NODE_ENV !== 'production' || typeof global !== 'undefined' && (global as any).vitest;

        if (isTestOrDev) {
            throw new Error(
                `Invalid state transition: ${currentState} → ${newState}. ` +
                `Valid transitions: ${validTransitions.join(', ')}`
            );
        }

        // In production: silently block (safer than crashing)
        logger.warn('Transition blocked in production mode');
        return; // Don't dispatch
    }

    // Valid transition - proceed
    return next(action);
};
