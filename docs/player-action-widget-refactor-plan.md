# Player Action Widget Refactor Plan

## Executive Summary

This document outlines a refactoring plan for `player-action-widget.ts` and `player-action-widget.html` to improve code organization, maintainability, and separation of concerns. The current implementation is functional but exhibits signs of complexity that can be reduced through architectural improvements.

**Current State**: ~1,967 lines (TypeScript), ~468 lines (HTML)
**Goal**: Reduce cognitive load, improve testability, separate UI concerns from business logic

---

## Current State Analysis

### Strengths
- ✅ Clear state machine implementation with defined phase transitions
- ✅ Good use of Redux selectors for data queries
- ✅ Comprehensive handler delegation pattern for business logic
- ✅ Bridge API integration for consistent Redux updates
- ✅ Extensive logging for debugging state transitions
- ✅ Transaction pattern for atomic state changes

### Pain Points
- ❌ **God Class Problem**: Single class manages 11+ handlers + complex lifecycle
- ❌ **Large getData()**: ~200 lines doing data fetching, transformation, and handler initialization
- ❌ **Event Handler Fragmentation**: 20+ event handlers mixed across class (unclear separation)
- ❌ **Template Complexity**: Nested conditionals for 5+ states, difficult to scan
- ❌ **Handler Initialization Overhead**: Each render re-initializes all handlers (no caching/memoization)
- ❌ **Subscription Logic**: Complex change detection in _render() mixin
- ❌ **Missing Type Safety**: PlayerActionWidgetData interface has many optional fields, weak contracts
- ❌ **HTML-TypeScript Coupling**: Template expects specific data structure without clear schema
- ❌ **Handler Dependencies**: Handlers created inline, hard to test without widget context

---

## Refactoring Goals

### 1. **Separation of Concerns**
- Extract UI rendering logic from state management
- Separate event handling into logical groups
- Create explicit handler factory/registry
- Decouple handlers from widget lifecycle

### 2. **Improved Testability**
- Make handlers independently testable (no widget context required)
- Extract pure functions for complex calculations
- Make subscription logic mockable
- Create test fixtures for state transitions

### 3. **Reduced Complexity**
- Aim for methods < 50 lines (getData currently ~200)
- Break large conditional blocks in template
- Implement handler lazy-loading (initialize only when needed)
- Create state-specific "phase handlers" instead of monolithic widget

### 4. **Better Code Organization**
- Logical grouping of related functionality
- Clear responsibility per class/module
- Explicit dependencies between components
- Consistent naming conventions

---

## Proposed Architecture

### Phase 1: Handler Factory & Initialization (High Priority)

**Goal**: Make handler creation/initialization testable and lazy-loaded

```typescript
// foundry/module/services/playerActionHandlerFactory.ts
export class PlayerActionHandlerFactory {
  private characterId: string;
  private crewId: string | null;
  private handlers: Map<string, any> = new Map();

  constructor(characterId: string, crewId: string | null) {
    this.characterId = characterId;
    this.crewId = crewId;
  }

  // Lazy-initialize handlers only when needed
  getDiceRollingHandler(): DiceRollingHandler {
    if (!this.handlers.has('diceRolling')) {
      this.handlers.set('diceRolling', new DiceRollingHandler({
        characterId: this.characterId,
        crewId: this.crewId,
      }));
    }
    return this.handlers.get('diceRolling')!;
  }

  // Repeat for all handlers...
}
```

**Changes Required**:
- Create `PlayerActionHandlerFactory` class in `/foundry/module/services/`
- Implement lazy initialization pattern
- Update `PlayerActionWidget.constructor()` to use factory
- Change `getData()` to call factory getters (not init in method)
- Make factory mockable in tests

**Files Changed**:
- NEW: `foundry/module/services/playerActionHandlerFactory.ts`
- MODIFY: `foundry/module/widgets/player-action-widget.ts` (constructor, getData)

