/**
 * Clock Selection Dialog
 *
 * Dialog for selecting a harm or crew clock
 */

import { BaseSelectionDialog } from './base/BaseSelectionDialog';
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';
import { selectHarmClocksByCharacter, selectThreatClocksByCrew } from '@/selectors/clockSelectors';

/**
 * Dialog for selecting a harm or crew clock
 */
export class ClockSelectionDialog extends BaseSelectionDialog {
  /**
   * @param _entityId - Character or crew ID (unused, kept for API compatibility)
   * @param clockType - Clock type to filter
   * @param onSelect - Callback: (clockId) => void
   */
  constructor(
    _entityId: string,
    clockType: 'harm' | 'crew',
    onSelect: (clockId: string) => void | Promise<void>
  ) {
    const state: RootState = game.fitgd!.store.getState();

    // Get clocks for entity using selectors
    let entityClocks: Clock[];
    let title: string;
    let emptyMessage: string;

    if (clockType === 'harm') {
      entityClocks = selectHarmClocksByCharacter(state, _entityId);
      title = 'Select Harm Clock';
      emptyMessage = 'No harm clocks yet';
    } else {
      // crew clocks: only threat category
      entityClocks = selectThreatClocksByCrew(state, _entityId);
      title = 'Select Threat Clock';
      emptyMessage = 'No threat clocks available';
    }

    super({
      title,
      items: entityClocks,
      allowCreate: true,
      emptyMessage,
      onSelect: onSelect,
      onCreate: async () => {
        // Close this dialog and trigger create flow
        if (onSelect) {
          await onSelect('_new');
        }
      },
      showSearch: entityClocks.length > 5, // Only show search if many clocks
      width: 450,
      height: 'auto',
    });
  }

  /**
   * Render a clock item with segments display
   *
   * @param clock - Clock to render
   * @returns HTML string
   * @protected
   */
  protected override _defaultRenderItem(clock: Clock): string {
    return `
      <div class="clock-item">
        <span class="clock-name">${clock.subtype || 'Unnamed Clock'}</span>
        <span class="clock-segments">${clock.segments}/${clock.maxSegments}</span>
      </div>
    `;
  }
}
