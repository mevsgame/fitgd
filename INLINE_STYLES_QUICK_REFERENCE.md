# Inline Styles - Quick Reference

## 3 Issues to Fix

### Issue #1: Outcome Label Colors (dialogs.mjs, lines 248-257)
**Current:**
```javascript
outcomeLabel = '<strong style="color: gold;">Critical Success!</strong>';
outcomeLabel = '<strong style="color: green;">Full Success</strong>';
outcomeLabel = '<strong style="color: orange;">Partial Success</strong>';
outcomeLabel = '<strong style="color: red;">Failure</strong>';
```

**Fix:** Replace with class-based approach
```javascript
outcomeLabel = `<strong class="outcome-${outcome}">${text}</strong>`;
```

**CSS to add:**
```css
.outcome-critical { color: gold; font-weight: bold; }
.outcome-success { color: green; font-weight: bold; }
.outcome-partial { color: orange; font-weight: bold; }
.outcome-failure { color: red; font-weight: bold; }
```

---

### Issue #2: Help Text Styling (dialogs.mjs, line 376)
**Current:**
```html
<p class="help-text" style="font-size: 0.9em; color: #666; margin-top: 8px;">
```

**Fix:** Remove inline style
```html
<p class="help-text">
```

**CSS to add:**
```css
.help-text {
  font-size: 0.9em;
  color: #666;
  margin-top: 8px;
}
```

---

### Issue #3: Clock Cursor Pointer (fitgd.mjs, line 870)
**Current:**
```javascript
${editable ? 'style="cursor: pointer;"' : ''}
```

**Fix:** Use CSS class
```javascript
class="... ${editable ? 'clock-editable' : ''}"
```

**CSS to add:**
```css
.clock-editable {
  cursor: pointer;
}
```

---

## Files to Modify

1. `/home/user/fitgd/foundry/module/dialogs.mjs`
   - Lines 248, 251, 254, 257 (outcome labels)
   - Line 376 (help text)

2. `/home/user/fitgd/foundry/module/fitgd.mjs`
   - Line 870 (clock cursor)

3. `/home/user/fitgd/foundry/templates/styles/fitgd-sheets.css`
   - Add outcome classes
   - Add help-text class
   - Add clock-editable class

