/**
 * Dice Service
 *
 * Encapsulates all dice rolling and chat posting logic
 * Provides injectable service for testability
 */
import { logger } from '../utils/logger';

/**
 * Interface for dice rolling operations
 */
export interface DiceService {
  /**
   * Roll dice and return sorted results
   *
   * @param dicePool - Number of d6 to roll (0 for desperate/2d6kl)
   * @returns Sorted array of dice results (descending order)
   */
  roll(dicePool: number): Promise<number[]>;

  /**
   * Post roll result to chat message
   *
   * @param result - Array of rolled values
   * @param characterId - Redux ID of character making the roll
   * @param flavor - Flavor text to display with roll (e.g., "Force approach")
   */
  postRollToChat(result: number[], characterId: string, flavor: string): Promise<void>;
}

/**
 * Default Foundry implementation of DiceService
 *
 * Uses Foundry's Roll API to generate dice rolls and post them to chat
 */
export class FoundryDiceService implements DiceService {
  async roll(dicePool: number): Promise<number[]> {
    let roll: Roll;
    let results: number[];

    try {
      logger.debug(`DiceService.roll - Creating roll with dicePool: ${dicePool}`);

      if (dicePool === 0) {
        // Roll 2d6, take lowest (desperate roll)
        logger.debug('DiceService.roll - Rolling 2d6kl (desperate)');
        roll = await Roll.create('2d6kl').evaluate({ async: true });
        results = [roll.total];
        logger.debug('DiceService.roll - Desperate roll result:', results);
      } else {
        // Roll Nd6
        logger.debug(`DiceService.roll - Rolling ${dicePool}d6`);
        roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true });
        logger.debug('DiceService.roll - Roll created, extracting results');
        // Extract numeric values from result objects and sort descending
        results = (roll.dice[0].results as any[]).map((r: any) => r.result).sort((a, b) => b - a);
        logger.debug('DiceService.roll - Extracted results:', results);
      }

      return results;
    } catch (error) {
      logger.error('Error in DiceService.roll:', error);
      throw error;
    }
  }

  async postRollToChat(result: number[], characterId: string, flavor: string): Promise<void> {
    try {
      logger.debug('DiceService.postRollToChat - Posting roll to chat');

      // Reconstruct the roll for chat display
      const dicePool = result.length;
      let roll: Roll;

      if (dicePool === 1 && result[0] <= 6) {
        // Single die from desperate roll
        roll = await Roll.create('2d6kl').evaluate({ async: true });
      } else {
        roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true });
      }

      // Post roll to chat with flavor text
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: game.actors.get(characterId) }),
        flavor: flavor,
      });

      logger.debug('DiceService.postRollToChat - Chat message posted');
    } catch (error) {
      logger.error('Error in DiceService.postRollToChat:', error);
      throw error;
    }
  }
}
