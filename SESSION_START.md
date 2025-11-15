# Claude Code Session Start Guide

**Purpose:** Ensure every Claude session has the necessary context to work effectively on this project.

---

## 📋 Required Reading at Session Start

### Always Read (Every Session)

1. **[CLAUDE.md](./CLAUDE.md)** - Read the following sections:
   - "Core Architecture Principles"
   - "Critical Rules (Updated)" section at the end
   - "Implementation Learnings & Debugging Notes" (skim for patterns)
   - "Universal Broadcasting Pattern (CRITICAL)"
   - "Foundry Application Render Lifecycle & Concurrent Render Blocking (CRITICAL)"
   - "SOLUTION: Foundry-Redux Bridge API"

2. **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Full read (quick navigation reference)

### Conditional Reading (Based on Task)

**If working on Foundry integration:**
- [foundry/module/BRIDGE_API_QUICK_GUIDE.md](./foundry/module/BRIDGE_API_QUICK_GUIDE.md) - **MUST READ** before touching any Foundry code

**If working on game rules/mechanics:**
- [vault/rules_primer.md](./vault/rules_primer.md) - Game rules reference
- [docs/FITGD_VS_BLADES.md](./docs/FITGD_VS_BLADES.md) - Rules differences

**If working on core Redux/API:**
- [docs/EXAMPLES.md](./docs/EXAMPLES.md) - API usage patterns
- README.md "Game Rules" section

**If creating macros:**
- [foundry/MACROS.md](./foundry/MACROS.md)
- [foundry/VERBS_MAPPING.md](./foundry/VERBS_MAPPING.md)

---

## ⚠️ Critical Rules (Never Violate)

### Foundry Integration

**✅ DO:**
- Use `game.fitgd.bridge.execute()` or `game.fitgd.bridge.executeBatch()` for ALL state changes
- Let Redux subscriptions handle rendering (no manual `this.render()` in event handlers)
- Batch related actions together to prevent race conditions
- Test with GM + Player clients before declaring done

**❌ NEVER:**
- Call `game.fitgd.store.dispatch()` directly (except socket handlers lines 984-1050 in fitgd.mjs)
- Call `game.fitgd.saveImmediate()` manually
- Call `refreshSheetsByReduxId()` manually
- Use `setTimeout()` as a fix for timing issues (symptom of not understanding the problem)
- Assume a fix worked without user confirmation

### Debugging Principles

**✅ DO:**
- Add diagnostic logging FIRST when debugging
- Understand the problem before attempting a fix
- Wait for user confirmation that fix worked
- Read platform source code (Foundry Application class, etc.) when needed

**❌ NEVER:**
- Use hacky workarounds (setTimeout, etc.) when you don't understand the problem
- State "this should fix it" without user confirmation
- Try multiple fixes in rapid succession without understanding which worked

### Development Workflow

**✅ DO:**
- Write tests first (TDD approach)
- Update CLAUDE.md with new learnings/debugging insights
- Commit related changes together with clear messages
- Ask for clarification when requirements are ambiguous

**❌ NEVER:**
- Make assumptions about game rules without checking rules_primer.md
- Create new documentation files without asking (prefer updating existing)
- Ignore user hints about approach being wrong

---

## 🎯 Architecture Quick Reference

### Data Flow
```
User Action → Dialog/Sheet Handler → Bridge API → Redux Dispatch → Broadcast → Sheet Refresh
                                         ↓
                                   Auto-saves to Foundry World
```

### Key Files
- `foundry/module/fitgd.mjs` - Main entry point, store initialization, socket handlers
- `foundry/module/foundry-redux-bridge.mjs` - Bridge API implementation
- `foundry/module/dialogs.mjs` - Game mechanic dialogs
- `foundry/module/widgets/player-action-widget.mjs` - Combat round widget
- `src/api/` - Core game API (Redux-agnostic)
- `src/slices/` - Redux state management

### Common Patterns

**Single State Change:**
```javascript
await game.fitgd.bridge.execute({
  type: 'action',
  payload: { ... }
});
```

**Multiple Related Changes:**
```javascript
await game.fitgd.bridge.executeBatch([
  { type: 'action1', payload: { ... } },
  { type: 'action2', payload: { ... } }
]);
```

---

## 📝 Session Checklist

Before starting work:

- [ ] **Run `pnpm install`** (CRITICAL on fresh branches - see CLAUDE.md "Development Workflow")
- [ ] **Verify build works** (`pnpm run build` succeeds)
- [ ] Read required docs (see above)
- [ ] Understand the task requirements
- [ ] Check if similar code exists (grep for patterns)
- [ ] Identify which files need modification
- [ ] Confirm approach with user if ambiguous

During work:

- [ ] Follow TDD (tests first)
- [ ] Use Bridge API for all Foundry state changes
- [ ] Add diagnostic logging if debugging
- [ ] Commit atomically with clear messages

Before declaring done:

- [ ] All tests pass
- [ ] User confirmed fix works (don't assume)
- [ ] Updated relevant documentation if needed
- [ ] Committed and pushed changes

---

## 🔍 Quick Diagnostics

**"Cannot find module" or build/test failures?**
→ Run `pnpm install` - dependencies not installed on fresh branch

**State not propagating to other clients?**
→ Missing `bridge.execute()` or `bridge.executeBatch()` call

**Widget stuck at "ROLLING..." or similar?**
→ Render race condition - check if actions are batched

**Sheet not updating after action?**
→ Either missing `bridge.execute()` or subscription not set up

**"Clock not found" errors?**
→ Commands for deleted entities - expected behavior (see CLAUDE.md)

**Silent failures with Actor IDs?**
→ Using Redux ID where Foundry Actor ID expected (or vice versa)

---

## 💡 Remember

- **Bridge API makes correct pattern easy** - if you're writing complex dispatch/broadcast logic, you're doing it wrong
- **Diagnostic logging reveals truth** - don't guess, add logs first
- **Socket handlers are special** - they intentionally don't use Bridge API
- **CLAUDE.md is living documentation** - update it with new learnings
- **User knows the domain** - listen to hints about approach

---

## 📚 Full Documentation Map

See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for complete navigation.

---

**Status:** Production Ready | All critical antipatterns eliminated | Bridge API integrated
