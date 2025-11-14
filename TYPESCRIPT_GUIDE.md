# TypeScript Development Guide

**Status:** ✅ TypeScript migration complete (Phase 5)
**Last Updated:** 2025-11-14

This guide explains how to work with the TypeScript codebase for Forged in the Grimdark.

---

## Quick Start

### Prerequisites

- Node.js 20+ (preferably 22+)
- pnpm 10.19+ (package manager)

### Setup

```bash
# Install dependencies
pnpm install

# Build TypeScript modules
pnpm run build:foundry

# Run type checking
pnpm run type-check:all

# Run tests
pnpm test
```

---

## Project Structure

### Source Files (.ts)

All source code is now in TypeScript:

```
foundry/module/              ← TypeScript source files (.ts)
├── fitgd.ts                 ← Main entry point
├── foundry-redux-bridge.ts  ← Bridge API
├── types/
│   ├── global.d.ts          ← Global type declarations
│   └── ids.ts               ← Branded ID types
├── dialogs/                 ← 17 dialog files
├── sheets/                  ← 3 sheet files
├── widgets/                 ← 1 widget file
└── ... (other directories)
```

### Build Output (.mjs)

TypeScript is compiled to ES modules:

```
foundry/module-dist/         ← Built JavaScript files (.mjs)
├── fitgd.mjs                ← Compiled entry point
├── foundry-redux-bridge.mjs
└── ... (mirrors source structure)
```

**IMPORTANT:** `module-dist/` is in `.gitignore` - these are **generated files**, not source files.

### Migration Scripts

```
foundry/module/migration/
└── unify-ids-migration.mjs  ← Intentionally JavaScript (one-time script)
```

Migration scripts are kept as .mjs since they're one-time utilities run in Foundry's console.

---

## Development Workflow

### 1. Edit TypeScript Source

Edit files in `foundry/module/*.ts` (source of truth).

**Example:** `foundry/module/dialogs/AddTraitDialog.ts`

```typescript
import type { Character } from '@/types/character';
import type { ReduxId } from '../types/ids';

export class AddTraitDialog extends FormApplication {
  async addTrait(characterId: ReduxId): Promise<void> {
    await game.fitgd.bridge.execute({
      type: 'characters/addTrait',
      payload: { characterId, trait }
    });
  }
}
```

### 2. Build for Foundry

```bash
# One-time build
pnpm run build:foundry

# Watch mode (auto-rebuild on changes)
pnpm run dev:foundry
```

### 3. Test in Foundry

Foundry loads from `foundry/module-dist/fitgd.mjs` (configured in `system.json`).

### 4. Type Check

```bash
# Check all TypeScript
pnpm run type-check:all

# Check only Foundry integration
pnpm run type-check:foundry

# Check only core library
pnpm run type-check
```

---

## TypeScript Patterns

### Branded Types for ID Safety

**Problem:** Easy to confuse Redux IDs with Foundry Actor IDs.

**Solution:** Use branded types for compile-time safety.

```typescript
import { asReduxId, type ReduxId } from '../types/ids';

// ✅ CORRECT - Explicit conversion
const reduxId = asReduxId(this.actor.id);
await game.fitgd.bridge.execute(action, { affectedReduxIds: [reduxId] });

// ❌ WRONG - Compile error
const stringId = this.actor.id;  // type: string
await game.fitgd.bridge.execute(action, { affectedReduxIds: [stringId] });
// Error: Type 'string' is not assignable to type 'ReduxId'
```

**Available types:**

```typescript
// foundry/module/types/ids.ts
export type ReduxId = string & { readonly __brand: 'redux' };
export type FoundryActorId = string & { readonly __brand: 'foundry' };

// Conversion helpers
export function asReduxId(id: string): ReduxId;
export function asFoundryActorId(id: string): FoundryActorId;
export function toReduxId(id: ReduxId | FoundryActorId): ReduxId;
```

### Path Aliases

Use `@/` to import from the core library:

```typescript
// ✅ CORRECT
import type { Character } from '@/types/character';
import { createCharacter } from '@/api/character';

// ❌ WRONG - Don't use relative paths to core
import type { Character } from '../../../../src/types/character';
```

