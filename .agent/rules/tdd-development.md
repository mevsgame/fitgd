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

## Test Output Hygiene
To ensure tests remain readable and efficient:
1.  **Use `logger` instead of `console`**:
    -   NEVER use `console.log`, `console.error`, or `console.warn` in source code.
    -   ALWAYS use the `logger` utility ([src/utils/logger.ts](cci:7://file:///workspaces/fitgd/src/utils/logger.ts:0:0-0:0)), which automatically suppresses output in the `test` environment.
    -   Exceptions: Scripts meant for CLI output (e.g., build scripts) may use console.
2.  **Selector Stability**:
    -   Ensure Redux selectors (Reselect) always return stable references.
    -   Avoid returning new arrays (`[]`) or objects (`{}`) in selectors if the data hasn't changed. Use constants like `EMPTY_ARRAY` instead.
    -   Unstable selectors cause "input selector returned a different result" warnings in `stderr` during tests.
3.  **Clean `stderr`**:
    -   Tests should produce minimal to NO output in `stderr`.
    -   If tests intentionally provoke errors, verify them without letting them leak to `stderr` (or silence them).