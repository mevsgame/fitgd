/**
 * GM Consequence Resolution Dialog
 *
 * Context-aware dialog for selecting and applying clock interactions.
 * Shows smart suggestions based on roll outcome and allows GM overrides.
 */

import type { Clock } from '@/types/clock';
import type { InteractionContext, ClockWithSuggestion, ClockInteraction } from '@/types/clockInteraction';
import { suggestClockInteractions } from '@/utils/clockInteractions';

interface ConsequenceResolutionCallbacks {
  onApply?: (interaction: ClockInteraction) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
}

/**
 * GM Consequence Resolution Dialog
 *
 * Shows all available clocks with smart suggestions based on roll context.
 * GM selects exactly ONE clock to affect (or none).
 */
export class ConsequenceResolutionDialog extends Dialog {
  private context: InteractionContext;
  private availableClocks: Clock[];
  private callbacks: ConsequenceResolutionCallbacks;
  private suggestions: ClockWithSuggestion[] = [];
  private selectedClockId: string | null = null;
  private overrideAmount: number | null = null;
  private overrideDirection: 'advance' | 'reduce' | null = null;

  constructor(
    context: InteractionContext,
    availableClocks: Clock[],
    callbacks: ConsequenceResolutionCallbacks = {}
  ) {
    const content = `
      <div class="consequence-resolution-dialog">
        <div class="dialog-header">
          <h2>Resolve Consequence</h2>
          <p class="context-summary">
            <strong>${context.outcome}</strong> at
            <strong>${context.position}/${context.effect}</strong>
            ${context.actionType ? `(${context.actionType})` : ''}
          </p>
        </div>

        <form class="consequence-form">
          <div class="clocks-section">
            <h3>Select Clock (or none)</h3>
            <div class="clock-list">
              <!-- Will be populated by getData() -->
            </div>
          </div>

          <div class="override-section" style="display: none;">
            <h3>Override Suggestion</h3>

            <div class="form-group">
              <label>Direction</label>
              <select name="direction">
                <option value="advance">Advance (add segments)</option>
                <option value="reduce">Reduce (remove segments)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Amount</label>
              <input type="number" name="amount" min="0" max="12" />
            </div>
          </div>

          <div class="preview-section" style="display: none;">
            <div class="preview-box">
              <strong>Preview:</strong>
              <span class="preview-text"></span>
            </div>
          </div>
        </form>
      </div>
    `;

    const buttons = {
      apply: {
        icon: '<i class="fas fa-check"></i>',
        label: 'Apply',
        callback: (html: JQuery) => this._onApply(html)
      },
      skip: {
        icon: '<i class="fas fa-forward"></i>',
        label: 'Skip (No Clock)',
        callback: () => this._onSkip()
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: 'Cancel'
      }
    };

    super({
      title: 'Resolve Consequence',
      content,
      buttons,
      default: 'apply',
      classes: ['fitgd', 'fitgd-dialog', 'consequence-resolution-dialog'],
      width: 600,
      height: 'auto'
    });

    this.context = context;
    this.availableClocks = availableClocks;
    this.callbacks = callbacks;
  }

