/**
 * Flashback Equipment Dialog
 *
 * Dialog for acquiring equipment via flashback (1 Momentum for Rare tier)
 * Epic tier cannot be acquired via flashback and must be earned as story rewards
 */

import type { Character, Equipment } from '@/types/character';
import type { Crew } from '@/types/crew';

interface FlashbackEquipmentData {
  character: Character;
  crew: Crew;
  momentum: number;
  selectedTier: Equipment['tier'];
  selectedItemName: string;
  selectedItemDescription: string;
  momentumCostEstimate: number;
  canEquip: boolean;
  currentLoad: number;
  maxLoad: number;
}

export class FlashbackEquipmentDialog extends Application {
  private characterId: string;
  private character: Character;
  private crew: Crew;

  // Form state
  private selectedTier: Equipment['tier'] = 'common';
  private selectedItemName: string = '';
  private selectedItemDescription: string = '';

  /**
   * Create a new Flashback Equipment Dialog
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
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'flashback-equipment-dialog'] as any,
      template: 'systems/forged-in-the-grimdark/templates/dialogs/flashback-equipment-dialog.html',
      width: 500,
      height: 'auto',
      title: 'Flashback Equipment',
      resizable: false,
    }) as ApplicationOptions;
  }

  override get id(): string {
    return `flashback-equipment-dialog-${this.characterId}`;
  }

  override async getData(options: Partial<ApplicationOptions> = {}): Promise<FlashbackEquipmentData> {
    const data = await super.getData(options);

    // Calculate momentum cost based on selected tier
    const momentumCost = this._calculateMomentumCost(this.selectedTier);

    // Calculate current load and max load
    const currentLoad = this.character.equipment.filter((e) => e.equipped).length;
    const maxLoad = 5; // Default from config
    const canEquip = currentLoad < maxLoad;

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: this.crew?.currentMomentum || 0,
      selectedTier: this.selectedTier,
      selectedItemName: this.selectedItemName,
      selectedItemDescription: this.selectedItemDescription,
      momentumCostEstimate: momentumCost,
      canEquip,
      currentLoad,
      maxLoad,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Tier selection
    html.find('[name="tier"]').change(this._onTierChange.bind(this));

    // Item name input
    html.find('[name="itemName"]').on('input', this._onItemNameChange.bind(this));

    // Item description textarea
    html.find('[name="itemDescription"]').on('input', this._onItemDescriptionChange.bind(this));

    // Apply button
    html.find('[data-action="apply"]').click(this._onApply.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Calculate Momentum cost based on tier
   */
  private _calculateMomentumCost(tier: Equipment['tier']): number {
    if (tier === 'common') return 0; // Common items are declared freely
    if (tier === 'rare') return 1; // Rare items cost 1 Momentum (flashback)
    return Infinity; // Epic cannot be acquired via flashback
  }

  /**
   * Handle tier selection change
   */
  private _onTierChange(event: JQuery.ChangeEvent): void {
    this.selectedTier = event.currentTarget.value as Equipment['tier'];
    this.selectedItemName = ''; // Reset item name when tier changes
    this.selectedItemDescription = '';
    this.render();
  }

  /**
   * Handle item name input change
   */
  private _onItemNameChange(event: Event): void {
    this.selectedItemName = (event.target as HTMLInputElement).value.trim();
  }

  /**
   * Handle item description textarea change
   */
  private _onItemDescriptionChange(event: Event): void {
    this.selectedItemDescription = (event.target as HTMLTextAreaElement).value.trim();
  }

  /**
   * Handle apply button
   */
  private async _onApply(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    try {
      await this._applyFlashbackEquipment();
      this.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications!.error(`Error: ${errorMessage}`);
      console.error('FitGD | Flashback Equipment error:', error);
    }
  }

  /**
   * Apply flashback equipment acquisition
   */
  private async _applyFlashbackEquipment(): Promise<void> {
    // Validate item name
    if (!this.selectedItemName) {
      ui.notifications!.warn('Please enter an equipment name');
      return;
    }

    // Validate tier (epic cannot be flashbacked)
    if (this.selectedTier === 'epic') {
      ui.notifications!.error('Epic equipment cannot be acquired through flashbacks - must be earned');
      return;
    }

    // Validate Momentum for rare items
    const momentumCost = this._calculateMomentumCost(this.selectedTier);
    if (this.crew.currentMomentum < momentumCost) {
      ui.notifications!.warn(
        `Not enough Momentum for ${this.selectedTier} equipment (need ${momentumCost}, have ${this.crew.currentMomentum})`
      );
      return;
    }

    // Validate load limit
    const currentLoad = this.character.equipment.filter((e) => e.equipped).length;
    const maxLoad = 5; // Default from config
    if (currentLoad >= maxLoad) {
      ui.notifications!.warn(`Equipment load is full (${currentLoad}/${maxLoad}) - unequip something first`);
      return;
    }

    // Generate unique ID for this equipment instance
    const equipmentId = foundry.utils.randomID();

    // Build equipment object
    const equipment: Equipment = {
      id: equipmentId,
      name: this.selectedItemName,
      type: 'equipment', // Flashback equipment is always regular equipment
      tier: this.selectedTier,
      category: 'flashback', // Mark as flashback acquisition
      description: this.selectedItemDescription,
      passive: false,
      equipped: true, // Immediately equip flashback items
      locked: true, // Locked until next Momentum Reset
      depleted: false,
      acquiredAt: Date.now(),
      acquiredVia: 'flashback',
      metadata: {},
    };

    // Dispatch actions in batch if Momentum cost applies
    const actions = [
      {
        type: 'characters/addEquipment',
        payload: {
          characterId: this.characterId,
          equipment,
        },
      },
    ];

    // If rare item, also spend Momentum
    if (this.selectedTier === 'rare') {
      actions.push({
        type: 'crews/spendMomentum',
        payload: {
          crewId: this.crew.id,
          amount: 1,
        },
      } as any);
    }

    // Use Bridge API to dispatch actions
    await (game.fitgd!.bridge.executeBatch as any)(actions, {
      affectedReduxIds: [this.characterId, this.crew.id],
      force: false,
    });

    ui.notifications!.info(
      `Flashback! Acquired ${this.selectedTier} equipment "${this.selectedItemName}"${
        momentumCost > 0 ? ` (spent ${momentumCost}M)` : ''
      }`
    );
  }
}
