/**
 * Flashback Traits Dialog
 *
 * Dialog for managing traits during flashbacks
 */

// @ts-check

import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';

export class FlashbackTraitsDialog extends Application {
  /**
   * Create a new Flashback Traits Dialog
   *
   * @param {string} characterId - Redux ID of the character
   * @param {string} crewId - Redux ID of the character's crew
   * @param {Object} options - Additional options passed to Application constructor
   */
  constructor(characterId, crewId, options = {}) {
    super(options);

    this.characterId = characterId;
    this.crewId = crewId;
    this.character = game.fitgd.api.character.getCharacter(characterId);
    this.crew = game.fitgd.api.crew.getCrew(crewId);

    // Determine if player is eligible for editable mode (fewest traits)
    this.isEditable = this._checkTraitEligibility();

    // Current mode: 'use-existing', 'create-new', or 'consolidate'
    this.mode = 'use-existing';

    // Selected traits for consolidation
    this.selectedTraitIds = [];

    // Selected trait for use
    this.selectedTraitId = null;
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'flashback-traits-dialog'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/flashback-traits-dialog.html',
      width: 500,
      height: 'auto',
      title: 'Use Trait / Flashback',
      resizable: false,
    });
  }

  /** @override */
  get id() {
    return `flashback-traits-dialog-${this.characterId}`;
  }

  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options);

    // Get traits, excluding disabled ones
    const availableTraits = this.character.traits.filter(t => !t.disabled);

    // Categorize traits
    const roleAndBackgroundTraits = availableTraits.filter(t =>
      t.category === 'role' || t.category === 'background'
    );
    const consolidatableTraits = availableTraits.filter(t =>
      t.category !== 'role' && t.category !== 'background'
    );

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: this.crew?.currentMomentum || 0,
      isEditable: this.isEditable,
      mode: this.mode,
      availableTraits,
      roleAndBackgroundTraits,
      consolidatableTraits,
      selectedTraitIds: this.selectedTraitIds,
      selectedTraitId: this.selectedTraitId,
      canConsolidate: consolidatableTraits.length >= 3,
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Store html for later use
    this.html = html;

    // Mode selection (if editable)
    html.find('[name="mode"]').change(this._onModeChange.bind(this));

    // Trait selection
    html.find('.trait-item').click(this._onTraitClick.bind(this));

    // Apply button
    html.find('[data-action="apply"]').click(this._onApply.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Check if character is eligible for editable mode (fewest traits in crew)
   */
  _checkTraitEligibility() {
    const state = game.fitgd.store.getState();
    const crewCharacters = this.crew.characters;

    // Count traits for all characters in crew
    const traitCounts = crewCharacters.map(charId => {
      const char = state.characters.byId[charId];
      return { id: charId, count: char?.traits.length || 0 };
    });

    // Find minimum trait count
    const minCount = Math.min(...traitCounts.map(tc => tc.count));

    // Check if this character has the minimum (or tied for minimum)
    const myCount = traitCounts.find(tc => tc.id === this.characterId)?.count || 0;
    return myCount === minCount;
  }

  /**
   * Handle mode change
   */
  _onModeChange(event) {
    this.mode = event.currentTarget.value;
    this.selectedTraitIds = [];
    this.selectedTraitId = null;
    this.render();
  }

  /**
   * Handle trait click
   */
  _onTraitClick(event) {
    const traitId = event.currentTarget.dataset.traitId;

    if (this.mode === 'consolidate') {
      // Toggle selection for consolidation (max 3)
      const index = this.selectedTraitIds.indexOf(traitId);
      if (index >= 0) {
        this.selectedTraitIds.splice(index, 1);
      } else if (this.selectedTraitIds.length < 3) {
        this.selectedTraitIds.push(traitId);
      }
    } else {
      // Single selection for use-existing or trait to use after create
      this.selectedTraitId = traitId;
    }

    this.render();
  }

  /**
   * Handle apply button
   */
  async _onApply(event) {
    event.preventDefault();

    try {
      if (this.mode === 'use-existing') {
        await this._applyUseExisting();
      } else if (this.mode === 'create-new') {
        await this._applyCreateNew();
      } else if (this.mode === 'consolidate') {
        await this._applyConsolidate();
      }

      this.close();
    } catch (error) {
      ui.notifications.error(`Error: ${error.message}`);
      console.error('FitGD | Flashback Traits error:', error);
    }
  }

  /**
   * Apply use existing trait (costs 1 Momentum for position improvement)
   */
  async _applyUseExisting() {
    if (!this.selectedTraitId) {
      ui.notifications.warn('Please select a trait');
      return;
    }

    // Check Momentum (costs 1M for position improvement)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: this.selectedTraitId,
            positionImprovement: true, // Using trait will improve position
            momentumCost: 1, // Flashback costs 1M
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info('Trait selected - will improve position on roll (costs 1M)');
  }

  /**
   * Apply create new trait (flashback)
   */
  async _applyCreateNew() {
    // Get trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = this.html.find('[name="newTraitName"]').val()?.trim();
    const newTraitDescription = this.html.find('[name="newTraitDescription"]').val()?.trim();

    if (!newTraitName) {
      ui.notifications.warn('Please enter a trait name');
      return;
    }

    // Check Momentum (costs 1M for flashback)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'new',
            newTrait: {
              name: newTraitName,
              description: newTraitDescription || undefined,
              category: 'flashback',
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info(`New trait "${newTraitName}" will be created on roll (costs 1M)`);
  }

  /**
   * Apply consolidate traits
   */
  async _applyConsolidate() {
    if (this.selectedTraitIds.length !== 3) {
      ui.notifications.warn('Please select exactly 3 traits to consolidate');
      return;
    }

    // Get consolidated trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = this.html.find('[name="newTraitName"]').val()?.trim();
    const newTraitDescription = this.html.find('[name="newTraitDescription"]').val()?.trim();

    if (!newTraitName) {
      ui.notifications.warn('Please enter a name for the consolidated trait');
      return;
    }

    // Check Momentum (costs 1M for flashback)
    if (this.crew.currentMomentum < 1) {
      ui.notifications.warn('Not enough Momentum (need 1 for flashback)');
      return;
    }

    // Use Bridge API to dispatch trait transaction and broadcast to all clients
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setTraitTransaction',
        payload: {
          characterId: this.characterId,
          transaction: {
            mode: 'consolidate',
            consolidation: {
              traitIdsToRemove: this.selectedTraitIds,
              newTrait: {
                name: newTraitName,
                description: newTraitDescription || undefined,
                category: 'grouped',
              },
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId], force: false }
    );

    ui.notifications.info(`Traits will be consolidated into "${newTraitName}" on roll (costs 1M)`);
  }
}

/* -------------------------------------------- */
/*  Add Progress Clock Dialog                   */
/* -------------------------------------------- */

/**
 * Add Progress Clock Dialog
 *
 * Creates a new progress clock (project clock) for tracking long-term goals,
 * threats, obstacles, faction relations, etc. Unlike harm/consumable/addiction
 * clocks which are tied to the core mechanics, progress clocks are freeform
 * narrative tools.
 *
 * Clock sizes:
 * - 4 segments: Quick tasks
 * - 6 segments: Standard projects
 * - 8 segments: Complex undertakings
 * - 12 segments: Epic long-term goals
 *
 * Categories help organize clocks by type (project, threat, goal, obstacle, faction).
 *
 * @extends Dialog
 */
