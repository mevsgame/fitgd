/**
 * Dice Service
 *
 * Encapsulates all dice rolling and chat posting logic
 * Provides injectable service for testability
 */
import { logger } from '../utils/logger';

/**
 * Result from a dice roll including both the values and the Roll object
 */
export interface RollResult {
  /** Array of dice values, sorted descending */
  results: number[];
  /** The Foundry Roll object (for chat posting with Dice So Nice) */
  roll: Roll;
}

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
   * Roll dice and return full result including Roll object
   * Use this when you need to post to chat with Dice So Nice support
   *
   * @param dicePool - Number of d6 to roll (0 for desperate/2d6kl)
   * @returns RollResult with results array and Roll object
   */
  rollWithObject(dicePool: number): Promise<RollResult>;

  /**
   * Roll dice and show Dice So Nice animation WITHOUT creating a chat message
   * Use this when you want the 3D dice animation but will show results elsewhere
   *
   * @param dicePool - Number of d6 to roll (0 for desperate/2d6kl)
   * @returns Sorted array of dice results (descending order)
   */
  rollWithDiceSoNice(dicePool: number): Promise<number[]>;

  /**
   * Roll dice and immediately post to chat (for Dice So Nice compatibility)
   * This is the primary method for game rolls - uses ONE roll for both
   * the game logic AND the chat display
   *
   * @param dicePool - Number of d6 to roll (0 for desperate/2d6kl)
   * @param characterId - Redux ID of character making the roll
   * @param flavor - Flavor text to display with roll
   * @returns Sorted array of dice results (descending order)
   */
  rollAndPostToChat(dicePool: number, characterId: string, flavor: string): Promise<number[]>;
}

/**
 * Default Foundry implementation of DiceService
 *
 * Uses Foundry's Roll API to generate dice rolls and post them to chat
 */
export class FoundryDiceService implements DiceService {
  async roll(dicePool: number): Promise<number[]> {
    const { results } = await this.rollWithObject(dicePool);
    return results;
  }

  async rollWithDiceSoNice(dicePool: number): Promise<number[]> {
    try {
      logger.debug(`DiceService.rollWithDiceSoNice - Rolling ${dicePool}d6 with Dice So Nice (no chat)`);

      // Roll ONCE and get both results and Roll object
      const { results, roll } = await this.rollWithObject(dicePool);

      // Trigger Dice So Nice animation WITHOUT creating a chat message
      // This uses the Dice So Nice direct API if available
      if ((game as any).dice3d) {
        await (game as any).dice3d.showForRoll(roll, game.user, true);
        logger.debug('DiceService.rollWithDiceSoNice - Dice So Nice animation triggered');
      }

      return results;
    } catch (error) {
      logger.error('Error in DiceService.rollWithDiceSoNice:', error);
      throw error;
    }
  }

  async rollWithObject(dicePool: number): Promise<RollResult> {
    let roll: Roll;
    let results: number[];

    try {
      logger.debug(`DiceService.rollWithObject - Creating roll with dicePool: ${dicePool}`);

      if (dicePool === 0) {
        // Roll 2d6, take lowest (desperate roll)
        logger.debug('DiceService.rollWithObject - Rolling 2d6kl (desperate)');
        roll = await Roll.create('2d6kl').evaluate({ async: true }) as Roll;
        results = [roll.total];
        logger.debug('DiceService.rollWithObject - Desperate roll result:', results);
      } else {
        // Roll Nd6
        logger.debug(`DiceService.rollWithObject - Rolling ${dicePool}d6`);
        roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true }) as Roll;
        logger.debug('DiceService.rollWithObject - Roll created, extracting results');
        // Extract numeric values from result objects and sort descending
        results = (roll.dice[0].results as any[]).map((r: any) => r.result).sort((a, b) => b - a);
        logger.debug('DiceService.rollWithObject - Extracted results:', results);
      }

      return { results, roll };
    } catch (error) {
      logger.error('Error in DiceService.rollWithObject:', error);
      throw error;
    }
  }

  async rollAndPostToChat(dicePool: number, characterId: string, flavor: string): Promise<number[]> {
    try {
      logger.debug(`DiceService.rollAndPostToChat - Rolling ${dicePool}d6 and posting to chat`);

      // Roll ONCE and get both results and Roll object
      const { results, roll } = await this.rollWithObject(dicePool);

      // Post the SAME Roll object to chat (Dice So Nice will pick this up)
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: game.actors.get(characterId) }),
        flavor: flavor,
      });

      logger.debug('DiceService.rollAndPostToChat - Posted to chat with results:', results);
      return results;
    } catch (error) {
      logger.error('Error in DiceService.rollAndPostToChat:', error);
      throw error;
    }
  }
}
