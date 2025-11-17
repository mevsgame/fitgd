/**
 * Lean Into Trait Dialog
 *
 * Dialog for leaning into a trait to gain momentum
 *
 * Game Mechanic:
 * - Player describes how a trait creates a complication
 * - Crew gains 2 Momentum (capped at 10, excess is lost)
 * - Trait is disabled until next Momentum Reset
 * - While disabled, cannot use trait for flashbacks or position/effect improvements
 */

import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { ReduxId } from '@/types/foundry'; 

interface LeanIntoTraitData {
  character: Character;
  crew: Crew;
  momentum: number;
  momentumGain: number;
  wouldCapOut: boolean;
  availableTraits: Character['traits'];
  selectedTraitId: string | null;
}

export class LeanIntoTraitDialog extends Application {
  private characterId: string;
  private crewId: string;
  private character: Character;
  private crew: Crew;
  private selectedTraitId: string | null = null;
  private html?: JQuery;

  /**
   * Create a new Lean Into Trait Dialog
   *
   * @param characterId - Redux ID of the character
   * @param crewId - Redux ID of the character's crew
   * @param options - Additional options passed to Application constructor
   */
  constructor(characterId: string, crewId: string, options: Partial<ApplicationOptions> = {}) {
    super(options);

    this.characterId = characterId;
    this.crewId = crewId;
    this.character = game.fitgd.api.character.getCharacter(characterId);
    this.crew = game.fitgd.api.crew.getCrew(crewId);
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'lean-into-trait-dialog'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/lean-into-trait-dialog.html',
      width: 500,
      height: 'auto',
      title: 'Lean Into Trait',
      resizable: false,
    });
  }

  override get id(): string {
    return `lean-into-trait-dialog-${this.characterId}`;
  }

  override async getData(options: Partial<ApplicationOptions> = {}): Promise<LeanIntoTraitData> {
    const data = await super.getData(options);

    // Get traits that are NOT disabled (available to lean into)
    const availableTraits = this.character.traits.filter(t => !t.disabled);

    const currentMomentum = this.crew?.currentMomentum || 0;
    const momentumGain = Math.min(2, 10 - currentMomentum); // Cap at 10
    const wouldCapOut = currentMomentum >= 8; // Would hit cap with +2

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: currentMomentum,
      momentumGain,
      wouldCapOut,
      availableTraits,
      selectedTraitId: this.selectedTraitId,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Store html for later use
    this.html = html;

    // Trait selection
    html.find('.trait-item').click(this._onTraitClick.bind(this));

    // Apply button
    html.find('[data-action="apply"]').click(this._onApply.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Handle trait click
   */
  private _onTraitClick(event: JQuery.ClickEvent): void {
    const traitId = (event.currentTarget as HTMLElement).dataset.traitId;
    this.selectedTraitId = traitId || null;
    this.render();
  }

  /**
   * Handle apply button - disable trait and gain 2 momentum
   */
  private async _onApply(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.selectedTraitId) {
      ui.notifications.warn('Please select a trait to lean into');
      return;
    }

    try {
      const trait = this.character.traits.find(t => t.id === this.selectedTraitId);
      if (!trait) {
        ui.notifications.error('Selected trait not found');
        return;
      }

      // Get optional complication description
      const complicationText = this.html?.find('[name="complicationDescription"]').val() as string | undefined;
      const complication = complicationText?.trim();

      const currentMomentum = this.crew.currentMomentum;
      const newMomentum = Math.min(currentMomentum + 2, 10);
      const actualGain = newMomentum - currentMomentum;

      // Batch both Redux actions together
      await game.fitgd.bridge.executeBatch(
        [
          // Disable the trait
          {
            type: 'characters/disableTrait',
            payload: {
              characterId: this.characterId,
              traitId: this.selectedTraitId,
            },
          },
          // Add 2 momentum to crew (capped at 10)
          {
            type: 'crews/setMomentum',
            payload: {
              crewId: this.crewId,
              amount: newMomentum,
            },
          },
        ],
        { affectedReduxIds: [this.characterId as ReduxId, this.crewId as ReduxId] }
      );

      // User feedback
      let message = `Leaned into "${trait.name}" - Crew gains ${actualGain} Momentum`;
      if (actualGain < 2) {
        message += ' (capped at 10)';
      }
      if (complication) {
        message += `\nComplication: ${complication}`;
      }

      ui.notifications.info(message);

      // Close dialog
      this.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications.error(`Error: ${errorMessage}`);
      console.error('FitGD | Lean Into Trait error:', error);
    }
  }
}
