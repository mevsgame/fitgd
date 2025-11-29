/**
 * Notification Service
 *
 * Encapsulates UI notification logic
 * Provides injectable service for testability
 */

/**
 * Interface for displaying notifications to users
 */
export interface NotificationService {
  /**
   * Display an info notification (blue toast)
   *
   * @param message - Message to display
   */
  info(message: string): void;

  /**
   * Display a warning notification (yellow toast)
   *
   * @param message - Message to display
   */
  warn(message: string): void;

  /**
   * Display an error notification (red toast)
   *
   * @param message - Message to display
   */
  error(message: string): void;
}

/**
 * Default Foundry implementation of NotificationService
 *
 * Uses Foundry's ui.notifications API to display toasts
 */
export class FoundryNotificationService implements NotificationService {
  info(message: string): void {
    ui.notifications?.info(message);
  }

  warn(message: string): void {
    ui.notifications?.warn(message);
  }

  error(message: string): void {
    ui.notifications?.error(message);
  }
}
