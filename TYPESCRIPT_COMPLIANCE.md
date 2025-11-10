# TypeScript Compliance Improvements

## Overview

This document outlines the TypeScript compliance improvements made to the Forged in the Grimdark codebase.

## Problems Solved

### Before
1. **Minified compiled output** - Variable names like `St`, `Q`, `kt` made debugging impossible
2. **No type declarations** - IDEs couldn't provide type hints for Foundry modules
3. **No type checking for .mjs files** - Integration code had no compile-time safety
4. **Hard to trace errors** - Couldn't understand compiled code without sourcemaps

### After
1. ✅ **Readable compiled output** - Variable names preserved (e.g., `STATE_TRANSITIONS`, `DEFAULT_CONFIG`)
2. ✅ **Full TypeScript declarations** - Complete `.d.ts` files for all exports
3. ✅ **JSDoc type checking** - `.mjs` files get type checking via `@ts-check`
4. ✅ **IDE intellisense** - Full autocomplete and error checking in VSCode

## Build Configuration Changes

### vite.config.ts

```typescript
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      // Generate TypeScript declaration files
      insertTypesEntry: true,
      rollupTypes: false,
      outDir: 'foundry/dist',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      copyDtsFiles: true,
    }),
  ],
  build: {
    // Disable minification to keep code readable
    minify: false,
    rollupOptions: {
      output: {
        compact: false,
      },
    },
  },
});
```

**Trade-off:** Bundle size increased from ~110kb to ~160kb, but code is human-readable.

### TypeScript Declaration Output

The build now generates:
- `foundry/dist/index.d.ts` - Main type entry point
- `foundry/dist/types/*.d.ts` - Type definitions
- `foundry/dist/api/*.d.ts` - API interfaces
- `foundry/dist/slices/*.d.ts` - Slice types

## Foundry Integration Layer

### jsconfig.json

Created `foundry/jsconfig.json` to enable type checking for `.mjs` files:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "paths": {
      "../dist/*": ["./dist/*"]
    }
  },
  "include": ["module/**/*.mjs"]
}
```

### Using TypeScript Types in .mjs Files

Add `// @ts-check` at the top of `.mjs` files and import types via JSDoc:

```javascript
// @ts-check

/**
 * @typedef {import('../dist/store').RootState} RootState
 * @typedef {import('../dist/types').Character} Character
 * @typedef {import('../dist/types').Crew} Crew
 */

/**
 * Get a character from Redux state
 * @param {string} characterId
 * @returns {Character|null}
 */
function getCharacter(characterId) {
  const state = game.fitgd.store.getState();
  return state.characters.byId[characterId] || null;
}
```

### IDE Support

VSCode will now:
- ✅ Show type hints for all Redux types
- ✅ Warn about type errors in JSDoc-annotated code
- ✅ Provide autocomplete for imported types
- ✅ Navigate to type definitions with Ctrl+Click

## Before/After Comparison

### Compiled Output (foundry/dist/fitgd-core.es.js)

**Before (Minified):**
```javascript
const St = {
  IDLE_WAITING: ["DECISION_PHASE", "ASSIST_ROLLING"],
  // ...
};
function Q(e) {
  return { characterId: e, state: "IDLE_WAITING" };
}
const C = { character: { startingTraitCount: 2 } };
```

**After (Readable):**
```javascript
const STATE_TRANSITIONS = {
  IDLE_WAITING: ["DECISION_PHASE", "ASSIST_ROLLING", "PROTECT_ACCEPTING"],
  // ...
};
function createInitialPlayerRoundState(characterId) {
  return {
    characterId,
    state: "IDLE_WAITING",
    stateEnteredAt: Date.now()
  };
}
const DEFAULT_CONFIG = {
  character: {
    startingTraitCount: 2,
    startingActionDots: 12,
    maxActionDotsPerAction: 4,
    maxActionDotsAtCreation: 3
  },
  // ...
};
```

### Type Safety in Foundry Code

**Before (No type checking):**
```javascript
function getCharacter(id) {
  const state = game.fitgd.store.getState();
  return state.characters.byId[id] || null; // No type hints
}
```

