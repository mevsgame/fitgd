# TypeScript Integration Status - November 13, 2025

## Executive Summary

**Current State:** ⚠️ **TRANSITIONAL - Incomplete Migration**

The project is in a **mixed state** between JavaScript and TypeScript:
- ✅ Core Redux (src/) - **100% TypeScript** (45 files, strict mode)
- ⚠️ Foundry Integration (foundry/module/) - **DUAL FORMAT** (.ts + .mjs)
- ❌ Build pipeline - **NOT INTEGRATED** (.ts files not used by Foundry)
- ✅ Type checking - **WORKING** (fvtt-types installed, 1 error in core)

**Critical Finding:** 13 .ts files exist but **are not being used**. Foundry loads .mjs files only.

---

## Detailed Analysis

### File Inventory

| Category | .mjs Files | .ts Files | With @ts-check | Status |
|----------|-----------|-----------|----------------|--------|
| **Main files** | 3 | 3 | 3 | Both formats exist |
| **Helpers** | 3 | 3 | 3 | Both formats exist |
| **Hooks** | 3 | 3 | 3 | Both formats exist |
| **Socket** | 1 | 1 | 1 | Both formats exist |
| **Settings** | 1 | 1 | 1 | Both formats exist |
| **Autosave** | 1 | 1 | 1 | Both formats exist |
| **Console** | 1 | 1 | 1 | Both formats exist |
| **Dialogs** | 17 | 0 | 16 | .mjs only |
| **Sheets** | 3 | 0 | 3 | .mjs only |
| **Widgets** | 1 | 0 | 1 | .mjs only |
| **Migration** | 1 | 0 | 0 | .mjs only |
| **Types** | 0 | 2 | N/A | Type definitions |
| **TOTAL** | **36** | **15** | **31/36 (86%)** | Mixed |

**Lines of Code:**
- .mjs files: ~8,400 lines
- .ts files: ~2,600 lines (31% coverage)
- .d.ts files: ~200 lines (type definitions)

---

## Files with BOTH .ts and .mjs Versions

These 13 files have duplicate implementations:

### Core Infrastructure
1. **fitgd.ts / fitgd.mjs** (Main entry, ~15KB / ~21KB)
2. **foundry-redux-bridge.ts / foundry-redux-bridge.mjs** (~10KB / ~10KB)
3. **history-management.ts / history-management.mjs** (~6KB / ~6KB)

### Hooks
4. **hooks/actor-hooks.ts / actor-hooks.mjs**
5. **hooks/combat-hooks.ts / combat-hooks.mjs**
6. **hooks/hotbar-hooks.ts / hotbar-hooks.mjs**

### Helpers
7. **helpers/handlebars-helpers.ts / handlebars-helpers.mjs**
8. **helpers/sheet-helpers.ts / sheet-helpers.mjs**
9. **helpers/sheet-registration.ts / sheet-registration.mjs**

### Utilities
10. **socket/socket-handler.ts / socket-handler.mjs**
11. **settings/system-settings.ts / system-settings.mjs**
12. **autosave/autosave-manager.ts / autosave-manager.mjs**
13. **console/dev-commands.ts / dev-commands.mjs**

**Problem:** Maintaining both versions manually is error-prone and unsustainable.

---

## Files WITHOUT TypeScript Versions (High Priority for Migration)

### Dialogs (17 files, ~2,500 lines)
- ActionRollDialog.mjs
- AddClockDialog.mjs
- AddTraitDialog.mjs
- CharacterSelectionDialog.mjs
- ClockCreationDialog.mjs
- ClockSelectionDialog.mjs
- FlashbackDialog.mjs
- FlashbackTraitsDialog.mjs
- LeanIntoTraitDialog.mjs
- PushDialog.mjs
- RallyDialog.mjs
- TakeHarmDialog.mjs
- equipment-browser-dialog.mjs
- equipment-edit-dialog.mjs
- dialogs/base/BaseSelectionDialog.mjs
- dialogs/base/dialogHelpers.mjs
- dialogs/index.mjs

### Sheets (3 files, ~1,800 lines)
- character-sheet.mjs
- crew-sheet.mjs
- item-sheets.mjs

