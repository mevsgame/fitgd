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
export { ClockCreationDialog } from './ClockCreationDialog';

// Main game dialogs (all TypeScript)
export { ActionRollDialog } from './ActionRollDialog';
export { TakeHarmDialog } from './TakeHarmDialog';
export { RallyDialog } from './RallyDialog';
export { PushDialog } from './PushDialog';
export { FlashbackDialog } from './FlashbackDialog';
export { AddTraitDialog } from './AddTraitDialog';
export { FlashbackTraitsDialog } from './FlashbackTraitsDialog';
export { LeanIntoTraitDialog } from './LeanIntoTraitDialog';
export { AddClockDialog } from './AddClockDialog';

// Equipment dialogs (all TypeScript)
export { EquipmentBrowserDialog } from './equipment-browser-dialog';
export { EquipmentEditDialog } from './equipment-edit-dialog';

// Clock interaction dialogs
export { ConsequenceResolutionDialog } from './ConsequenceResolutionDialog';
