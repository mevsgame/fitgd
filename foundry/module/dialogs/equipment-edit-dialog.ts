/**
 * Equipment Edit Dialog
 *
 * Allows editing all fields of an equipment instance.
 * Changes are saved to Redux (no effect on template).
 */

import type { Equipment } from '@/types/character';

interface EquipmentEditData {
  equipment: Equipment;
  tiers: string[];
  categories: string[];
}

export class EquipmentEditDialog extends FormApplication {
  private characterId: string;

  constructor(characterId: string, equipment: Equipment, options: Partial<FormApplicationOptions> = {}) {
    super(equipment, options);
    this.characterId = characterId;
  }

  static get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'dialog', 'equipment-edit'] as unknown as string[],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/equipment-edit.html',
      width: 500,
      height: 'auto' as any,
      title: 'Edit Equipment',
      submitOnChange: false,
      closeOnSubmit: true,
    });
  }

  getData(): EquipmentEditData {
    const equipment = this.object as Equipment;
    return {
      equipment,
      tiers: ['common', 'rare', 'epic'],
      categories: ['weapon', 'armor', 'tool', 'consumable', 'augmentation', 'misc'],
    };
  }

  protected async _updateObject(_event: Event, formData: Record<string, any>): Promise<void> {
    const equipment = this.object as Equipment;
    const changes: Partial<Equipment> = {
      name: formData.name as string,
      tier: formData.tier as Equipment['tier'],
      category: formData.category as string,
      description: formData.description as string,
      img: formData.img as string,
      modifiers: {
        position: formData['modifiers.position'] || 'none',
        effect: formData['modifiers.effect'] || 'none',
        dicePool: parseInt(formData['modifiers.dicePool'] || '0', 10),
      },
    };

    await game.fitgd.bridge.execute({
      type: 'characters/updateEquipment',
      payload: {
        characterId: this.characterId,
        equipmentId: equipment.id,
        changes,
      },
    });

    ui.notifications.info(`Updated ${changes.name}`);
  }
}
