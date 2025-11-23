/**
 * Equipment Sheet Dialog
 *
 * Unified editor for creating and editing equipment items.
 * - Create mode: Creates new equipment on character with defaults
 * - Edit mode: Updates existing equipment properties
 * - Role-based access: Players can only create/edit Common tier items
 */

import type { Equipment } from '@/types/equipment';

interface EquipmentEditData {
  equipment: Equipment;
  mode: 'create' | 'edit';
  tiers: string[];
  categories: string[];
  isGM: boolean;
  canEditTier: boolean;
}

export class EquipmentEditDialog extends FormApplication {
  private characterId: string;
  private mode: 'create' | 'edit';

  /**
   * Create a new Equipment Edit Dialog
   * @param characterId - Character to add/edit equipment for
   * @param equipment - Equipment object (for edit mode) or template (for create mode)
   * @param mode - 'create' or 'edit'
   * @param options - Additional options
   */
  constructor(
    characterId: string,
    equipment: Partial<Equipment> | Equipment,
    mode: 'create' | 'edit' = 'edit',
    options: Partial<FormApplicationOptions> = {}
  ) {
    super(equipment, options);
    this.characterId = characterId;
    this.mode = mode;
  }

  static get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'dialog', 'equipment-edit'] as unknown as string[],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/equipment-edit.html',
      width: 500,
      height: 'auto' as any,
      title: 'Equipment',
      submitOnChange: false,
      closeOnSubmit: true,
    });
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Equipment' : 'Edit Equipment';
  }

  getData(): EquipmentEditData {
    const equipment = this.object as Partial<Equipment>;
    const isGM = game.user!.isGM;

    // Players can only edit tier if equipment is already Common
    const isCommon = (equipment as Equipment).tier === 'common' || this.mode === 'create';
    const canEditTier = isGM || isCommon;

    return {
      equipment: equipment as Equipment,
      mode: this.mode,
      tiers: ['common', 'rare', 'epic'],
      categories: ['active', 'passive', 'consumable'],
      isGM,
      canEditTier,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Wire up custom buttons
    html.find('.cancel-btn').click(() => this.close());
    html.find('.save-btn').click(() => this._onSubmit(new Event('submit')));
  }

  protected async _updateObject(_event: Event, formData: Record<string, any>): Promise<void> {
    const equipment = this.object as Partial<Equipment>;
    const isGM = game.user!.isGM;

    // Validate name
    const name = (formData.name as string)?.trim();
    if (!name || name.length === 0) {
      ui.notifications?.error('Equipment name is required');
      return;
    }
    if (name.length > 50) {
      ui.notifications?.error('Equipment name must be 50 characters or less');
      return;
    }

    // Validate slots
    const slots = parseInt(formData.slots as string, 10);
    if (isNaN(slots) || slots < 1) {
      ui.notifications?.error('Equipment must occupy at least 1 slot');
      return;
    }

    // Validate tier restrictions for players
    const tier = formData.tier as Equipment['tier'];
    if (!isGM && tier !== 'common') {
      ui.notifications?.error('Players can only create or edit Common tier equipment');
      return;
    }

    if (this.mode === 'create') {
      // Create mode: add new equipment to character
      const newEquipment: Equipment = {
        id: crypto.randomUUID(),
        name,
        category: formData.category as Equipment['category'],
        tier,
        slots,
        description: (formData.description as string) || '',
        equipped: false,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: formData['modifiers.diceBonus'] ? parseInt(formData['modifiers.diceBonus'] as string, 10) : undefined,
          dicePenalty: formData['modifiers.dicePenalty'] ? parseInt(formData['modifiers.dicePenalty'] as string, 10) : undefined,
          positionBonus: formData['modifiers.positionBonus'] ? parseInt(formData['modifiers.positionBonus'] as string, 10) : undefined,
          positionPenalty: formData['modifiers.positionPenalty'] ? parseInt(formData['modifiers.positionPenalty'] as string, 10) : undefined,
          effectBonus: formData['modifiers.effectBonus'] ? parseInt(formData['modifiers.effectBonus'] as string, 10) : undefined,
          effectPenalty: formData['modifiers.effectPenalty'] ? parseInt(formData['modifiers.effectPenalty'] as string, 10) : undefined,
        },
        acquiredAt: Date.now(),
        acquiredVia: isGM ? 'earned' : 'earned',
      };

      await game.fitgd.bridge.execute({
        type: 'characters/addEquipment',
        payload: {
          characterId: this.characterId,
          equipment: newEquipment,
        },
      });

      ui.notifications?.info(`Created ${name}`);
    } else {
      // Edit mode: update existing equipment
      const equipmentId = (equipment as Equipment).id;
      const changes: Partial<Equipment> = {
        name,
        category: formData.category as Equipment['category'],
        tier,
        slots,
        description: (formData.description as string) || '',
        modifiers: {
          diceBonus: formData['modifiers.diceBonus'] ? parseInt(formData['modifiers.diceBonus'] as string, 10) : undefined,
          dicePenalty: formData['modifiers.dicePenalty'] ? parseInt(formData['modifiers.dicePenalty'] as string, 10) : undefined,
          positionBonus: formData['modifiers.positionBonus'] ? parseInt(formData['modifiers.positionBonus'] as string, 10) : undefined,
          positionPenalty: formData['modifiers.positionPenalty'] ? parseInt(formData['modifiers.positionPenalty'] as string, 10) : undefined,
          effectBonus: formData['modifiers.effectBonus'] ? parseInt(formData['modifiers.effectBonus'] as string, 10) : undefined,
          effectPenalty: formData['modifiers.effectPenalty'] ? parseInt(formData['modifiers.effectPenalty'] as string, 10) : undefined,
        },
      };

      await game.fitgd.bridge.execute({
        type: 'characters/updateEquipment',
        payload: {
          characterId: this.characterId,
          equipmentId,
          updates: changes,
        },
      });

      ui.notifications?.info(`Updated ${name}`);
    }
  }
}
