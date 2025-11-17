/**
 * Clock Creation Dialog
 *
 * Unified dialog for creating harm clocks or crew clocks with proper segment selection.
 * Matches the grimdark aesthetic and consolidates duplicate logic.
 */

import { ClockSize } from "@/types";

type ClockType = 'harm' | 'progress';

interface ClockData {
  name: string;
  segments: ClockSize;
  description?: string;
  category?: string;
  isCountdown?: boolean;
}

/**
 * Clock Creation Dialog
 *
 * Provides a styled form for creating new clocks with:
 * - Clock name/type input
 * - Segment count selection (4, 6, 8, 12)
 * - Optional description
 * - Grimdark UI styling
 */
export class ClockCreationDialog extends Dialog {

  /**
   * Create a new Clock Creation Dialog
   *
   * @param _entityId - Character or crew ID (unused, kept for API compatibility)
   * @param clockType - 'harm' or 'progress' (crew clock)
   * @param onCreate - Callback: (clockData) => Promise<void>
   * @param options - Additional dialog options
   */
  constructor(
    _entityId: string,
    clockType: ClockType,
    onCreate: (clockData: ClockData) => void | Promise<void>,
    options: Partial<DialogOptions> = {}
  ) {
    const isHarm = clockType === 'harm';
    const title = isHarm ? 'Create Harm Clock' : 'Create Crew Clock';
    const placeholder = isHarm ? 'e.g., Physical Harm, Morale Damage' : 'e.g., Threat Level, Investigation';

    const content = `
      <div class="clock-creation-dialog">
        <div class="dialog-header">
          <h2>${title}</h2>
          <p class="help-text">Configure the new clock properties</p>
        </div>

        <form class="clock-creation-form">
          <div class="form-group">
            <label>Clock Name</label>
            <input type="text"
                   name="clockName"
                   placeholder="${placeholder}"
                   autofocus />
          </div>

          <div class="form-group">
            <label>Segments</label>
            <select name="segments">
              <option value="4">4 segments (short)</option>
              <option value="6" ${isHarm ? 'selected' : ''}>6 segments</option>
              <option value="8" ${!isHarm ? 'selected' : ''}>8 segments</option>
              <option value="12">12 segments (long)</option>
            </select>
          </div>

          ${!isHarm ? `
          <div class="form-group">
            <label>Category</label>
            <select name="category">
              <option value="long-term-project">Long-term Project</option>
              <option value="threat">Threat (countdown)</option>
              <option value="personal-goal">Personal Goal</option>
              <option value="obstacle">Obstacle</option>
              <option value="faction">Faction</option>
            </select>
          </div>
          ` : ''}

          <div class="form-group">
            <label>Description (optional)</label>
            <textarea name="description"
                      rows="2"
                      placeholder="Optional notes about this clock..."></textarea>
          </div>
        </form>
      </div>
    `;

    const buttons = {
      create: {
        icon: '<i class="fas fa-clock"></i>',
        label: 'Create Clock',
        callback: (html?: JQuery) => this._onApply(html!, onCreate, clockType)
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Cancel'
      }
    };

    super({
      title,
      content,
      buttons,
      default: 'create',
      classes: ['fitgd', 'clock-creation-dialog'],
      width: 450,
      ...options
    });
  }

  /**
   * Handle form submission
   */
  private async _onApply(
    html: JQuery,
    onCreate: (clockData: ClockData) => void | Promise<void>,
    clockType: ClockType
  ): Promise<boolean> {
    const form = html.find('form')[0] as HTMLFormElement;
    const clockName = (form.elements.namedItem('clockName') as HTMLInputElement).value.trim();
    const segments = <ClockSize>parseInt((form.elements.namedItem('segments') as HTMLSelectElement).value, 10);
    const descriptionEl = form.elements.namedItem('description') as HTMLTextAreaElement | null;
    const description = descriptionEl?.value?.trim() || undefined;
    const categoryEl = form.elements.namedItem('category') as HTMLSelectElement | null;
    const category = categoryEl?.value;

    // Validation
    if (!clockName) {
      ui.notifications!.warn('Please enter a clock name');
      return false; // Prevent dialog from closing
    }

    if (!segments || segments < 4 || segments > 12) {
      ui.notifications!.error('Invalid segment count');
      return false;
    }

    // Build clock data
    const clockData: ClockData = {
      name: clockName,
      segments,
      description
    };

    // Add category for crew clocks
    if (clockType === 'progress' && category) {
      clockData.category = category;
      clockData.isCountdown = category === 'threat';
    }

    try {
      // Call the onCreate callback with the clock data
      await onCreate(clockData);
      ui.notifications!.info(`Clock "${clockName}" created`);
    } catch (error) {
      console.error('FitGD | Clock creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications!.error(`Error creating clock: ${errorMessage}`);
      return false; // Prevent dialog from closing on error
    }

    return true; // Allow dialog to close
  }
}