---

### Phase 2: Decompose getData() (High Priority)

**Goal**: Replace 200-line `getData()` with focused data preparation methods

**Current Pattern**:
```typescript
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  // 200 lines: fetch character, crew, state, compute selectors,
  // initialize handlers, build template data
}
```

**New Pattern**:
```typescript
override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
  const entities = await this._loadEntities();      // Character, crew, state
  const uiState = this._buildUIState(entities);      // Flags: isDecisionPhase, etc.
  const derivedData = this._computeDerivedData(entities);  // Dice pool, etc.
  const templateData = this._prepareTemplateData(
    entities,
    uiState,
    derivedData
  );

  return {
    ...templateData,
    isDecisionPhase,
    isRolling,
    // ... rest of data
  };
}

private async _loadEntities(): Promise<{
  character: Character;
  crew: Crew | null;
  playerState: PlayerRoundState | null;
}> { /* ... */ }

private _buildUIState(entities: any): {
  isDecisionPhase: boolean;
  isRolling: boolean;
  // ... other flags
} { /* ... */ }

private _computeDerivedData(entities: any): {
  dicePool: number;
  momentumCost: number;
  // ... selectors
} { /* ... */ }

private _prepareTemplateData(
  entities: any,
  uiState: any,
  derivedData: any
): Partial<PlayerActionWidgetData> { /* ... */ }
```

**Benefits**:
- Each method has single responsibility
- Easier to debug (call one method to test character loading, etc.)
- Methods ~40-60 lines each (below threshold)
- Testable without full widget initialization

**Files Changed**:
- MODIFY: `foundry/module/widgets/player-action-widget.ts` (getData and new private methods)

---

### Phase 3: Event Handler Organization (Medium Priority)

**Goal**: Group related event handlers into logical "concerns"

**Current**: 20 handlers scattered across class
**Proposed**: Group into 4 categories

```typescript
// Approach/Secondary/Position/Effect handlers
private _onApproachChange() { }
private _onSecondaryApproachChange() { }
private _onPositionChange() { }
private _onEffectChange() { }
↓
// New grouping:
private async _handleDecisionPhaseChange(event: JQuery.ChangeEvent) {
  const type = event.currentTarget.dataset.type; // 'approach' | 'secondary' | 'position' | 'effect'
  const value = (event.currentTarget as HTMLSelectElement).value;

  switch (type) {
    case 'approach': await this._handleApproachChange(value); break;
    case 'secondary': await this._handleSecondaryChange(value); break;
    // ...
  }
}

// Action modifiers handlers
private _onRally() { }
private _onLeanIntoTrait() { }
private _onUseTrait() { }
private _onEquipment() { }
private _onTogglePushDie() { }
private _onTogglePushEffect() { }
↓
// New grouping: delegate to ModifierHandler
private async _handleModifierAction(action: string) {
  const modifierHandler = new ActionModifierHandler(...);
  await modifierHandler.handle(action);
}
```

**Handler Categories**:
1. **Decision Phase Inputs** (approach, secondary, position, effect)
2. **Action Modifiers** (push, traits, equipment, rally)
3. **Roll & Outcome** (roll, consequences, stims)
4. **GM Configuration** (passive gear, consequence type, harm target)

**Files Changed**:
- MODIFY: `foundry/module/widgets/player-action-widget.ts` (activateListeners, consolidate handlers)
- CONSIDER: New handler classes for grouping if logic is complex

---

### Phase 4: Template Refactoring (Medium Priority)

**Goal**: Extract state-specific sections into partials, reduce nesting

**Current State**: 5+ main states (DECISION, ROLLING, STIMS, SUCCESS, GM_RESOLVING) with complex nested conditionals

