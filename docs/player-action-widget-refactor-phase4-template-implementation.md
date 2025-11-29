# Phase 4: Template Refactoring Implementation Guide

## Overview

This guide provides step-by-step instructions for decomposing the monolithic template into state-specific partials for improved maintainability and readability.

**Duration**: 3-4 hours
**Risk Level**: Medium-High (many small changes)
**Breaking Changes**: None (data structure unchanged)
**Prerequisites**: Phase 1 & 2 complete (improves overall organization)

---

## What We're Solving

**Current Problem**:
```handlebars
<!-- player-action-widget.html: 468 lines -->
<div class="player-action-widget-container">
  {{#if isDecisionPhase}}
    <div class="widget-content decision-phase">
      {{#unless isGM}}
        <!-- Player controls: 100+ lines -->
        ...
      {{/unless}}
      {{#if isGM}}
        <!-- GM controls: 30+ lines -->
        ...
      {{/if}}
      <!-- Current plan: 50+ lines -->
      ...
    </div>
  {{/if}}

  {{#if isRolling}}
    <!-- Rolling state: 10 lines -->
    ...
  {{/if}}

  {{#if isStimsRolling}}
    <!-- Stims rolling: 10 lines -->
    ...
  {{/if}}

  {{#if isSuccess}}
    <!-- Success: 20 lines -->
    ...
  {{/if}}

  {{#if isGMResolvingConsequence}}
    <!-- Consequence: 150+ lines with nested conditionals -->
    ...
  {{/if}}
</div>
```