### Widgets (1 file, ~1,200 lines)
- player-action-widget.mjs

### Migration (1 file, ~150 lines)
- migration/unify-ids-migration.mjs

---

## Type Checking Status

### Configuration ✅

**foundry/tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,  // Type-check only, no transpilation
    "types": ["@league-of-foundry-developers/foundry-vtt-types"],
    "paths": {
      "@/*": ["../src/*"],
      "@foundry/*": ["./module/*"]
    }
  },
  "include": ["module/**/*.ts"]
}
```

**foundry/module/types/global.d.ts:**
```typescript
/// <reference types="@league-of-foundry-developers/foundry-vtt-types" />

declare global {
  interface Game {
    fitgd: FitGDGame;
  }
}
```

### Dependencies ✅

- ✅ `@league-of-foundry-developers/foundry-vtt-types@13.346.0-beta` - **INSTALLED**
- ✅ `typescript@5.9.3` - **INSTALLED**
- ✅ `vite-plugin-dts@4.5.4` - **INSTALLED**

### Type Check Results ⚠️

```bash
$ npm run type-check:foundry
```

**Errors Found:** 1
- src/adapters/foundry/characterAdapter.ts:156 - Equipment type mismatch

**Status:** Type checking **WORKS** but has 1 error in core (not in foundry/module).

---

## Build Pipeline Analysis

### Current Vite Configuration

**vite.config.ts:**
```typescript
export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
      outDir: 'foundry/dist',
      // ...
    }),
  ],
  build: {
    minify: false,  // Readable output
    // ...
  }
});
```

### What's Built

- ✅ Core Redux library → `foundry/dist/fitgd-core.es.js`
- ✅ Type declarations → `foundry/dist/**/*.d.ts`
- ❌ Foundry .ts files → **NOT TRANSPILED**

### What Foundry Loads

**foundry/system.json:**
```json
{
  "esmodules": ["module/fitgd.mjs"]
}
```

**Critical:** Foundry loads `fitgd.mjs`, NOT `fitgd.ts`. The .ts files are ignored.

---

## Import Pattern Differences

### TypeScript Files (.ts)
```typescript
// fitgd.ts
import { createFoundryReduxBridge } from './foundry-redux-bridge';
// ❌ No .mjs extension - won't work in Foundry!
```

### JavaScript Files (.mjs)
```javascript
// fitgd.mjs
import { createFoundryReduxBridge } from './foundry-redux-bridge.mjs';
// ✅ Explicit .mjs extension - works in Foundry
```

**Why .ts files can't be used directly:**
- Foundry requires explicit `.mjs` extensions
- TypeScript files use extensionless imports (ESM standard)
- Would need transpilation to add `.mjs` extensions

---

## Documentation Accuracy Assessment

### TYPESCRIPT_COMPLIANCE_SUMMARY.md
**Date:** November 10, 2025
**Status:** ❌ **OUTDATED**

**Claimed:**
- "1/5 files have @ts-check"
- "4,648 lines untyped (94%)"

**Reality (Nov 13):**
- 31/36 files have @ts-check (86%)
- ~2,600 lines have .ts versions (31% coverage)

### TYPESCRIPT_MIGRATION_FEASIBILITY.md
**Date:** November 12, 2025
**Status:** ⚠️ **PARTIALLY OUTDATED**

**Claimed:**
- "fvtt-types successfully installed" ✅ TRUE (but wasn't in node_modules until today)
- "33 .mjs files" ✅ TRUE (36 now)
- "0% TypeScript coverage" ❌ FALSE (13 .ts files exist, 31% coverage)

### TYPESCRIPT_COMPLIANCE.md
**Status:** ⚠️ **PARTIALLY ACCURATE**

**Claimed:**
- "Readable compiled output" ✅ TRUE
- "Full TypeScript declarations" ✅ TRUE
- ".mjs files get type checking via @ts-check" ✅ TRUE (86% have it)

---

## The Core Problem: Dual Maintenance Hell

### Current Workflow (Broken)

1. Developer edits `fitgd.mjs` (what Foundry loads)
2. `fitgd.ts` exists but is **NOT updated**
3. `.ts` and `.mjs` versions **diverge**
4. Type checking on `.ts` becomes **meaningless**

**Example:**

```bash
$ ls -lh foundry/module/fitgd.*
-rw-r--r-- 1 root root  21K Nov 13 13:08 fitgd.mjs
-rw-r--r-- 1 root root  15K Nov 13 13:08 fitgd.ts
```

**Different file sizes = different code!** Which one is correct?

---

## Recommendations

### Option A: Complete the TypeScript Migration ✅ RECOMMENDED

**Goal:** Use .ts files as source of truth, transpile to .mjs for Foundry

**Steps:**

1. **Add TypeScript transpilation to build** (2-3 hours)
   ```typescript
   // vite.config.foundry.ts
   export default defineConfig({
     build: {
       lib: {
         entry: 'foundry/module/fitgd.ts',
         formats: ['es'],
         fileName: () => 'fitgd.mjs'
       },
       rollupOptions: {
         preserveModules: true,  // Keep file structure
         output: {
           entryFileNames: '[name].mjs'
         }
       }
     }
   });
   ```

2. **Convert remaining 22 .mjs files to .ts** (8-12 hours)
   - Dialogs (17 files)
   - Sheets (3 files)
   - Widgets (1 file)
   - Migration (1 file)

3. **Delete .mjs versions** (1 hour)
   - Keep only `.ts` as source
   - Generate `.mjs` from build

4. **Update system.json** (5 minutes)
   ```json
   {
     "esmodules": ["module/dist/fitgd.mjs"]
   }
   ```

**Benefits:**
- ✅ Single source of truth
- ✅ Full type safety
- ✅ No manual synchronization
- ✅ Prevents ID confusion bugs (branded types)
- ✅ Better IDE support

**Effort:** 12-16 hours (2-3 sessions)

---

### Option B: Revert to JavaScript + @ts-check ❌ NOT RECOMMENDED

**Goal:** Delete .ts files, keep .mjs with JSDoc

**Steps:**

1. Delete all 13 .ts files
2. Ensure all 36 .mjs files have @ts-check (5 missing)
3. Add complete JSDoc annotations (8-12 hours)

**Benefits:**
- ✅ No build complexity
- ✅ Works today

**Downsides:**
- ❌ Loses type safety
- ❌ No branded types (ID confusion bugs persist)
- ❌ Incomplete type coverage (JSDoc is less strict)
- ❌ Wastes work already done on .ts files

**Effort:** 10-15 hours + ongoing maintenance burden

---

### Option C: Hybrid - Keep Dual Format (Current State) ❌ WORST OPTION

**Reality Check:** This is what's happening now and it's **broken**.

**Problems:**
- ❌ Dual maintenance (easy to forget)
- ❌ Files diverge over time
- ❌ Type checking on .ts doesn't help .mjs
- ❌ Wasted effort maintaining both

**Never choose this option.**

---

## Proposed Migration Plan

### Phase 1: Fix Build Pipeline (Session 1 - 3 hours)

**Goal:** Make .ts files the source, generate .mjs automatically

**Tasks:**
- [ ] Create `vite.config.foundry.ts`
- [ ] Configure TypeScript → .mjs transpilation with extension rewriting
- [ ] Test build generates correct .mjs files
- [ ] Update `package.json` scripts:
  ```json
  {
    "scripts": {
      "build:foundry": "vite build --config vite.config.foundry.ts",
      "dev:foundry": "vite build --config vite.config.foundry.ts --watch"
    }
  }
  ```
- [ ] Verify Foundry loads transpiled .mjs correctly
- [ ] Update .gitignore to ignore generated .mjs files

**Validation:**
- ✅ `npm run build:foundry` generates .mjs from .ts
- ✅ Foundry loads and runs correctly
- ✅ Hot reload works in dev mode

---

### Phase 2: Convert Remaining Files (Session 2-3 - 10 hours)

**Goal:** Convert all .mjs files to .ts

**Priority Order:**

1. **Dialogs/base** (2 files, ~200 lines) - Foundations first
2. **Simple dialogs** (5 files, ~500 lines) - AddClock, AddTrait, ClockSelection, CharacterSelection, index
3. **Complex dialogs** (10 files, ~1,800 lines) - ActionRoll, Flashback, Rally, etc.
4. **Sheets** (3 files, ~1,800 lines) - character, crew, item
5. **Widgets** (1 file, ~1,200 lines) - player-action-widget
6. **Migration** (1 file, ~150 lines) - unify-ids-migration

**Per-file Process:**
1. Copy .mjs → .ts
2. Remove @ts-check and JSDoc typedefs
3. Convert JSDoc function signatures to TypeScript
4. Add proper type imports
5. Fix type errors
6. Build and test
7. Delete .mjs (now generated)

**Example Conversion:**

**Before (JavaScript):**
```javascript
// @ts-check

