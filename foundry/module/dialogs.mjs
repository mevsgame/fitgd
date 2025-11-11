/**
 * Dialog Forms for FitGD
 *
 * DEPRECATED: This file now re-exports from individual dialog files.
 * For new code, import directly from './dialogs/index.mjs' or specific dialog files.
 *
 * Implements dialog forms for core game mechanics:
 * - Action Roll
 * - Take Harm
 * - Rally
 * - Push Yourself
 * - Flashback
 * - Add/Manage Traits
 * - Add/Manage Clocks
 */

// @ts-check

// Re-export all dialogs from the new modular structure
export { ActionRollDialog } from './dialogs/ActionRollDialog.mjs';
export { TakeHarmDialog } from './dialogs/TakeHarmDialog.mjs';
export { RallyDialog } from './dialogs/RallyDialog.mjs';
export { PushDialog } from './dialogs/PushDialog.mjs';
export { FlashbackDialog } from './dialogs/FlashbackDialog.mjs';
export { AddTraitDialog } from './dialogs/AddTraitDialog.mjs';
export { FlashbackTraitsDialog } from './dialogs/FlashbackTraitsDialog.mjs';
export { AddClockDialog } from './dialogs/AddClockDialog.mjs';

// Re-export helper function for backward compatibility
export { refreshSheetsByReduxId } from './helpers/sheet-helpers.mjs';
