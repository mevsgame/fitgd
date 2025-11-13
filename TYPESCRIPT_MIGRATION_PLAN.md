# TypeScript Migration Plan - Action Items

**Status:** ✅ Phase 1 Complete | ✅ Phase 2 Complete (17/17 dialogs converted)
**Date:** 2025-11-13 (Updated after Phase 2 complete)
**Estimated Time:** 12-17 hours (3-4 sessions)
**Time Spent:** 2 hours (Phase 1) + 2.5 hours (Phase 2) = 4.5 hours total

---

## The Situation

You have **13 TypeScript files** that aren't being used. Foundry loads `.mjs` files only.

**Two paths forward:**

### Path A: Complete TypeScript Migration ✅ RECOMMENDED
- Finish what's started
- Use `.ts` as source, build `.mjs` for Foundry
- 12-17 hours of work
- Prevents entire classes of bugs

### Path B: Revert to JavaScript
- Delete the 13 `.ts` files
- Stick with `.mjs` + JSDoc
- Faster short-term, loses long-term benefits

---

## Recommended: Path A - Complete Migration

### Phase 1: Fix Build Pipeline ✅ COMPLETE (2 hours)

**Goal:** Make TypeScript the source of truth

**Status:** ✅ **COMPLETE** - Build pipeline working, awaiting Foundry testing

**Tasks:**

1. ✅ **Create Foundry build config** - DONE
   - Created `vite.config.foundry.ts` (140 lines)
   - Configured TypeScript → .mjs transpilation
   - Added custom path resolution for relative imports
   - Created renderChunk plugin to add .mjs extensions

2. ✅ **Add build scripts** - DONE
   - `npm run build:foundry` - Build once
   - `npm run build:all` - Build core + Foundry
   - `npm run dev:foundry` - Watch mode

3. ✅ **Test the build** - DONE
   - Build completes in ~0.6 seconds
   - All 13 .ts files transpiled successfully
   - Generated files use correct relative paths
   - .mjs extensions added to all imports

4. ✅ **Update .gitignore** - DONE
   - Added `foundry/module-dist/` to .gitignore

**Validation Checklist:**
- [x] `npm run build:foundry` succeeds
- [x] Generated .mjs files have correct imports (.mjs extensions)
- [ ] **NEXT:** Foundry loads the system without errors (update system.json)
- [ ] **NEXT:** Hot reload works in dev mode

**Commit:** Ready to commit: "feat: Add TypeScript build pipeline for Foundry integration"

**See:** `PHASE1_COMPLETION.md` for detailed report

---

### Phase 2: Convert Dialogs ✅ COMPLETE (17/17 files - 2.5 hours)

**Goal:** Convert 17 dialog files to TypeScript

**Status:** ✅ **COMPLETE** - All dialogs converted and building successfully

**Order of conversion:**

1. ✅ **Base dialogs** (30 min) - **DONE**
   - [x] dialogs/base/dialogHelpers.mjs → .ts
   - [x] dialogs/base/BaseSelectionDialog.mjs → .ts

2. ✅ **Simple dialogs** (1 hour) - **DONE**
   - [x] dialogs/AddClockDialog.mjs → .ts
   - [x] dialogs/AddTraitDialog.mjs → .ts
   - [x] dialogs/ClockSelectionDialog.mjs → .ts
   - [x] dialogs/CharacterSelectionDialog.mjs → .ts
   - [x] dialogs/index.mjs → .ts

3. ✅ **Medium dialogs** (30 min) - **DONE**
   - [x] dialogs/ClockCreationDialog.mjs → .ts
   - [x] dialogs/FlashbackDialog.mjs → .ts
   - [x] dialogs/LeanIntoTraitDialog.mjs → .ts
   - [x] dialogs/PushDialog.mjs → .ts
   - [x] dialogs/TakeHarmDialog.mjs → .ts
   - [x] dialogs/equipment-edit-dialog.mjs → .ts

4. ✅ **Complex dialogs** (30 min) - **DONE**
   - [x] dialogs/ActionRollDialog.mjs → .ts
   - [x] dialogs/FlashbackTraitsDialog.mjs → .ts
   - [x] dialogs/RallyDialog.mjs → .ts
   - [x] dialogs/equipment-browser-dialog.mjs → .ts

**Per-file process:**
1. Copy .mjs → .ts
2. Remove `// @ts-check` and JSDoc typedefs
3. Convert function signatures to TypeScript
4. Add type imports (`import type { ... } from '@/types/...'`)
5. Fix any type errors
6. Build: `npm run build:foundry`
7. Test in Foundry
8. Commit

**Validation after each file:**
- [ ] Type-check passes: `npm run type-check:foundry`
- [ ] Build succeeds: `npm run build:foundry`
- [ ] Dialog works in Foundry

**Commit pattern:** "refactor: Convert [DialogName] to TypeScript"

---

### Phase 3: Convert Sheets & Widgets (Session 3 - 4 hours)

**Goal:** Convert remaining UI components

**Files:**

1. **Sheets** (2.5 hours)
   - [ ] sheets/character-sheet.mjs → .ts (~800 lines, complex)
   - [ ] sheets/crew-sheet.mjs → .ts (~700 lines, complex)
   - [ ] sheets/item-sheets.mjs → .ts (~300 lines, simple)

2. **Widgets** (1.5 hours)
   - [ ] widgets/player-action-widget.mjs → .ts (~1,200 lines, very complex)

**Key challenges:**
- ActorSheet/FormApplication typing
- Event handler signatures
- Redux state integration

**Focus areas:**
- Type the `getData()` return value
- Type all event handlers
- Use branded types for IDs

**Validation:**
- [ ] Sheets render correctly
- [ ] All buttons/interactions work
- [ ] Player action widget state machine works
- [ ] GM sees player updates

