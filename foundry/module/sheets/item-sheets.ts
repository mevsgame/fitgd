/**
 * Item Sheet Classes
 *
 * Foundry VTT Item Sheets for trait and equipment items
 */

/* -------------------------------------------- */
/*  Item Sheet Classes                          */
/* -------------------------------------------- */

/**
 * FitGD Trait Item Sheet
 *
 * Foundry VTT Item Sheet for trait items. Displays trait details:
 * - Trait name
 * - Category (role, background, scar, flashback, grouped)
 * - Description
 * - Disabled status (leaned into for Momentum)
 *
 * Traits are stored in Redux but can be viewed as Foundry Items.
 */
class FitGDTraitSheet extends ItemSheet {
  static override get defaultOptions(): ItemSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'item', 'trait'],
      template: 'systems/forged-in-the-grimdark/templates/trait-sheet.html',
      width: 520,
      height: 480
    });
  }
}

/**
 * FitGD Equipment Item Sheet
 *
 * Foundry VTT Item Sheet for equipment items. Displays equipment details:
 * - Equipment name
 * - Tier (common, rare, epic)
 * - Category (active, passive, consumable)
 * - Slots and modifiers
 * - Description
 *
 * Equipment is stored as Foundry Items and as templates for character equipment.
 */
class FitGDEquipmentSheet extends ItemSheet {
  static override get defaultOptions(): ItemSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'item', 'equipment'],
      template: 'systems/forged-in-the-grimdark/templates/equipment-sheet.html',
      width: 520,
      height: 600
    });
  }

  /**
   * Handle item updates and properly save nested modifier objects
   */
  protected override async _updateObject(event: Event, formData: Record<string, unknown>): Promise<void> {
    // Handle nested modifiers object properly
    const modifiers: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('system.modifiers.')) {
        const modifierKey = key.replace('system.modifiers.', '');
        modifiers[modifierKey] = value;
        delete formData[key];
      }
    }

    // Set the modifiers object in formData
    if (Object.keys(modifiers).length > 0) {
      (formData as any)['system.modifiers'] = modifiers;
    }

    // Call parent to handle the update
    return super._updateObject(event, formData);
  }
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

export { FitGDTraitSheet, FitGDEquipmentSheet };
