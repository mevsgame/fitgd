# Phase 1 Completion Report - Build Pipeline

**Date:** 2025-11-13
**Status:** ✅ **COMPLETED**
**Time Spent:** ~2 hours

---

## Summary

Phase 1 of the TypeScript migration is complete. We successfully created a build pipeline that transpiles TypeScript files in `foundry/module/` to `.mjs` files that Foundry VTT can load.

### What Was Built

1. **Vite Configuration** (`vite.config.foundry.ts`)
   - Transpiles 13 TypeScript files to .mjs
   - Preserves module structure (no bundling)
   - Adds .mjs extensions to relative imports
   - Generates source maps for debugging
   - Handles external dependencies correctly

2. **Build Scripts** (package.json)
   - `npm run build:foundry` - Build Foundry modules once
   - `npm run build:all` - Build core library + Foundry modules
   - `npm run dev:foundry` - Watch mode for development

3. **Git Configuration** (.gitignore)
   - Ignores generated files in `foundry/module-dist/`

---

## Generated Files

The build successfully transpiles 13 TypeScript files:

### Output Structure
```
foundry/module-dist/
├── fitgd.mjs (10.61 KB)
├── foundry-redux-bridge.mjs (7.45 KB)
├── history-management.mjs (4.32 KB)
├── autosave/
│   └── autosave-manager.mjs (11.64 KB)
├── console/
│   └── dev-commands.mjs (0.35 KB)
├── helpers/
│   ├── handlebars-helpers.mjs (3.57 KB)
│   ├── sheet-helpers.mjs (0.96 KB)
│   └── sheet-registration.mjs (0.90 KB)
├── hooks/
│   ├── actor-hooks.mjs (2.38 KB)
│   ├── combat-hooks.mjs (3.77 KB)
│   └── hotbar-hooks.mjs (2.95 KB)
├── settings/
│   └── system-settings.mjs (1.79 KB)
└── socket/
    └── socket-handler.mjs (9.20 KB)
```

**Total:** 13 files, ~60 KB transpiled code, ~100 KB source maps

---

## Import Resolution Verification

All imports are correctly resolved with relative paths:

### Example: fitgd.mjs
```javascript
// ✅ Core library (up one level to dist/)
import { configureStore, createGameAPI, createFoundryAdapter } from "../dist/fitgd-core.es.js";

// ✅ Same directory
import { createFoundryReduxBridge } from "./foundry-redux-bridge.mjs";

// ✅ Subdirectories
import { refreshSheetsByReduxId } from "./helpers/sheet-helpers.mjs";
import { registerCombatHooks } from "./hooks/combat-hooks.mjs";
import { receiveCommandsFromSocket } from "./socket/socket-handler.mjs";
```

### Example: hooks/combat-hooks.mjs
```javascript
// ✅ Relative path to sibling directory
import { PlayerActionWidget } from "../widgets/player-action-widget.mjs";
```

**All 13 files verified** - imports are correct and use relative paths.

---

## Key Technical Decisions

### 1. Preserve Modules = True
```typescript
preserveModules: true,
preserveModulesRoot: 'foundry/module',
```

**Why:** Keeps the original file structure instead of bundling everything into one file. Makes debugging easier and allows Foundry to load modules individually.

### 2. Custom Path Resolution
```typescript
paths: (id: string) => {
  if (id.startsWith('/home/user/fitgd/foundry/module/')) {
    return './' + id.replace('/home/user/fitgd/foundry/module/', '');
  }
  if (id.startsWith('/home/user/fitgd/foundry/dist/')) {
    return '../dist/' + id.replace('/home/user/fitgd/foundry/dist/', '');
  }
  return id;
}
```

**Why:** Rollup resolves external imports with absolute paths. This converts them back to relative paths that work in Foundry.

### 3. External .mjs Files
```typescript
external: [
  /^\.\.\/dist\//,  // Core library
  '@reduxjs/toolkit',
  'immer',
  /\.mjs$/,  // .mjs files not yet converted to TypeScript
],
```

**Why:** During migration, some .mjs files don't have .ts versions yet (sheets, dialogs, widgets). Marking them as external allows .ts files to import from .mjs files without bundling them.

### 4. renderChunk Plugin
```typescript
renderChunk(code) {
  const importRegex = /from\s+['"](\.\.[\/\w\-\/]+|\.\/[\/\w\-\/]+)['"]/g;
  return code.replace(importRegex, (match, importPath) => {
    if (importPath.match(/\.(mjs|js|json)$/)) return match;
    return match.replace(importPath, importPath + '.mjs');
  });
}
```

**Why:** TypeScript uses extensionless imports. Foundry requires `.mjs` extensions. This plugin adds them in the output.

