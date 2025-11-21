/**
 * Push Handler
 *
 * Manages push mechanics (Push Yourself action):
 * - Toggle push die (+1d to dice pool)
 * - Toggle push effect (Effect +1)
 * - Creates Redux actions for push state changes
 *
 * This handler encapsulates the 44-line event handling from PlayerActionWidget
 * (_onTogglePushDie and _onTogglePushEffect methods).
 */

import type { PlayerRoundState, PlayerPushType } from '@/types/playerRoundState';
import { asReduxId } from '../types/ids';

/**
 * Configuration for push operations
 */
export interface PushHandlerConfig {
  characterId: string;
}

/**
 * Push Handler
 *
 * Responsible for managing push mechanics including:
 * - Determining current push state (die vs effect)
 * - Creating Redux actions to toggle push states
 * - Handling push type transitions
 *
 * @example
 * const handler = new PushHandler({ characterId });
 *
 * // Toggle push die
 * const action = handler.createTogglePushDieAction(playerState);
 * await game.fitgd.bridge.execute(action);
 *
 * // Toggle push effect
 * const action = handler.createTogglePushEffectAction(playerState);
 * await game.fitgd.bridge.execute(action);
 */
export class PushHandler {
  constructor(private config: PushHandlerConfig) { }

  /**
   * Check if push die is currently active
   *
   * @param playerState - Current player round state
   * @returns true if push die is active
   *
   * @example
   * if (handler.isPushDieActive(playerState)) {
   *   console.log('Push die is already active');
   * }
   */
  isPushDieActive(playerState: PlayerRoundState | null): boolean {
    return playerState?.pushed && playerState?.pushType === 'extra-die' ? true : false;
  }

  /**
   * Check if push effect is currently active
   *
   * @param playerState - Current player round state
   * @returns true if push effect is active
   *
   * @example
   * if (handler.isPushEffectActive(playerState)) {
   *   console.log('Push effect is already active');
   * }
   */
  isPushEffectActive(playerState: PlayerRoundState | null): boolean {
    return playerState?.pushed && playerState?.pushType === 'improved-effect' ? true : false;
  }

  /**
   * Create Redux action to toggle push die
   *
   * @param playerState - Current player round state
   * @returns Redux action payload for Bridge API
   *
   * @example
   * const action = handler.createTogglePushDieAction(playerState);
   * await game.fitgd.bridge.execute(action);
   */
  createTogglePushDieAction(
    playerState: PlayerRoundState | null
  ): {
    type: string;
    payload: {
      characterId: string;
      pushed: boolean;
      pushType: PlayerPushType | undefined;
    };
  } {
    const currentlyPushedDie = this.isPushDieActive(playerState);

    return {
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.config.characterId,
        pushed: !currentlyPushedDie,
        pushType: !currentlyPushedDie ? 'extra-die' : undefined,
      },
    };
  }

  /**
   * Create Redux action to toggle push effect
   *
   * @param playerState - Current player round state
   * @returns Redux action payload for Bridge API
   *
   * @example
   * const action = handler.createTogglePushEffectAction(playerState);
   * await game.fitgd.bridge.execute(action);
   */
  createTogglePushEffectAction(
    playerState: PlayerRoundState | null
  ): {
    type: string;
    payload: {
      characterId: string;
      pushed: boolean;
      pushType: PlayerPushType | undefined;
    };
  } {
    const currentlyPushedEffect = this.isPushEffectActive(playerState);

    return {
      type: 'playerRoundState/setImprovements',
      payload: {
        characterId: this.config.characterId,
        pushed: !currentlyPushedEffect,
        pushType: !currentlyPushedEffect ? 'improved-effect' : undefined,
      },
    };
  }

  /**
   * Get affected Redux ID for this character
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedReduxId(): string {
    return asReduxId(this.config.characterId);
  }
}
