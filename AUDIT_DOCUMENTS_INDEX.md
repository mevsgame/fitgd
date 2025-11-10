# Inline Styles & HTML Markup Audit - Document Index

Complete audit of HTML markup and inline CSS in foundry/module JavaScript files.

**Audit Date:** 2025-11-10  
**Scope:** All .mjs files in `/home/user/fitgd/foundry/module`  
**Total Issues Found:** 3 inline style instances requiring fixes

---

## Documents in This Audit

### 1. **INLINE_STYLES_FINDINGS.md** (READ THIS FIRST)
Comprehensive findings report with:
- Quick summary table
- All 3 issues with full context
- Code examples (before/after)
- Solution for each issue
- Testing checklist
- Related action items

**When to read:** Start here for complete overview

---

### 2. **FOUNDRY_INLINE_STYLES_AUDIT.md**
Detailed technical audit with:
- Executive summary with severity ratings
- 8 detailed findings (including patterns that are OK)
- CSS organization recommendations
- Detailed CSS snippets for refactoring
- Migration path with phases
- Related files to review

**When to read:** For deep technical analysis

---

### 3. **INLINE_STYLES_QUICK_REFERENCE.md**
Quick lookup guide with:
- 3 issues in compact format
- Current code snippets
- Proposed fixes
- Files to modify list

**When to read:** Quick reminder while implementing fixes

---

## The 3 Issues at a Glance

| Issue | Location | Lines | Severity | Fix Type |
|-------|----------|-------|----------|----------|
| Outcome label colors | `dialogs.mjs` | 248, 251, 254, 257 | HIGH | Move to CSS classes |
| Help text styling | `dialogs.mjs` | 376 | HIGH | Remove inline style |
| Clock cursor pointer | `fitgd.mjs` | 870 | MEDIUM | Remove redundant style |

---

## Implementation Path

### Step 1: Update CSS
**File:** `/home/user/fitgd/foundry/templates/styles/fitgd-sheets.css`

Add 4 new outcome classes:
```css
.outcome-critical { color: gold; font-weight: bold; }
.outcome-success { color: green; font-weight: bold; }
.outcome-partial { color: orange; font-weight: bold; }
.outcome-failure { color: red; font-weight: bold; }
```

Update `.help-text` class properties (lines 467-472)

### Step 2: Update dialogs.mjs
- Lines 246-258: Refactor outcome label generation
- Line 376: Remove inline style attribute

### Step 3: Update fitgd.mjs
- Line 870: Remove conditional inline style

### Step 4: Test
- Action rolls (all outcome types)
- Consequence dialogs
- Clock interactions
- No console errors

---

## Key Findings Summary

### Issues Found
- 6 inline `style=` attributes
- 4 hardcoded color values in JavaScript strings
- 49+ HTML template literals (mostly well-structured)

### Issues Status
- ✅ 2 HIGH priority issues (clearly incorrect)
- ⚠️ 1 MEDIUM priority issue (redundant CSS)
- ✅ 49+ template literals with CSS classes (good pattern - no action needed)

### CSS Assessment
- ✅ Comprehensive 849-line CSS file exists
- ✅ Good class-based organization
- ✅ Dark theme established
- ✅ Clock colors already defined
- ⚠️ Outcome colors missing (need to add)
- ⚠️ Help text properties need update

---

## Risk Assessment

**Overall Risk Level:** VERY LOW

**Why?**
- Straightforward CSS refactoring
- No breaking changes
- CSS handling already works
- Tests exist (can verify no regressions)

**Confidence Level:** HIGH
- Issue patterns are clear
- Solutions are proven patterns
- Existing CSS architecture supports changes

---

## Quality Metrics

| Metric | Status | Notes |
|--------|--------|-------|
| Code style consistency | ✅ GOOD | CSS classes used throughout |
| Separation of concerns | ⚠️ MIXED | 3 inline styles violate principle |
| Theme maintainability | ⚠️ LIMITED | Color values hardcoded in JS |
| Template structure | ✅ EXCELLENT | Semantic HTML with proper classes |

---

## Next Steps

1. Choose document to read based on need:
   - Quick start: `INLINE_STYLES_QUICK_REFERENCE.md`
   - Full analysis: `INLINE_STYLES_FINDINGS.md`
   - Deep dive: `FOUNDRY_INLINE_STYLES_AUDIT.md`

2. Implement fixes in order: CSS → dialogs.mjs → fitgd.mjs

3. Test thoroughly (all outcome types, all interactions)

4. Delete this index document once implementation is complete

---

## File Locations

```
/home/user/fitgd/
├── AUDIT_DOCUMENTS_INDEX.md (this file)
├── INLINE_STYLES_FINDINGS.md (START HERE)
├── FOUNDRY_INLINE_STYLES_AUDIT.md
├── INLINE_STYLES_QUICK_REFERENCE.md
│
└── foundry/
    ├── module/
    │   ├── dialogs.mjs (modify lines 246-258, 376)
    │   ├── fitgd.mjs (modify line 870)
    │   └── ...
    │
    └── templates/styles/
        └── fitgd-sheets.css (add outcome classes, update help-text)
```

---

## Document Statistics

- **Total audit documents:** 4
- **Total lines of analysis:** 800+
- **Code examples included:** 40+
- **Issues documented:** 3
- **Related patterns noted:** 5+
- **CSS classes analyzed:** 80+

