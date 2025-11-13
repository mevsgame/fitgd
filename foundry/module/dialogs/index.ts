/**
 * Dialog Module Exports
 *
 * Central export for all dialog classes
 */

// Base classes and helpers
export { BaseSelectionDialog } from './base/BaseSelectionDialog';
export { promptForText, confirmAction } from './base/dialogHelpers';

// Selection dialogs
export { ClockSelectionDialog } from './ClockSelectionDialog';
export { CharacterSelectionDialog } from './CharacterSelectionDialog';
export { ClockCreationDialog } from './ClockCreationDialog.mjs';

// Main game dialogs (newly refactored from dialogs.mjs)
export { ActionRollDialog } from './ActionRollDialog.mjs';
export { TakeHarmDialog } from './TakeHarmDialog.mjs';
export { RallyDialog } from './RallyDialog.mjs';
export { PushDialog } from './PushDialog.mjs';
export { FlashbackDialog } from './FlashbackDialog.mjs';
export { AddTraitDialog } from './AddTraitDialog';
export { FlashbackTraitsDialog } from './FlashbackTraitsDialog.mjs';
export { LeanIntoTraitDialog } from './LeanIntoTraitDialog.mjs';
export { AddClockDialog } from './AddClockDialog';

// Equipment dialogs
export { EquipmentBrowserDialog } from './equipment-browser-dialog.mjs';
export { EquipmentEditDialog } from './equipment-edit-dialog.mjs';