**Proposed Approach**: Create state-specific partials
```
foundry/templates/widgets/
  player-action-widget.html          // Main layout, state dispatcher
  partials/
    decision-phase.html               // DECISION_PHASE content
    rolling-phase.html                // ROLLING content
    consequence-phase.html            // GM_RESOLVING_CONSEQUENCE content
    success-phase.html                // SUCCESS_COMPLETE content
```

**Main Template**:
```handlebars
<div class="player-action-widget-container">
  <div class="widget-header">
    <h2>🎯 {{character.name}} - YOUR TURN</h2>
  </div>

  {{#switch playerState.state}}
    {{#case 'DECISION_PHASE'}}
      {{> decision-phase character=character isGM=isGM playerState=playerState ...}}
    {{#case 'ROLLING'}}
      {{> rolling-phase playerState=playerState}}
    {{#case 'GM_RESOLVING_CONSEQUENCE'}}
      {{> consequence-phase isGM=isGM playerState=playerState ...}}
    {{#case 'SUCCESS_COMPLETE'}}
      {{> success-phase playerState=playerState}}
  {{/switch}}
</div>
```

**Benefits**:
- Each partial ~80-100 lines (vs current ~240 lines for one state)
- Easier to reason about state-specific UI
- Partials can be independently tested with mock data
- Reduces cognitive load when scanning template

**Files Changed**:
- MODIFY: `foundry/templates/widgets/player-action-widget.html`
- NEW: `foundry/templates/widgets/partials/decision-phase.html`
- NEW: `foundry/templates/widgets/partials/rolling-phase.html`
- NEW: `foundry/templates/widgets/partials/consequence-phase.html`
- NEW: `foundry/templates/widgets/partials/success-phase.html`

---

### Phase 5: Subscription & State Monitoring (Lower Priority)

**Goal**: Extract Redux subscription logic, make it more efficient

**Current**: Complex change detection in `_render()` with previous state tracking

**Proposed**: Extract to dedicated service
```typescript
// foundry/module/services/playerActionStateMonitor.ts
export class PlayerActionStateMonitor {
  private previousState: RootState | null = null;
  private listeners: Map<string, (change: StateChange) => void> = new Map();

  subscribe(key: string, listener: (change: StateChange) => void) {
    this.listeners.set(key, listener);
  }

  checkForChanges(currentState: RootState, characterId: string): StateChange | null {
    const change = this._detectChange(this.previousState, currentState, characterId);
    this.previousState = currentState;
    return change;
  }

  private _detectChange(...): StateChange | null { /* ... */ }
}
```

**Benefits**:
- Testable state change detection
- Reusable for other widgets
- Clearer intent (not mixed into Foundry lifecycle)
- Easier to debug subscription behavior

**Files Changed**:
- NEW: `foundry/module/services/playerActionStateMonitor.ts`
- MODIFY: `foundry/module/widgets/player-action-widget.ts` (_render, subscription logic)

---

## Implementation Phases

### Phase 1: Handler Factory (Lowest Risk, High Impact)
- Create factory service
- Update widget to use factory
- Update tests
- **Estimated Effort**: 2-3 hours
- **Breaking Changes**: None (factory is internal)
- **Risk**: Low (factories are well-established pattern)

### Phase 2: Decompose getData() (Medium Risk, High Impact)
- Extract private methods for data loading
- Test each method independently
- Verify template receives same data structure
- **Estimated Effort**: 3-4 hours
- **Breaking Changes**: None (data structure unchanged)
- **Risk**: Medium (refactoring complex method)

### Phase 3: Event Handler Organization (Medium Risk, Medium Impact)
- Group handlers by concern
- Consider if new handler classes needed
- Test event routing
- **Estimated Effort**: 2-3 hours
- **Breaking Changes**: None (same listeners, reorganized)
- **Risk**: Medium (coordinate listener binding)

### Phase 4: Template Refactoring (Medium Risk, Medium Impact)
- Create partials for each state
- Test template rendering with mock data
- Verify all conditional paths work
- **Estimated Effort**: 3-4 hours
- **Breaking Changes**: None (data structure unchanged)
- **Risk**: Medium-High (template fragmentation)

