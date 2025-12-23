/**
 * Player Request Service
 *
 * Handles RPC communication for the GM-Authority pattern.
 * Players send requests via socketlib.executeAsGM(), GM validates and responds.
 *
 * @see docs/gm-authority-rpc.md
 */

import { logger } from '../utils/logger';

/* -------------------------------------------- */
/*  Types                                       */
/* -------------------------------------------- */

/**
 * Player request structure for GM-Authority RPC
 */
export interface PlayerRequest {
    type: string;
    payload: Record<string, unknown>;
    characterId: string;
    requestId: string;
}

/**
 * Result returned from GM's handlePlayerRequest
 */
export interface PlayerRequestResult {
    success: boolean;
    error?: string;
    lastConfirmedRequestId: string;
}

/**
 * Blocking request types that require GM response before proceeding
 */
export const BLOCKING_REQUEST_TYPES = [
    'REQUEST_START_ACTION',
    'REQUEST_ROLL',
    'REQUEST_USE_STIMS',
    'REQUEST_ACCEPT_CONSEQUENCE',
    'REQUEST_CLOSE_WIDGET',
] as const;

/**
 * Optimistic request types that update local state immediately
 */
export const OPTIMISTIC_REQUEST_TYPES = [
    'REQUEST_SET_APPROACH',
    'REQUEST_SET_IMPROVEMENTS',
    'REQUEST_SET_EQUIPMENT',
    'REQUEST_SET_PASSIVE',
] as const;

export type BlockingRequestType = typeof BLOCKING_REQUEST_TYPES[number];
export type OptimisticRequestType = typeof OPTIMISTIC_REQUEST_TYPES[number];
export type RequestType = BlockingRequestType | OptimisticRequestType;

/* -------------------------------------------- */
/*  Service Implementation                      */
/* -------------------------------------------- */

/**
 * Player Request Service
 *
 * Manages RPC communication between player clients and GM.
 * Tracks pending requests and handles request ID generation.
 */
export class PlayerRequestService {
    /** Last sent request ID (for filtering incoming broadcasts) */
    private lastSentRequestId: string | null = null;

    /** Character ID this service is for */
    private characterId: string;

    /** Request counter for unique IDs */
    private requestCounter = 0;

    constructor(characterId: string) {
        this.characterId = characterId;
    }

    /* -------------------------------------------- */
    /*  Public API                                  */
    /* -------------------------------------------- */

    /**
     * Send a blocking request to GM
     *
     * Waits for GM response before returning.
     * Used for actions that require GM validation (roll, stims, accept consequence).
     *
     * @param type - Request type (REQUEST_ROLL, REQUEST_USE_STIMS, etc.)
     * @param payload - Request payload
     * @returns Promise resolving to GM's response
     */
    async sendBlockingRequest(type: BlockingRequestType, payload: Record<string, unknown> = {}): Promise<PlayerRequestResult> {
        const requestId = this.generateRequestId();
        this.lastSentRequestId = requestId;

        const request: PlayerRequest = {
            type,
            payload,
            characterId: this.characterId,
            requestId,
        };

        logger.debug(`Sending blocking request:`, request);

        try {
            // Use socketlib's executeAsGM to send request to GM
            const result = await game.fitgd!.socket.executeAsGM('handlePlayerRequest', request) as PlayerRequestResult;

            logger.debug(`Received response for ${requestId}:`, result);

            if (!result.success && result.error) {
                ui.notifications?.warn(result.error);
            }

            return result;
        } catch (error) {
            logger.error(`Request ${requestId} failed:`, error);

            // GM unreachable
            ui.notifications?.error(game.i18n.localize('FITGD.ActionWidget.GMUnavailable') || 'GM unavailable, please retry');

            return {
                success: false,
                error: 'GM unavailable',
                lastConfirmedRequestId: requestId,
            };
        }
    }

    /**
     * Send an optimistic request to GM
     *
     * Updates local state immediately, sends request in background.
     * Used for approach/equipment selection that can be undone.
     *
     * @param type - Request type
     * @param payload - Request payload
     */
    async sendOptimisticRequest(type: OptimisticRequestType, payload: Record<string, unknown> = {}): Promise<void> {
        const requestId = this.generateRequestId();
        this.lastSentRequestId = requestId;

        const request: PlayerRequest = {
            type,
            payload,
            characterId: this.characterId,
            requestId,
        };

        // Fire and forget - don't await
        game.fitgd!.socket.executeAsGM('handlePlayerRequest', request)
            .then((rawResult: unknown) => {
                const result = rawResult as PlayerRequestResult;
                if (!result.success && result.error) {
                    // GM rejected - show notification (state will be corrected by broadcast)
                    ui.notifications?.warn(result.error);
                }
            })
            .catch((error) => {
                logger.warn(`Optimistic request ${requestId} failed:`, error);
                // Will be corrected by next broadcast
            });
    }

    /**
     * Check if an incoming broadcast should be applied
     *
     * Per GM-Authority spec, player only applies state if:
     * 1. It has forceSync flag (reconnect scenario)
     * 2. Its lastConfirmedRequestId matches our lastSentRequestId
     *
     * @param lastConfirmedRequestId - Request ID from broadcast
     * @param forceSync - Whether this is a force sync
     * @returns Whether to apply the broadcast
     */
    shouldApplyBroadcast(lastConfirmedRequestId: string | null, forceSync: boolean): boolean {
        if (forceSync) {
            logger.debug('Force sync - applying broadcast');
            return true;
        }

        if (!lastConfirmedRequestId) {
            // No request ID in broadcast - apply it (legacy compatibility)
            return true;
        }

        if (lastConfirmedRequestId === this.lastSentRequestId) {
            logger.debug(`Broadcast matches last sent request ${this.lastSentRequestId} - applying`);
            return true;
        }

        logger.debug(`Broadcast for ${lastConfirmedRequestId} doesn't match last sent ${this.lastSentRequestId} - ignoring`);
        return false;
    }

    /**
     * Get last sent request ID (for debugging/testing)
     */
    getLastSentRequestId(): string | null {
        return this.lastSentRequestId;
    }

    /**
     * Clear state (called when widget closes)
     */
    reset(): void {
        this.lastSentRequestId = null;
        this.requestCounter = 0;
    }

    /* -------------------------------------------- */
    /*  Private Helpers                             */
    /* -------------------------------------------- */

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        this.requestCounter++;
        return `req-${this.characterId.substring(0, 8)}-${Date.now()}-${this.requestCounter}`;
    }
}

/* -------------------------------------------- */
/*  Factory Function                            */
/* -------------------------------------------- */

/**
 * Create a player request service for a character
 *
 * @param characterId - Character ID
 * @returns PlayerRequestService instance
 */
export function createPlayerRequestService(characterId: string): PlayerRequestService {
    return new PlayerRequestService(characterId);
}
