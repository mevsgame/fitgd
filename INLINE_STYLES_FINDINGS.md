# Inline Styles & HTML Markup - Complete Findings Report

**Date:** 2025-11-10  
**Auditor:** Automated code search  
**Scope:** All `.mjs` files in `/home/user/fitgd/foundry/module`

---

## Quick Summary

| Finding | Count | Severity | Status |
|---------|-------|----------|--------|
| Inline `style=` attributes | 6 | HIGH | Needs fixing |
| Hardcoded color values in strings | 4 | HIGH | Needs fixing |
| Well-structured HTML templates | 49+ | OK | No action needed |
| CSS file coverage | 1 existing | - | Located |

---

## The 3 Issues to Fix

### Issue #1: Outcome Labels with Inline Color Styles

**Location:** `/home/user/fitgd/foundry/module/dialogs.mjs` (Lines 248, 251, 254, 257)

**Problem Code:**
```javascript
if (sixes >= 2) {
  outcome = 'critical';
  outcomeLabel = '<strong style="color: gold;">Critical Success!</strong>';
} else if (highest >= 6) {
  outcome = 'success';
  outcomeLabel = '<strong style="color: green;">Full Success</strong>';
} else if (highest >= 4) {
  outcome = 'partial';
  outcomeLabel = '<strong style="color: orange;">Partial Success</strong>';
} else {
  outcome = 'failure';
  outcomeLabel = '<strong style="color: red;">Failure</strong>';
}
```

**Impact:**
- Appears in every roll chat message
- Colors hardcoded, not themeable
- Violates separation of concerns

**Solution:**
Change to class-based approach:
```javascript
const outcomeClassMap = {
  critical: 'outcome-critical',
  success: 'outcome-success',
  partial: 'outcome-partial',
  failure: 'outcome-failure'
};

// Later in template
outcomeLabel = `<strong class="${outcomeClassMap[outcome]}">${text}</strong>`;
```

**Add to CSS** (`/home/user/fitgd/foundry/templates/styles/fitgd-sheets.css`):
```css
.outcome-critical {
  color: gold;
  font-weight: bold;
}

.outcome-success {
  color: green;
  font-weight: bold;
}

.outcome-partial {
  color: orange;
  font-weight: bold;
}

.outcome-failure {
  color: red;
  font-weight: bold;
}
```

**Priority:** CRITICAL - This appears in every chat message

---

### Issue #2: Help Text with Inline Styles

**Location:** `/home/user/fitgd/foundry/module/dialogs.mjs` (Line 376)

**Problem Code:**
```html
<p class="help-text" style="font-size: 0.9em; color: #666; margin-top: 8px;">
  <strong>Harm Segments:</strong><br/>
  Controlled: 0/1/2 (Limited/Standard/Great)<br/>
  Risky: 2/3/4 (Limited/Standard/Great)<br/>
  Desperate: 4/5/6 (Limited/Standard/Great)
</p>
```

**Impact:**
- Inline styles override or conflict with CSS class
- Already has `.help-text` class but styles in HTML
- Class definition exists but properties are hardcoded

**Note:** `.help-text` IS already defined in CSS at line 467-472:
```css
.fitgd .help-text {
  font-size: 12px;
  color: #aaa;
  margin: 8px 0 0 0;
  font-style: italic;
}
```

**Solution:**
1. Remove inline style from HTML:
```html
<p class="help-text">
  <strong>Harm Segments:</strong><br/>
  ...
</p>
```

2. Update CSS to match intended appearance:
```css
.fitgd .help-text {
  font-size: 0.9em;        /* Change from 12px */
  color: #666;             /* Change from #aaa */
  margin: 8px 0 0 0;       /* Matches the 8px margin-top */
  font-style: normal;      /* Remove italic if not needed */
}
```

**Priority:** HIGH - Dialog is used frequently

---

### Issue #3: Clock Cursor Pointer with Conditional Style

**Location:** `/home/user/fitgd/foundry/module/fitgd.mjs` (Line 870)

