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

export class EquipmentEditDialog extends FormApplication<Equipment> {
  private characterId: string;

  constructor(characterId: string, equipment: Equipment, options: Partial<FormApplicationOptions> = {}) {
    super(equipment, options);
    this.characterId = characterId;
  }

  static override get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'dialog', 'equipment-edit'],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/equipment-edit.html',
      width: 500,
      height: 'auto',
      title: 'Edit Equipment',
      submitOnChange: false,
      closeOnSubmit: true,
    });
  }

  override getData(): EquipmentEditData {
    return {
      equipment: this.object,
      tiers: ['accessible', 'inaccessible', 'epic'],
      categories: ['weapon', 'armor', 'tool', 'consumable', 'misc'],
    };
  }

  protected override async _updateObject(_event: Event, formData: Record<string, any>): Promise<void> {
    const changes: Partial<Equipment> = {
      name: formData.name as string,
      tier: formData.tier as Equipment['tier'],
      category: formData.category as string,
      description: formData.description as string,
      img: formData.img as string,
    };

    await game.fitgd.bridge.execute({
      type: 'characters/updateEquipment',
      payload: {
        characterId: this.characterId,
        equipmentId: this.object.id,
        changes,
      },
    });

    ui.notifications.info(`Updated ${changes.name}`);
  }
}
