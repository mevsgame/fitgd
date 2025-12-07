---
description: TDD workflow for fixing bugs and regressions
---

# TDD Bug Fix Workflow

Use this workflow when fixing reported bugs or regressions.

## Steps

1. Review documentation in `docs/` for expected behavior

// turbo
2. Run existing tests to understand current state:
`npm run test -- --run tests/integration/[related-file].test.ts`

3. Write a failing test that verifies the documented behavior

// turbo
4. Confirm test fails (validates bug exists):
`npm run test -- --run tests/integration/[new-test-file].test.ts`

5. Implement the fix in production code

// turbo
6. Verify type safety:
`npm run type-check:all`

// turbo
7. Confirm test passes:
`npm run test -- --run tests/integration/[new-test-file].test.ts`

// turbo
8. Run full test suite to check for regressions:
`npm run test -- --run`

9. Update documentation if behavior changed

10. Commit with descriptive message
