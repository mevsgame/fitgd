# Documentation Index

Quick reference for all project documentation.

---

## 🚀 Getting Started

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview, installation, quick start |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development setup, workflow, debugging |

---

## 📖 Architecture & Design

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Complete implementation plan, architecture principles, debugging lessons |
| [ARCHITECTURAL_ANALYSIS.md](./ARCHITECTURAL_ANALYSIS.md) | Architecture audit, antipatterns eliminated, remaining issues |

---

## 🎮 Foundry VTT Integration

### Core Integration
| Document | Purpose |
|----------|---------|
| [foundry/README.md](./foundry/README.md) | Foundry system overview, installation, features |
| [foundry/module/BRIDGE_API_QUICK_GUIDE.md](./foundry/module/BRIDGE_API_QUICK_GUIDE.md) | ⭐ **Essential** - How to use Bridge API (start here!) |
| [foundry/module/BRIDGE_API_USAGE.md](./foundry/module/BRIDGE_API_USAGE.md) | Complete Bridge API reference with migration guide |
| [foundry/module/BRIDGE_INTEGRATION_EXAMPLE.md](./foundry/module/BRIDGE_INTEGRATION_EXAMPLE.md) | Before/after examples of Bridge refactoring |

### Advanced Topics
| Document | Purpose |
|----------|---------|
| [foundry/MACROS.md](./foundry/MACROS.md) | 15+ ready-to-use macro examples |
| [foundry/VERBS_MAPPING.md](./foundry/VERBS_MAPPING.md) | Game verbs → API method mapping |
| [foundry/DRAG_DROP.md](./foundry/DRAG_DROP.md) | Drag & drop functionality |
| [foundry/TESTING_MACROS.md](./foundry/TESTING_MACROS.md) | Testing and debugging macros |

---

## 📚 Core Library (Redux/TypeScript)

| Document | Purpose |
|----------|---------|
| [docs/EXAMPLES.md](./docs/EXAMPLES.md) | API usage examples (character creation, actions, harm, etc.) |
| [docs/MIGRATION_GUIDE.md](./docs/MIGRATION_GUIDE.md) | Migration guide for API changes |
| [docs/FOUNDRY_PERSISTENCE.md](./docs/FOUNDRY_PERSISTENCE.md) | How state persistence works |
| [docs/HISTORY_PRUNING.md](./docs/HISTORY_PRUNING.md) | Command history management |
| [docs/FITGD_VS_BLADES.md](./docs/FITGD_VS_BLADES.md) | Game rules comparison (FitGD vs Blades in the Dark) |

---

## 🔍 Quick Reference by Task

### "I want to..."

**...understand the Bridge API pattern**
→ Start here: [foundry/module/BRIDGE_API_QUICK_GUIDE.md](./foundry/module/BRIDGE_API_QUICK_GUIDE.md)

**...set up my dev environment**
→ [DEVELOPMENT.md](./DEVELOPMENT.md)

**...learn the game rules**
→ [vault/rules_primer.md](./vault/rules_primer.md) + [docs/FITGD_VS_BLADES.md](./docs/FITGD_VS_BLADES.md)

**...create a Foundry macro**
→ [foundry/MACROS.md](./foundry/MACROS.md)

**...understand the architecture**
→ [CLAUDE.md](./CLAUDE.md) + [ARCHITECTURAL_ANALYSIS.md](./ARCHITECTURAL_ANALYSIS.md)

**...use the core API (non-Foundry)**
→ [docs/EXAMPLES.md](./docs/EXAMPLES.md)

**...debug state issues**
→ [CLAUDE.md](./CLAUDE.md) → "Implementation Learnings & Debugging Notes" section

**...understand what was fixed**
→ [ARCHITECTURAL_ANALYSIS.md](./ARCHITECTURAL_ANALYSIS.md) → "Eliminated Antipatterns" section

---

## 📝 Documentation Standards

### For Developers Adding Features

1. **Use Bridge API** - See [BRIDGE_API_QUICK_GUIDE.md](./foundry/module/BRIDGE_API_QUICK_GUIDE.md)
2. **Document in CLAUDE.md** - Add debugging lessons learned
3. **Update examples** - Add to [docs/EXAMPLES.md](./docs/EXAMPLES.md) if relevant
4. **Write tests** - TDD approach documented in [CLAUDE.md](./CLAUDE.md)

### Documentation Lifecycle

- ✅ **README.md** - Kept current with major milestones
- ✅ **CLAUDE.md** - Living document, updated with learnings
- ✅ **Bridge API docs** - Updated when API changes
- ✅ **ARCHITECTURAL_ANALYSIS.md** - Snapshot in time, historical reference

---

## ⚠️ Critical Rules (From CLAUDE.md)

### DO
- ✅ Use `game.fitgd.bridge.execute()` for all state changes
- ✅ Batch related actions with `bridge.executeBatch()`
- ✅ Test with GM + Player clients
- ✅ Let Redux subscriptions handle rendering

### DO NOT
- ❌ Call `game.fitgd.store.dispatch()` directly
- ❌ Call `game.fitgd.saveImmediate()` manually
- ❌ Use `setTimeout()` as a fix for timing issues
- ❌ Touch socket handlers (lines 984-1050 in fitgd.mjs)

---

## 📦 Repository Structure

```
fitgd/
├── README.md                          # Project overview
├── CLAUDE.md                          # Architecture & implementation history
├── ARCHITECTURAL_ANALYSIS.md          # Architecture audit
├── DEVELOPMENT.md                     # Dev setup & workflow
├── DOCUMENTATION_INDEX.md             # This file
│
├── src/                               # Core Redux library (TypeScript)
│   ├── api/                           # Public API
│   ├── slices/                        # Redux slices
│   └── types/                         # TypeScript types
│
├── foundry/                           # Foundry VTT system
│   ├── README.md                      # Foundry-specific docs
│   ├── MACROS.md                      # Macro examples
│   ├── VERBS_MAPPING.md               # API mapping
│   ├── module/
│   │   ├── fitgd.mjs                  # Main entry point
│   │   ├── foundry-redux-bridge.mjs   # Bridge API implementation
│   │   ├── BRIDGE_API_QUICK_GUIDE.md  # Quick reference
│   │   ├── BRIDGE_API_USAGE.md        # Complete reference
│   │   └── BRIDGE_INTEGRATION_EXAMPLE.md
│   ├── templates/                     # Handlebars templates
│   └── dist/                          # Built library (auto-generated)
│
├── docs/                              # Core library docs
│   ├── EXAMPLES.md                    # API usage examples
│   ├── MIGRATION_GUIDE.md             # Migration guide
│   ├── FOUNDRY_PERSISTENCE.md         # Persistence details
│   ├── HISTORY_PRUNING.md             # Command history
│   └── FITGD_VS_BLADES.md             # Rules comparison
│
├── vault/                             # Game rules & content
│   ├── rules_primer.md                # Core game rules
│   └── content/                       # Game content (traits, gear, etc.)
│
└── tests/                             # Test suite
```

---

## 🎯 Status: Production Ready

All core features complete. Bridge API prevents common integration bugs. Ready for gameplay testing.