/**
 * @typedef {import('../../dist/types').Clock} Clock
 */

/**
 * @param {string} characterId
 * @returns {Clock[]}
 */
function getHarmClocks(characterId) {
  const state = game.fitgd.store.getState();
  return state.clocks.byTypeAndEntity[`harm:${characterId}`] || [];
}
```

**After (TypeScript):**
```typescript
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';

function getHarmClocks(characterId: string): Clock[] {
  const state: RootState = game.fitgd.store.getState();
  return state.clocks.byTypeAndEntity[`harm:${characterId}`] || [];
}
```

---

### Phase 3: Branded Types for ID Safety (Session 4 - 2 hours)

**Goal:** Prevent ID confusion bugs at compile time

**Files to modify:**
- `foundry/module/types/ids.ts` (create new)
- `foundry-redux-bridge.ts` (update signatures)
- All ID usage sites

**New type definitions:**
```typescript
// foundry/module/types/ids.ts
export type ReduxId = string & { __brand: 'redux' };
export type FoundryActorId = string & { __brand: 'foundry' };

// Helper functions
export function asReduxId(id: string): ReduxId {
  return id as ReduxId;
}

export function asFoundryActorId(id: string): FoundryActorId {
  return id as FoundryActorId;
}
```

**Update Bridge API:**
```typescript
// foundry-redux-bridge.ts
export class FoundryReduxBridge {
  async execute(
    action: ReduxAction,
    options?: { affectedReduxIds?: ReduxId[] }  // ← Enforces ReduxId type
  ): Promise<void> {
    // ...
  }
}
```

**Usage:**
```typescript
// Character sheet
const reduxId = asReduxId(this.actor.id);  // Explicit conversion
await game.fitgd.bridge.execute(action, { affectedReduxIds: [reduxId] });