**After (Full type safety):**
```javascript
// @ts-check
/**
 * @typedef {import('../dist/types').Character} Character
 */

/**
 * @param {string} id
 * @returns {Character|null}
 */
function getCharacter(id) {
  const state = game.fitgd.store.getState();
  return state.characters.byId[id] || null; // VSCode shows Character type
}
```

## Migration Guide for Foundry Modules

### Step 1: Add @ts-check
```javascript
// @ts-check
```

### Step 2: Import Types
```javascript
/**
 * @typedef {import('../dist/types').Character} Character
 * @typedef {import('../dist/types').Crew} Crew
 * @typedef {import('../dist/types').Clock} Clock
 * @typedef {import('../dist/store').RootState} RootState
 */
```

### Step 3: Annotate Function Signatures
```javascript
/**
 * @param {string} characterId
 * @param {number} segments
 * @returns {Promise<void>}
 */
async function takeHarm(characterId, segments) {
  // Implementation
}
```

### Step 4: Use TypeScript Types for Return Values
```javascript
/**
 * @param {string} characterId
 * @returns {Clock[]}
 */
function getHarmClocks(characterId) {
  return game.fitgd.bridge.getClocks(characterId, 'harm');
}
```

## Files Updated

### Core Build System
- ✅ `vite.config.ts` - Added dts plugin, disabled minification
- ✅ `package.json` - Added `vite-plugin-dts` dependency

### Foundry Integration
- ✅ `foundry/jsconfig.json` - Created for type checking
- ✅ `foundry/module/foundry-redux-bridge.mjs` - Added type annotations

### Documentation
- ✅ `TYPESCRIPT_COMPLIANCE.md` - This file

## Verification Commands

```bash
# Rebuild with new configuration
pnpm build:lib

# Check compiled output readability
head -100 foundry/dist/fitgd-core.es.js

# Verify TypeScript declarations exist
ls foundry/dist/*.d.ts
ls foundry/dist/types/*.d.ts

# Check bundle size (should be ~160kb unminified)
ls -lh foundry/dist/fitgd-core.es.js
```

## Next Steps

1. **Migrate remaining .mjs files** - Add `@ts-check` and type annotations to:
   - `foundry/module/fitgd.mjs`
   - `foundry/module/dialogs.mjs`
   - `foundry/module/widgets/player-action-widget.mjs`

2. **Consider full TypeScript conversion** - For complex modules, convert `.mjs` → `.ts` and compile with TSC

3. **Add type tests** - Create `*.test-d.ts` files to verify type correctness at compile time

4. **Production build** - Create separate Vite config for minified production builds:
   ```typescript
   // vite.config.prod.ts
   export default defineConfig({
     build: {
       minify: 'esbuild', // Re-enable for production
     }
   });
   ```

## Trade-offs

### Bundle Size
- **Dev/Debug:** ~160kb unminified (readable)
- **Production:** ~110kb minified (performance)

**Recommendation:** Use unminified for development, minified for production releases.

### Build Time
- Added ~1-2 seconds for TypeScript declaration generation
- Worth it for improved developer experience

### Maintenance
- Must keep JSDoc annotations in sync with TypeScript types
- Alternatively, convert fully to TypeScript

## Architectural Recommendations

From `CLAUDE.md` (Section: Architectural Concerns):

> ### 2. Lack of Type Safety in Foundry Integration ⚠️
>
> **Problem:**
> - Foundry code is JavaScript, not TypeScript
> - ID confusion (Redux UUIDs vs Foundry Actor IDs) caught at runtime, not compile-time
>
> **Recommendation:**
> ```typescript
> // Convert Foundry integration to TypeScript
> type ReduxId = string & { __brand: 'redux' };
> type FoundryActorId = string & { __brand: 'foundry' };
>
> // Compile-time prevention of ID confusion
> function execute(action: ReduxAction, options: { affectedReduxIds: ReduxId[] }) {
>   // TypeScript ensures ReduxId, not FoundryActorId
> }
> ```
>
> **Priority:** Medium - prevents entire class of bugs at compile-time

**Status:** Partially addressed by this PR. Full TypeScript conversion recommended for future work.

## References

- [Vite Plugin DTS](https://github.com/qmhc/vite-plugin-dts)
- [JSDoc TypeScript Support](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [JSConfig Reference](https://code.visualstudio.com/docs/languages/jsconfig)