**Problems**:
- ❌ 468 lines in single file (hard to scan)
- ❌ 5+ state-specific sections mixed together
- ❌ Deep nesting (3-4 levels of {{#if}})
- ❌ Difficult to edit one state without affecting others
- ❌ Hard to test individual state rendering
- ❌ No clear separation of concerns

**New Pattern**:
```
foundry/templates/widgets/
  player-action-widget.html          (main, ~50 lines)
  partials/
    decision-phase.html               (100 lines)
    rolling-phase.html                (15 lines)
    stims-rolling-phase.html          (15 lines)
    success-phase.html                (25 lines)
    consequence-phase.html            (120 lines)
    gm-passive-grid.html              (already exists, will improve)
```

---

## Step 1: Create Decision Phase Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\decision-phase.html`

```handlebars
{{!-- Decision Phase Partial
     Visible when: playerState.state === 'DECISION_PHASE'
     Controls: Player approach/equipment selection, GM position/effect setting
     Shared Display: Current Plan showing final action composition
 --}}

<div class="widget-content decision-phase">

  {{#unless isGM}}
  <!-- ==================== PLAYER CONTROLS ==================== -->
  <div class="player-controls">

    <!-- Approach Selection -->
    <div class="form-group">
      <label>Primary Approach:</label>
      <select name="approach" class="approach-select">
        <option value="">-- Select Approach --</option>
        {{#each approaches}}
        <option value="{{this}}" {{#if (eq ../playerState.selectedApproach this)}}selected{{/if}}>
          {{capitalize this}} ({{lookup ../character.approaches this}}d)
        </option>
        {{/each}}
      </select>
    </div>

    <!-- Unified Secondary Approach/Equipment Selection -->
    {{#if playerState.selectedApproach}}
    <div class="form-group secondary-selection">
      <label>Secondary Approach or Equipment:</label>
      <select name="secondary-approach" class="secondary-approach-select approach-select">
        <option value="">-- Select Secondary (optional) --</option>
        {{#each secondaryOptions}}
        {{#if (eq this.type 'approach')}}
        <option value="{{this.value}}" {{#if (eq ../selectedSecondaryId this.value)}}selected{{/if}}>
          {{this.name}} ({{this.bonus}})
        </option>
        {{else if (eq this.type 'separator')}}
        <option disabled>────────────────</option>
        {{else if (eq this.type 'active')}}
        <option value="{{this.value}}" {{#if (eq ../selectedSecondaryId this.value)}}selected{{/if}}>
          🗡️ {{this.name}} {{#if this.bonus}}({{this.bonus}}){{/if}}{{#if this.locked}} 🔒{{/if}}
        </option>
        {{else if (eq this.type 'consumable')}}
        <option value="{{this.value}}" {{#if (eq ../selectedSecondaryId this.value)}}selected{{/if}}>
          💊 {{this.name}} {{#if this.bonus}}({{this.bonus}}){{/if}}{{#if this.locked}} 🔒{{/if}}
        </option>
        {{/if}}
        {{/each}}
      </select>
      <p class="help-text">Choose another approach for Synergy, or select an equipped item for its bonus.</p>
    </div>
    {{/if}}

    <!-- Position & Effect Display (Read-Only for Player) -->
    <div class="position-effect-display">
      <div class="position">
        Position: <span class="position-{{playerState.position}}">{{uppercase (default playerState.position "RISKY")}}</span>
      </div>
      <div class="effect">
        Effect: <span class="effect-level">{{uppercase (default playerState.effect "STANDARD")}}</span>
      </div>
    </div>

    <!-- Harm Clocks Display -->
    {{#if harmClocks.length}}
    <div class="harm-clocks-display">
      <h4>💔 HARM CLOCKS:</h4>
      <div class="clocks-list">
        {{#each harmClocks}}
        <div class="clock-item">
          <span class="clock-name">{{this.subtype}}:</span>
          <span class="clock-segments">{{this.segments}}/{{this.maxSegments}}</span>
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}

    <!-- Momentum Replenishment -->
    <div class="momentum-replenishment">
      <h4>GET MOMENTUM:</h4>
      <div class="replenishment-row">
        <!-- Momentum Track (Compact) -->
        <div class="momentum-track-compact">
          {{#times 10}}
          <span class="momentum-box-compact {{#if (lt this ../momentum)}}filled{{/if}}">
            {{#if (eq this ../momentum)}}▶{{/if}}
          </span>
          {{/times}}
        </div>
        <!-- Replenishment Buttons -->
        <div class="replenishment-buttons">
          <button type="button" data-action="rally" {{#unless canRally}}disabled{{/unless}}>
            Rally
          </button>
          <button type="button" data-action="lean-into-trait" {{#unless character.traits.length}}disabled{{/unless}}>
            Lean Into Trait
          </button>
        </div>
      </div>
    </div>

    <!-- Action Modifiers Buttons -->
    <div class="prepare-actions">
      <h4>SPEND MOMENTUM:</h4>
      <div class="button-row">
        <button type="button" data-action="use-trait" class="{{#if playerState.traitTransaction}}active{{/if}}" {{#if
          (and (eq playerState.position "controlled" ) (lt momentum 1))}}disabled{{/if}}>
          Use Trait
        </button>
        <button type="button" data-action="push-die"
          class="{{#if (and playerState.pushed (eq playerState.pushType 'extra-die'))}}active{{/if}}" {{#if (lt
          momentum 1)}}disabled{{/if}}>
          Push (+1d)
        </button>
        <button type="button" data-action="push-effect"
          class="{{#if (and playerState.pushed (eq playerState.pushType 'improved-effect'))}}active{{/if}}" {{#if (lt
          momentum 1)}}disabled{{/if}}>
          Push (Effect)
        </button>
      </div>
    </div>

  </div>
  {{/unless}}

  {{#if isGM}}
  <!-- ==================== GM CONTROLS ==================== -->
  <div class="gm-controls">
    <h4>⚙️ GM Controls:</h4>
    <div class="form-group">
      <label>Set Position:</label>
      <select name="position" class="position-select">
        <option value="controlled" {{#if (eq playerState.position "controlled" )}}selected{{/if}}>Controlled</option>
        <option value="risky" {{#if (eq (default playerState.position "risky" ) "risky" )}}selected{{/if}}>Risky</option>
        <option value="desperate" {{#if (eq playerState.position "desperate" )}}selected{{/if}}>Desperate</option>
        <option value="impossible" {{#if (eq playerState.position "impossible" )}}selected{{/if}}>Impossible</option>
      </select>
    </div>
    <div class="form-group">
      <label>Set Effect:</label>
      <select name="effect" class="effect-select">
        <option value="limited" {{#if (eq playerState.effect "limited" )}}selected{{/if}}>Limited</option>
        <option value="standard" {{#if (eq (default playerState.effect "standard" ) "standard" )}}selected{{/if}}>Standard</option>
        <option value="great" {{#if (eq playerState.effect "great" )}}selected{{/if}}>Great</option>
        <option value="spectacular" {{#if (eq playerState.effect "spectacular" )}}selected{{/if}}>Spectacular</option>
      </select>
    </div>

    <!-- GM Passive Equipment Grid -->
    {{> gm-passive-grid passiveEquipment=passiveEquipment selectedPassiveId=selectedPassiveId isGM=true}}
  </div>
  {{/if}}

  <!-- ==================== CURRENT PLAN (SHARED BY GM AND PLAYER) ==================== -->
  {{#if playerState.selectedApproach}}
  <div class="action-plan-preview">
    <h4>📋 Current Plan:</h4>
    <div class="plan-box">
      <!-- Primary + Secondary + Passive summary -->
      <div class="plan-line action-composition">
        <strong>Action:</strong>
        {{capitalize playerState.selectedApproach}}
        {{#if selectedSecondaryName}}
        + {{selectedSecondaryName}}
        {{/if}}
        {{#if approvedPassiveEquipment}}
        + {{approvedPassiveEquipment.name}}
        {{/if}}
        = <strong>{{dicePool}}d</strong>
      </div>

      <!-- Position with Equipment + Trait Modifiers -->
      <div class="plan-line">
        Position: {{uppercase (default playerState.position "risky")}}
        {{#if (ne improvedPosition playerState.position)}}
        → <span class="{{#if (or (ne equipmentModifiedPosition playerState.position) playerState.traitTransaction)}}improved{{/if}}">{{uppercase improvedPosition}}</span>
        {{/if}}
      </div>

      <!-- Effect with Equipment + Push Modifiers -->
      <div class="plan-line">
        Effect: {{uppercase (default playerState.effect "standard")}}
        {{#if (ne improvedEffect playerState.effect)}}
        → <span class="{{#if (or (ne equipmentModifiedEffect playerState.effect) (and playerState.pushed (eq playerState.pushType 'improved-effect')))}}improved{{/if}}">{{uppercase improvedEffect}}</span>
        {{/if}}
      </div>

      {{#if improvements.length}}
      <div class="plan-line improvements">
        <strong>Improvements:</strong>
        <ul>
          {{#each improvements}}
          <li>{{this}}</li>
          {{/each}}
        </ul>
      </div>
      {{/if}}

      {{#if momentumCost}}
      <div class="plan-line momentum-cost">
        Momentum Cost: -{{momentumCost}}M ({{momentum}}→{{subtract momentum momentumCost}})
      </div>
      {{/if}}
    </div>
  </div>
  {{else}}
  <p class="waiting">⏳ Waiting for player to select an approach...</p>
  {{/if}}

  <!-- Action Buttons (different for GM vs Player) -->
  <div class="action-buttons">
    {{#if isGM}}
    <!-- GM sees "Accept Roll" button -->
    <button type="button" data-action="approve-roll" class="primary {{#if playerState.gmApproved}}approved{{/if}}"
      {{#unless playerState.selectedApproach}}disabled{{/unless}}>
      {{#if playerState.gmApproved}}✅ Roll Approved{{else}}✓ Accept Roll{{/if}}
    </button>
    {{else}}
    <!-- Player sees "Roll" button (disabled until GM approves) -->
    <button type="button" data-action="cancel" class="secondary">Cancel</button>
    <button type="button" data-action="roll" class="primary {{#if playerState.gmApproved}}approved{{/if}}" {{#unless
      (and playerState.selectedApproach playerState.gmApproved)}}disabled{{/unless}}>
      {{#if playerState.gmApproved}}🎲 ROLL ACTION{{else}}⏳ Waiting for GM Approval{{/if}}
    </button>
    {{/if}}
  </div>

</div>
```

---

## Step 2: Create Rolling Phase Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\rolling-phase.html`

```handlebars
{{!-- Rolling Phase Partial
     Visible when: playerState.state === 'ROLLING'
     Display: Dice animation and pool information
 --}}

<div class="widget-content rolling">
  <h3>🎲 ROLLING...</h3>
  <div class="dice-animation">
    <!-- Dice animation would go here -->
    <p>Rolling {{playerState.dicePool}}d6...</p>
  </div>
</div>
```

---

## Step 3: Create Stims Rolling Phase Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\stims-rolling-phase.html`

```handlebars
{{!-- Stims Rolling Phase Partial
     Visible when: playerState.state === 'STIMS_ROLLING'
     Display: Stims activation animation
 --}}

<div class="widget-content stims-rolling">
  <h3>💉 STIMS ACTIVATED!</h3>
  <div class="stims-animation">
    <p>Advancing addiction clock...</p>
    <p>Returning to decision phase for reroll.</p>
  </div>
</div>
```

---

## Step 4: Create Stims Locked Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\stims-locked-phase.html`

```handlebars
{{!-- Stims Locked Phase Partial
     Visible when: playerState.state === 'STIMS_LOCKED'
     Display: Addiction lockout message
 --}}

<div class="widget-content stims-locked">
  <h2 class="stims-error">🚫 STIMS LOCKED!</h2>
  <div class="stims-locked-message">
    <p>Addiction clock is filled!</p>
    <p>Stims are no longer available for the entire crew.</p>
    <p class="fade-text">Returning to consequence...</p>
  </div>
</div>
```

---

## Step 5: Create Success Phase Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\success-phase.html`

```handlebars
{{!-- Success Phase Partial
     Visible when: playerState.state === 'SUCCESS_COMPLETE'
     Display: Success outcome and dice results
 --}}

<div class="widget-content success">
  <div class="roll-outcome">
    {{#if (eq playerState.outcome "critical")}}
    <h2 class="outcome-critical">✨ CRITICAL SUCCESS! ✨</h2>
    {{else}}
    <h2 class="outcome-success">✅ FULL SUCCESS</h2>
    {{/if}}
    <div class="dice-display">
      <div class="dice-result">Highest: {{max playerState.rollResult}}</div>
      <div class="dice-rolled">Rolled: {{join playerState.rollResult ", "}}</div>
    </div>
  </div>
  <p class="success-message">You succeed without complications!</p>
  <p class="fade-text">Close this window when ready.</p>
</div>
```

---

## Step 6: Create Consequence Phase Partial

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\partials\consequence-phase.html`

This is the most complex partial (~120 lines). Break it down into sub-sections:

```handlebars
{{!-- Consequence Phase Partial
     Visible when: playerState.state === 'GM_RESOLVING_CONSEQUENCE'
     Controls: GM configures consequences, Player can use stims or accept
 --}}

<div class="widget-content gm-resolving-consequence">

  <!-- ==================== OUTCOME DISPLAY ==================== -->
  <div class="roll-outcome">
    {{#if (eq playerState.outcome "partial")}}
    <h2 class="outcome-partial">⚠️ PARTIAL SUCCESS - Configuring Consequence</h2>
    {{else}}
    <h2 class="outcome-failure">❌ FAILURE - Configuring Consequence</h2>
    {{/if}}
    <div class="dice-display">
      <div class="dice-result">Highest: {{max playerState.rollResult}}</div>
      <div class="dice-rolled">Rolled: {{join playerState.rollResult ", "}}</div>
    </div>
  </div>

  <!-- ==================== CURRENT CONSEQUENCE PLAN (SHARED BY GM AND PLAYER) ==================== -->
  {{#if consequenceTransaction}}
  <div class="consequence-plan-preview">
    <h4>📋 Current Consequence Plan:</h4>
    <div class="plan-box">
      <div class="plan-line">
        <strong>Type:</strong>
        {{#if (eq consequenceTransaction.consequenceType 'harm')}}
        💔 Harm
        {{else}}
        ⏱️ Crew Clock
        {{/if}}
      </div>

      {{#if (eq consequenceTransaction.consequenceType 'harm')}}
      {{#if harmTargetCharacter}}
      <div class="plan-line">
        <strong>Target:</strong> {{harmTargetCharacter.name}}
        {{#if (eq harmTargetCharacter.id character.id)}}
        <span class="label">(Acting)</span>
        {{else}}
        <span class="label protect">(Protected)</span>
        {{/if}}
      </div>
      {{/if}}

      {{#if selectedHarmClock}}
      <div class="plan-line">
        <strong>Clock:</strong> {{selectedHarmClock.subtype}}
        ({{selectedHarmClock.segments}}/{{selectedHarmClock.maxSegments}})
      </div>
      {{/if}}

      {{#if calculatedHarmSegments}}
      <div class="plan-line highlight">
        <strong>Harm:</strong> +{{calculatedHarmSegments}} segments
        <span class="calculation">({{uppercase effectivePosition}}/{{uppercase effectiveEffect}})</span>
      </div>
      {{/if}}
      {{/if}}

      {{#if (eq consequenceTransaction.consequenceType 'crew-clock')}}
      {{#if selectedCrewClock}}
      <div class="plan-line">
        <strong>Clock:</strong> {{selectedCrewClock.subtype}}
        ({{selectedCrewClock.segments}}/{{selectedCrewClock.maxSegments}})
      </div>
      <div class="plan-line highlight">
        <strong>Advance:</strong> +{{calculatedHarmSegments}} segments
        <span class="calculation">({{uppercase effectivePosition}})</span>
      </div>
      {{/if}}
      {{/if}}

      {{#if calculatedMomentumGain}}
      <div class="plan-line momentum-gain">
        <strong>Momentum Gain:</strong> <span class="positive">+{{calculatedMomentumGain}}M</span>
      </div>
      {{/if}}
    </div>
  </div>
  {{else}}
  <p class="waiting">⏳ {{#if isGM}}Select consequence type to begin...{{else}}Waiting for GM to configure consequence...{{/if}}</p>
  {{/if}}

  {{#if isGM}}
  <!-- ==================== GM CONSEQUENCE CONFIGURATION ==================== -->
  <div class="gm-consequence-config">
    <h4>⚙️ Configure Consequence:</h4>

    <!-- Consequence Type Toggles -->
    <div class="consequence-type-toggles">
      <button type="button" data-action="select-consequence-type" data-type="harm"
        class="consequence-type-btn {{#if (eq consequenceTransaction.consequenceType 'harm')}}active{{/if}}">
        💔 Harm
      </button>
      <button type="button" data-action="select-consequence-type" data-type="crew-clock"
        class="consequence-type-btn {{#if (eq consequenceTransaction.consequenceType 'crew-clock')}}active{{/if}}">
        ⏱️ Crew Clock
      </button>
    </div>

    <!-- Harm Configuration (shown when harm type selected) -->
    {{#if (eq consequenceTransaction.consequenceType 'harm')}}
    <div class="harm-config">
      <div class="form-group">
        <label>Target Character:</label>
        <button type="button" data-action="select-harm-target" class="select-btn">
          {{#if harmTargetCharacter}}
          {{harmTargetCharacter.name}} {{#if (eq harmTargetCharacter.id character.id)}}(Acting){{else}}(Protected){{/if}}
          {{else}}
          Select Character...
          {{/if}}
        </button>
      </div>

      <div class="form-group">
        <label>Harm Clock:</label>
        <button type="button" data-action="select-harm-clock" class="select-btn" {{#unless harmTargetCharacter}}disabled{{/unless}}>
          {{#if selectedHarmClock}}
          {{selectedHarmClock.subtype}} ({{selectedHarmClock.segments}}/{{selectedHarmClock.maxSegments}})
          {{else}}
          {{#if harmTargetCharacter}}Select or Create Clock...{{else}}(Select target first){{/if}}
          {{/if}}
        </button>
      </div>
    </div>
    {{/if}}

    <!-- Crew Clock Configuration (shown when crew-clock type selected) -->
    {{#if (eq consequenceTransaction.consequenceType 'crew-clock')}}
    <div class="crew-clock-config">
      <div class="form-group">
        <label>Select Clock:</label>
        <button type="button" data-action="select-crew-clock" class="select-btn">
          {{#if selectedCrewClock}}
          {{selectedCrewClock.subtype}} ({{selectedCrewClock.segments}}/{{selectedCrewClock.maxSegments}})
          {{else}}
          Select or Create Clock...
          {{/if}}
        </button>
      </div>

      {{#if selectedCrewClock}}
      <div class="info-note">
        Segments to add: <strong>{{calculatedHarmSegments}}</strong>
        <span class="calculation">({{uppercase effectivePosition}})</span>
      </div>
      {{/if}}
    </div>
    {{/if}}

  </div>
  {{/if}}

  {{#unless isGM}}
  <!-- ==================== PLAYER CONSEQUENCE ACTIONS ==================== -->
  <div class="player-consequence-actions">
    <h4>⚡ Your Options:</h4>
    <div class="player-action-buttons">
      <!-- Player can use stims to reroll (unless locked by addiction) -->
      <button type="button" data-action="use-stims-gm-phase" class="stims-btn" {{#if (or
        playerState.stimsUsedThisAction stimsLocked)}}disabled{{/if}}>
        {{#if stimsLocked}}
        💉 Stims LOCKED (Addiction)
        {{else if playerState.stimsUsedThisAction}}
        💉 Stims Already Used
        {{else}}
        💉 Use Stims & Reroll
        {{/if}}
      </button>

      <!-- Player approves GM's configured consequence -->
      <button type="button" data-action="approve-consequence" class="primary" {{#unless
        consequenceConfigured}}disabled{{/unless}}>
        {{#if consequenceConfigured}}✓ Accept Consequence{{else}}⏳ Waiting for GM...{{/if}}
      </button>
    </div>
  </div>
  {{/unless}}

</div>
```

---

## Step 7: Refactor Main Template

**File**: `D:\GitHub\fitgd\foundry\templates\widgets\player-action-widget.html`

Replace entire template with this clean dispatcher:

```handlebars
{{!-- Player Action Widget Main Template
     Serves as dispatcher for state-specific partials
     All state-specific content moved to dedicated partials
 --}}

<div class="player-action-widget-container">

  <!-- Header (shared by all states) -->
  <div class="widget-header">
    <h2>🎯 {{character.name}} - YOUR TURN</h2>
  </div>

  <!-- State Dispatcher: Render appropriate partial based on playerState.state -->

  {{#if isDecisionPhase}}
    {{> decision-phase
       character=character
       isGM=isGM
       playerState=playerState
       approaches=approaches
       secondaryOptions=secondaryOptions
       selectedSecondaryId=selectedSecondaryId
       selectedSecondaryName=selectedSecondaryName
       approvedPassiveEquipment=approvedPassiveEquipment
       harmClocks=harmClocks
       momentum=momentum
       dicePool=dicePool
       momentumCost=momentumCost
       improvements=improvements
       improvedPosition=improvedPosition
       improvedEffect=improvedEffect
       canRally=canRally
       passiveEquipment=passiveEquipment
       selectedPassiveId=selectedPassiveId
       equipmentModifiedPosition=equipmentModifiedPosition
       equipmentModifiedEffect=equipmentModifiedEffect}}
  {{/if}}

  {{#if isRolling}}
    {{> rolling-phase playerState=playerState}}
  {{/if}}

  {{#if isStimsRolling}}
    {{> stims-rolling-phase}}
  {{/if}}

  {{#if isStimsLocked}}
    {{> stims-locked-phase}}
  {{/if}}

  {{#if isSuccess}}
    {{> success-phase playerState=playerState}}
  {{/if}}

  {{#if isGMResolvingConsequence}}
    {{> consequence-phase
       character=character
       isGM=isGM
       playerState=playerState
       consequenceTransaction=consequenceTransaction
       harmTargetCharacter=harmTargetCharacter
       selectedHarmClock=selectedHarmClock
       selectedCrewClock=selectedCrewClock
       calculatedHarmSegments=calculatedHarmSegments
       calculatedMomentumGain=calculatedMomentumGain
       effectivePosition=effectivePosition
       effectiveEffect=effectiveEffect
       consequenceConfigured=consequenceConfigured
       stimsLocked=stimsLocked}}
  {{/if}}

</div>
```

---

## Step 8: Update Handlebars Configuration (if needed)

Ensure your Handlebars setup includes the `partials` directory in the template lookup path.

**File**: `foundry/module/module.mjs` or wherever Handlebars is configured

```javascript
// Register partials directory
Handlebars.registerPartials('systems/forged-in-the-grimdark/templates/widgets/partials');
```

Or if using Foundry VTT's built-in partial loading, ensure the path is included in `system.json`:

```json
{
  "documentTypes": {
    "Actor": {
      "character": {
        "templates": ["common"]
      }
    }
  },
  "socketLibrary": "socketlib",
  "ui": {
    "pause": "systems/forged-in-the-grimdark/templates/hud/pause.html"
  },
  "templates": {
    "widgets": "systems/forged-in-the-grimdark/templates/widgets"
  }
}
```

---

## Step 9: Verify Template Rendering

Create template test fixtures:

**File**: `tests/unit/templates/player-action-widget.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderTemplate } from 'foundry-mocks';
import { mockCharacter, mockCrew } from '../../fixtures';

describe('Player Action Widget Template', () => {

  describe('Main template dispatcher', () => {
    it('should render decision-phase partial when isDecisionPhase=true', async () => {
      const data = {
        character: mockCharacter(),
        isDecisionPhase: true,
        isRolling: false,
        isSuccess: false,
        isGMResolvingConsequence: false,
        playerState: { state: 'DECISION_PHASE' },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html',
        data
      );

      expect(html).toContain('decision-phase');
      expect(html).not.toContain('rolling');
    });

    it('should render rolling-phase partial when isRolling=true', async () => {
      const data = {
        character: mockCharacter(),
        isDecisionPhase: false,
        isRolling: true,
        isSuccess: false,
        isGMResolvingConsequence: false,
        playerState: { state: 'ROLLING', dicePool: 5 },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html',
        data
      );

      expect(html).toContain('rolling');
      expect(html).toContain('5d6');
    });

    it('should render consequence-phase partial when isGMResolvingConsequence=true', async () => {
      const data = {
        character: mockCharacter(),
        isDecisionPhase: false,
        isRolling: false,
        isSuccess: false,
        isGMResolvingConsequence: true,
        playerState: { state: 'GM_RESOLVING_CONSEQUENCE', outcome: 'failure' },
        consequenceTransaction: { consequenceType: 'harm' },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html',
        data
      );

      expect(html).toContain('consequence');
      expect(html).toContain('FAILURE');
    });
  });

  describe('Decision phase partial', () => {
    it('should render player controls when isGM=false', async () => {
      const data = {
        character: mockCharacter(),
        isGM: false,
        playerState: { selectedApproach: 'force' },
        approaches: ['force', 'guile', 'focus', 'spirit'],
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/partials/decision-phase.html',
        data
      );

      expect(html).toContain('Primary Approach');
      expect(html).toContain('player-controls');
    });

    it('should render GM controls when isGM=true', async () => {
      const data = {
        character: mockCharacter(),
        isGM: true,
        playerState: { position: 'risky', effect: 'standard' },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/partials/decision-phase.html',
        data
      );

      expect(html).toContain('Set Position');
      expect(html).toContain('Set Effect');
      expect(html).toContain('GM Controls');
    });
  });

  describe('Success phase partial', () => {
    it('should render critical success message', async () => {
      const data = {
        playerState: {
          outcome: 'critical',
          rollResult: [6, 6, 4],
        },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/partials/success-phase.html',
        data
      );

      expect(html).toContain('CRITICAL SUCCESS');
      expect(html).toContain('Highest: 6');
    });
  });

  describe('Consequence phase partial', () => {
    it('should render harm configuration when consequenceType=harm', async () => {
      const data = {
        isGM: true,
        consequenceTransaction: {
          consequenceType: 'harm',
        },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/partials/consequence-phase.html',
        data
      );

      expect(html).toContain('Target Character');
      expect(html).toContain('Harm Clock');
      expect(html).toContain('harm-config');
    });

    it('should render crew clock configuration when consequenceType=crew-clock', async () => {
      const data = {
        isGM: true,
        consequenceTransaction: {
          consequenceType: 'crew-clock',
        },
      };

      const html = await renderTemplate(
        'systems/forged-in-the-grimdark/templates/widgets/partials/consequence-phase.html',
        data
      );

      expect(html).toContain('Select Clock');
      expect(html).toContain('crew-clock-config');
    });
  });
});
```

---

## Step 10: Testing Strategy

### Integration Test

Test full widget rendering through all states:

```typescript
describe('Player Action Widget - Full Lifecycle', () => {
  it('should render complete workflow: decision → rolling → consequence → complete', async () => {
    const data = {
      character: mockCharacter(),
      crew: mockCrew(),
      isGM: false,
      // ... full data structure
    };

    // Test each state rendering
    const decisionHtml = await renderTemplate(..., { ...data, isDecisionPhase: true });
    expect(decisionHtml).toContain('Primary Approach');

    const rollingHtml = await renderTemplate(..., { ...data, isRolling: true });
    expect(rollingHtml).toContain('ROLLING');

    const consequenceHtml = await renderTemplate(..., { ...data, isGMResolvingConsequence: true });
    expect(consequenceHtml).toContain('FAILURE');

    const successHtml = await renderTemplate(..., { ...data, isSuccess: true });
    expect(successHtml).toContain('SUCCESS');
  });
});
```

---

## Verification Checklist

After implementation:

- ✅ All 6 partials created and syntactically valid
- ✅ Main template renders decision-phase partial (visual check)
- ✅ Main template renders rolling-phase partial (visual check)
- ✅ Main template renders consequence-phase partial (visual check)
- ✅ Main template renders success-phase partial (visual check)
- ✅ Partials receive correct data structure
- ✅ Handlebars partial lookup path configured correctly
- ✅ No template syntax errors in console
- ✅ Widget renders in all states (DECISION, ROLLING, CONSEQUENCE, SUCCESS)
- ✅ All event listeners still bound correctly
- ✅ GM and Player views work correctly
- ✅ No performance regression

---

## File Size Comparison

| File | Before | After | Change |
|------|--------|-------|--------|
| player-action-widget.html | 468 lines | 50 lines | -89% |
| decision-phase.html | N/A | 105 lines | New |
| rolling-phase.html | N/A | 10 lines | New |
| stims-rolling-phase.html | N/A | 10 lines | New |
| stims-locked-phase.html | N/A | 10 lines | New |
| success-phase.html | N/A | 20 lines | New |
| consequence-phase.html | N/A | 125 lines | New |
| **Total** | **468** | **330** | **-29%** |

---

## Template Maintainability Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Max nesting depth | 4 levels | 2 levels |
| Conditional complexity | Complex | Clear state dispatch |
| File scanability | Poor (468 lines) | Excellent (50 lines main) |
| Testing individual state | Hard | Easy (test partial directly) |
| Feature isolation | Mixed | Separated by state |
| Re-use of partials | Partial (gm-passive-grid) | Full (all state-specific) |

---

## Rollback Plan

If issues arise with template rendering:

1. Delete new partial files
2. Restore original `player-action-widget.html` (full 468 lines)
3. Test rendering in Foundry VTT
4. Verify no errors in console

**Git Commands**:
```bash
git checkout foundry/templates/widgets/player-action-widget.html
git rm foundry/templates/widgets/partials/*.html
```

---

## Next Steps

Once Phase 4 is complete:

1. **Run full widget lifecycle test** (GM + Player, all states)
2. **Verify console has no template errors**
3. **Check template rendering performance** (should be same or better)
4. **Proceed to Phase 3**: Event handler organization (leverages cleaner template structure)

---

## Summary

Phase 4 transforms template from a 468-line monolith into a well-organized partial-based architecture:

```
player-action-widget.html (50 lines - clean dispatcher)
├── decision-phase.html (105 lines)
├── rolling-phase.html (10 lines)
├── stims-rolling-phase.html (10 lines)
├── stims-locked-phase.html (10 lines)
├── success-phase.html (20 lines)
├── consequence-phase.html (125 lines)
└── gm-passive-grid.html (existing partial)
```

**Benefits**:
- ✅ Each state has its own file (clear separation)
- ✅ Main template is clean dispatcher (easy to understand)
- ✅ Partials are testable independently
- ✅ Nesting reduced from 4 to 2 levels
- ✅ -89% reduction in main template size
- ✅ Overall template complexity reduced 30%