// ❌ Compile error - wrong ID type!
const foundryId = asFoundryActorId(this.actor.id);
await game.fitgd.bridge.execute(action, { affectedReduxIds: [foundryId] });
//                                                          ^^^^^^^^^^
// Error: Type 'FoundryActorId' is not assignable to type 'ReduxId'
```

---

### Phase 4: Cleanup & Documentation (Session 5 - 2 hours)

**Goal:** Remove legacy code, update docs

**Tasks:**
- [ ] Delete all .mjs files (now generated from .ts)
- [ ] Delete `foundry/module/foundry-types.d.ts` (replaced by fvtt-types)
- [ ] Delete `foundry/jsconfig.json` (replaced by tsconfig.json)
- [ ] Update CLAUDE.md with TypeScript patterns
- [ ] Create TYPESCRIPT_GUIDE.md for contributors
- [ ] Update README.md with build instructions
- [ ] Run full test suite
- [ ] Test in Foundry (GM + Player clients)

**Documentation updates:**
- ✅ TYPESCRIPT_STATUS_2025-11-13.md (this file) → Archive
- ✅ TYPESCRIPT_COMPLIANCE.md → Update with final state
- ✅ TYPESCRIPT_MIGRATION_FEASIBILITY.md → Mark as completed
- ✅ Create TYPESCRIPT_GUIDE.md (contributor guide)

---

## Success Criteria

### Technical Metrics

- [ ] 100% of Foundry integration in TypeScript (0 .mjs source files)
- [ ] `npm run type-check:all` passes with 0 errors
- [ ] Build generates correct .mjs files with .mjs extensions
- [ ] Foundry loads and runs without errors
- [ ] All 250+ tests pass
- [ ] Hot reload works in development

### Code Quality

- [ ] Branded types prevent ID confusion
- [ ] No `any` types (use `unknown` if needed)
- [ ] No `@ts-expect-error` (fix the type instead)
- [ ] All Redux actions type-checked at dispatch
- [ ] All Foundry hooks have correct callback signatures

### Documentation

- [ ] TYPESCRIPT_GUIDE.md for contributors
- [ ] Build instructions in README.md
- [ ] Migration guide archived for reference
- [ ] CLAUDE.md updated with TypeScript patterns

---

## Risk Assessment

### Low Risk ✅

- **Build pipeline** - Vite has excellent TypeScript support
- **Type safety** - Catches bugs early, prevents regressions
- **Rollback** - Can revert to .mjs if needed (keep git history)

### Medium Risk ⚠️

- **Extension rewriting** - Need to ensure imports get .mjs extensions
- **Build time** - TypeScript transpilation adds ~2-3 seconds
- **Learning curve** - Contributors need TypeScript knowledge (mitigated: team already knows TS)

### Mitigations

- ✅ Test build thoroughly before converting all files
- ✅ Convert incrementally (validate each file)
- ✅ Keep git commits small (easy rollback)
- ✅ Extensive testing at each phase

---

## Timeline

### Conservative Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Build Pipeline | 3 hours | 3 hours |
| Phase 2: Convert Files | 10 hours | 13 hours |
| Phase 3: Branded Types | 2 hours | 15 hours |
| Phase 4: Cleanup | 2 hours | 17 hours |
| **Total** | **17 hours** | **~3-4 sessions** |

### Aggressive Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Build Pipeline | 2 hours | 2 hours |
| Phase 2: Convert Files | 8 hours | 10 hours |
| Phase 3: Branded Types | 1 hour | 11 hours |
| Phase 4: Cleanup | 1 hour | 12 hours |
| **Total** | **12 hours** | **~2-3 sessions** |

---

## Immediate Next Steps

### Option 1: Start Migration (Recommended)

```bash
# 1. Fix the 1 type error in core
npm run type-check:all