**Problem Code:**
```javascript
return new Handlebars.SafeString(`
  <div class="clock-container ${editable ? 'editable' : ''}">
    <img
      src="${svgPath}"
      alt="${alt}"
      class="${cssClass} clock-${size} clock-${color}"
      width="${width}"
      height="${height}"
      data-clock-id="${clockData.id}"
      data-clock-type="${clockData.clockType}"
      data-clock-value="${value}"
      data-clock-max="${size}"
      data-clock-color="${color}"
      ${editable ? 'style="cursor: pointer;"' : ''}
    />
  </div>
`);
```

**Impact:**
- Conditional inline style
- Container already has `.editable` class
- CSS equivalent already works (line 529-537 in CSS file)

**Current CSS (already exists!):**
```css
.fitgd .clock-container.editable img.clock {
  cursor: pointer;
  transition: transform 0.2s;
}

.fitgd .clock-container.editable img.clock:hover {
  transform: scale(1.05);
  filter: brightness(1.2);
}
```

**Solution:**
The CSS selector already handles this! Just remove the inline style:
```javascript
return new Handlebars.SafeString(`
  <div class="clock-container ${editable ? 'editable' : ''}">
    <img
      src="${svgPath}"
      alt="${alt}"
      class="${cssClass} clock-${size} clock-${color}"
      width="${width}"
      height="${height}"
      data-clock-id="${clockData.id}"
      data-clock-type="${clockData.clockType}"
      data-clock-value="${value}"
      data-clock-max="${size}"
      data-clock-color="${color}"
    />
  </div>
`);
```

**Priority:** MEDIUM - CSS already handles this, just cleanup needed

---

## HTML Structure Assessment

### ✅ GOOD: Well-Structured Templates

**Outcome Roll Message** (`dialogs.mjs:262-276`):
```javascript
const messageContent = `
  <div class="fitgd-action-roll">
    <h3>${character.name} - ${action.charAt(0).toUpperCase() + action.slice(1)}</h3>
    <div class="roll-details">
      <div><strong>Position:</strong> ${position.charAt(0).toUpperCase() + position.slice(1)}</div>
      <div><strong>Effect:</strong> ${effect.charAt(0).toUpperCase() + effect.slice(1)}</div>
      ${push ? '<div><em>Pushed (spent 1 Momentum)</em></div>' : ''}
      ${devilsBargain ? '<div><em>Devil\'s Bargain accepted</em></div>' : ''}
      ${hasZeroDots ? '<div><em>0 dots in action: rolled 2d6, kept lowest</em></div>' : ''}
    </div>
    <div class="roll-result">
      <h4>${outcomeLabel}</h4>
      <div class="dice-result">Highest: ${highest}</div>
      <div class="dice-rolled">Rolled: ${dice.join(', ')}</div>
    </div>
  </div>
`;
```
**Status:** ✅ Good - Uses semantic HTML with classes. Example to follow!

**Widget Roll Result** (`player-action-widget.mjs:978-983`):
```javascript
content: `
  <div class="fitgd-roll-result">
    <h3>${outcomeText}</h3>
    <p>Rolled: ${diceText}</p>
    <p>Action: ${this.playerState.selectedAction}</p>
  </div>
`,
```
**Status:** ✅ Good - Clean, no inline styles

**Form Generation** (`dialogs.mjs:92-383`):
- Multiple dialog forms with `.form-group` class
- Consistent structure
- No inline styles
**Status:** ✅ Good - Consistent class usage

**History Dialog** (`history-management.mjs:71-79`):
- Semantic HTML with `<p>`, `<ul>`, `<li>`
- No inline styles
- Localized strings
**Status:** ✅ Good - Proper localization

---

## CSS File Analysis

**File:** `/home/user/fitgd/foundry/templates/styles/fitgd-sheets.css`  
**Size:** 849 lines

**Good news:** CSS file is comprehensive and well-organized:
- ✅ Outcome colors (gold, green, orange, red) could be defined here
- ✅ Clock styling classes are properly defined
- ✅ `.help-text` class exists (but needs property update)
- ✅ Grid layout and dark theme established
- ✅ Good class naming conventions