**Configured in:** `foundry/tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["../src/*"],
      "@foundry/*": ["./module/*"]
    }
  }
}
```

### Null Safety

TypeScript strict mode catches potential undefined access:

```typescript
// ❌ ERROR - 'game.fitgd' is possibly undefined
game.fitgd.store.dispatch(action);

// ✅ CORRECT - Guard against undefined
if (!game.fitgd) {
  console.error('FitGD not initialized');
  return;
}
game.fitgd.store.dispatch(action);
```

**Common guards:**

```typescript
if (!game.fitgd) return;
if (!ui.notifications) return;
if (!game.actors) return;
```

### Foundry Types

Use types from `@league-of-foundry-developers/foundry-vtt-types`:

```typescript
// Application options
static get defaultOptions(): ApplicationOptions {
  return foundry.utils.mergeObject(super.defaultOptions, {
    classes: ['fitgd', 'dialog'],
    width: 400,
  });
}

// Dialog options
static async show(
  characterId: string,
  options?: Partial<DialogOptions>
): Promise<void> {
  // ...
}
```

**Available types:**
- `Application`, `FormApplication`, `Dialog`
- `Actor`, `Item`, `Scene`, `ChatMessage`
- `ApplicationOptions`, `DialogOptions`
- See: `node_modules/@league-of-foundry-developers/foundry-vtt-types`

---

## Build Configuration

### vite.config.foundry.ts

```typescript
export default defineConfig({
  build: {
    outDir: 'foundry/module-dist',
    lib: {
      entry: {
        fitgd: resolve(__dirname, 'foundry/module/fitgd.ts'),
        // ... 34 more entry points
      },
      formats: ['es'],
    },
    rollupOptions: {
      preserveModules: true,  // Keep file structure
      output: {
        entryFileNames: '[name].mjs',  // Add .mjs extension
      },
    },
  },
});
```

**Key features:**
- Preserves module structure (no bundling)
- Adds `.mjs` extensions to all imports
- Generates source maps for debugging
- Path alias resolution (`@/` → `src/`)

---

## Common Tasks

### Adding a New Dialog

1. Create TypeScript file:

```typescript
// foundry/module/dialogs/MyDialog.ts
import { asReduxId, type ReduxId } from '../types/ids';

export class MyDialog extends FormApplication {
  static async show(characterId: string): Promise<void> {
    const dialog = new MyDialog({ characterId });
    dialog.render(true);
  }

  async _updateObject(event: Event, formData: any): Promise<void> {
    const reduxId = asReduxId(this.options.characterId);
    await game.fitgd.bridge.execute({
      type: 'characters/someAction',
      payload: { characterId: reduxId }
    });
  }
}
```

2. Export from index:

```typescript
// foundry/module/dialogs/index.ts
export { MyDialog } from './MyDialog';
```

3. Add entry point to `vite.config.foundry.ts`:

```typescript
entry: {
  // ...
  'dialogs/MyDialog': resolve(__dirname, 'foundry/module/dialogs/MyDialog.ts'),
}
```

4. Build and test:

```bash
pnpm run build:foundry
```

### Fixing Type Errors

**Known issues (476 errors as of Phase 5):**

1. **Null safety** (~200 errors) - Add guards:
   ```typescript
   if (!game.fitgd) return;
   ```

2. **Branded types** (~50 errors) - Add conversions:
   ```typescript
   const reduxId = asReduxId(stringId);
   ```

3. **Module imports** (~100 errors) - Update to TypeScript imports:
   ```typescript
   // ❌ Old
   import { foo } from './bar.mjs';

   // ✅ New
   import { foo } from './bar';
   ```

4. **Unused variables** (~76 errors) - Remove or prefix with `_`:
   ```typescript
   // ❌ Error: 'foo' is declared but never read
   const foo = 123;

   // ✅ Fix
   const _foo = 123;  // Underscore indicates intentionally unused
   ```

**Strategy:** Fix incrementally as you work on files. Type errors don't prevent builds.

