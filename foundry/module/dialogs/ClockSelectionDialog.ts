/**
 * Clock Selection Dialog
 *
 * Dialog for selecting a harm or crew clock
 */

import { BaseSelectionDialog } from './base/BaseSelectionDialog';
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';

/**
 * Dialog for selecting a harm or crew clock
 */
export class ClockSelectionDialog extends BaseSelectionDialog {
  private entityId: string;
  private clockType: 'harm' | 'crew';

  /**
   * @param entityId - Character or crew ID
   * @param clockType - Clock type to filter
   * @param onSelect - Callback: (clockId) => void
   */
  constructor(
    entityId: string,
    clockType: 'harm' | 'crew',
    onSelect: (clockId: string) => void | Promise<void>
  ) {
    const state: RootState = game.fitgd.store.getState();

    // Get clocks for entity
    const allClocks = Object.values(state.clocks.byId);
    const entityClocks = allClocks.filter((clock: Clock) => {
      if (clock.entityId !== entityId) return false;

      if (clockType === 'harm') {
        return clock.clockType === 'harm';
      } else {
        // crew clocks: anything that's not harm (progress clocks, consumables, addiction, etc.)
        return clock.clockType !== 'harm';
      }
    });

    super({
      title: clockType === 'harm' ? 'Select Harm Clock' : 'Select Crew Clock',
      items: entityClocks,
      allowCreate: true,
      emptyMessage: clockType === 'harm' ? 'No harm clocks yet' : 'No crew clocks available',
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

    this.entityId = entityId;
    this.clockType = clockType;
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
