/**
 * Sheet Registration Helper
 *
 * Registers Foundry sheet classes for Actors and Items
 */
 
import { FitGDCharacterSheet } from '../sheets/character-sheet.ts'; 
import { FitGDCrewSheet } from '../sheets/crew-sheet.ts'; 
import { FitGDTraitSheet, FitGDEquipmentSheet } from '../sheets/item-sheets.ts';

/* -------------------------------------------- */
/*  Sheet Registration                          */
/* -------------------------------------------- */

export function registerSheetClasses(): void {
  // Unregister default sheets
  Actors.unregisterSheet('core', ActorSheet);
  Items.unregisterSheet('core', ItemSheet);

  // Register character sheet
  Actors.registerSheet('forged-in-the-grimdark', FitGDCharacterSheet, {
    types: ['character'],
    makeDefault: true
  });

  // Register crew sheet
  Actors.registerSheet('forged-in-the-grimdark', FitGDCrewSheet, {
    types: ['crew'],
    makeDefault: true
  });

  // Register trait item sheet
  Items.registerSheet('forged-in-the-grimdark', FitGDTraitSheet, {
    types: ['trait'],
    makeDefault: true
  });

  // Register equipment item sheet
  Items.registerSheet('forged-in-the-grimdark', FitGDEquipmentSheet, {
    types: ['equipment'],
    makeDefault: true
  });
}
