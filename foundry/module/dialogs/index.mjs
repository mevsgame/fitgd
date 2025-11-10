/**
 * Dialog Module Exports
 *
 * Central export for all dialog classes
 */

// @ts-check

// Base classes and helpers
export { BaseSelectionDialog } from './base/BaseSelectionDialog.mjs';
export { promptForText, confirmAction } from './base/dialogHelpers.mjs';

// Specific dialog implementations
export { ClockSelectionDialog } from './ClockSelectionDialog.mjs';
export { CharacterSelectionDialog } from './CharacterSelectionDialog.mjs';

// Note: Existing dialogs from dialogs.mjs are NOT re-exported here
// to avoid naming conflicts. They should be imported directly from dialogs.mjs:
// - ActionRollDialog
// - TakeHarmDialog
// - RallyDialog
// - PushDialog
// - FlashbackDialog
// - AddTraitDialog
// - FlashbackTraitsDialog
// - AddClockDialog
//
// Usage:
//   import { ClockSelectionDialog, promptForText } from './dialogs/index.mjs';
//   import { AddTraitDialog } from './dialogs.mjs'; // Existing dialogs
