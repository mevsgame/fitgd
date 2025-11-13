# TypeScript Migration - Next Steps

**Last Updated:** 2025-11-13
**Current Status:** ✅ Phases 1-3 Complete, Ready for Testing

---

## Quick Reference

🎯 **Recommended Next Action:** Build and test TypeScript modules in Foundry

📊 **Progress:** 3/5 phases complete (60%)
⏱️ **Time Invested:** 6 hours
📁 **Files Converted:** 34+ TypeScript modules
✅ **Ready to Test:** Yes

---

## Immediate Next Steps (Choose One)

### 🔨 Option A: Build and Test (Recommended)

**Why:** Verify everything works before cleanup
**Time:** 1-2 hours
**Risk:** Low

**Steps:**

1. **Build TypeScript modules:**
   ```bash
   npm install
   npm run build:foundry
   ```

2. **Verify build output:**
   ```bash
   ls -la foundry/module-dist/
   # Should see 34+ .mjs files
   ```

3. **Update Foundry system.json:**
   ```json
   {
     "esmodules": [
       "module-dist/fitgd.mjs"
     ]
   }
   ```

4. **Test in Foundry:**
   - Launch Foundry
   - Load the system
   - Open character and crew sheets
   - Start combat, test player action widget
   - Test with GM + Player clients

5. **If issues found:**
   - Check console for errors
   - Review import paths
   - Verify .mjs extensions on all imports
   - Fix and rebuild

6. **If tests pass:**
   - Commit with message: "chore: Verify TypeScript build and Foundry integration"
   - Proceed to Phase 5 cleanup

---

### 🛠️ Option B: Fix Deprecated Import First

**Why:** Clean up before testing
**Time:** 5 minutes
**Risk:** Very low

**Issue:** `player-action-widget.ts` imports from deprecated `dialogs.mjs`

**Fix:**

```typescript
// BEFORE:
import { FlashbackTraitsDialog, refreshSheetsByReduxId } from '../dialogs.mjs';

// AFTER:
import { FlashbackTraitsDialog } from '../dialogs/FlashbackTraitsDialog.mjs';
import { refreshSheetsByReduxId } from '../helpers/sheet-helpers.mjs';
```

**Then:** Proceed to Option A (Build and Test)

---

### 🎨 Option C: Add Branded Types (Optional)

**Why:** Prevent ID confusion at compile-time
**Time:** 1 hour
**Risk:** Low
**Phase:** 4

**What it does:** Adds type-level distinction between Redux IDs and Foundry Actor IDs

**Example:**
```typescript
type ReduxId = string & { __brand: 'redux' };
type FoundryActorId = string & { __brand: 'foundry' };

// Compile-time error if you mix them up
function useReduxId(id: ReduxId) { /* ... */ }
useReduxId(foundryActorId); // ❌ Type error!
```

**Recommended:** Do this after testing (Option A)

---

### 🧹 Option D: Skip to Phase 5 Cleanup

**Why:** Remove legacy .mjs files
**Time:** 2 hours
**Risk:** Medium - should test first

**⚠️ Warning:** Only do this after successful testing (Option A)

**Tasks:**
1. Delete all legacy .mjs source files
2. Delete deprecated `dialogs.mjs`
3. Update documentation
4. Archive migration reports

**Command:**
```bash
# Don't run this yet - test first!
find foundry/module -name "*.mjs" -type f | grep -v migration | xargs rm
```

---

## Troubleshooting Guide

### Build fails with "vite: command not found"
**Solution:**
```bash
npm install
# Then try again:
npm run build:foundry
```

### Build succeeds but Foundry can't find modules
**Solution:** Check `system.json` points to `module-dist/`, not `module/`

### Type errors during build
**Solution:**
```bash
# See detailed errors:
npm run type-check:foundry

# Common fixes:
# - Add missing type imports
# - Fix incorrect type annotations
# - Cast to 'any' if Foundry types are missing
```

### Foundry console shows import errors
**Solution:** Verify all imports in generated .mjs files have `.mjs` extensions

### State not persisting across sessions
**Solution:**
- Check Redux store initialization in `fitgd.mjs`
- Verify `saveImmediate()` is being called after state changes
- Check browser console for Redux errors

---

## Testing Checklist

Use this to verify everything works:

