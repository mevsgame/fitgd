/**
 * Dialog Module Exports
 *
 * Central export for all dialog classes
 */

// @ts-check

// Base classes and helpers
export { BaseSelectionDialog } from './base/BaseSelectionDialog.mjs';
export { promptForText, confirmAction } from './base/dialogHelpers.mjs';

// Selection dialogs
export { ClockSelectionDialog } from './ClockSelectionDialog.mjs';
export { CharacterSelectionDialog } from './CharacterSelectionDialog.mjs';
export { ClockCreationDialog } from './ClockCreationDialog.mjs';

// Main game dialogs (newly refactored from dialogs.mjs)
export { ActionRollDialog } from './ActionRollDialog.mjs';
export { TakeHarmDialog } from './TakeHarmDialog.mjs';
export { RallyDialog } from './RallyDialog.mjs';
export { PushDialog } from './PushDialog.mjs';
export { FlashbackDialog } from './FlashbackDialog.mjs';
export { AddTraitDialog } from './AddTraitDialog.mjs';
export { FlashbackTraitsDialog } from './FlashbackTraitsDialog.mjs';
export { LeanIntoTraitDialog } from './LeanIntoTraitDialog.mjs';
export { AddClockDialog } from './AddClockDialog.mjs';