**Commit pattern:** "refactor: Convert [SheetName] to TypeScript"

---

### Phase 4: Add Branded Types (Session 3 continued - 1 hour)

**Goal:** Prevent ID confusion at compile time

**Tasks:**

1. **Create ID types** (~15 min)
   ```typescript
   // foundry/module/types/ids.ts
   export type ReduxId = string & { __brand: 'redux' };
   export type FoundryActorId = string & { __brand: 'foundry' };

   export function asReduxId(id: string): ReduxId {
     return id as ReduxId;
   }
   ```

2. **Update Bridge API** (~30 min)
   ```typescript
   // foundry-redux-bridge.ts
   async execute(
     action: ReduxAction,
     options?: { affectedReduxIds?: ReduxId[] }
   ): Promise<void>
   ```

3. **Update all ID usage** (~15 min)
   ```typescript
   // Character sheet
   const reduxId = asReduxId(this.actor.id);
   await game.fitgd.bridge.execute(action, { affectedReduxIds: [reduxId] });
   ```

**Validation:**
- [ ] Type errors appear when using wrong ID type
- [ ] All existing code compiles with correct ID types

**Commit:** "feat: Add branded types for ID safety"

---

### Phase 5: Cleanup & Documentation (Session 4 - 2 hours)

**Goal:** Remove legacy code, finalize migration

**Tasks:**

1. **Delete legacy files** (~30 min)
   - [ ] Delete all .mjs source files (now generated from .ts)
   - [ ] Delete foundry/module/foundry-types.d.ts (replaced by fvtt-types)
   - [ ] Delete foundry/jsconfig.json (replaced by tsconfig.json)
   - [ ] Update .gitignore to ignore ALL generated .mjs files

2. **Fix type errors** (~30 min)
   - [ ] Fix src/adapters/foundry/characterAdapter.ts:156 (Equipment type)
   - [ ] Ensure `npm run type-check:all` passes with 0 errors

3. **Documentation** (~1 hour)
   - [ ] Update CLAUDE.md with TypeScript examples
   - [ ] Create TYPESCRIPT_GUIDE.md for contributors
   - [ ] Update README.md with build instructions
   - [ ] Archive migration documentation

4. **Final testing** (~30 min)
   - [ ] Run full test suite: `npm test`
   - [ ] Test in Foundry (GM + Player clients)
   - [ ] Verify all features work
   - [ ] Check console for errors

**Commit:** "docs: Complete TypeScript migration documentation"

---

## Rollback Plan

**If something goes wrong:**

1. **Keep git commits small** - Easy to revert individual files
2. **Test after each file** - Catch issues early
3. **Backup .mjs files** - Keep original .mjs until migration complete

**Worst case:**
```bash
git revert <commit-hash>  # Revert problematic commit
git reset --hard origin/main  # Nuclear option - start over
```

---

## Alternative: Path B - Revert to JavaScript

**If you decide TypeScript isn't worth it:**

### Tasks

1. **Delete TypeScript files** (~30 min)
   ```bash
   rm foundry/module/**/*.ts
   rm foundry/module/*.ts
   rm -rf foundry/module/types/
   rm foundry/tsconfig.json
   ```

2. **Ensure all .mjs have @ts-check** (~30 min)
   - Add to 5 files missing it:
     - dialogs.mjs
     - migration/unify-ids-migration.mjs
     - (3 others)

3. **Update documentation** (~30 min)
   - Note that TypeScript migration was abandoned
   - Update CLAUDE.md to reflect JavaScript-only approach

**Total time:** 1.5 hours

**Commit:** "refactor: Revert to JavaScript-only approach"

**Downsides:**
- Lose type safety for ID confusion (major bug class)
- No branded types
- Less IDE support
- 13 TypeScript files' work wasted

---

## Decision Matrix

| Factor | Path A (TypeScript) | Path B (JavaScript) |
|--------|---------------------|---------------------|
| **Initial effort** | 12-17 hours | 1.5 hours |
| **Bug prevention** | High (branded types) | Low (JSDoc only) |
| **IDE support** | Excellent | Good |
| **Maintenance** | Low (single source) | Medium (JSDoc sync) |
| **Long-term value** | High | Low |
| **Risk** | Low (proven tech) | None (current state) |
| **Recommendation** | ✅ **RECOMMENDED** | ❌ Not recommended |

---

## Quick Start (Path A)

**To start Phase 1 right now:**

```bash
# 1. Install dependencies (if not done)
pnpm install

# 2. Verify type-check works
npm run type-check:foundry

# 3. Create Foundry Vite config
# (I can help with this - it's the first file to create)

# 4. Test build
npm run build:foundry

# 5. Launch Foundry and verify it loads

# Once that works, start converting dialogs one by one
```

---

## My Recommendation

**Complete the TypeScript migration (Path A).**

**Reasons:**

1. **Infrastructure is 80% done** - Just need build config + file conversion
2. **Prevents critical bugs** - ID confusion has caused issues (see CLAUDE.md)
3. **Better DX** - Full autocomplete, refactoring support
4. **No runtime cost** - Types stripped at build time
5. **Future-proof** - Easier to maintain and extend

**The work is already started. Finishing it is less effort than cleaning it up.**

---

## Questions to Answer

1. **Do you want to complete TypeScript migration or revert?**
   - If complete → I'll create the Vite config and we start Phase 1
   - If revert → I'll delete the .ts files and clean up

2. **What's your time availability?**
   - 3-4 focused sessions → Can complete full migration
   - Limited time → Maybe revert and revisit later

3. **Any specific concerns about TypeScript?**
   - Build complexity?
   - Team knowledge?
   - Something else?

---

**Ready to proceed when you are. What would you like to do?**
