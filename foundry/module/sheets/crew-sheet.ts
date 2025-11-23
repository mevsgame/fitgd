/**
 * Crew Sheet Class
 *
 * Foundry VTT Actor Sheet for crew entities
 */

import type { Clock } from '@/types/clock';
import { AddClockDialog } from '../dialogs/index';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers';
import {
  getClockDataset,
  getCharacterDataset,
  getDatasetInt,
} from '../utils/dataset-helpers';

/* -------------------------------------------- */
/*  Crew Sheet Class                            */
/* -------------------------------------------- */

interface CrewSheetData extends ActorSheet.Data {
  system?: {
    currentMomentum: number;
    characters: Array<{
      id: string;
      name: string;
      foundryActorId: string;
    }>;
    addictionClock: Clock | null;
    progressClocks: Clock[];
  };
  reduxId?: string;
}

/**
 * FitGD Crew Sheet
 *
 * Foundry VTT Actor Sheet for crew entities. Displays and manages:
 * - Crew members (characters in the crew)
 * - Momentum pool (0-10, starts at 5)
 * - Addiction clock (fills when using too many stims)
 * - Progress clocks (long-term projects, threats, goals)
 *
 * All state is stored in Redux, fetched via actor's Redux ID flag.
 * Sheet provides UI for triggering crew-level actions (spend Momentum, etc.).
 */