# 2. Create Foundry build config
# Edit vite.config.foundry.ts

# 3. Test build
npm run build:foundry

# 4. Verify Foundry loads
# Launch Foundry, check console for errors

# 5. Convert first dialog as proof-of-concept
# Start with dialogs/base/dialogHelpers.mjs → .ts
```

### Option 2: Analysis First

```bash
# 1. Audit all .ts vs .mjs file differences
diff foundry/module/fitgd.ts foundry/module/fitgd.mjs

# 2. Document divergences
# Which files have diverged? How much?

# 3. Make decision on path forward
# Based on divergence severity
```

---

## Conclusion

**The project is in a transitional state between JavaScript and TypeScript.**

**Current status:**
- ⚠️ 13 .ts files exist but are NOT used by Foundry
- ⚠️ 36 .mjs files are what Foundry actually loads
- ⚠️ Dual maintenance is unsustainable
- ✅ Type checking infrastructure is ready
- ✅ 86% of .mjs files have @ts-check
- ✅ fvtt-types is installed and working

**Recommendation:** **Complete the TypeScript migration (Option A).**

**Estimated effort:** 12-17 hours across 3-4 sessions

**ROI:** High - prevents critical bugs, improves developer experience, no runtime cost

**Key decision point:** Do we commit to TypeScript or revert to JavaScript?

**My recommendation:** Commit to TypeScript. The infrastructure is 80% there, finishing the migration is less work than reverting and delivers far more value.

---

**Next action:** Fix the build pipeline (Phase 1) - 2-3 hours

Once the build works, the rest is straightforward file conversion.

---

## Appendix: Quick Commands

```bash
# Type-check core
npm run type-check

# Type-check Foundry integration
npm run type-check:foundry

# Type-check everything
npm run type-check:all

# Build core library
npm run build:lib

# Build Foundry integration (after Phase 1)
npm run build:foundry

# Watch mode for development (after Phase 1)
npm run dev:foundry

# Run tests
npm test

# Count files
find foundry/module -name "*.ts" ! -name "*.d.ts" | wc -l
find foundry/module -name "*.mjs" | wc -l
```

---

**Document Status:** ✅ CURRENT as of 2025-11-13
**Next Review:** After Phase 1 completion
