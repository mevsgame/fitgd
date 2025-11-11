/**
 * Crew Sheet Class
 *
 * Foundry VTT Actor Sheet for crew entities
 */

// @ts-check

import { AddClockDialog } from '../dialogs.mjs';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

/* -------------------------------------------- */
/*  Crew Sheet Class                            */
/* -------------------------------------------- */

/**
 * FitGD Crew Sheet
 *
 * Foundry VTT Actor Sheet for crew entities. Displays and manages:
 * - Crew members (characters in the crew)
 * - Momentum pool (0-10, starts at 5)
 * - Consumable clocks (grenades, stims, etc.)
 * - Addiction clock (fills when using too many stims)
 * - Progress clocks (long-term projects, threats, goals)
 *
 * All state is stored in Redux, fetched via actor's Redux ID flag.
 * Sheet provides UI for triggering crew-level actions (spend Momentum, use consumables).
 *
 * @extends ActorSheet
 */
class FitGDCrewSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'actor', 'crew'],
      template: 'systems/forged-in-the-grimdark/templates/crew-sheet.html',
      width: 800,
      height: 900,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'members' }]
    });
  }

  getData() {
    const context = super.getData();

    // Override editable to be GM-only for clock editing
    context.editable = game.user.isGM;

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
    console.log('FitGD | Crew Sheet getData - reduxId:', reduxId, 'editable:', context.editable);

    if (reduxId) {
      const crew = game.fitgd.api.crew.getCrew(reduxId);

      if (crew) {
        // Resolve character names from Redux IDs
        const characterDetails = crew.characters.map(charId => {
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
          consumableClocks: game.fitgd.api.query.getConsumableClocks(reduxId),
          progressClocks: game.fitgd.api.query.getProgressClocks(reduxId)
        };
        context.reduxId = reduxId;

        console.log('FitGD | Crew system data:', context.system);
      }
    }

    return context;
  }

  /**
   * Find Foundry actor ID from Redux character ID
   */
  _findFoundryActorId(characterReduxId) {
    for (const actor of game.actors) {
      if (actor.type === 'character') {
        const actorReduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
        if (actorReduxId === characterReduxId) {
          return actor.id;
        }
      }
    }
    return null;
  }

  activateListeners(html) {
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
   * Get Redux crew ID from Foundry actor
   */
  _getReduxId() {
    return this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
  }

  async _onAddMomentum(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    const amount = parseInt(event.currentTarget.dataset.amount) || 1;

    try {
      game.fitgd.api.crew.addMomentum({ crewId, amount });
      ui.notifications.info(`Added ${amount} Momentum`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Add Momentum error:', error);
    }
  }

  async _onSpendMomentum(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    const amount = parseInt(event.currentTarget.dataset.amount) || 1;

    try {
      game.fitgd.api.crew.spendMomentum({ crewId, amount });
      ui.notifications.info(`Spent ${amount} Momentum`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Spend Momentum error:', error);
    }
  }

  async _onResetMomentum(event) {
    event.preventDefault();

    // GM-only check
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can perform a Momentum Reset');
      return;
    }

    const crewId = this._getReduxId();
    if (!crewId) return;

    // Get crew and members
    const crew = game.fitgd.api.crew.getCrew(crewId);
    if (!crew) {
      ui.notifications.error('Crew not found');
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
      // Use the tested API method instead of reimplementing the logic
      console.log('FitGD | Calling performReset for crew:', crewId);
      console.log('FitGD | Crew characters:', crew.characters);

      // Check clocks BEFORE reset
      crew.characters.forEach(charId => {
        const harmClocks = game.fitgd.api.query.getHarmClocks(charId);
        console.log(`FitGD | BEFORE reset - Character ${charId} harm clocks:`, harmClocks);
      });
      const addictionBefore = game.fitgd.api.query.getAddictionClock(crewId);
      console.log('FitGD | BEFORE reset - Addiction clock:', addictionBefore);

      const result = game.fitgd.api.crew.performReset(crewId);

      console.log('FitGD | Momentum Reset result:', result);
      console.log('FitGD | Characters reset (detailed):', JSON.stringify(result.charactersReset, null, 2));
      console.log('FitGD | Addiction reduced:', result.addictionReduced);

      // Check clocks AFTER reset
      crew.characters.forEach(charId => {
        const harmClocks = game.fitgd.api.query.getHarmClocks(charId);
        console.log(`FitGD | AFTER reset - Character ${charId} harm clocks:`, harmClocks);
      });
      const addictionAfter = game.fitgd.api.query.getAddictionClock(crewId);
      console.log('FitGD | AFTER reset - Addiction clock:', addictionAfter);

      // Check Redux state before broadcast
      const state = game.fitgd.store.getState();
      console.log('FitGD | Clock history length BEFORE broadcast:', state.clocks.history.length);
      console.log('FitGD | Last 5 clock commands:', state.clocks.history.slice(-5));

      // Broadcast changes to all clients
      await game.fitgd.saveImmediate();

      // Check Redux state after broadcast
      const stateAfter = game.fitgd.store.getState();
      console.log('FitGD | Clock history length AFTER broadcast:', stateAfter.clocks.history.length);

      // Refresh affected sheets (crew + all member characters)
      const affectedIds = [crewId, ...crew.characters];
      refreshSheetsByReduxId(affectedIds, false);

      ui.notifications.info('Momentum Reset performed successfully');
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Momentum Reset error:', error);
    }
  }

  async _onAddClock(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    new AddClockDialog(crewId).render(true);
  }

  async _onClickClockSegment(event) {
    event.preventDefault();
    const clockId = event.currentTarget.dataset.clockId;
    const segment = parseInt(event.currentTarget.dataset.segment);
    const currentSegments = parseInt(event.currentTarget.dataset.currentSegments);

    if (!clockId) return;

    try {
      const clock = game.fitgd.api.clock.getClock(clockId);
      if (!clock) return;

      // Toggle segment: if clicking on filled segment, reduce; otherwise increase
      if (segment < currentSegments) {
        // Reduce to this segment
        const toRemove = currentSegments - segment;
        game.fitgd.api.clock.clearSegments({ clockId, segments: toRemove });
        ui.notifications.info(`Clock reduced to ${segment} segments`);
      } else if (segment === currentSegments) {
        // Reduce by 1
        game.fitgd.api.clock.clearSegments({ clockId, segments: 1 });
        ui.notifications.info(`Clock reduced by 1 segment`);
      } else {
        // Add to this segment
        const toAdd = segment - currentSegments + 1;
        game.fitgd.api.clock.addSegments({ clockId, segments: toAdd });
        ui.notifications.info(`Clock advanced to ${segment + 1} segments`);
      }

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock segment error:', error);
    }
  }

  /**
   * Handle clicking on clock SVG image (GM-only)
   * Cycles through clock segments
   */
  async _onClickClockSVG(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const img = event.currentTarget;
    const clockId = img.dataset.clockId;
    const currentValue = parseInt(img.dataset.clockValue);
    const maxValue = parseInt(img.dataset.clockMax);

    if (!clockId) return;

    try {
      // Cycle: 0 -> max, then back to 0
      const newValue = currentValue >= maxValue ? 0 : currentValue + 1;

      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock SVG click error:', error);
    }
  }

  /**
   * Handle clock value input change (GM-only)
   * Directly sets clock segments
   */
  async _onChangeClockValue(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const input = event.currentTarget;
    const clockId = input.dataset.clockId;
    const newValue = parseInt(input.value);

    if (!clockId) return;

    try {
      game.fitgd.api.clock.setSegments({ clockId, segments: newValue });
      await game.fitgd.saveImmediate();
      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock value change error:', error);
    }
  }

  /**
   * Handle clock name blur (GM-only)
   * Renames clock when contenteditable loses focus
   */
  async _onRenameClockBlur(event) {
    if (!game.user.isGM) return;

    const element = event.currentTarget;
    const clockId = element.dataset.clockId;
    const newName = element.textContent.trim();

    if (!clockId || !newName) return;

    try {
      game.fitgd.api.clock.rename({ clockId, name: newName });
      await game.fitgd.saveImmediate();
      ui.notifications.info(`Clock renamed to "${newName}"`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock rename error:', error);
      this.render(false); // Reset to original name
    }
  }

  /**
   * Handle delete clock button (GM-only)
   */
  async _onDeleteClock(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const clockId = event.currentTarget.dataset.clockId;

    if (!clockId) return;

    const confirmed = await Dialog.confirm({
      title: 'Delete Clock',
      content: '<p>Are you sure you want to delete this clock?</p>',
      yes: () => true,
      no: () => false
    });

    if (!confirmed) return;

    try {
      game.fitgd.api.clock.delete(clockId);
      await game.fitgd.saveImmediate();
      this.render(false);
      ui.notifications.info('Clock deleted');
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Clock delete error:', error);
    }
  }

  async _onAddCharacter(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    // Show dialog to select character
    const characters = game.actors.filter(a => a.type === 'character');

    if (characters.length === 0) {
      ui.notifications.warn('No characters exist. Create a character first.');
      return;
    }

    // Get current crew members to filter them out
    const crew = game.fitgd.api.crew.getCrew(crewId);
    const currentMemberIds = new Set(crew.characters);

    // Filter out characters already in the crew
    const availableCharacters = characters.filter(char => {
      const reduxId = char.getFlag('forged-in-the-grimdark', 'reduxId');
      return reduxId && !currentMemberIds.has(reduxId);
    });

    if (availableCharacters.length === 0) {
      ui.notifications.warn('No available characters. All characters are already in the crew.');
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
            const selectedFoundryId = html.find('[name="characterId"]').val();
            const selectedActor = game.actors.get(selectedFoundryId);
            const characterReduxId = selectedActor?.getFlag('forged-in-the-grimdark', 'reduxId');

            if (characterReduxId) {
              try {
                game.fitgd.api.crew.addCharacter({ crewId, characterId: characterReduxId });
                ui.notifications.info(`Added ${selectedActor.name} to crew`);

                // Save immediately (critical state change)
                await game.fitgd.saveImmediate();

                this.render(false);
              } catch (error) {
                ui.notifications.error(`Error: ${error.message}`);
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

  async _onRemoveCharacter(event) {
    event.preventDefault();
    const crewId = this._getReduxId();
    if (!crewId) return;

    const characterId = event.currentTarget.dataset.characterId;
    if (!characterId) return;

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

    try {
      game.fitgd.api.crew.removeCharacter({ crewId, characterId });
      ui.notifications.info(`Removed ${characterName} from crew`);

      // Save immediately (critical state change)
      await game.fitgd.saveImmediate();

      this.render(false);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Remove character error:', error);
    }
  }

}

export { FitGDCrewSheet };