class FitGDCrewSheet extends ActorSheet {
  static override get defaultOptions(): ActorSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'actor', 'crew'],
      template: 'systems/forged-in-the-grimdark/templates/crew-sheet.html',
      width: 800,
      height: 900,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'members' }]
    });
  }

  override getData(): CrewSheetData {
    const context = super.getData() as CrewSheetData;

    // Null safety checks
    if (!game.fitgd) {
      console.error('FitGD | FitGD not initialized');
      return context;
    }

    // Override editable to be GM-only for clock editing
    context.editable = game.user?.isGM || false;

    // Unified IDs: Foundry Actor ID === Redux ID
    const reduxId = this.actor.id;
    console.log('FitGD | Crew Sheet getData - reduxId:', reduxId, 'editable:', context.editable);

    if (reduxId) {
      const crew = game.fitgd.api.crew.getCrew(reduxId);

      if (crew) {
        // Resolve character names from Redux IDs
        const characterDetails = crew.characters.map((charId: string) => {
          const character = game.fitgd.api.character.getCharacter(charId);
          return {
            id: charId,
            name: character?.name || 'Unknown Character',
            // Find the Foundry actor for this character for linking
            foundryActorId: this._findFoundryActorId(charId)
          };
        });

        context.system = {
          currentMomentum: crew.currentMomentum,
          characters: characterDetails,
          addictionClock: game.fitgd.api.query.getAddictionClock(reduxId),
          progressClocks: game.fitgd.api.query.getProgressClocks(reduxId)
        };
        context.reduxId = reduxId;

        console.log('FitGD | Crew system data:', context.system);
      }
    }

    return context;
  }

  /**
   * Get Foundry actor ID from Redux character ID
   * (With unified IDs, they're the same!)
   */
  private _findFoundryActorId(characterReduxId: string): string {
    return characterReduxId; // Unified IDs: Redux ID === Foundry Actor ID
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Momentum controls
    html.find('.momentum-add-btn').click(this._onAddMomentum.bind(this));
    html.find('.momentum-spend-btn').click(this._onSpendMomentum.bind(this));
    html.find('.momentum-reset-btn').click(this._onResetMomentum.bind(this));

    // Clocks
    html.find('.add-clock-btn').click(this._onAddClock.bind(this));
    html.find('.clock-segment').click(this._onClickClockSegment.bind(this));

    // Clock controls (GM-only editing)
    html.find('.clock-container img.clock').click(this._onClickClockSVG.bind(this));
    html.find('.clock-value-input').change(this._onChangeClockValue.bind(this));
    html.find('.clock-name').blur(this._onRenameClockBlur.bind(this));
    html.find('.delete-clock-btn').click(this._onDeleteClock.bind(this));

    // Crew members
    html.find('.add-character-btn').click(this._onAddCharacter.bind(this));
    html.find('.remove-character-btn').click(this._onRemoveCharacter.bind(this));
  }

  /**
   * Get Redux crew ID (unified with Foundry Actor ID)
   */
  private _getReduxId(): string {
    return this.actor.id; // Unified IDs: Foundry Actor ID === Redux ID
  }

  private async _onAddMomentum(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    try {
      const amount = getDatasetInt(event.currentTarget as HTMLElement, 'amount', 1);

      game.fitgd.api.crew.addMomentum({ crewId, amount });
      ui.notifications?.info(`Added ${amount} Momentum`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Add Momentum error:', error);
    }
  }

  private async _onSpendMomentum(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    try {
      const amount = getDatasetInt(event.currentTarget as HTMLElement, 'amount', 1);

      game.fitgd.api.crew.spendMomentum({ crewId, amount });
      ui.notifications?.info(`Spent ${amount} Momentum`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Spend Momentum error:', error);
    }
  }

  private async _onResetMomentum(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    // GM-only check
    if (!game.user?.isGM) {
      ui.notifications?.warn('Only the GM can perform a Momentum Reset');
      return;
    }

    const crewId = this._getReduxId();
    if (!crewId) return;

    // Get crew and members
    const crew = game.fitgd.api.crew.getCrew(crewId);
    if (!crew) {
      ui.notifications?.error('Crew not found');
      return;
    }

    // Show confirmation dialog
    const confirmed = await Dialog.confirm({
      title: 'Perform Momentum Reset?',
      content: `
        <p><strong>This will perform a Momentum Reset:</strong></p>
        <ul>
          <li>Set Momentum to <strong>5</strong></li>
          <li>Reset Rally for all crew members</li>
          <li>Re-enable all disabled traits</li>
          <li>Reduce Addiction Clock by <strong>2 segments</strong></li>
          <li>Recover all dying (6/6) harm clocks to <strong>5/6</strong></li>
        </ul>
        <p>Continue?</p>
      `,
      yes: () => true,
      no: () => false,
      options: {
        classes: ['dialog', 'fitgd-dialog']
      }
    });

    if (!confirmed) return;

    try {
      // Perform momentum reset
      game.fitgd.api.crew.performReset(crewId);

      // Broadcast changes to all clients
      await game.fitgd.saveImmediate();

      // Refresh affected sheets (crew + all member characters)
      const affectedIds = [crewId, ...crew.characters];
      refreshSheetsByReduxId(affectedIds, false);

      ui.notifications?.info('Momentum Reset performed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Momentum Reset error:', error);
    }
  }

  private async _onAddClock(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    new AddClockDialog(crewId).render(true);
  }

  private async _onClickClockSegment(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    try {
      const target = event.currentTarget as HTMLElement;
      const { clockId } = getClockDataset(target);
      const segment = getDatasetInt(target, 'segment', 0);
      const currentSegments = getDatasetInt(target, 'currentSegments', 0);

      const clock = game.fitgd.api.clock.getClock(clockId);
      if (!clock) return;

      // Toggle segment: if clicking on filled segment, reduce; otherwise increase
      if (segment < currentSegments) {
        // Reduce to this segment
        const toRemove = currentSegments - segment;
        game.fitgd.api.clock.clearSegments({ clockId, segments: toRemove });
        ui.notifications?.info(`Clock reduced to ${segment} segments`);
      } else if (segment === currentSegments) {
        // Reduce by 1
        game.fitgd.api.clock.clearSegments({ clockId, segments: 1 });
        ui.notifications?.info(`Clock reduced by 1 segment`);
      } else {
        // Add to this segment
        const toAdd = segment - currentSegments + 1;
        game.fitgd.api.clock.addSegments({ clockId, segments: toAdd });
        ui.notifications?.info(`Clock advanced to ${segment + 1} segments`);
      }

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Clock segment error:', error);
    }
  }

  /**
   * Handle clicking on clock SVG image (GM-only)
   * Cycles through clock segments
   */
  private async _onClickClockSVG(event: JQuery.ClickEvent): Promise<void> {
    if (!game.user?.isGM) return;

    event.preventDefault();

    try {
      const img = event.currentTarget as HTMLElement;
      const { clockId } = getClockDataset(img);
      const currentValue = getDatasetInt(img, 'clockValue', 0);
      const maxValue = getDatasetInt(img, 'clockMax', 0);

      // Cycle: 0 -> max, then back to 0
      const newValue = currentValue >= maxValue ? 0 : currentValue + 1;

      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Clock SVG click error:', error);
    }
  }

  /**
   * Handle clock value input change (GM-only)
   * Directly sets clock segments
   */
  private async _onChangeClockValue(event: JQuery.ChangeEvent): Promise<void> {
    if (!game.user?.isGM) return;

    event.preventDefault();

    try {
      const input = event.currentTarget as HTMLInputElement;
      const { clockId } = getClockDataset(input);
      const newValue = parseInt(input.value, 10);

      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Clock value change error:', error);
    }
  }

  /**
   * Handle clock name blur (GM-only)
   * Renames clock when contenteditable loses focus
   */
  private async _onRenameClockBlur(event: JQuery.BlurEvent): Promise<void> {
    if (!game.user?.isGM) return;

    try {
      const element = event.currentTarget as HTMLElement;
      const { clockId } = getClockDataset(element);
      const newName = element.textContent?.trim();

      if (!newName) {
        this.render(false); // Reset to original name if empty
        return;
      }

      game.fitgd.api.clock.rename({ clockId, name: newName });
      await game.fitgd.saveImmediate();
      ui.notifications?.info(`Clock renamed to "${newName}"`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Clock rename error:', error);
      this.render(false); // Reset to original name
    }
  }

  /**
   * Handle delete clock button (GM-only)
   */
  private async _onDeleteClock(event: JQuery.ClickEvent): Promise<void> {
    if (!game.user?.isGM) return;

    event.preventDefault();

    try {
      const target = event.currentTarget as HTMLElement;
      const { clockId } = getClockDataset(target);

      const confirmed = await Dialog.confirm({
        title: 'Delete Clock',
        content: '<p>Are you sure you want to delete this clock?</p>',
        yes: () => true,
        no: () => false
      });

      if (!confirmed) return;

      game.fitgd.api.clock.delete(clockId);
      await game.fitgd.saveImmediate();
      this.render(false);
      ui.notifications?.info('Clock deleted');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Clock delete error:', error);
    }
  }

  private async _onAddCharacter(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    // Show dialog to select character
    const characters = game.actors.filter(a => a.type === 'character');

    if (characters.length === 0) {
      ui.notifications?.warn('No characters exist. Create a character first.');
      return;
    }

    // Get current crew members to filter them out
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const currentMemberIds = new Set(crew.characters);

    // Filter out characters already in the crew
    const availableCharacters = characters.filter(char => {
      const reduxId = char.id; // Unified IDs
      return reduxId && !currentMemberIds.has(reduxId);
    });

    if (availableCharacters.length === 0) {
      ui.notifications?.warn('No available characters. All characters are already in the crew.');
      return;
    }

    // Create simple selection dialog
    const options = availableCharacters.map(char => `<option value="${char.id}">${char.name}</option>`).join('');

    const dialog = new Dialog({
      title: 'Add Character to Crew',
      content: `
        <form>
          <div class="form-group">
            <label>Select Character:</label>
            <select name="characterId">${options}</select>
          </div>
        </form>
      `,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Add',
          callback: async (html) => {
            const selectedFoundryId = (html as JQuery).find('[name="characterId"]').val() as string;
            const selectedActor = game.actors.get(selectedFoundryId);
            const characterReduxId = selectedActor?.id; // Unified IDs

            if (characterReduxId) {
              try {
                game.fitgd.api.crew.addCharacter({ crewId, characterId: characterReduxId });
                ui.notifications?.info(`Added ${selectedActor.name} to crew`);

                // Save immediately (critical state change)
                await game.fitgd.saveImmediate();

                this.render(false);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                ui.notifications?.error(`Error: ${errorMessage}`);
              }
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'add'
    }, {
      classes: ['dialog', 'fitgd-dialog']
    });

    dialog.render(true);
  }

  private async _onRemoveCharacter(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    try {
      const target = event.currentTarget as HTMLElement;
      const { characterId } = getCharacterDataset(target);

      // Get character name for confirmation
      const character = game.fitgd.api.character.getCharacter(characterId);
      const characterName = character?.name || 'Unknown Character';

      const confirmed = await Dialog.confirm({
        title: 'Remove Character',
        content: `<p>Are you sure you want to remove <strong>${characterName}</strong> from the crew?</p>`,
        yes: () => true,
        no: () => false,
        options: {
          classes: ['dialog', 'fitgd-dialog']
        }
      });

      if (!confirmed) return;

      game.fitgd.api.crew.removeCharacter({ crewId, characterId });
      ui.notifications?.info(`Removed ${characterName} from crew`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Remove character error:', error);
    }
  }

}

export { FitGDCrewSheet };
