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
      height: 600,
      submitOnChange: true  // Submit on every change
    });
  }

  /**
   * Prepare data for rendering the sheet
   * Ensures modifiers object exists with proper defaults
   */
  override async getData(options: any = {}): Promise<any> {
    const data = await super.getData(options);

    // Ensure modifiers object exists and has all expected fields
    const item = this.item as any;
    if (!item.system.modifiers) {
      console.log('FitGD | Creating missing modifiers object on item:', item.name);
      item.system.modifiers = {};
    }

    // Ensure all modifier fields exist (with undefined for unset values)
    const expectedModifiers = ['diceBonus', 'dicePenalty', 'positionBonus', 'positionPenalty', 'effectBonus', 'effectPenalty'];
    for (const modifier of expectedModifiers) {
      if (!(modifier in item.system.modifiers)) {
        item.system.modifiers[modifier] = undefined;
      }
    }

    console.log('FitGD | Equipment Sheet - getData() returning with modifiers:', item.system.modifiers);

    return data;
  }

  override async _render(force: boolean = false, options: any = {}): Promise<void> {
    // Ensure modifiers exist before rendering
    const item = this.item as any;
    if (!item.system.modifiers) {
      item.system.modifiers = {};
    }

    return super._render(force, options);
  }

  /**
   * Override form data collection to ensure modifier fields are included
   */
  protected override _getFormData(form?: HTMLFormElement): Record<string, any> {
    const formData = super._getFormData(form);
    console.log('FitGD | _getFormData collected:', Object.keys(formData));
    return formData;
  }

  /**
   * Handle item updates and properly save nested modifier objects
   *
   * Foundry flattens nested objects with dot notation (system.modifiers.diceBonus),
   * but doesn't reconstruct them automatically. This override rebuilds the modifiers
   * object from the flattened form data.
   */
  protected override async _updateObject(event: Event, formData: Record<string, unknown>): Promise<void> {
    // Collect all modifier fields into a single object
    const modifiers: Record<string, any> = {};
    const keysToDelete: string[] = [];

    console.log('FitGD | Equipment Sheet - _updateObject called with formData keys:', Object.keys(formData));

    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('system.modifiers.')) {
        console.log(`FitGD |   Found modifier key: ${key} = ${value}`);
        const modifierKey = key.replace('system.modifiers.', '');
        // Convert empty strings to undefined, parse numbers
        if (value === '' || value === null) {
          modifiers[modifierKey] = undefined;
        } else if (typeof value === 'string' && value.trim() !== '') {
          // Try to parse as number
          const numValue = parseInt(value, 10);
          modifiers[modifierKey] = isNaN(numValue) ? value : numValue;
        } else {
          modifiers[modifierKey] = value;
        }
        keysToDelete.push(key);
      }
    }

    console.log('FitGD | Equipment Sheet - Modifier keys found:', keysToDelete.length);

    // Remove all flattened modifier keys from formData
    keysToDelete.forEach(key => delete formData[key]);

    // Always set the modifiers object (even if empty) to ensure it's preserved
    (formData as any)['system.modifiers'] = modifiers;

    console.log('FitGD | Equipment Sheet - Before update:');
    console.log('  Current item modifiers:', (this.item as any).system?.modifiers);
    console.log('  Modifiers being saved:', modifiers);
    console.log('  Updated formData:', formData);

    // Call parent to handle the update
    await super._updateObject(event, formData);

    console.log('FitGD | Equipment Sheet - After update:');
    console.log('  Item modifiers after save:', (this.item as any).system?.modifiers);
  }
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

export { FitGDTraitSheet, FitGDEquipmentSheet };
