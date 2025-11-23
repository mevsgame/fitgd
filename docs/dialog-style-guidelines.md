# Dialog Style Guidelines

This document defines the UI/UX standards for all dialog templates in the Foundry module, based on the high-quality patterns established in `rally-dialog.html`, `lean-into-trait-dialog.html`, and `flashback-traits-dialog.html`.

---

## ⚠️ CRITICAL: CSS Styling is Required

> [!IMPORTANT]
> **HTML structure alone does NOT create visual appearance.** Dialogs require BOTH:
> 1. **HTML Structure** (semantic classes, proper hierarchy)
> 2. **CSS Styling** (colors, spacing, borders, hover effects)

**Without CSS, dialogs will look terrible** - just unstyled HTML with no visual polish.

### Required CSS File

All dialog styling must be added to: [`foundry/templates/styles/fitgd-sheets.css`](file:///d:/GitHub/fitgd/foundry/templates/styles/fitgd-sheets.css)

### CSS Pattern Example

Every dialog needs a dedicated CSS section following this pattern:

```css
/* Base dialog styling */
.{dialog-name}-dialog {
  padding: 15px;
  font-family: "Signika", sans-serif;
  background: #1a1a1a;
  color: #e0e0e0;
}

/* Header with golden title */
.{dialog-name}-dialog .dialog-header {
  margin-bottom: 20px;
  text-align: center;
}

.{dialog-name}-dialog .dialog-header h2 {
  margin: 0 0 10px 0;
  color: #ffd700; /* Golden */
}

/* Info notice with blue accent */
.{dialog-name}-dialog .info-notice {
  padding: 8px;
  background: rgba(66, 165, 245, 0.1);
  border-left: 3px solid #42a5f5;
  margin: 10px 0;
  font-size: 0.9em;
}

/* Form groups with golden labels */
.{dialog-name}-dialog .form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
  color: #ffd700;
}

/* Help text - gray and smaller */
.{dialog-name}-dialog .help-text {
  font-size: 0.9em;
  color: #aaa;
  margin-bottom: 10px;
}

/* Primary button - blue gradient with glow */
.{dialog-name}-dialog .dialog-buttons button.primary {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  color: #fff;
  border: 2px solid #42a5f5;
}

.{dialog-name}-dialog .dialog-buttons button.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  box-shadow: 0 0 15px rgba(66, 165, 245, 0.8);
}

/* Secondary button - gray */
.{dialog-name}-dialog .dialog-buttons button.secondary {
  background: #4a4a4a;
  color: #e0e0e0;
  border: 1px solid #666;
}
```

### Reference Implementation

See `.rally-dialog` CSS (lines 1988-2270 in fitgd-sheets.css) for a complete example of high-quality dialog styling.

---

## Core Principles

1. **Semantic Structure**: Use clear, hierarchical HTML structure with semantic class names
2. **Information Hierarchy**: Present information in a logical flow (Header → Context → Selection → Action)
3. **User Guidance**: Provide contextual help text, notices, and visual feedback at every step
4. **Consistent Patterns**: Reuse established patterns for similar interactions
5. **Accessibility**: Use proper labels, semantic HTML, and clear visual states
6. **CSS Styling**: Every dialog MUST have dedicated CSS styling to look professional

---

## Template Structure

All dialogs MUST follow this structure:

```html
<div class="[dialog-name]-dialog">
  <!-- Header -->
  <div class="dialog-header">
    <!-- Title, current state, cost/gain notices -->
  </div>

  <!-- Instructions (if needed) -->
  <div class="instructions">
    <!-- Contextual help and rules explanation -->
  </div>

  <!-- Main Content -->
  <div class="[content-section-name]">
    <!-- Selection UI, forms, grids, etc. -->
  </div>

  <!-- Action Buttons -->
  <div class="dialog-buttons">
    <!-- Cancel (secondary) and Primary action buttons -->
  </div>
</div>
```

---

## Header Section

### Required Elements

1. **Title** (`<h2>`): Clear, action-oriented dialog title
2. **Current State Display**: Show relevant game state (momentum, load, etc.)
3. **Cost/Gain Notice**: Highlight mechanical impact with visual indicators

### Pattern Examples

```html
<!-- Momentum Display -->
<p class="momentum-display">Current Momentum: <strong>{{momentum}}/10</strong></p>

<!-- Cost Notice -->
<p class="cost-notice">💎 Cost: <strong>1 Momentum</strong> for position improvement</p>

<!-- Gain Notice -->
<p class="gain-notice">
  ✨ Gain: <strong>+{{momentumGain}} Momentum</strong>
  {{#if wouldCapOut}}<span class="cap-warning">(Capped at 10)</span>{{/if}}
</p>

<!-- Info Notice -->
<p class="info-notice">
  💬 Reference a teammate's trait to inspire the group. <strong>Always Controlled position.</strong>
</p>
```

### Class Naming Convention

- `.momentum-display` - Current momentum state
- `.cost-notice` - Momentum/resource costs
- `.gain-notice` - Momentum/resource gains
- `.info-notice` - General informational notices
- `.cap-warning` - Warning about hitting limits

---

## Instructions Section

Use when users need rule clarification or workflow guidance.

```html
<div class="instructions">
  <p><strong>Lean into a trait to create a complication.</strong></p>
  <p class="help-text">
    The trait will be <strong>disabled</strong> until the next Momentum Reset.
    While disabled, you cannot use it for flashbacks or position/effect improvements.
  </p>
</div>
```

### Class Naming Convention

- `.instructions` - Container for instructional content
- `.help-text` - Secondary explanatory text
- `.help-text-small` - Smaller, less prominent help text

---

## Selection UI

### Form Groups

Use consistent form group structure:

```html
<div class="form-group">
  <label>Target Teammate:</label>
  <select name="target" class="target-select">
    <option value="">-- Select Teammate --</option>
    {{#each teammates}}
    <option value="{{this.id}}" {{#if (eq ../selectedTargetId this.id)}}selected{{/if}}>
      {{this.name}}
    </option>
    {{/each}}
  </select>
  {{#unless teammates.length}}
  <p class="no-teammates">No other teammates in crew.</p>
  {{/unless}}
</div>
```

### Traits Grid

Standard pattern for displaying selectable traits:

```html
<div class="traits-grid">
  {{#each availableTraits}}
  <div class="trait-item {{#if (eq ../selectedTraitId this.id)}}selected{{/if}} {{#if this.disabled}}disabled-trait{{/if}}" data-trait-id="{{this.id}}">
    <div class="trait-name">{{this.name}}</div>
    <div class="trait-category">{{this.category}}</div>
    {{#if this.disabled}}
    <div class="trait-status">🔒 Disabled (will be re-enabled)</div>
    {{/if}}
    {{#if this.description}}
    <div class="trait-description">{{this.description}}</div>
    {{/if}}
  </div>
  {{/each}}

  {{#unless availableTraits.length}}
  <p class="no-traits">No available traits. All traits are currently disabled.</p>
  {{/unless}}
</div>
```

### Class Naming Convention

- `.form-group` - Container for label + input
- `.traits-grid` - Grid layout for trait items
- `.trait-item` - Individual trait card
  - `.selected` - Currently selected state
  - `.disabled-trait` - Disabled/unavailable state
- `.trait-name` - Primary trait identifier
- `.trait-category` - Trait category/type
- `.trait-status` - Status indicator (locked, disabled, etc.)
- `.trait-description` - Trait description text
- `.no-traits` / `.no-teammates` - Empty state messages

---

## Conditional Content

### Progressive Disclosure

Show additional UI only when relevant:

```html
{{#if selectedTargetId}}
<div class="trait-selection">
  <h3>Select {{targetCharacter.name}}'s Trait:</h3>
  <p class="help-text">Reference a trait that inspires the team.</p>
  <!-- Trait grid here -->
</div>
{{/if}}
```

### Mode Selection

For multi-mode dialogs:

```html
<div class="mode-selection">
  <h3>Action:</h3>
  <div class="mode-options">
    <label class="mode-option">
      <input type="radio" name="mode" value="use-existing" {{#if (eq mode "use-existing")}}checked{{/if}} />
      <span>Use Existing Trait</span>
    </label>
    <label class="mode-option">
      <input type="radio" name="mode" value="create-new" {{#if (eq mode "create-new")}}checked{{/if}} />
      <span>Create New Trait (Flashback)</span>
    </label>
  </div>
</div>
```

---

## Preview/Summary Sections

Show calculated results before committing:

```html
{{#if canRoll}}
<div class="roll-info">
  <p><strong>Ready to roll:</strong> {{actionDots}}d6 (Controlled position)</p>
  <p class="momentum-preview">
    Possible Momentum Gain:
    <span class="momentum-outcomes">1-3→+1M | 4-5→+2M | 6→+3M | Crit→+4M</span>
  </p>
</div>
{{/if}}
```

### Class Naming Convention

- `.roll-info` - Roll preview information
- `.momentum-preview` - Momentum outcome preview
- `.momentum-outcomes` - Specific outcome breakdown

---

## Action Buttons

### Standard Pattern

```html
<div class="dialog-buttons">
  <button type="button" data-action="cancel" class="secondary">Cancel</button>
  <button type="button" data-action="apply" class="primary" {{#unless selectedTraitId}}disabled{{/unless}}>
    Lean Into Trait (+{{momentumGain}}M)
  </button>
</div>
```

### Button Guidelines

1. **Always include Cancel**: Use `class="secondary"` and `data-action="cancel"`
2. **Primary action on right**: Use `class="primary"` and descriptive `data-action`
3. **Dynamic labels**: Include relevant costs/gains in button text
4. **Disabled state**: Use `disabled` attribute with conditional logic
5. **Icons for clarity**: Use emoji or FontAwesome icons (e.g., 🎲, ✨, 💎)

### Button Label Patterns

- **Cost actions**: `"Use Trait (1M)"`, `"Accept Changes (Spend 2M)"`
- **Gain actions**: `"Lean Into Trait (+2M)"`
- **Roll actions**: `"🎲 Roll & Apply (3d6)"`
- **Disabled states**: `"No Changes"`, `"Insufficient Momentum"`

---

## Visual Feedback Patterns

### Emoji Usage

Use emoji consistently for visual categorization:

- 💬 - Informational notices
- 💎 - Costs (momentum, resources)
- ✨ - Gains (momentum, benefits)
- 🎲 - Roll actions
- 🔒 - Locked/disabled states
- ✓ - Success/valid states
- ✗ - Error/invalid states

### Status Indicators

```html
<!-- Warning -->
<span class="cap-warning">(Capped at 10)</span>

<!-- Status -->
<div class="trait-status">🔒 Disabled (will be re-enabled)</div>

<!-- Validation -->
<p class="cost-ok">✓ You have sufficient Momentum</p>
<p class="cost-insufficient">✗ Not enough Momentum (need 2, have 1)</p>
```

---

## Empty States

Always provide helpful empty state messages:

```html
{{#unless teammates.length}}
<p class="no-teammates">No other teammates in crew.</p>
{{/unless}}

{{#unless availableTraits.length}}
<p class="no-traits">No available traits. All traits are currently disabled (already leaned into).</p>
{{/unless}}
```

---

## Input Fields

### Text Inputs

```html
<div class="form-group">
  <label>Name</label>
  <input type="text" name="name" value="{{equipment.name}}" required />
</div>
```

### Textareas

```html
<div class="complication-input">
  <label>Describe the complication (optional):</label>
  <textarea name="complicationDescription" rows="2" placeholder="How does this trait create problems right now?"></textarea>
  <p class="help-text-small">This is for flavor/narrative - not required.</p>
</div>
```

### Selects

```html
<div class="form-group">
  <label>Tier</label>
  <select name="tier">
    {{#each tiers}}
    <option value="{{this}}" {{#if (eq this ../equipment.tier)}}selected{{/if}}>{{this}}</option>
    {{/each}}
  </select>
</div>
```

---

## Common Anti-Patterns to Avoid

### ❌ Poor Structure

```html
<!-- BAD: Flat structure without semantic sections -->
<div class="equipment-edit-form">
  <label>Name</label>
  <input type="text" name="name" />
  <label>Tier</label>
  <select name="tier">...</select>
  <button>Save</button>
</div>
```

### ✅ Good Structure

```html
<!-- GOOD: Clear hierarchy with semantic sections -->
<div class="equipment-edit-dialog">
  <div class="dialog-header">
    <h2>Edit Equipment</h2>
  </div>
  
  <div class="form-section">
    <div class="form-group">
      <label>Name</label>
      <input type="text" name="name" />
    </div>
    <div class="form-group">
      <label>Tier</label>
      <select name="tier">...</select>
    </div>
  </div>
  
  <div class="dialog-buttons">
    <button type="button" class="secondary">Cancel</button>
    <button type="button" class="primary">Save Changes</button>
  </div>
</div>
```

### ❌ Missing Context

```html
<!-- BAD: No help text or state display -->
<select name="tier">
  <option value="accessible">Accessible</option>
  <option value="inaccessible">Inaccessible</option>
</select>
```

### ✅ Contextual Help

```html
<!-- GOOD: Clear explanation of options -->
<div class="form-group">
  <label>Tier</label>
  <select name="tier">
    <option value="accessible">Accessible</option>
    <option value="inaccessible">Inaccessible</option>
  </select>
  <p class="help-text">
    <strong>Accessible:</strong> Standard gear, freely available<br/>
    <strong>Inaccessible:</strong> Requires flashback (1 Momentum + trait)
  </p>
</div>
```

### ❌ Generic Button Labels

```html
<!-- BAD: Unclear what action does -->
<button type="button">Submit</button>
<button type="button">OK</button>
```

### ✅ Descriptive Labels

```html
<!-- GOOD: Clear action and cost -->
<button type="button" class="primary">
  Use Trait (1M)
</button>
<button type="button" class="primary">
  🎲 Roll & Apply (3d6)
</button>
```

---

## Checklist for New Dialogs

Before submitting a new dialog template, verify:

- [ ] **CSS styling added to fitgd-sheets.css** (MOST IMPORTANT!)
- [ ] Root element uses `.{dialog-name}-dialog` class
- [ ] Header section includes title and relevant state display
- [ ] Cost/gain notices use appropriate emoji and classes
- [ ] Help text provided for complex interactions
- [ ] Form groups use consistent structure
- [ ] Empty states have helpful messages
- [ ] Buttons follow left (secondary) / right (primary) pattern
- [ ] Button labels include costs/gains where relevant
- [ ] Disabled states have clear messaging
- [ ] Progressive disclosure used for conditional content
- [ ] Semantic class names throughout
- [ ] No inline styles (use CSS classes)

