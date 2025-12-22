/**
 * Sheet Registration Helper
 *
 * Registers Foundry sheet classes for Actors and Items
 */

import { FitGDCharacterSheet } from '../sheets/character-sheet';
import { FitGDCrewSheet } from '../sheets/crew-sheet';
import { FitGDEquipmentSheet } from '../sheets/item-sheets';

/* -------------------------------------------- */
/*  Sheet Registration                          */
/* -------------------------------------------- */

export function registerSheetClasses(): void {
  // Unregister default sheets
  // @ts-ignore - Foundry sheet registration type mismatch (v4 type system)
  Actors.unregisterSheet('core', ActorSheet);
  // @ts-ignore - Foundry sheet registration type mismatch (v4 type system)
  Items.unregisterSheet('core', ItemSheet);

  // Register character sheet
  // @ts-ignore - Foundry sheet registration type mismatch (v4 type system)
  Actors.registerSheet('forged-in-the-grimdark', FitGDCharacterSheet, {
    types: ['character'],
    makeDefault: true
  });

  // Register crew sheet
  // @ts-ignore - Foundry sheet registration type mismatch (v4 type system)
  Actors.registerSheet('forged-in-the-grimdark', FitGDCrewSheet, {
    types: ['crew'],
    makeDefault: true
  });



  // Register equipment item sheet
  // @ts-ignore - Foundry sheet registration type mismatch (v4 type system)
  Items.registerSheet('forged-in-the-grimdark', FitGDEquipmentSheet, {
    types: ['equipment'],
    makeDefault: true
  });
}