  override async getData(): Promise<any> {
    const data = await super.getData();

    // Get suggestions based on context
    this.suggestions = suggestClockInteractions(this.context, this.availableClocks);

    // Group by type
    const harmSuggestions = this.suggestions.filter(s => s.clock.category === 'harm');
    const threatSuggestions = this.suggestions.filter(s => s.clock.category === 'threat');
    const progressSuggestions = this.suggestions.filter(s => s.clock.category === 'progress');

    return {
      ...data,
      context: this.context,
      harmSuggestions,
      threatSuggestions,
      progressSuggestions,
      hasSuggestions: this.suggestions.length > 0
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Render clock suggestions
    this._renderClockSuggestions(html);

    // Clock selection (radio buttons)
    html.find('.clock-option').on('click', (event) => {
      const clockId = $(event.currentTarget).data('clock-id');
      this._onSelectClock(clockId, html);
    });

    // Override controls
    html.find('[name="direction"]').on('change', () => this._updatePreview(html));
    html.find('[name="amount"]').on('input', () => this._updatePreview(html));

    // Initial preview update
    this._updatePreview(html);
  }

  private _renderClockSuggestions(html: JQuery): void {
    const clockList = html.find('.clock-list');
    clockList.empty();

    if (this.suggestions.length === 0) {
      clockList.append('<p class="no-suggestions">No clock suggestions for this context. You can skip.</p>');
      return;
    }

    // Group by category
    const harmSuggestions = this.suggestions.filter(s => s.clock.category === 'harm');
    const threatSuggestions = this.suggestions.filter(s => s.clock.category === 'threat');
    const progressSuggestions = this.suggestions.filter(s => s.clock.category === 'progress');

    // Render Harm clocks
    if (harmSuggestions.length > 0) {
      clockList.append('<h4>Harm Clocks (Character)</h4>');
      for (const suggestion of harmSuggestions) {
        clockList.append(this._renderClockOption(suggestion));
      }
    }

    // Render Threat clocks
    if (threatSuggestions.length > 0) {
      clockList.append('<h4>Threat Clocks (Crew/Scene)</h4>');
      for (const suggestion of threatSuggestions) {
        clockList.append(this._renderClockOption(suggestion));
      }
    }

    // Render Progress clocks
    if (progressSuggestions.length > 0) {
      clockList.append('<h4>Progress Clocks</h4>');
      for (const suggestion of progressSuggestions) {
        clockList.append(this._renderClockOption(suggestion));
      }
    }
  }

  private _renderClockOption(suggestion: ClockWithSuggestion): string {
    const { clock, suggestedDirection, suggestedAmount, reasoning } = suggestion;

    const directionIcon = suggestedDirection === 'advance'
      ? '<i class="fas fa-arrow-up" style="color: red;"></i>'
      : '<i class="fas fa-arrow-down" style="color: green;"></i>';

    const directionText = suggestedDirection === 'advance' ? '+' : '-';

    return `
      <div class="clock-option" data-clock-id="${clock.id}">
        <input type="radio" name="selectedClock" value="${clock.id}" id="clock-${clock.id}">
        <label for="clock-${clock.id}">
          <div class="clock-info">
            <span class="clock-name">${clock.name || clock.subtype || 'Unnamed Clock'}</span>
            <span class="clock-segments">${clock.segments}/${clock.maxSegments}</span>
          </div>
          <div class="suggestion-info">
            ${directionIcon} ${directionText}${suggestedAmount} segments
            <span class="reasoning">${reasoning}</span>
          </div>
        </label>
      </div>
    `;
  }

  private _onSelectClock(clockId: string, html: JQuery): void {
    this.selectedClockId = clockId;

    // Update radio button
    html.find(`#clock-${clockId}`).prop('checked', true);

    // Show override section
    html.find('.override-section').show();

    // Get suggestion for this clock
    const suggestion = this.suggestions.find(s => s.clock.id === clockId);

    if (suggestion) {
      // Pre-fill with suggestion
      html.find('[name="direction"]').val(suggestion.suggestedDirection || 'advance');
      html.find('[name="amount"]').val(suggestion.suggestedAmount || 0);
    }

    // Show preview
    html.find('.preview-section').show();
    this._updatePreview(html);
  }

  private _updatePreview(html: JQuery): void {
    if (!this.selectedClockId) {
      html.find('.preview-section').hide();
      return;
    }

    const direction = html.find('[name="direction"]').val() as 'advance' | 'reduce';
    const amount = parseInt(html.find('[name="amount"]').val() as string) || 0;

    const suggestion = this.suggestions.find(s => s.clock.id === this.selectedClockId);
    if (!suggestion) return;

    const clock = suggestion.clock;
    const newSegments = direction === 'advance'
      ? Math.min(clock.segments + amount, clock.maxSegments)
      : Math.max(clock.segments - amount, 0);

    const previewText = html.find('.preview-text');
    previewText.html(`
      <strong>${clock.name || clock.subtype}</strong>:
      ${clock.segments}/${clock.maxSegments} → ${newSegments}/${clock.maxSegments}
      ${direction === 'reduce' && newSegments === 0 ? ' <em>(will be deleted)</em>' : ''}
    `);
  }

  private async _onApply(html: JQuery): Promise<void> {
    if (!this.selectedClockId) {
      ui.notifications.warn('No clock selected. Use "Skip" if you don\'t want to apply a consequence.');
      return;
    }

    const direction = html.find('[name="direction"]').val() as 'advance' | 'reduce';
    const amount = parseInt(html.find('[name="amount"]').val() as string) || 0;

    if (amount <= 0) {
      ui.notifications.error('Amount must be greater than 0');
      return;
    }

    // Create interaction
    const interaction: ClockInteraction = {
      clockId: this.selectedClockId,
      direction,
      amount,
      context: `${this.context.outcome} at ${this.context.position}/${this.context.effect}`
    };

    // Invoke callback (widget handles Redux dispatch)
    if (this.callbacks.onApply) {
      await this.callbacks.onApply(interaction);
    }
  }

  private async _onSkip(): Promise<void> {
    // Invoke skip callback (widget handles momentum award and state transition)
    if (this.callbacks.onSkip) {
      await this.callbacks.onSkip();
    }
  }
}
