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
   * @param preSelectedCategory - Optional: lock category to this value (e.g., 'threat' for consequences)
   */
  constructor(
    _entityId: string,
    clockType: ClockType,
    onCreate: (clockData: ClockData) => void | Promise<void>,
    options: Partial<DialogOptions> = {},
    preSelectedCategory?: 'threat' | 'long-term-project' | 'personal-goal' | 'obstacle' | 'faction'
  ) {
    const isHarm = clockType === 'harm';
    const isLockedCategory = preSelectedCategory !== undefined;
    const title = isHarm ? game.i18n.localize('FITGD.Dialogs.ClockCreation.TitleHarm') : (isLockedCategory ? game.i18n.localize('FITGD.Dialogs.ClockCreation.TitleThreat') : game.i18n.localize('FITGD.Dialogs.ClockCreation.TitleCrew'));
    const placeholder = isHarm ? game.i18n.localize('FITGD.Dialogs.ClockCreation.PlaceholderHarm') : game.i18n.localize('FITGD.Dialogs.ClockCreation.PlaceholderCrew');

    const content = `
      <div class="clock-creation-dialog">
        <div class="dialog-header">
          <p class="help-text">${game.i18n.localize('FITGD.Dialogs.ClockCreation.HelpText')}</p>
        </div>

        <form class="clock-creation-form">
          <div class="form-group">
            <label>${game.i18n.localize('FITGD.Dialogs.ClockCreation.ClockName')}</label>
            <input type="text"
                   name="clockName"
                   placeholder="${placeholder}"
                   autofocus />
          </div>

          <div class="form-group">
            <label>${game.i18n.localize('FITGD.Dialogs.ClockCreation.Segments')}</label>
            <select name="segments">
              <option value="4">4 ${game.i18n.localize('FITGD.Dialogs.ClockCreation.Segments')} (${game.i18n.localize('FITGD.Dialogs.ClockCreation.Short')})</option>
              <option value="6" ${isHarm ? 'selected' : ''}>6 ${game.i18n.localize('FITGD.Dialogs.ClockCreation.Segments')}</option>
              <option value="8" ${!isHarm ? 'selected' : ''}>8 ${game.i18n.localize('FITGD.Dialogs.ClockCreation.Segments')}</option>
              <option value="12">12 ${game.i18n.localize('FITGD.Dialogs.ClockCreation.Segments')} (${game.i18n.localize('FITGD.Dialogs.ClockCreation.Long')})</option>
            </select>
          </div>

          ${!isHarm ? `
          <div class="form-group">
            <label>${game.i18n.localize('FITGD.Dialogs.ClockCreation.Category')}${isLockedCategory ? game.i18n.localize('FITGD.Dialogs.ClockCreation.LockedConsequence') : ''}</label>
            <select name="category" ${isLockedCategory ? 'disabled' : ''}>
              <option value="long-term-project" ${preSelectedCategory === 'long-term-project' ? 'selected' : ''}>${game.i18n.localize('FITGD.Clocks.CategoryLongTermProject')}</option>
              <option value="threat" ${preSelectedCategory === 'threat' ? 'selected' : ''}>${game.i18n.localize('FITGD.Clocks.CategoryThreat')}</option>
              <option value="personal-goal" ${preSelectedCategory === 'personal-goal' ? 'selected' : ''}>${game.i18n.localize('FITGD.Clocks.CategoryPersonalGoal')}</option>
              <option value="obstacle" ${preSelectedCategory === 'obstacle' ? 'selected' : ''}>${game.i18n.localize('FITGD.Clocks.CategoryObstacle')}</option>
              <option value="faction" ${preSelectedCategory === 'faction' ? 'selected' : ''}>${game.i18n.localize('FITGD.Clocks.CategoryFaction')}</option>
            </select>
            ${isLockedCategory ? `<p class="form-help">${game.i18n.localize('FITGD.Dialogs.ClockCreation.LockedHelp')}</p>` : ''}
          </div>
          ` : ''}

          <div class="form-group">
            <label>${game.i18n.localize('FITGD.Dialogs.ClockCreation.DescriptionOptional')}</label>
            <textarea name="description"
                      rows="2"
                      placeholder="${game.i18n.localize('FITGD.Dialogs.ClockCreation.DescriptionPlaceholder')}"></textarea>
          </div>
        </form>
      </div>
    `;

    const buttons = {
      create: {
        icon: '<i class="fas fa-clock"></i>',
        label: game.i18n.localize('FITGD.Dialogs.ClockCreation.CreateClock'),
        callback: async (html?: JQuery<HTMLElement>) => {
          await this._onApply(html!, onCreate, clockType, preSelectedCategory);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('FITGD.Global.Cancel')
      }
    };

    super(
      {
        title,
        content,
        buttons,
        default: 'create'
      },
      {
        classes: ['fitgd', 'dialog', 'fitgd-dialog', 'clock-creation-dialog'],
        width: 450,
        ...options
      }
    );
  }

  /**
   * Handle form submission
   *
   * @private
   * @param html - Dialog HTML
   * @param onCreate - Callback to create the clock
   * @param clockType - Type of clock being created
   * @param preSelectedCategory - Pre-selected category (if locked)
   * @returns True if dialog should close, false otherwise
   */
  private async _onApply(
    html: JQuery,
    onCreate: (clockData: ClockData) => void | Promise<void>,
    clockType: ClockType,
    preSelectedCategory?: string
  ): Promise<boolean> {
    const form = html.find('form')[0] as HTMLFormElement;
    const clockName = (form.elements.namedItem('clockName') as HTMLInputElement).value.trim();
    const segments = <ClockSize>parseInt((form.elements.namedItem('segments') as HTMLSelectElement).value, 10);
    const descriptionEl = form.elements.namedItem('description') as HTMLTextAreaElement | null;
    const description = descriptionEl?.value?.trim() || undefined;
    const categoryEl = form.elements.namedItem('category') as HTMLSelectElement | null;
    // Use preSelectedCategory if field is disabled, otherwise get from form
    const category = preSelectedCategory || categoryEl?.value;

    // Validation
    if (!clockName) {
      ui.notifications!.warn(game.i18n.localize('FITGD.Messages.EnterClockName'));
      return false; // Prevent dialog from closing
    }

    if (!segments || segments < 4 || segments > 12) {
      ui.notifications!.error(game.i18n.localize('FITGD.Messages.InvalidSegments'));
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
      ui.notifications!.info(game.i18n.format('FITGD.Messages.ClockCreated', { name: clockName }));
    } catch (error) {
      console.error('FitGD | Clock creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications!.error(game.i18n.format('FITGD.Messages.RollFailed', { error: errorMessage }));
      return false; // Prevent dialog from closing on error
    }

    return true; // Allow dialog to close
  }
}