**Organization sections found:**
1. Global Sheet Styles
2. Sheet Header
3. Momentum Display
4. Tabs
5. Sheet Body
6. Buttons
7. Action Ratings
8. Traits
9. Clocks
10. Equipment & Members
11. Action Sections
12. Action Roll Dialog
13. Chat Message Styling

---

## Action Items

### Phase 1: Add Missing CSS Classes (Update fitgd-sheets.css)

Add after the existing `.help-text` definition (around line 473):

```css
/* Outcome label colors for chat messages */
.outcome-critical {
  color: gold;
  font-weight: bold;
}

.outcome-success {
  color: green;
  font-weight: bold;
}

.outcome-partial {
  color: orange;
  font-weight: bold;
}

.outcome-failure {
  color: red;
  font-weight: bold;
}
```

And update the `.help-text` definition (lines 467-472) to:
```css
.fitgd .help-text {
  font-size: 0.9em;
  color: #666;
  margin-top: 8px;
  margin-bottom: 8px;
}
```

### Phase 2: Update dialogs.mjs

**Lines 246-258:** Change outcome label generation
```javascript
// BEFORE
if (sixes >= 2) {
  outcome = 'critical';
  outcomeLabel = '<strong style="color: gold;">Critical Success!</strong>';
} else if (highest >= 6) {
  outcome = 'success';
  outcomeLabel = '<strong style="color: green;">Full Success</strong>';
} else if (highest >= 4) {
  outcome = 'partial';
  outcomeLabel = '<strong style="color: orange;">Partial Success</strong>';
} else {
  outcome = 'failure';
  outcomeLabel = '<strong style="color: red;">Failure</strong>';
}

// AFTER
const outcomeMap = {
  critical: 'Critical Success!',
  success: 'Full Success',
  partial: 'Partial Success',
  failure: 'Failure'
};

if (sixes >= 2) {
  outcome = 'critical';
} else if (highest >= 6) {
  outcome = 'success';
} else if (highest >= 4) {
  outcome = 'partial';
} else {
  outcome = 'failure';
}

outcomeLabel = `<strong class="outcome-${outcome}">${outcomeMap[outcome]}</strong>`;
```

**Line 376:** Remove inline style
```javascript
// BEFORE
<p class="help-text" style="font-size: 0.9em; color: #666; margin-top: 8px;">

// AFTER
<p class="help-text">
```

### Phase 3: Update fitgd.mjs

**Line 870:** Remove conditional style
```javascript
// BEFORE
${editable ? 'style="cursor: pointer;"' : ''}

// AFTER
(just remove this line)
```

The container `.editable` class already applies cursor via existing CSS at lines 529-537.

---

## Testing Checklist

After making changes:

- [ ] Run game in browser as GM
- [ ] Perform an Action roll (test all outcome types)
- [ ] Verify outcome colors appear correctly in chat
- [ ] Verify help text appears correctly in consequence dialog
- [ ] Verify clock cursor pointer works on editable clocks
- [ ] Check browser console for errors
- [ ] Test on different screen sizes
- [ ] Verify no style regressions

---

## Summary

**Total Issues:** 3  
**Severity:** 2 HIGH, 1 MEDIUM  
**Files to modify:** 3
- `/home/user/fitgd/foundry/module/dialogs.mjs` (2 locations)
- `/home/user/fitgd/foundry/module/fitgd.mjs` (1 location)
- `/home/user/fitgd/foundry/templates/styles/fitgd-sheets.css` (additions)

**Estimated effort:** Low (straightforward CSS refactoring)  
**Risk level:** Very Low (no breaking changes)  
**Benefit:** Better maintainability, themeable colors, cleaner separation of concerns

---

## Related Documents

- `FOUNDRY_INLINE_STYLES_AUDIT.md` - Full detailed audit with context
- `INLINE_STYLES_QUICK_REFERENCE.md` - Quick lookup guide

