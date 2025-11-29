/**
 * Widget Context Interface
 *
 * Provides an abstraction between the PlayerActionWidget and components that need widget state.
 * Allows event coordinators, presenters, and other services to be tested without depending on
 * the concrete PlayerActionWidget class or Foundry Application.
 *
 * This interface defines what capabilities and state are available to event handlers.
 */

import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { PlayerRoundState } from '@/types/playerRoundState';
import type { PlayerActionHandlerFactory } from '../services/playerActionHandlerFactory';
import type { DiceService } from '../services/diceService';
import type { NotificationService } from '../services/notificationService';
import type { DialogFactory } from '../services/dialogFactory';

/**
 * Context interface for Player Action Widget
 *
 * Provides access to:
 * - Entity state (character, crew, player round state)
 * - Utility services (dice, notifications, dialogs)
 * - Handler factory for creating handlers
 * - Special utility methods (post to chat)
 *
 * This abstraction allows event coordinators and presenters to be tested with a simple
 * mock object instead of requiring the full PlayerActionWidget + Foundry setup.
 *
 * @example
 * // Mock context for testing
 * const mockContext = {
 *   getCharacterId: () => 'char-1',
 *   getCharacter: () => mockCharacter(),
 *   getCrew: () => mockCrew(),
 *   getCrewId: () => 'crew-1',
 *   getPlayerState: () => mockPlayerState(),
 *   getDiceService: () => mockDiceService,
 *   getNotificationService: () => mockNotificationService,
 *   getDialogFactory: () => mockDialogFactory,
 *   getHandlerFactory: () => mockHandlerFactory,
 *   postSuccessToChat: jest.fn()
 * };
 *
 * const coordinator = new PlayerActionEventCoordinator(mockContext);
 * await coordinator.handleApproachChange('force');
 * // Test coordinator without Foundry!
 */
export interface IPlayerActionWidgetContext {
  /**
   * Get the character ID this widget is for
   * @returns Redux ID of the character taking their turn
   */
  getCharacterId(): string;

  /**
   * Get the character entity
   * @returns Character data or null if not loaded
   */
  getCharacter(): Character | null;

  /**
   * Get the crew entity
   * @returns Crew data or null if no crew
   */
  getCrew(): Crew | null;

  /**
   * Get the crew ID (if character is in a crew)
   * @returns Crew Redux ID or null
   */
  getCrewId(): string | null;

  /**
   * Get the current player round state
   * @returns PlayerRoundState or null if not in a turn
   */
  getPlayerState(): PlayerRoundState | null;

  /**
   * Get the dice service for rolling
   * @returns DiceService instance
   */
  getDiceService(): DiceService;

  /**
   * Get the notification service
   * @returns NotificationService instance
   */
  getNotificationService(): NotificationService;

  /**
   * Get the dialog factory for creating dialogs
   * @returns DialogFactory instance
   */
  getDialogFactory(): DialogFactory;

  /**
   * Get the handler factory for creating game handlers
   * @returns PlayerActionHandlerFactory instance
   */
  getHandlerFactory(): PlayerActionHandlerFactory;

  /**
   * Post a success message to the game chat
   *
   * Called when player successfully rolls and wants outcome posted to chat.
   * This is a utility method specific to the widget's presentation layer.
   *
   * @param outcome - The outcome type ('critical' | 'success')
   * @param rollResult - Array of dice values rolled
   */
  postSuccessToChat(outcome: string, rollResult: number[]): Promise<void>;
}
