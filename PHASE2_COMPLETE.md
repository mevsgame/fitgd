# Phase 2 Complete: All Dialogs Converted to TypeScript

**Date:** 2025-11-13
**Status:** ✅ **COMPLETE**

## Summary

Successfully converted all 17 dialog files from JavaScript (.mjs) to TypeScript (.ts) with full type safety.

## Files Converted

### Base Dialogs (2 files)
- ✅ `dialogs/base/dialogHelpers.ts` - Utility functions for prompts and confirmations
- ✅ `dialogs/base/BaseSelectionDialog.ts` - Abstract base class for selection dialogs

### Simple Dialogs (5 files)
- ✅ `dialogs/index.ts` - Central export file with all dialog classes
- ✅ `dialogs/AddClockDialog.ts` - Wrapper for clock creation
- ✅ `dialogs/AddTraitDialog.ts` - Add trait to character
- ✅ `dialogs/ClockSelectionDialog.ts` - Select harm or crew clocks
- ✅ `dialogs/CharacterSelectionDialog.ts` - Select character from crew

### Medium Complexity Dialogs (6 files)
- ✅ `dialogs/ClockCreationDialog.ts` - Unified clock creation with segment selection (~200 lines)
- ✅ `dialogs/FlashbackDialog.ts` - Flashback trait creation (~150 lines)
- ✅ `dialogs/LeanIntoTraitDialog.ts` - Lean into trait for Momentum (~180 lines)
- ✅ `dialogs/PushDialog.ts` - Push yourself dialog (~120 lines)
- ✅ `dialogs/TakeHarmDialog.ts` - Take harm with position/effect (~160 lines)
- ✅ `dialogs/equipment-edit-dialog.ts` - Equipment editing form (~50 lines)

### Complex Dialogs (4 files)
- ✅ `dialogs/ActionRollDialog.ts` - Action roll with dice, outcomes, chat (~368 lines)
- ✅ `dialogs/RallyDialog.ts` - Rally mechanic with state management (~330 lines)
- ✅ `dialogs/FlashbackTraitsDialog.ts` - Flashback trait management (~344 lines)
- ✅ `dialogs/equipment-browser-dialog.ts` - Equipment browser with filtering (~269 lines)

## Total Conversion

- **Lines converted:** ~2,300+ lines of TypeScript
- **Dialogs converted:** 17 files
- **Build time:** ~780ms for all 30 TypeScript modules

## TypeScript Patterns Established

### Type-Only Imports
```typescript
import type { Character } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { Position } from '@/types/action';
```

### Interface Definitions
```typescript
interface FlashbackMode = 'use-existing' | 'create-new' | 'consolidate';

interface FlashbackTraitsData {
  character: Character;
  crew: Crew;
  momentum: number;
  // ... full type safety for all template data
}
```

### Method Visibility
```typescript
export class ActionRollDialog extends Dialog {
  // Public constructor
  constructor(characterId: string, crewId: string, options = {}) {}

  // Private methods
  private _onRender(html: JQuery, characterId: string): void {}
  private async _onRoll(html: JQuery, characterId: string, crewId: string): Promise<void> {}
}
```

### Override Keywords
```typescript
export class RallyDialog extends Application {
  static override get defaultOptions(): ApplicationOptions {}
  override get id(): string {}
  override async getData(options = {}): Promise<RallyDialogData> {}
  override activateListeners(html: JQuery): void {}
}
```

### Type Guards
```typescript
const teammates = this.crew.characters
  .filter(id => id !== this.characterId)
  .map(id => state.characters.byId[id])
  .filter((char): char is Character => !!char); // Type guard!
```

### Proper Error Handling
```typescript
try {
  await game.fitgd.bridge.execute({ /* ... */ });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  ui.notifications.error(`Error: ${errorMessage}`);
  console.error('FitGD | Rally error:', error);
}
```

### Dynamic Imports
```typescript
// Used in ActionRollDialog to avoid circular dependency
const { TakeHarmDialog } = await import('./TakeHarmDialog.mjs');
new TakeHarmDialog(characterId, crewId, options).render(true);
```

## Build Configuration

### Vite Config Updates
Added 17 dialog entry points to `vite.config.foundry.ts`:

