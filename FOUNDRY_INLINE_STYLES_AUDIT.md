# Foundry Module Inline Styles & HTML Markup Audit

**Date:** 2025-11-10
**Scope:** Complete audit of HTML/CSS in foundry/module JavaScript files
**Total Issues Found:** 8 distinct inline style instances + 49+ HTML elements in template literals

---

## Executive Summary

| Category | Count | Severity | Location |
|----------|-------|----------|----------|
| **Inline Style Attributes** | 6 | High | dialogs.mjs, fitgd.mjs |
| **Hardcoded Color Values** | 4 | High | dialogs.mjs |
| **HTML Template Literals** | 49+ | Medium | 5 files |
| **Form-generated HTML** | ~20 | Low | dialogs.mjs |
| **Cursor Pointers** | 1 | Low | fitgd.mjs |

---

## Detailed Findings

### 1. CRITICAL: Outcome Label Styling (dialogs.mjs)

**File:** `/home/user/fitgd/foundry/module/dialogs.mjs`  
**Lines:** 248, 251, 254, 257

**Code:**
```javascript
// Lines 245-258
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

**Issues:**
- ❌ 4 inline `style` attributes with hardcoded color names
- ❌ Colors: `gold`, `green`, `orange`, `red`
- ❌ Used in chat message rendering (line 272: `${outcomeLabel}`)
- ❌ Not themeable or configurable

**Refactoring Strategy:**
```javascript
// Instead of inline styles, use outcome-specific CSS classes
const outcomeClassMap = {
  critical: 'outcome-critical',
  success: 'outcome-success',
  partial: 'outcome-partial',
  failure: 'outcome-failure'
};

// In template:
outcomeLabel = `<strong class="${outcomeClassMap[outcome]}">
  ${outcomes[outcome]}
</strong>`;

// In CSS (fitgd.css or new outcomes.css):
.outcome-critical { color: gold; font-weight: bold; }
.outcome-success { color: green; font-weight: bold; }
.outcome-partial { color: orange; font-weight: bold; }
.outcome-failure { color: red; font-weight: bold; }
```

**Priority:** HIGH - Appears in all chat messages

---

### 2. CRITICAL: Help Text Styling (dialogs.mjs)

**File:** `/home/user/fitgd/foundry/module/dialogs.mjs`  
**Line:** 376

**Code:**
```html
<p class="help-text" style="font-size: 0.9em; color: #666; margin-top: 8px;">
  <strong>Harm Segments:</strong><br/>
  Controlled: 0/1/2 (Limited/Standard/Great)<br/>
  Risky: 2/3/4 (Limited/Standard/Great)<br/>
  Desperate: 4/5/6 (Limited/Standard/Great)
</p>
```

**Issues:**
- ❌ Inline `style` attribute with 3 CSS properties
- ❌ Hardcoded hex color `#666` (dark gray)
- ❌ Font size and margin hardcoded
- ❌ Already has class `help-text` (should use this instead!)

**Refactoring Strategy:**
```html
<!-- Remove inline style, class should handle it -->
<p class="help-text">
  <strong>Harm Segments:</strong><br/>
  Controlled: 0/1/2 (Limited/Standard/Great)<br/>
  Risky: 2/3/4 (Limited/Standard/Great)<br/>
  Desperate: 4/5/6 (Limited/Standard/Great)
</p>
```

```css
/* In fitgd.css */
.help-text {
  font-size: 0.9em;
  color: #666;
  margin-top: 8px;
}
```

**Priority:** HIGH - Dialog already uses class, just needs CSS definition

---

### 3. Cursor Pointer on Clock Element (fitgd.mjs)

**File:** `/home/user/fitgd/foundry/module/fitgd.mjs`  
**Line:** 870