### Build Verification
- [ ] `npm run build:foundry` completes without errors
- [ ] `npm run type-check:foundry` passes with 0 errors
- [ ] `foundry/module-dist/` contains 34+ .mjs files
- [ ] All .mjs imports have .mjs extensions

### Foundry System Loading
- [ ] System loads without console errors
- [ ] Redux store initializes correctly
- [ ] No "module not found" errors

### Character Sheet
- [ ] Sheet opens and renders correctly
- [ ] Can view/edit traits
- [ ] Can view/edit action dots
- [ ] Can view/edit equipment
- [ ] Harm clocks display correctly
- [ ] Rally button works
- [ ] All dialogs open (Add Trait, etc.)

### Crew Sheet
- [ ] Sheet opens and renders correctly
- [ ] Can view/edit crew details
- [ ] Momentum displays correctly
- [ ] Can add/remove characters
- [ ] Crew clocks display correctly

### Combat & Player Action Widget
- [ ] Widget appears on player's turn
- [ ] Can select action, position, effect
- [ ] Push buttons work
- [ ] Trait flashback opens dialog
- [ ] Dice rolling works
- [ ] Consequence resolution works
- [ ] Stims and addiction mechanics work

### Multi-Client Testing
- [ ] Test with GM + Player clients open
- [ ] State changes propagate via sockets
- [ ] Both clients see updates in real-time
- [ ] No duplicate or missed updates

---

## File Locations

**Status Documents:**
- `TYPESCRIPT_MIGRATION_STATUS.md` - Current state report
- `TYPESCRIPT_MIGRATION_PLAN.md` - Original plan with phase details
- `PHASE3_COMPLETE.md` - Phase 3 completion report
- `PHASE3_WIDGET_COMPLETION.md` - Widget-specific details

**Build Configuration:**
- `vite.config.foundry.ts` - Build configuration
- `tsconfig.json` - TypeScript compiler settings
- `package.json` - npm scripts

**Source Files:**
- `foundry/module/*.ts` - TypeScript source files
- `foundry/module/*/. ts` - TypeScript source files in subdirectories

**Build Output (Generated):**
- `foundry/module-dist/*.mjs` - Built JavaScript modules
- `foundry/module-dist/*.mjs.map` - Source maps

---

## Commit Strategy

**After testing succeeds:**
```bash
git add -A
git commit -m "chore: Verify TypeScript build and Foundry integration

- Built all 34+ TypeScript modules successfully
- Tested in Foundry with GM + Player clients
- Verified all sheets, dialogs, and widgets work correctly
- Confirmed state synchronization via sockets

All functionality working as expected. Ready for Phase 5 cleanup."

git push
```

**If issues found:**
```bash
git add <fixed-files>
git commit -m "fix: Resolve TypeScript build/integration issues

- Fixed: [describe issue]
- Updated: [files changed]
- Tested: [what you verified]"

git push
```

---

## Decision Matrix

| Scenario | Recommended Action |
|----------|-------------------|
| **Never built before** | Option A (Build and Test) |
| **Build working, want to clean up** | Option B → Option A |
| **Build tested, everything works** | Option D (Phase 5 Cleanup) |
| **Want maximum type safety** | Option C (Branded Types) |
| **Build fails** | Check Troubleshooting Guide |
| **Foundry integration broken** | Check Testing Checklist |

---

## Support Resources

**Documentation:**
- TypeScript: https://www.typescriptlang.org/docs/
- Vite: https://vitejs.dev/guide/
- Redux Toolkit: https://redux-toolkit.js.org/

**Project Docs:**
- `CLAUDE.md` - Project architecture and patterns
- `SESSION_START.md` - Session startup guide
- `TYPESCRIPT_MIGRATION_FEASIBILITY.md` - Why TypeScript

**Get Help:**
- Check console errors first
- Review recent commits for changes
- Compare with working .mjs versions
- Ask in project channel

---

## Summary

✅ **What's Done:** All TypeScript conversions complete
🔨 **What's Next:** Build and test
🎯 **Goal:** Verify everything works before cleanup
⏱️ **Time:** 1-2 hours for full testing

**Recommended:** Start with Option A (Build and Test)

---

**Last Updated:** 2025-11-13
**Status:** Ready for testing