```typescript
lib: {
  entry: {
    // ... existing entries

    // Dialogs - Base (2)
    'dialogs/base/dialogHelpers': path.resolve(__dirname, '...'),
    'dialogs/base/BaseSelectionDialog': path.resolve(__dirname, '...'),

    // Dialogs - Simple (5)
    'dialogs/index': path.resolve(__dirname, '...'),
    'dialogs/AddClockDialog': path.resolve(__dirname, '...'),
    // ...

    // Dialogs - Medium (6)
    'dialogs/ClockCreationDialog': path.resolve(__dirname, '...'),
    // ...

    // Dialogs - Complex (4)
    'dialogs/ActionRollDialog': path.resolve(__dirname, '...'),
    'dialogs/FlashbackTraitsDialog': path.resolve(__dirname, '...'),
    'dialogs/RallyDialog': path.resolve(__dirname, '...'),
    'dialogs/equipment-browser-dialog': path.resolve(__dirname, '...'),
  }
}
```

### Export Updates
All dialog exports in `dialogs/index.ts` now use TypeScript versions:

```typescript
// ✅ All TypeScript exports
export { ActionRollDialog } from './ActionRollDialog';
export { RallyDialog } from './RallyDialog';
export { FlashbackTraitsDialog } from './FlashbackTraitsDialog';
export { EquipmentBrowserDialog } from './equipment-browser-dialog';
```

## Generated Output

Build produces 30 ES modules with correct .mjs extensions:

```
foundry/module-dist/
├── dialogs/
│   ├── base/
│   │   ├── dialogHelpers.mjs (1.44 kB)
│   │   └── BaseSelectionDialog.mjs (3.43 kB)
│   ├── index.mjs (1.40 kB)
│   ├── AddClockDialog.mjs (1.66 kB)
│   ├── AddTraitDialog.mjs (2.55 kB)
│   ├── ClockSelectionDialog.mjs (1.73 kB)
│   ├── CharacterSelectionDialog.mjs (1.76 kB)
│   ├── ClockCreationDialog.mjs (4.31 kB)
│   ├── FlashbackDialog.mjs (2.83 kB)
│   ├── LeanIntoTraitDialog.mjs (4.02 kB)
│   ├── PushDialog.mjs (2.37 kB)
│   ├── TakeHarmDialog.mjs (4.02 kB)
│   ├── equipment-edit-dialog.mjs (1.31 kB)
│   ├── ActionRollDialog.mjs (10.00 kB)
│   ├── FlashbackTraitsDialog.mjs (8.04 kB)
│   ├── RallyDialog.mjs (8.04 kB)
│   └── equipment-browser-dialog.mjs (7.81 kB)
```

## Type Safety Improvements

### Before (JavaScript with JSDoc)
```javascript
// @ts-check

/**
 * @typedef {'harm' | 'progress'} ClockType
 * @typedef {import('../../dist/types').Clock} Clock
 */

/**
 * @param {string} entityId - Character or crew ID
 * @param {ClockType} clockType - 'harm' or 'progress'
 * @param {Function} onCreate - Callback
 */
constructor(entityId, clockType, onCreate, options = {}) {
  // No compile-time type checking
}
```

### After (TypeScript)
```typescript
type ClockType = 'harm' | 'progress';

interface ClockData {
  name: string;
  segments: number;
  description?: string;
}

constructor(
  entityId: string,
  clockType: ClockType,
  onCreate: (clockData: ClockData) => void | Promise<void>,
  options: Partial<DialogOptions> = {}
) {
  // Full compile-time type checking
}
```

## Benefits Achieved

✅ **Compile-time type checking** - Catch errors before runtime
✅ **Better IDE support** - IntelliSense, autocomplete, refactoring
✅ **Self-documenting code** - Types serve as inline documentation
✅ **Easier refactoring** - TypeScript tracks all usages
✅ **Prevention of common bugs** - null/undefined, wrong types caught early
✅ **Maintainability** - Clear contracts between components

## Commits

1. `d90e2b8` - feat: Convert medium complexity dialogs to TypeScript (Phase 2 continued)
2. `7ca72cf` - feat: Convert complex dialogs to TypeScript (Phase 2 complete)

## Next Steps: Phase 3 - Sheets & Widgets

See `TYPESCRIPT_MIGRATION_PLAN.md` for the remaining phases:

- **Phase 3:** Convert sheets and widgets (~4 hours)
  - sheets/character-sheet.mjs (~800 lines)
  - sheets/crew-sheet.mjs (~700 lines)
  - sheets/item-sheets.mjs (~300 lines)
  - widgets/player-action-widget.mjs (~1,200 lines)

---

**Phase 2 Status:** ✅ **COMPLETE** - All dialogs converted to TypeScript with full type safety.
