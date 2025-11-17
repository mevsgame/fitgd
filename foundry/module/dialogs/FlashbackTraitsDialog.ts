/**
 * Flashback Traits Dialog
 *
 * Dialog for managing traits during flashbacks
 */

import type { Character, Trait } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { ReduxId } from '@/types/foundry'; 

type FlashbackMode = 'use-existing' | 'create-new' | 'consolidate';

interface FlashbackTraitsData {
  character: Character;
  crew: Crew;
  momentum: number;
  isEditable: boolean;
  mode: FlashbackMode;
  availableTraits: Trait[];
  roleAndBackgroundTraits: Trait[];
  consolidatableTraits: Trait[];
  selectedTraitIds: string[];
  selectedTraitId: string | null;
  canConsolidate: boolean;
}

export class FlashbackTraitsDialog extends Application {
  private characterId: string;
  private character: Character;
  private crew: Crew;

  // Determine if player is eligible for editable mode (fewest traits)
  private isEditable: boolean;

  // Current mode: 'use-existing', 'create-new', or 'consolidate'
  private mode: FlashbackMode = 'use-existing';

  // Selected traits for consolidation
  private selectedTraitIds: string[] = [];

  // Selected trait for use
  private selectedTraitId: string | null = null;

  private html?: JQuery;

  /**
   * Create a new Flashback Traits Dialog
   *
   * @param characterId - Redux ID of the character
   * @param crewId - Redux ID of the character's crew
   * @param options - Additional options passed to Application constructor
   */
  constructor(characterId: string, crewId: string, options: Partial<ApplicationOptions> = {}) {
    super(options);

    this.characterId = characterId;
    this.character = game.fitgd!.api.character.getCharacter(characterId);
    this.crew = game.fitgd!.api.crew.getCrew(crewId);

    // Determine if player is eligible for editable mode (fewest traits)
    this.isEditable = this._checkTraitEligibility();
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'flashback-traits-dialog'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/flashback-traits-dialog.html',
      width: 500,
      height: 'auto',
      title: 'Use Trait / Flashback',
      resizable: false,
    });
  }

  override get id(): string {
    return `flashback-traits-dialog-${this.characterId}`;
  }

  override async getData(options: Partial<ApplicationOptions> = {}): Promise<FlashbackTraitsData> {
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

  override activateListeners(html: JQuery): void {
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
  private _checkTraitEligibility(): boolean {
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
  private _onModeChange(event: JQuery.ChangeEvent): void {
    this.mode = event.currentTarget.value as FlashbackMode;
    this.selectedTraitIds = [];
    this.selectedTraitId = null;
    this.render();
  }

  /**
   * Handle trait click
   */
  private _onTraitClick(event: JQuery.ClickEvent): void {
    const traitId = (event.currentTarget as HTMLElement).dataset.traitId;

    if (!traitId) return;

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
  private async _onApply(event: JQuery.ClickEvent): Promise<void> {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications.error(`Error: ${errorMessage}`);
      console.error('FitGD | Flashback Traits error:', error);
    }
  }

  /**
   * Apply use existing trait (costs 1 Momentum for position improvement)
   */
  private async _applyUseExisting(): Promise<void> {
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
      { affectedReduxIds: [this.characterId as ReduxId], force: false }
    );

    ui.notifications.info('Trait selected - will improve position on roll (costs 1M)');
  }

  /**
   * Apply create new trait (flashback)
   */
  private async _applyCreateNew(): Promise<void> {
    // Get trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = (this.html.find('[name="newTraitName"]').val() as string)?.trim();
    const newTraitDescription = (this.html.find('[name="newTraitDescription"]').val() as string)?.trim();

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
              category: 'flashback' as const,
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId as ReduxId], force: false }
    );

    ui.notifications.info(`New trait "${newTraitName}" will be created on roll (costs 1M)`);
  }

  /**
   * Apply consolidate traits
   */
  private async _applyConsolidate(): Promise<void> {
    if (this.selectedTraitIds.length !== 3) {
      ui.notifications.warn('Please select exactly 3 traits to consolidate');
      return;
    }

    // Get consolidated trait name and description from form
    if (!this.html) {
      ui.notifications.error('Dialog HTML not found');
      return;
    }

    const newTraitName = (this.html.find('[name="newTraitName"]').val() as string)?.trim();
    const newTraitDescription = (this.html.find('[name="newTraitDescription"]').val() as string)?.trim();

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
                category: 'grouped' as const,
              },
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        },
      },
      { affectedReduxIds: [this.characterId as ReduxId], force: false }
    );

    ui.notifications.info(`Traits will be consolidated into "${newTraitName}" on roll (costs 1M)`);
  }
}