---

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test --watch

# Coverage report
pnpm run test:coverage
```

Tests are in `tests/` directory and use Vitest.

### Type Checking

```bash
# Check everything (fails fast on errors)
pnpm run type-check:all

# Check Foundry integration only
pnpm run type-check:foundry
```

---

## Troubleshooting

### Build Fails

**Error:** `Cannot find module '@/types/character'`

**Solution:** Check path aliases in `foundry/tsconfig.json`

---

**Error:** `vite: command not found`

**Solution:** Run `pnpm install`

---

### Type Errors Don't Match IDE

**Problem:** VSCode shows no errors, but `tsc` reports errors.

**Solution:** VSCode may be using a different `tsconfig.json`. Restart TypeScript server:

1. `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
2. "TypeScript: Restart TS Server"

---

### Foundry Can't Load Modules

**Error:** `Failed to load module script: The server responded with a non-JavaScript MIME type`

**Solution:** Verify `system.json` points to `module-dist/`, not `module/`:

```json
{
  "esmodules": ["module-dist/fitgd.mjs"]
}
```

---

### Import Errors in Foundry Console

**Error:** `Failed to resolve module specifier "./foo"`

**Solution:** All imports must have `.mjs` extensions. The build should add these automatically. Check `vite.config.foundry.ts`:

```typescript
output: {
  entryFileNames: '[name].mjs',
}
```

---

## Migration Status

### Completed (Phase 5)

- ✅ 35 TypeScript modules (100% of Foundry integration)
- ✅ Build pipeline configured
- ✅ Legacy .mjs files deleted
- ✅ system.json updated to load from `module-dist/`
- ✅ Branded types for ID safety

### Remaining Work (Optional)

- ⚠️ 476 type errors (mostly strictness checks, not bugs)
  - Can be fixed incrementally as you work on files
  - Build and runtime work correctly despite errors

---

## Best Practices

### 1. Always Use Bridge API

```typescript
// ✅ CORRECT
await game.fitgd.bridge.execute({
  type: 'characters/addTrait',
  payload: { characterId, trait }
});

// ❌ WRONG - Never call dispatch directly
game.fitgd.store.dispatch({ type: 'characters/addTrait', payload: { ... } });
await game.fitgd.saveImmediate();  // Easy to forget!
```

See: `foundry/module/BRIDGE_API_QUICK_GUIDE.md`

### 2. Use Branded Types

```typescript
// ✅ CORRECT
const reduxId = asReduxId(actor.id);

// ❌ WRONG - Type confusion
const id = actor.id;  // Is this Redux ID or Foundry Actor ID?
```

### 3. Guard Against Undefined

```typescript
// ✅ CORRECT
if (!game.fitgd?.store) {
  console.error('FitGD not initialized');
  return;
}

// ❌ WRONG - Will crash if undefined
game.fitgd.store.dispatch(action);
```

### 4. Use Path Aliases

```typescript
// ✅ CORRECT
import type { Character } from '@/types/character';

// ❌ WRONG - Fragile relative paths
import type { Character } from '../../../../src/types/character';
```

---

## Resources

### Documentation

- **Core Architecture:** `CLAUDE.md`
- **Bridge API Guide:** `foundry/module/BRIDGE_API_QUICK_GUIDE.md`
- **Session Start Guide:** `SESSION_START.md`
- **Migration Reports:** `TYPESCRIPT_MIGRATION_STATUS.md`

### External References

- **Foundry Types:** https://github.com/League-of-Foundry-Developers/foundry-vtt-types
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Vite Documentation:** https://vitejs.dev/

---

## Getting Help

### Type Errors

Run type-check to see detailed errors:

```bash
pnpm run type-check:foundry
```

### Build Errors

Check build output for specific issues:

```bash
pnpm run build:foundry
```

### Runtime Errors

Check Foundry console for errors. Enable source maps in browser DevTools to see TypeScript line numbers.

---

**Status:** ✅ Production ready. TypeScript migration complete.
**Next Steps:** Fix type errors incrementally as you work on features.
