/**
 * Character Selection Dialog
 *
 * Dialog for selecting a character (e.g., Protect mechanic)
 */

import { BaseSelectionDialog } from './base/BaseSelectionDialog';
import type { Character } from '@/types/character';
import type { RootState } from '@/store';

/**
 * Dialog for selecting a character
 */
export class CharacterSelectionDialog extends BaseSelectionDialog {
  private currentCharacterId: string;

  /**
   * @param crewId - Crew ID
   * @param currentCharacterId - ID of current acting character
   * @param onSelect - Callback: (characterId) => void
   */
  constructor(
    crewId: string,
    currentCharacterId: string,
    onSelect: (characterId: string) => void | Promise<void>
  ) {
    const state: RootState = game.fitgd.store.getState();
    const crew = state.crews.byId[crewId];

    if (!crew) {
      throw new Error(`Crew ${crewId} not found`);
    }

    // Get all characters in crew
    const characters = crew.characters
      .map((id) => state.characters.byId[id])
      .filter((char): char is Character => !!char);

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
   * @param character - Character to render
   * @returns HTML string
   * @protected
   */
  protected override _defaultRenderItem(character: Character): string {
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