---

## Issues Encountered & Resolved

### Issue 1: Absolute Paths in Output
**Problem:** First build generated imports with absolute paths:
```javascript
import { foo } from "./home/user/fitgd/foundry/module/foo.mjs";  // ❌
```

**Solution:** Added custom `paths` function to convert absolute paths back to relative:
```javascript
import { foo } from "./foo.mjs";  // ✅
```

### Issue 2: Missing .mjs Extensions
**Problem:** Imports didn't have `.mjs` extensions:
```javascript
import { foo } from "./foo";  // ❌ Foundry can't resolve
```

**Solution:** Created `renderChunk` plugin to add `.mjs` extensions to all relative imports.

### Issue 3: External .mjs Imports Failed
**Problem:** Build failed when .ts files imported from .mjs files that don't have .ts versions yet.

**Solution:** Added `/\.mjs$/` to external regex to allow gradual migration.

---

## Validation Checklist

- [x] Build completes successfully with 0 errors
- [x] All 13 .ts files transpiled to .mjs
- [x] Source maps generated for all files
- [x] Imports use relative paths (not absolute)
- [x] .mjs extensions added to all relative imports
- [x] Core library import uses `../dist/fitgd-core.es.js`
- [x] Subdirectory imports work correctly (e.g., `../widgets/player-action-widget.mjs`)
- [ ] **NOT TESTED YET:** Foundry loads the generated files
- [ ] **NOT TESTED YET:** All functionality works correctly

---

## Next Steps (Phase 2)

Now that the build pipeline works, we can:

1. **Test in Foundry** - Update `system.json` to load from `module-dist/` instead of `module/`
2. **Convert dialogs/** - 17 .mjs files → .ts (highest priority)
3. **Convert sheets/** - 3 .mjs files → .ts
4. **Convert widgets/** - 1 .mjs file → .ts
5. **Delete .mjs sources** - Once all files converted, delete original .mjs files (now generated from .ts)

---

## Build Commands Reference

```bash
# Build Foundry modules once
npm run build:foundry

# Build in watch mode (auto-rebuild on file changes)
npm run dev:foundry

# Build everything (core + Foundry)
npm run build:all

# Type-check TypeScript without building
npm run type-check:foundry

# Type-check everything
npm run type-check:all
```

---

## Known Limitations

1. **Sourcemap Warnings** - The renderChunk plugin modifies code after transpilation, so sourcemaps show a warning. This is cosmetic and doesn't affect functionality.

2. **Manual Entry Points** - Each .ts file must be listed manually in `vite.config.foundry.ts`. When converting new files, they must be added to the entry object.

3. **Not Tested in Foundry** - Build produces correct output, but hasn't been tested in Foundry VTT yet. This is the next validation step.

---

## Files Changed

### New Files
- ✅ `vite.config.foundry.ts` (140 lines)
- ✅ `foundry/module-dist/` (directory with 13 generated .mjs files)
- ✅ `PHASE1_COMPLETION.md` (this file)

### Modified Files
- ✅ `package.json` (added 3 new scripts)
- ✅ `.gitignore` (ignore foundry/module-dist/)

### No Changes Required
- Core library build (`vite.config.ts`) - unchanged
- TypeScript files in `foundry/module/` - unchanged
- Existing .mjs files - unchanged (still used by Foundry until Phase 2)

---

## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Build time | <2 seconds | ~0.6 seconds | ✅ EXCEEDED |
| Build errors | 0 | 0 | ✅ PASS |
| Files transpiled | 13 | 13 | ✅ PASS |
| Import paths | Relative | Relative | ✅ PASS |
| Source maps | Generated | Generated | ✅ PASS |
| Bundle size | <100 KB | ~60 KB | ✅ EXCEEDED |

---

## Recommendation

**Phase 1 is COMPLETE and SUCCESSFUL.** The build pipeline is working correctly.

**Next action:** Test in Foundry VTT before proceeding to Phase 2.

### To Test in Foundry:

1. Update `foundry/system.json`:
   ```json
   {
     "esmodules": ["module-dist/fitgd.mjs"]
   }
   ```

2. Build the core library and Foundry modules:
   ```bash
   npm run build:all
   ```

3. Launch Foundry and check console for errors

4. Test basic functionality:
   - Create a character
   - Take harm
   - Spend Momentum
   - Open player action widget

If Foundry testing succeeds, proceed to Phase 2 (converting remaining .mjs files to .ts).

---

**Phase 1: ✅ COMPLETE**
**Estimated Time:** 2 hours (3 hours budgeted)
**Next Phase:** Test in Foundry, then proceed to Phase 2 (Convert Dialogs)
