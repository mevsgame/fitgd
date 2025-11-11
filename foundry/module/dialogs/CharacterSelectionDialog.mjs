/**
 * Character Selection Dialog
 *
 * Dialog for selecting a character (e.g., Protect mechanic)
 */

// @ts-check

import { BaseSelectionDialog } from './base/BaseSelectionDialog.mjs';

/**
 * @typedef {import('../../dist/types').Character} Character
 * @typedef {import('../../dist/store').RootState} RootState
 */

/**
 * Dialog for selecting a character
 *
 * @extends {BaseSelectionDialog}
 */
export class CharacterSelectionDialog extends BaseSelectionDialog {
  /**
   * @param {string} crewId - Crew ID
   * @param {string} currentCharacterId - ID of current acting character
   * @param {Function} onSelect - Callback: (characterId) => void
   */
  constructor(crewId, currentCharacterId, onSelect) {
    const state = game.fitgd.store.getState();
    const crew = state.crews.byId[crewId];

    if (!crew) {
      throw new Error(`Crew ${crewId} not found`);
    }

    // Get all characters in crew
    const characters = crew.characters.map((id) => state.characters.byId[id]).filter(Boolean);

    // Sort: acting character first, then others alphabetically
    characters.sort((a, b) => {
      if (a.id === currentCharacterId) return -1;
      if (b.id === currentCharacterId) return 1;
      return a.name.localeCompare(b.name);
    });

    super({
      title: 'Select Target Character',
      items: characters,
      allowCreate: false,
      emptyMessage: 'No characters in crew',
      onSelect: onSelect,
      showSearch: characters.length > 5,
      width: 400,
      height: 'auto',
    });

    this.currentCharacterId = currentCharacterId;
  }

  /**
   * Render character item with label (acting vs protecting)
   *
   * @param {Character} character - Character to render
   * @returns {string} HTML string
   * @protected
   */
  _defaultRenderItem(character) {
    const isActing = character.id === this.currentCharacterId;
    const label = isActing ? '(Acting)' : '(Protect)';
    const labelClass = isActing ? 'acting' : 'protect';

    return `
      <div class="character-item">
        <span class="char-name">${character.name}</span>
        <span class="char-label ${labelClass}">${label}</span>
      </div>
    `;
  }
}