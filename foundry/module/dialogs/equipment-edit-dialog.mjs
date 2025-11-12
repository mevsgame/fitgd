/**
 * Equipment Edit Dialog
 *
 * Allows editing all fields of an equipment instance.
 * Changes are saved to Redux (no effect on template).
 */
export class EquipmentEditDialog extends FormApplication {
  constructor(characterId, equipment, options = {}) {
    super(equipment, options);
    this.characterId = characterId;
  }

  static get defaultOptions() {
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

  getData() {
    return {
      equipment: this.object,
      tiers: ['accessible', 'inaccessible', 'epic'],
      categories: ['weapon', 'armor', 'tool', 'consumable', 'misc'],
    };
  }

  async _updateObject(event, formData) {
    const changes = {
      name: formData.name,
      tier: formData.tier,
      category: formData.category,
      description: formData.description,
      img: formData.img,
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
