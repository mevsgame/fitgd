/**
 * Character Sheet Class
 *
 * Foundry VTT Actor Sheet for character entities
 */

// @ts-check

import {
  ActionRollDialog,
  AddTraitDialog, 
  AddClockDialog
} from '../dialogs.mjs';

import { ClockCreationDialog } from '../dialogs/index.mjs';

/**
 * FitGD Character Sheet
 *
 * Foundry VTT Actor Sheet for character entities. Displays and manages:
 * - Character traits (with lean-in/rally mechanics)
 * - Action dots (12 actions, 0-4 dots each)
 * - Equipment inventory
 * - Harm clocks (max 3 per character)
 * - Rally availability
 *
 * All state is stored in Redux, fetched via actor's Redux ID flag.
 * Sheet provides UI for triggering Redux actions (add trait, disable trait, take harm).
 *
 * Edit mode allows GM to modify action dots directly.
 *
 * @extends ActorSheet
 */
class FitGDCharacterSheet extends ActorSheet {
  /**
   * Create a new Character Sheet
   *
   * @param {...any} args - Arguments passed to ActorSheet constructor
   */
  constructor(...args) {
    super(...args);
    this.editMode = false; // Track edit mode for action dots
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'actor', 'character'],
      template: 'systems/forged-in-the-grimdark/templates/character-sheet.html',
      width: 700,
      height: 800,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'actions' }]
    });
  }

  getData() {
    const context = super.getData();
    context.editMode = this.editMode;

    // Override editable to be GM-only for clock editing
    context.editable = game.user.isGM;

    // Get Redux ID from Foundry actor flags
    const reduxId = this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
    console.log('FitGD | Character Sheet getData - reduxId:', reduxId, 'editable:', context.editable);

    if (reduxId) {
      const character = game.fitgd.api.character.getCharacter(reduxId);
      console.log('FitGD | Character from Redux:', character);

      if (character) {
        // Calculate total allocated dots
        const allocatedDots = Object.values(character.actionDots).reduce((sum, dots) => sum + dots, 0);
        const unallocatedDots = character.unallocatedActionDots;
        const totalDots = allocatedDots + unallocatedDots;

        // Convert actionDots object to array for easier template iteration
        const actionDotsArray = Object.entries(character.actionDots).map(([action, dots]) => ({
          action,
          dots
        }));

        // Get addiction clock for this character
        const state = game.fitgd.store.getState();
        const addictionClock = Object.values(state.clocks.byId).find(
          clock => clock.entityId === reduxId && clock.clockType === 'addiction'
        );

        context.system = {
          actionDots: actionDotsArray,
          traits: character.traits,
          equipment: character.equipment,
          rallyAvailable: character.rallyAvailable,
          harmClocks: game.fitgd.api.query.getHarmClocks(reduxId),
          addictionClock: addictionClock || null,
          unallocatedActionDots: unallocatedDots,
          allocatedActionDots: allocatedDots,
          totalActionDots: totalDots
        };

        // Find crew for this character
        context.crewId = this._getCrewId(reduxId);
        context.reduxId = reduxId;

        console.log('FitGD | Context system data:', context.system);
        console.log('FitGD | Harm clocks:', context.system.harmClocks);
      } else {
        console.warn('FitGD | Character not found in Redux for ID:', reduxId);
      }
    } else {
      console.warn('FitGD | No Redux ID found in actor flags');
    }

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log('FitGD | Character Sheet activateListeners called');

    // Action Rolls
    const actionRollBtn = html.find('.action-roll-btn');
    const actionRollSingleBtn = html.find('.action-roll-single-btn');
    console.log('FitGD | Found action roll buttons:', actionRollBtn.length, 'single:', actionRollSingleBtn.length);
    actionRollBtn.click(this._onActionRoll.bind(this));
    actionRollSingleBtn.click(this._onActionRollSingle.bind(this));

    // Action Dots (clickable)
    const dots = html.find('.dot');
    console.log('FitGD | Found action dots:', dots.length);
    dots.click(this._onDotClick.bind(this));

    // Toggle Edit Mode for action dots
    html.find('.toggle-edit-btn').click(this._onToggleEdit.bind(this));

    // Harm
    html.find('.add-harm-btn').click(this._onAddHarm.bind(this));

    // Clock controls (GM-only editing)
    html.find('.clock-container img.clock').click(this._onClickClockSVG.bind(this));
    html.find('.clock-value-input').change(this._onChangeClockValue.bind(this));
    html.find('.clock-name').blur(this._onRenameClockBlur.bind(this));
    html.find('.delete-clock-btn').click(this._onDeleteClock.bind(this));

    // Traits
    html.find('.add-trait-btn').click(this._onAddTrait.bind(this));
    html.find('.delete-trait-btn').click(this._onDeleteTrait.bind(this));
    html.find('.trait-name').blur(this._onRenameTraitBlur.bind(this));

    // Rally checkbox
    html.find('input[name="system.rallyAvailable"]').change(this._onRallyChange.bind(this));
 
    // Drag events for hotbar macros
    html.find('.draggable').on('dragstart', this._onDragStart.bind(this));
  }

  /**
   * Get Redux character ID from Foundry actor
   */
  _getReduxId() {
    return this.actor.getFlag('forged-in-the-grimdark', 'reduxId');
  }

  /**
   * Find the crew that contains this character
   */
  _getCrewId(characterId) {
    const state = game.fitgd.store.getState();

    // Search all crews for this character
    for (const crewId of state.crews.allIds) {
      const crew = state.crews.byId[crewId];
      if (crew.characters.includes(characterId)) {
        return crewId;
      }
    }

    return null;
  }

  /**
   * Handle drag start for creating hotbar macros
   */
  _onDragStart(event) {
    const element = event.currentTarget;
    const actionType = element.dataset.actionType;
    const characterId = this._getReduxId();

    if (!characterId) return;

    const dragData = {
      type: 'FitGD',
      actorId: this.actor.id,
      characterId: characterId,
      actionType: actionType,
    };

    if (actionType === 'roll') {
      dragData.action = element.dataset.action;
    } else if (actionType === 'lean-trait') {
      dragData.traitId = element.dataset.traitId;
      dragData.traitName = element.dataset.traitName;
    }

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Handle clicking on action dots to set the value (only in edit mode)
   */
  async _onDotClick(event) {
    event.preventDefault();
    event.stopPropagation();

    console.log('FitGD | Dot clicked, editMode:', this.editMode);
    console.log('FitGD | Event target:', event.target);
    console.log('FitGD | Event currentTarget:', event.currentTarget);

    // Only allow editing in edit mode
    if (!this.editMode) {
      ui.notifications.warn('Click Edit to allocate action dots');
      return;
    }

    const characterId = this._getReduxId();
    if (!characterId) {
      console.error('FitGD | No character ID found');
      return;
    }

    // Try to get data attributes from both target and currentTarget
    // Prefer event.target (the actual clicked element) first, as it has both data-action and data-value
    // Fall back to currentTarget only if target doesn't have the required attributes
    const element = (event.target.dataset?.action && event.target.dataset?.value)
      ? event.target
      : event.currentTarget;
    const action = element.dataset?.action;
    const value = parseInt(element.dataset?.value);

    console.log('FitGD | Element used:', element);
    console.log('FitGD | Data action:', action);
    console.log('FitGD | Data value:', value);
    console.log('FitGD | Parsed action:', action, 'value:', value);

    if (!action || isNaN(value)) {
      console.error('FitGD | Invalid action or value');
      console.error('FitGD | Element dataset:', element.dataset);
      console.error('FitGD | Element:', element);
      return;
    }

    try {
      // Get current character state to check if we should toggle to 0
      const character = game.fitgd.api.character.getCharacter(characterId);
      if (!character) {
        console.error('FitGD | Character not found');
        return;
      }

      const currentDots = character.actionDots[action];
      let newDots = value;

      // Feature: If clicking on a single filled dot (current dots is 1 and clicking dot 1), set to 0
      if (currentDots === 1 && value === 1) {
        newDots = 0;
        console.log('FitGD | Toggling single dot to 0');
      }

      console.log('FitGD | Calling setActionDots with:', { characterId, action, dots: newDots });

      // Update the action dots (Redux will handle unallocated dots validation)
      game.fitgd.api.character.setActionDots({
        characterId,
        action,
        dots: newDots
      });

      console.log('FitGD | setActionDots succeeded');

      // Save and broadcast changes to other clients
      await game.fitgd.saveImmediate();

      // Re-render sheet
      this.render(false);

    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Set action dots error:', error);
    }
  }

  /**
   * Toggle edit mode for action dots
   */
  async _onToggleEdit(event) {
    event.preventDefault();

    console.log('FitGD | Toggle edit clicked, current editMode:', this.editMode);

    const characterId = this._getReduxId();
    if (!characterId) {
      console.error('FitGD | No character ID for toggle edit');
      return;
    }

    if (this.editMode) {
      // Trying to save - validate that all dots are allocated
      const character = game.fitgd.api.character.getCharacter(characterId);
      if (!character) {
        console.error('FitGD | Character not found');
        return;
      }

      console.log('FitGD | Attempting to save, unallocated dots:', character.unallocatedActionDots);

      if (character.unallocatedActionDots > 0) {
        ui.notifications.warn(`You must allocate all ${character.unallocatedActionDots} remaining action dots before saving`);
        return;
      }

      // All dots allocated, exit edit mode
      this.editMode = false;
      console.log('FitGD | Exiting edit mode, saving changes');

      // Save and broadcast final dot allocation to other clients
      await game.fitgd.saveImmediate();

      ui.notifications.info('Action dots saved');
    } else {
      // Enter edit mode
      this.editMode = true;
      console.log('FitGD | Entering edit mode');
      ui.notifications.info('Edit mode: Click dots to allocate action ratings');
    }

    // Re-render to update button text and dot states
    console.log('FitGD | Re-rendering with editMode:', this.editMode);
    this.render(false);
  }

  /**
   * Handle clicking on single action roll button
   */
  async _onActionRollSingle(event) {
    event.preventDefault();
    event.stopPropagation();

    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to make action rolls');
      return;
    }

    const action = event.currentTarget.dataset.action;

    if (action) {
      const dialog = new ActionRollDialog(characterId, crewId);
      dialog.render(true);

      // Pre-select the action after dialog renders
      setTimeout(() => {
        const select = dialog.element.find('[name="action"]');
        if (select.length) {
          select.val(action.toLowerCase()).trigger('change');
        }
      }, 100);
    }
  }

  async _onActionRoll(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    const crewId = this._getCrewId(characterId);

    if (!crewId) {
      ui.notifications.warn('Character must be part of a crew to make action rolls');
      return;
    }

    new ActionRollDialog(characterId, crewId).render(true);
  }

  /**
   * Handle Add Harm button
   * Opens ClockCreationDialog to create a new harm clock
   */
  async _onAddHarm(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    // Open ClockCreationDialog for harm clocks (same pattern as player-action-widget)
    const dialog = new ClockCreationDialog(
      characterId,
      'harm',
      async (clockData) => {
        try {
          // Create clock via Bridge API
          const newClockId = foundry.utils.randomID();

          await game.fitgd.bridge.execute(
            {
              type: 'clocks/createClock',
              payload: {
                id: newClockId,
                entityId: characterId,
                clockType: 'harm',
                subtype: clockData.name,
                maxSegments: clockData.segments,
                segments: 0,
                metadata: clockData.description ? { description: clockData.description } : undefined,
              },
            },
            { affectedReduxIds: [characterId], force: true }
          );

          ui.notifications.info(`Harm clock "${clockData.name}" created`);
        } catch (error) {
          console.error('FitGD | Error creating harm clock:', error);
          ui.notifications.error(`Error creating harm clock: ${error.message}`);
        }
      },
      {
        classes: ['dialog', 'fitgd-dialog']
      }
    );

    dialog.render(true);
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

  async _onAddTrait(event) {
    event.preventDefault();
    const characterId = this._getReduxId();
    if (!characterId) return;

    new AddTraitDialog(characterId).render(true);
  }

  async _onDeleteTrait(event) {
    if (!game.user.isGM) return;

    event.preventDefault();
    const traitId = event.currentTarget.dataset.traitId;

    if (!traitId) return;

    const characterId = this._getReduxId();
    if (!characterId) return;

    // Get trait name for confirmation
    const character = game.fitgd.api.character.getCharacter(characterId);
    const trait = character?.traits.find(t => t.id === traitId);
    const traitName = trait?.name || 'Unknown Trait';

    const confirmed = await Dialog.confirm({
      title: 'Delete Trait',
      content: `<p>Are you sure you want to delete <strong>${traitName}</strong>?</p>`,
      yes: () => true,
      no: () => false,
      options: {
        classes: ['dialog', 'fitgd-dialog']
      }
    });

    if (!confirmed) return;

    try {
      game.fitgd.api.character.removeTrait({ characterId, traitId });
      await game.fitgd.saveImmediate();
      this.render(false);
      ui.notifications.info(`Trait "${traitName}" deleted`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Trait delete error:', error);
    }
  }

  async _onRenameTraitBlur(event) {
    if (!game.user.isGM) return;

    const element = event.currentTarget;
    const traitId = element.dataset.traitId;
    const newName = element.textContent.trim();

    if (!traitId || !newName) {
      this.render(false); // Reset to original name if empty
      return;
    }

    const characterId = this._getReduxId();
    if (!characterId) return;

    // Get original name to check if it changed
    const character = game.fitgd.api.character.getCharacter(characterId);
    const trait = character?.traits.find((t) => t.id === traitId);
    const originalName = trait?.name;

    if (newName === originalName) return; // No change

    try {
      game.fitgd.api.character.updateTraitName({ characterId, traitId, name: newName });
      await game.fitgd.saveImmediate();
      ui.notifications.info(`Trait renamed to "${newName}"`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Trait rename error:', error);
      this.render(false); // Reset to original name
    }
  }

  async _onRallyChange(event) {
    if (!game.user.isGM) return;

    const characterId = this._getReduxId();
    if (!characterId) return;

    const isChecked = event.currentTarget.checked;

    try {
      // Use Bridge API with correct Redux action
      await game.fitgd.bridge.execute(
        {
          type: isChecked ? 'characters/resetRally' : 'characters/useRally',
          payload: { characterId }
        },
        { affectedReduxIds: [characterId] }
      );

      ui.notifications.info(`Rally ${isChecked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Rally change error:', error);
      // Revert checkbox on error
      event.currentTarget.checked = !isChecked;
    }
  }
}

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

export { FitGDCharacterSheet };
