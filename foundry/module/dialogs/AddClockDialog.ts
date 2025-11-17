/**
 * Add Clock Dialog
 *
 * Dialog for adding progress clocks
 */

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers';
import { ClockCreationDialog } from './ClockCreationDialog';

/**
 * Clock data from the creation dialog
 */
interface ClockData {
  name: string;
  segments: number;
  category?: string;
  isCountdown?: boolean;
  description?: string;
}

export class AddClockDialog {
  private crewId: string;
  private options: any;

  /**
   * Create a new Add Clock Dialog
   *
   * This is now a wrapper around ClockCreationDialog for backwards compatibility.
   * Consolidates duplicate clock creation logic.
   *
   * @param crewId - Redux ID of the crew
   * @param options - Additional options passed to Dialog constructor
   */
  constructor(crewId: string, options: any = {}) {
    this.crewId = crewId;
    this.options = options;
  }

  /**
   * Render the underlying clock creation dialog
   *
   * @param force - Force render
   * @returns Promise resolving to the Application instance
   */
  async render(force?: boolean): Promise<Application> {
    // Dynamically import to avoid circular dependency 

    const dialog = new ClockCreationDialog(
      this.crewId,
      'progress',
      async (clockData: ClockData) => {
        try {
          game.fitgd!.api.clock.createProgress({
            entityId: this.crewId,
            name: clockData.name,
            segments: clockData.segments,
            category: clockData.category as 'long-term-project' | 'threat' | 'personal-goal' | 'obstacle' | 'faction' | undefined,
            isCountdown: clockData.isCountdown,
            description: clockData.description
          });

          // Save immediately (critical state change)
          await game.fitgd!.saveImmediate();

          // Re-render sheet (force = true to ensure new clock appears)
          refreshSheetsByReduxId([this.crewId], true);
        } catch (error) {
          ui.notifications!.error(`Error: ${(error as Error).message}`);
          console.error('FitGD | Add Clock error:', error);
          throw error; // Re-throw so dialog can handle it
        }
      },
      this.options
    );

    return (dialog as any).render(force);
  }
}
