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
      submitOnChange: true,  // Submit on every change
      closeOnSubmit: false   // Don't close on submit (allows multiple edits)
    });
  }

  /**
   * Prepare data for rendering the sheet
   * Ensures modifiers object exists with proper defaults
   */
  override async getData(options: any = {}): Promise<any> {
    const data = (await super.getData(options)) as any;

    // Foundry v11+ structure: data.data.system contains the actual system data
    // But we need to expose it at data.system for the template
    if (!data.system && (data as any).data?.system) {
      data.system = (data as any).data.system;
    }

    // Alternatively, if system is in the document
    if (!data.system && (data as any).document?.system) {
      data.system = (data as any).document.system;
    }

    // Fallback: create empty system if still missing
    if (!data.system) {
      console.warn('FitGD | No system found, creating empty object');
      data.system = {};
    }

    // Ensure modifiers object exists
    if (!data.system.modifiers) {
      data.system.modifiers = {};
    }

    // Ensure all modifier fields exist (templates use {{system.modifiers.diceBonus}})
    const expectedModifiers = ['diceBonus', 'dicePenalty', 'positionBonus', 'positionPenalty', 'effectBonus', 'effectPenalty'];
    for (const modifier of expectedModifiers) {
      if (!(modifier in data.system.modifiers)) {
        data.system.modifiers[modifier] = undefined;
      }
    }

    return data;
  }

  override async _render(force: boolean = false, options: any = {}): Promise<void> {
    return super._render(force, options);
  }

  /**
   * Override form submission to manually collect modifier fields
   */
  protected override async _onSubmit(event: Event, options: any = {}): Promise<any> {
    const form = ((event.target as any)?.closest('form') || this.form) as HTMLFormElement;

    // Manually ensure modifier fields are collected, even if Foundry skips them
    if (form) {
      const modifierInputs = form.querySelectorAll('input[name^="system.modifiers"]');
      modifierInputs.forEach((input: any) => {
        // Force Foundry to include these fields
        if (!form.querySelector(`input[name="${input.name}"][value]`)) {
          const hiddenInput = document.createElement('input');
          hiddenInput.type = 'hidden';
          hiddenInput.name = input.name;
          hiddenInput.value = input.value;
          form.appendChild(hiddenInput);
        }
      });
    }

    return super._onSubmit(event, options);
  }

  /**
   * Collect form data to ensure modifier fields are included
   */
  protected _getFormData(form?: HTMLFormElement): Record<string, any> {
    // Try to call parent _getFormData if it exists
    const formData: Record<string, any> = {};

    // If no form provided, try to get it from the element
    const actualForm = form || (this.element?.[0] as HTMLFormElement)?.querySelector('form') || this.form;

    // Manually collect modifier fields because Foundry's _getFormData may skip them
    if (actualForm) {
      const modifierInputs = actualForm.querySelectorAll('input[name^="system.modifiers"]');
      modifierInputs.forEach((input: any) => {
        // Add to formData even if empty
        formData[input.name] = input.value;
      });
    }

    return formData;
  }

  /**
   * Handle item updates and properly save nested modifier objects
   *
   * Foundry flattens nested objects with dot notation (system.modifiers.diceBonus),
   * but doesn't reconstruct them automatically. This override rebuilds the modifiers
   * object from the flattened form data.
   */
  protected override async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<any> {
    // Get current item's modifiers to preserve existing values
    const currentModifiers = (this.item as any).system.modifiers || {};

    // Collect all modifier fields into a single object, preserving existing values when formData is empty
    const modifiers: Record<string, any> = { ...currentModifiers }; // Start with existing values
    const keysToDelete: string[] = [];

    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('system.modifiers.')) {
        const modifierKey = key.replace('system.modifiers.', '');

        // Parse the value: empty string = keep existing, otherwise parse as number or set to undefined
        let parsedValue: any;

        if (value === '' || value === null || value === undefined) {
          // Empty/null/undefined: preserve existing value (don't overwrite)
          parsedValue = currentModifiers[modifierKey];
        } else if (typeof value === 'string') {
          const trimmed = String(value).trim();
          if (trimmed === '') {
            // Empty after trim: preserve existing value
            parsedValue = currentModifiers[modifierKey];
          } else {
            // Non-empty string: parse as number
            const numValue = parseInt(trimmed, 10);
            parsedValue = isNaN(numValue) ? undefined : numValue;
          }
        } else if (typeof value === 'number') {
          // Already a number, keep it
          parsedValue = value;
        } else {
          // Unknown type: preserve existing
          parsedValue = currentModifiers[modifierKey];
        }

        modifiers[modifierKey] = parsedValue;
        keysToDelete.push(key);
      }
    }

    // Remove all flattened modifier keys from formData
    keysToDelete.forEach(key => delete formData[key]);

    // Set the modifiers object (preserving existing values for empty inputs)
    (formData as any)['system.modifiers'] = modifiers;

    // CRITICAL: Update the item directly (skip super._updateObject to avoid double-update)
    // The parent ItemSheet._updateObject calls item.update() internally, so calling both
    // super._updateObject AND item.update() causes a race condition where changes get overwritten
    return this.item!.update(formData as any);
  }
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

export { FitGDTraitSheet, FitGDEquipmentSheet };