**Code:**
```javascript
// Lines 857-873
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

**Issues:**
- ❌ Conditional inline `style="cursor: pointer;"` 
- ❌ Only applied when `editable === true`
- ❌ Could be handled with CSS class instead

**Refactoring Strategy:**
```javascript
// Remove conditional style, use class
return new Handlebars.SafeString(`
  <div class="clock-container ${editable ? 'editable' : ''}">
    <img
      src="${svgPath}"
      alt="${alt}"
      class="${cssClass} clock-${size} clock-${color} ${editable ? 'clock-editable' : ''}"
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

```css
/* In fitgd.css */
.clock-editable {
  cursor: pointer;
}
```

**Priority:** MEDIUM - Easy fix, low impact

---

### 4. HTML Template Literals - Chat Messages

**File:** `/home/user/fitgd/foundry/module/dialogs.mjs`  
**Lines:** 262-276

**Code:**
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

**Status:** ✅ Already uses CSS classes  
**Note:** Well-structured, uses semantic HTML with classes - good example to follow

---

### 5. HTML Template Literals - Roll Result Widget

**File:** `/home/user/fitgd/foundry/module/widgets/player-action-widget.mjs`  
**Lines:** 978-983

**Code:**
```javascript
content: `
  <div class="fitgd-roll-result">
    <h3>${outcomeText}</h3>
    <p>Rolled: ${diceText}</p>
    <p>Action: ${this.playerState.selectedAction}</p>
  </div>
`,
```

**Status:** ✅ Already uses CSS classes  
**Note:** Clean structure, no inline styles

---

### 6. Form Generation in Dialogs (dialogs.mjs)

**File:** `/home/user/fitgd/foundry/module/dialogs.mjs`  
**Lines:** 92-383 (multiple form dialogs)

**Example Code:**
```javascript
html: `
  <div class="form-group">
    <label for="action-select">Action</label>
    <select name="action">
      <option value="">Select an action...</option>
      ${actions.map(action => `<option value="${action}">${action}</option>`).join('')}
    </select>
  </div>
  
  <div class="form-group">
    <label for="position-select">Position</label>
    <select name="position">
      <option value="controlled">Controlled</option>
      <option value="risky" selected>Risky</option>
      <option value="desperate">Desperate</option>
    </select>
  </div>
  ...
`
```

**Status:** ✅ Already uses CSS classes (`.form-group`)  
**Note:** Good consistent structure across all dialogs

---

### 7. History Management HTML (history-management.mjs)

**File:** `/home/user/fitgd/foundry/module/history-management.mjs`  
**Lines:** 71-79

**Code:**
```javascript
content: `
  <p><strong>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Warning')}</strong></p>
  <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Description')}</p>
  <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.WillLose')}</p>
  <ul>
    <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseUndo')}</li>
    <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseHistory')}</li>
    <li>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.LoseReplay')}</li>
  </ul>
  <p>${game.i18n.localize('FITGD.Settings.HistoryManagement.PruneDialog.Confirm')}</p>
`,
```

**Status:** ✅ No inline styles, semantic HTML  
**Note:** Good example of localized dialog HTML

---

### 8. Clock Color System (fitgd.mjs)

**File:** `/home/user/fitgd/foundry/module/fitgd.mjs`  
**Lines:** 810-840

**Code:**
```javascript
// Determine color based on clock type and other factors
let color = 'grey';
if (clockData.clockType === 'harm') {
  // Morale harm uses grey, physical harm uses red
  if (clockData.subtype?.toLowerCase().includes('morale')) {
    color = 'grey';
  } else {
    color = 'red';
  }
} else if (clockData.clockType === 'consumable') {
  color = 'green';
} else if (clockData.clockType === 'addiction') {
  color = 'red';
}

// Used in class name: clock-${color}
class="${cssClass} clock-${size} clock-${color}"
```

**Status:** ⚠️ Color logic is code-driven, not CSS  
**Note:** This is CORRECT approach - color determined by data, applied via class  
**CSS Expected:**
```css
.clock-red { /* red clock styling */ }
.clock-grey { /* grey clock styling */ }
.clock-green { /* green clock styling */ }
```

---

## Summary of Required Actions

### HIGH PRIORITY (Must Fix)

| Issue | File | Lines | Action |
|-------|------|-------|--------|
| Outcome label colors | dialogs.mjs | 248, 251, 254, 257 | Move to CSS classes `.outcome-*` |
| Help text styling | dialogs.mjs | 376 | Remove inline style, define `.help-text` CSS |

### MEDIUM PRIORITY (Nice to Have)

| Issue | File | Lines | Action |
|-------|------|-------|--------|
| Clock cursor pointer | fitgd.mjs | 870 | Move to `.clock-editable` CSS class |

### NO ACTION NEEDED

| Pattern | Status | Reason |
|---------|--------|--------|
| HTML template literals with classes | ✅ OK | Already use CSS classes properly |
| Form generation | ✅ OK | Uses `.form-group` class consistently |
| Chat messages | ✅ OK | Uses semantic HTML with classes |
| Clock color system | ✅ OK | Color logic in code is correct pattern |

---

## CSS Organization Recommendations

### Current CSS Files to Check
```bash
find /home/user/fitgd/foundry -name "*.css" -o -name "*.scss"
```

### Suggested CSS Structure
```
foundry/styles/
├── fitgd.css              (main styles)
├── dialogs.css            (dialog-specific)
├── outcomes.css           (roll outcome colors)
├── clocks.css             (clock visual system)
└── forms.css              (form styling)
```

### CSS for Inline Style Fixes

**File: outcomes.css (NEW)**
```css
/* Roll outcome styling */
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

**File: dialogs.css (UPDATE)**
```css
.help-text {
  font-size: 0.9em;
  color: #666;
  margin-top: 8px;
  margin-bottom: 8px;
}
```

**File: clocks.css (UPDATE)**
```css
.clock-editable {
  cursor: pointer;
}

/* Existing clock color classes */
.clock-red { /* red harm, addiction clocks */ }
.clock-grey { /* morale harm clocks */ }
.clock-green { /* consumable clocks */ }
```

---

## Testing Checklist

After refactoring:

- [ ] All roll outcome labels display correct colors in chat
- [ ] Help text in dialogs renders with correct styling
- [ ] Editable clocks show cursor pointer on hover
- [ ] No inline styles remain in JavaScript files
- [ ] All colors are defined in CSS, not hardcoded in JS
- [ ] Chat messages render correctly
- [ ] Dialog windows display properly
- [ ] Clock display works for all types (harm, consumable, addiction)

---

## Migration Path

### Phase 1: Documentation (DONE)
- [x] Create this audit document
- [x] Identify all inline styles
- [x] List color hardcodes

### Phase 2: CSS Preparation
- [ ] Review existing CSS files
- [ ] Create outcome.css with outcome classes
- [ ] Define help-text styles
- [ ] Add clock-editable class

### Phase 3: JavaScript Refactoring
- [ ] Update dialogs.mjs outcome labels (lines 248, 251, 254, 257)
- [ ] Update dialogs.mjs help text (line 376)
- [ ] Update fitgd.mjs clock styling (line 870)

### Phase 4: Testing
- [ ] Test in browser with GM account
- [ ] Verify all chat messages display correctly
- [ ] Check all dialogs render properly
- [ ] Confirm no console errors

### Phase 5: Documentation
- [ ] Update CSS file comments
- [ ] Document outcome color system
- [ ] Update developer guidelines

---

## Related Files to Review

- `/home/user/fitgd/foundry/styles/` - CSS files (check for duplicates)
- `/home/user/fitgd/foundry/module/templates/` - Template files if they exist
- `/home/user/fitgd/foundry/system.json` - Stylesheet references

