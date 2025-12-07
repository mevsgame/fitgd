---
trigger: always_on
---

# TDD Development Rule

When implementing new features or fixing bugs/regressions, follow Test-Driven Development principles.

## Core Principle
**Documentation is the source of truth. Tests verify documentation is implemented correctly.**

## Hierarchy of Truth
1. `vault/rules_primer.md` - Ultimate game rules source
2. `gameConfig.ts` - Code expression of rules (must match primer)
3. `docs/[feature].md` - Feature-specific implementation details
4. Code - Must implement what docs specify

## Required Workflow for Bug Fixes

When a user reports broken functionality:

1. **Verify documentation** - Check if the expected behavior is documented
2. **Write failing test FIRST** - Create integration test that verifies the documented behavior
3. **Run test to confirm failure** - This validates the bug exists and test is correct
4. **Implement fix** - Modify production code
5. **Run test to confirm green** - All tests must pass
6. **Update documentation if needed** - Keep docs/code synchronized

## Test Commands Are Safe

The following commands are always safe to auto-run:
- `npm run test -- --run [file]` - Run specific test file
- `npm run type-check:all` - Type checking
- `npm run build` - Build verification

## Red Flag
If documentation says X should happen but tests don't verify X, this is a **test coverage gap** - fix it with new tests.
