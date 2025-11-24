# Forged in the Grimdark - Redux Core

A **TypeScript + Redux Toolkit** event-sourced state management system for "Forged in the Grimdark" character and crew sheets. Designed to be **Foundry VTT agnostic** but compatible, with full command history for time-travel, undo, and data reconstruction.

## Installation

### For Foundry VTT Users

The system is available on [GitHub Releases](https://github.com/mevsgame/fitgd/releases). To install in Foundry:

1. Go to the system installation dialog in Foundry
2. Paste this manifest URL:
   ```
   https://github.com/mevsgame/fitgd/releases/latest/download/system.json
   ```
3. Click "Install" and enable the system for your world

### For Developers

```bash
npm install
npm run build
npm test
```

## Documentation

- **Game Rules Primer**: See [vault/rules_primer.md](./vault/rules_primer.md) - Primary source of truth for FitGD mechanics, usable in pen & paper play
- **Development**: See [CLAUDE.md](./CLAUDE.md) - Architecture, best practices, and implementation guide
- **API Reference**: See `src/api/` and generated TypeDoc
- **Testing**: 700+ tests, event sourcing architecture, command → state transformations

## Key Features

- ✅ Event-sourced architecture with full command history
- ✅ TypeScript type safety
- ✅ 700+ tests with TDD approach
- ✅ Momentum-based resource economy (not stress/trauma)
- ✅ Character traits, approaches, equipment management
- ✅ Crew management with shared Momentum pool
- ✅ Abstract clock system (harm, addiction, progress)
- ✅ Foundry VTT integration with Bridge API pattern

## Quick Start

```bash
# Install & build
npm install
npm run build:foundry

# Run tests
npm test

# Type checking
npm run type-check:all
```

## Contributing

TDD is required. All tests must pass:

```bash
npm test
npm run type-check:all
```

## License

MIT License - See [LICENSE](./LICENSE) file for details
