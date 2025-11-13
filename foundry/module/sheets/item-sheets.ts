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
 * - Tier (accessible, inaccessible, epic)
 * - Category (weapon, armor, tool, etc.)
 * - Description
 *
 * Equipment is stored in Redux but can be viewed as Foundry Items.
 */
class FitGDEquipmentSheet extends ItemSheet {
  static override get defaultOptions(): ItemSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'sheet', 'item', 'equipment'],
      template: 'systems/forged-in-the-grimdark/templates/equipment-sheet.html',
      width: 520,
      height: 480
    });
  }
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

export { FitGDTraitSheet, FitGDEquipmentSheet };
