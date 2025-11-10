/**
 * Clock Selection Dialog
 *
 * Dialog for selecting a harm or crew clock
 */

// @ts-check

import { BaseSelectionDialog } from './base/BaseSelectionDialog.mjs';

/**
 * @typedef {import('../../dist/types').Clock} Clock
 * @typedef {import('../../dist/store').RootState} RootState
 */

/**
 * Dialog for selecting a harm or crew clock
 *
 * @extends {BaseSelectionDialog}
 */
export class ClockSelectionDialog extends BaseSelectionDialog {
  /**
   * @param {string} entityId - Character or crew ID
   * @param {'harm' | 'crew'} clockType - Clock type to filter
   * @param {Function} onSelect - Callback: (clockId) => void
   */
  constructor(entityId, clockType, onSelect) {
    const state = game.fitgd.store.getState();

    // Get clocks for entity
    const allClocks = Object.values(state.clocks.byId);
    const entityClocks = allClocks.filter((clock) => {
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
   * @param {Clock} clock - Clock to render
   * @returns {string} HTML string
   * @protected
   */
  _defaultRenderItem(clock) {
    return `
      <div class="clock-item">
        <span class="clock-name">${clock.subtype || 'Unnamed Clock'}</span>
        <span class="clock-segments">${clock.segments}/${clock.maxSegments}</span>
      </div>
    `;
  }
}
