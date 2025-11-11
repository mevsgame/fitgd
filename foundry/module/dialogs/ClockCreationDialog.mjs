/**
 * Clock Creation Dialog
 *
 * Unified dialog for creating harm clocks or crew clocks with proper segment selection.
 * Matches the grimdark aesthetic and consolidates duplicate logic.
 */

// @ts-check

/**
 * @typedef {'harm' | 'progress'} ClockType
 * @typedef {import('../../dist/types').Clock} Clock
 */

/**
 * Clock Creation Dialog
 *
 * Provides a styled form for creating new clocks with:
 * - Clock name/type input
 * - Segment count selection (4, 6, 8, 12)
 * - Optional description
 * - Grimdark UI styling
 *
 * @extends Dialog
 */
export class ClockCreationDialog extends Dialog {
  /**
   * Create a new Clock Creation Dialog
   *
   * @param {string} entityId - Character or crew ID
   * @param {ClockType} clockType - 'harm' or 'progress' (crew clock)
   * @param {Function} onCreate - Callback: (clockData) => Promise<void>
   *   clockData: { name: string, segments: number, description?: string }
   * @param {Object} options - Additional dialog options
   */
  constructor(entityId, clockType, onCreate, options = {}) {
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
        callback: (html) => this._onApply(html, onCreate, clockType)
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

    this.entityId = entityId;
    this.clockType = clockType;
  }

  /**
   * Handle form submission
   *
   * @param {jQuery} html - Dialog HTML
   * @param {Function} onCreate - Callback function
   * @param {ClockType} clockType - Clock type
   * @private
   */
  async _onApply(html, onCreate, clockType) {
    const form = html.find('form')[0];
    const clockName = form.clockName.value.trim();
    const segments = parseInt(form.segments.value, 10);
    const description = form.description?.value?.trim() || undefined;
    const category = form.category?.value;

    // Validation
    if (!clockName) {
      ui.notifications.warn('Please enter a clock name');
      return false; // Prevent dialog from closing
    }

    if (!segments || segments < 4 || segments > 12) {
      ui.notifications.error('Invalid segment count');
      return false;
    }

    // Build clock data
    const clockData = {
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
      ui.notifications.info(`Clock "${clockName}" created`);
    } catch (error) {
      console.error('FitGD | Clock creation error:', error);
      ui.notifications.error(`Error creating clock: ${error.message}`);
      return false; // Prevent dialog from closing on error
    }

    return true; // Allow dialog to close