### Phase 5: State Monitoring (Low Risk, Low Impact)
- Extract subscription logic to service
- Test change detection
- Verify re-render behavior
- **Estimated Effort**: 2 hours
- **Breaking Changes**: None (internal refactor)
- **Risk**: Low (careful testing prevents issues)

---

## Recommended Execution Order

1. **Start with Phase 1** (Handler Factory)
   - Lowest risk, enables better testing for later phases
   - No coordination with other phases

2. **Then Phase 2** (Decompose getData)
   - Builds on Phase 1
   - Improves data flow clarity

3. **Then Phase 4** (Template Partials)
   - Can be done independently
   - High immediate readability improvement

4. **Then Phase 3** (Event Handler Organization)
   - Benefits from Phases 1-2
   - May reveal opportunities for further refactoring

5. **Finally Phase 5** (State Monitoring)
   - Polish/optimization phase
   - Lowest priority

---

## Testing Strategy

### Unit Tests
- **Handler Factory**: Test lazy initialization
- **getData Helpers**: Test each decomposed method with fixtures
- **Event Handlers**: Mock bridge, verify correct actions dispatched

### Integration Tests
- **Full Widget Lifecycle**: Render → select approach → roll → consequences
- **State Transitions**: Verify all valid state paths work
- **Multi-Client**: GM + Player interactions (use existing patterns from session tests)

### Template Tests
- **Partial Rendering**: Each partial renders correctly with mock data
- **Conditional Paths**: All branches in conditionals covered
- **Data Binding**: Template receives expected data structure

### Regression Tests
- Run existing player-action-widget tests through all phases
- Verify no changes to external API (widget constructor, events)
- Test with actual Foundry VTT integration

---

## Success Criteria

- ✅ All methods < 50 lines (except getData delegation method)
- ✅ Template sections ~80-120 lines per state
- ✅ Handler initialization lazy-loaded (factory pattern)
- ✅ Data transformations testable without widget
- ✅ All existing tests pass (no breaking changes)
- ✅ Cognitive complexity reduced (verified by code review)
- ✅ No performance regression (state subscription still efficient)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Template rendering breaks | High | Test each partial with mock data before integration |
| Event routing bugs | Medium | Keep listener binding centralized, test event flow |
| Performance regression | Medium | Profile subscription before/after Phase 5 |
| State data structure changes | High | Maintain exact same interface to template |
| Handler factory complexity | Low | Start with simple lazy-load pattern, iterate if needed |

---

## Dependencies & Blockers

- **No external blockers** - This is refactoring existing code
- **Internal dependency**: Uses existing handlers (no changes needed to handlers)
- **Testing**: Requires ability to mock Redux bridge and services

---

## Notes for Implementation

### Preserve Existing Behavior
- Game rules and state transitions MUST remain identical
- Bridge API usage patterns should not change
- External interfaces (constructor, event bindings) stay the same
- Template data structure must match exactly (partial refactoring only)

### Leverage Existing Patterns
- Follow handler pattern established in codebase (DiceRollingHandler, etc.)
- Use Bridge API consistently (already in use throughout)
- Match service architecture from notificationService, diceService, etc.
- Follow Foundry application patterns for lifecycle

### Code Review Checklist
- [ ] No breaking changes to widget API
- [ ] All event listeners still bound correctly
- [ ] Template still receives same data structure
- [ ] Handler initialization works in multi-client scenario
- [ ] No new external dependencies introduced
- [ ] All tests passing (unit + integration + regression)

---

## Conclusion

This refactor improves maintainability and testability without changing the widget's functionality or user experience. The phased approach allows for incremental improvements with low risk at each step.

**Key Win**: Transforms PlayerActionWidget from a "God Class" (~2,000 lines with 11 handlers) into a well-organized, testable component with clear separation of concerns.
