# Testing FitGD Macros and API

This guide shows how to test FitGD macros, API methods, and complete game workflows.

## Table of Contents

1. [Testing Approaches](#testing-approaches)
2. [Unit Testing API Methods](#unit-testing-api-methods)
3. [Integration Testing Workflows](#integration-testing-workflows)
4. [Manual Testing in Foundry](#manual-testing-in-foundry)
5. [Test Scenarios](#test-scenarios)
6. [Automated Test Examples](#automated-test-examples)

---

## Testing Approaches

### 1. Unit Tests (Vitest)
Test individual API methods in isolation.

**Location:** `tests/api/*.test.ts`
**Framework:** Vitest (already configured)
**What to test:** Pure functions, Redux actions, API methods

### 2. Integration Tests (Vitest)
Test complete workflows that span multiple API calls.

**Location:** `tests/integration/*.test.ts`
**Framework:** Vitest
**What to test:** Character creation → crew assignment → action rolls → consequences

### 3. Manual Tests (Foundry Console)
Test macros directly in Foundry VTT browser console.

**Location:** Foundry VTT world, browser console (F12)
**What to test:** Full user experience, UI interactions, edge cases

---

## Unit Testing API Methods

### Test File Structure

```typescript
// tests/api/characterApi.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('CharacterAPI', () => {
  let store;
  let api;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  it('should create a character with starting traits and action dots', () => {
    const characterId = api.character.create({
      name: 'Sergeant Kane',
      traits: [
        { name: 'Elite Infantry', category: 'role', disabled: false },
        { name: 'Hive Gang Survivor', category: 'background', disabled: false }
      ],
      actionDots: {
        shoot: 3,
        command: 2,
        skirmish: 1,
        skulk: 0,
        wreck: 0,
        finesse: 0,
        survey: 2,
        study: 1,
        tech: 0,
        attune: 0,
        consort: 1,
        sway: 2
      }
    });

    expect(characterId).toBeDefined();

    const character = api.character.getCharacter(characterId);
    expect(character.name).toBe('Sergeant Kane');
    expect(character.traits).toHaveLength(2);
    expect(character.actionDots.shoot).toBe(3);
  });

  it('should validate starting action dots total to 12', () => {
    expect(() => {
      api.character.create({
        name: 'Invalid Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false }
        ],
        actionDots: {
          shoot: 4,
          command: 4,
          skirmish: 4,
          skulk: 4, // Total > 12
          wreck: 0,
          finesse: 0,
          survey: 0,
          study: 0,
          tech: 0,
          attune: 0,
          consort: 0,
          sway: 0
        }
      });
    }).toThrow();
  });

  it('should add a trait to character', () => {
    const characterId = api.character.create({ /* ... */ });

    const traitId = api.character.addTrait({
      characterId,
      trait: {
        name: 'Survived Ambush',
        category: 'scar',
        disabled: false,
        description: 'Lived through a brutal ambush'
      }
    });

    expect(traitId).toBeDefined();

    const character = api.character.getCharacter(characterId);
    expect(character.traits).toHaveLength(3);
    expect(character.traits.find(t => t.id === traitId).name).toBe('Survived Ambush');
  });

  it('should set action dots to specific value', () => {
    const characterId = api.character.create({ /* ... */ });

    api.character.setActionDots({
      characterId,
      action: 'shoot',
      dots: 4
    });

    const character = api.character.getCharacter(characterId);
    expect(character.actionDots.shoot).toBe(4);
  });

  it('should reject action dots outside 0-4 range', () => {
    const characterId = api.character.create({ /* ... */ });

    expect(() => {
      api.character.setActionDots({
        characterId,
        action: 'shoot',
        dots: 5 // Invalid
      });
    }).toThrow('Action dots must be between 0 and 4');
  });

  it('should lean into trait and gain 2 Momentum', () => {
    const characterId = api.character.create({ /* ... */ });
    const crewId = api.crew.create('Strike Team Alpha');
    api.crew.addCharacter({ crewId, characterId });

    const character = api.character.getCharacter(characterId);
    const traitId = character.traits[0].id;

    const result = api.character.leanIntoTrait({
      characterId,
      traitId,
      crewId
    });

    expect(result.momentumGained).toBe(2);
    expect(result.traitDisabled).toBe(true);

    const updatedCharacter = api.character.getCharacter(characterId);
    expect(updatedCharacter.traits.find(t => t.id === traitId).disabled).toBe(true);

    const crew = api.crew.getCrew(crewId);
    expect(crew.currentMomentum).toBe(7); // Started at 5, gained 2
  });
});
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test characterApi.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

---

## Integration Testing Workflows

### Complete Character Creation Workflow

```typescript
// tests/integration/characterCreation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('Character Creation Workflow', () => {
  let store;
  let api;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  it('should complete full character creation and crew assignment', () => {
    // Step 1: Create crew
    const crewId = api.crew.create('Strike Team Alpha');
    expect(crewId).toBeDefined();

    // Step 2: Create character with starting traits and action dots
    const characterId = api.character.create({
      name: 'Sergeant Kane',
      traits: [
        { name: 'Elite Infantry', category: 'role', disabled: false },
        { name: 'Hive Gang Survivor', category: 'background', disabled: false }
      ],
      actionDots: {
        shoot: 3, command: 2, skirmish: 1, skulk: 0,
        wreck: 0, finesse: 0, survey: 2, study: 1,
        tech: 0, attune: 0, consort: 1, sway: 2
      }
    });

    // Step 3: Add character to crew
    api.crew.addCharacter({ crewId, characterId });

    // Step 4: Verify crew membership
    const crew = api.crew.getCrew(crewId);
    expect(crew.characters).toContain(characterId);
    expect(crew.currentMomentum).toBe(5); // Starting Momentum

    // Step 5: Add equipment
    const equipmentId = api.character.addEquipment({
      characterId,
      equipment: {
        name: 'Lasgun',
        tier: 'accessible',
        category: 'weapon',
        description: 'Standard issue energy rifle'
      }
    });

    // Verify final state
    const character = api.character.getCharacter(characterId);
    expect(character.traits).toHaveLength(2);
    expect(character.equipment).toHaveLength(1);
    expect(character.equipment[0].name).toBe('Lasgun');
    expect(character.rallyAvailable).toBe(true);
  });
});
```

### Action Roll to Harm Workflow

```typescript
describe('Action Roll → Harm Workflow', () => {
  it('should apply harm consequence from failed risky roll', () => {
    // Setup
    const crewId = api.crew.create('Team');
    const characterId = api.character.create({ /* ... */ });
    api.crew.addCharacter({ crewId, characterId });

    // Simulate failed risky roll
    const result = api.action.applyConsequences({
      crewId,
      characterId,
      position: 'risky',
      effect: 'standard',
      result: 'failure',
      harmType: 'Physical Harm'
    });

    // Verify Momentum gained
    expect(result.momentumGenerated).toBe(2); // Risky failure = +2

    const crew = api.crew.getCrew(crewId);
    expect(crew.currentMomentum).toBe(7); // 5 + 2

    // Verify harm applied
    expect(result.harmApplied).toBeDefined();
    expect(result.harmApplied.segmentsAdded).toBe(2); // Risky = 2 segments
    expect(result.harmApplied.isDying).toBe(false);

    // Check harm clock
    const harmClocks = api.query.getHarmClocks(characterId);
    expect(harmClocks).toHaveLength(1);
    expect(harmClocks[0].segments).toBe(2);
    expect(harmClocks[0].maxSegments).toBe(6);
  });

  it('should mark character as dying at 6/6 harm', () => {
    const crewId = api.crew.create('Team');
    const characterId = api.character.create({ /* ... */ });
    api.crew.addCharacter({ crewId, characterId });

    // Take desperate/great harm (6 segments)
    const result = api.harm.take({
      characterId,
      harmType: 'Physical Harm',
      position: 'desperate',
      effect: 'great'
    });

    expect(result.segmentsAdded).toBe(6);
    expect(result.isDying).toBe(true);

    const isDying = api.query.isDying(characterId);
    expect(isDying).toBe(true);
  });
});
```

### Momentum Economy Workflow

```typescript
describe('Momentum Economy', () => {
  it('should handle complete Momentum cycle', () => {
    const crewId = api.crew.create('Team');
    const characterId = api.character.create({ /* ... */ });
    api.crew.addCharacter({ crewId, characterId });

    // Start at 5
    expect(api.query.getMomentum(crewId)).toBe(5);

    // Spend 1 for Push
    api.action.push({ crewId, type: 'extra-die' });
    expect(api.query.getMomentum(crewId)).toBe(4);

    // Spend 1 for Flashback
    api.action.flashback({
      crewId,
      characterId,
      trait: {
        name: 'Studied the Enemy',
        disabled: false
      }
    });
    expect(api.query.getMomentum(crewId)).toBe(3);

    // Gain 2 from leaning into trait
    const character = api.character.getCharacter(characterId);
    const traitId = character.traits[0].id;
    api.character.leanIntoTrait({ characterId, traitId, crewId });
    expect(api.query.getMomentum(crewId)).toBe(5);

    // Gain 2 from risky consequence
    api.crew.addMomentum({ crewId, amount: 2 });
    expect(api.query.getMomentum(crewId)).toBe(7);

    // Try Rally (should fail - need 0-3 Momentum)
    expect(() => {
      api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 2
      });
    }).toThrow('Rally only available at 0-3 Momentum');

    // Spend down to 3
    api.action.push({ crewId, type: 'extra-die' });
    api.action.push({ crewId, type: 'extra-die' });
    api.action.push({ crewId, type: 'extra-die' });
    api.action.push({ crewId, type: 'extra-die' });
    expect(api.query.getMomentum(crewId)).toBe(3);

    // Now Rally works
    const rallyResult = api.character.useRally({
      characterId,
      crewId,
      traitId,
      momentumToSpend: 2
    });
    expect(rallyResult.rallyUsed).toBe(true);
    expect(rallyResult.traitReEnabled).toBe(true);
    expect(api.query.getMomentum(crewId)).toBe(1);

    // Verify trait re-enabled
    const updatedCharacter = api.character.getCharacter(characterId);
    expect(updatedCharacter.traits.find(t => t.id === traitId).disabled).toBe(false);

    // Perform Reset
    const resetResult = api.crew.performReset(crewId);
    expect(resetResult.newMomentum).toBe(5);
    expect(api.query.getMomentum(crewId)).toBe(5);

    // Rally should be available again
    expect(api.query.canUseRally({ characterId, crewId })).toBe(true);
  });
});
```

---

## Manual Testing in Foundry

### Setup Test Environment

1. **Start Foundry VTT** with FitGD system
2. **Create test world** or use existing world
3. **Open browser console** (F12)
4. **Create test actors:**

```javascript
// In Foundry console
// Create crew
const crewActor = await Actor.create({
  name: 'Test Crew',
  type: 'crew'
});

// Create character
const charActor = await Actor.create({
  name: 'Test Character',
  type: 'character'
});

// Get Redux IDs
const crewId = crewActor.getFlag('forged-in-the-grimdark', 'reduxId');
const characterId = charActor.getFlag('forged-in-the-grimdark', 'reduxId');
```

### Test Macro Execution

```javascript
// Test 1: Add Momentum
console.log('Before:', game.fitgd.api.query.getMomentum(crewId));
game.fitgd.api.crew.addMomentum({ crewId, amount: 2 });
console.log('After:', game.fitgd.api.query.getMomentum(crewId));
// Expected: +2 Momentum

// Test 2: Set Action Dots
const char = game.fitgd.api.character.getCharacter(characterId);
console.log('Before:', char.actionDots.shoot);
game.fitgd.api.character.setActionDots({
  characterId,
  action: 'shoot',
  dots: 3
});
const charAfter = game.fitgd.api.character.getCharacter(characterId);
console.log('After:', charAfter.actionDots.shoot);
// Expected: 3

// Test 3: Lean into Trait
const traits = game.fitgd.api.character.getAvailableTraits(characterId);
console.log('Available traits:', traits.length);
if (traits.length > 0) {
  game.fitgd.api.character.leanIntoTrait({
    characterId,
    traitId: traits[0].id,
    crewId
  });
  console.log('Momentum after leaning:', game.fitgd.api.query.getMomentum(crewId));
}
// Expected: Trait disabled, +2 Momentum

// Test 4: Take Harm
game.fitgd.api.harm.take({
  characterId,
  harmType: 'Physical Harm',
  position: 'risky',
  effect: 'standard'
});
const harmClocks = game.fitgd.api.query.getHarmClocks(characterId);
console.log('Harm clocks:', harmClocks);
// Expected: 1 clock with 3 segments (risky/standard)
```

### Test Error Handling

```javascript
// Test invalid action dots
try {
  game.fitgd.api.character.setActionDots({
    characterId,
    action: 'shoot',
    dots: 5 // Invalid
  });
} catch (error) {
  console.log('Caught error:', error.message);
}
// Expected: "Action dots must be between 0 and 4"

// Test Rally when not at low Momentum
try {
  game.fitgd.api.character.useRally({
    characterId,
    crewId,
    momentumToSpend: 2
  });
} catch (error) {
  console.log('Caught error:', error.message);
}
// Expected: "Rally only available at 0-3 Momentum"

// Test spending more Momentum than available
const currentMomentum = game.fitgd.api.query.getMomentum(crewId);
try {
  game.fitgd.api.crew.spendMomentum({
    crewId,
    amount: currentMomentum + 1
  });
} catch (error) {
  console.log('Caught error:', error.message);
}
// Expected: Error about insufficient Momentum
```

---

## Test Scenarios

### Essential Test Cases

1. **Character Creation**
   - ✅ Create with 2 starting traits
   - ✅ Distribute 12 action dots (max 3 per action at creation)
   - ✅ Verify default rally available
   - ✅ Reject >12 total dots
   - ✅ Reject >3 dots in single action at creation

2. **Crew Management**
   - ✅ Create crew with starting Momentum (5)
   - ✅ Add character to crew
   - ✅ Remove character from crew
   - ✅ Multiple characters in crew

3. **Momentum System**
   - ✅ Add Momentum (cap at 10)
   - ✅ Spend Momentum (validate sufficient)
   - ✅ Lose excess above 10
   - ✅ Reset to 5
   - ✅ Generate from consequences (Controlled +1, Risky +2, Desperate +4)

4. **Traits**
   - ✅ Add trait manually
   - ✅ Disable trait (lean in) → gain 2 Momentum
   - ✅ Re-enable trait (Rally) at 0-3 Momentum
   - ✅ Group 3 traits into 1
   - ✅ Add trait via Flashback (costs 1 Momentum)

5. **Harm & Clocks**
   - ✅ Create harm clock
   - ✅ Add segments based on Position/Effect
   - ✅ Max 3 harm clocks per character
   - ✅ 4th clock replaces lowest
   - ✅ Mark dying at 6/6
   - ✅ Recover segments
   - ✅ Convert to scar trait

6. **Action Rolls**
   - ✅ Roll with action dots
   - ✅ Roll with 0 dots (2d6 keep lowest)
   - ✅ Push (+1d, costs 1 Momentum)
   - ✅ Devil's Bargain (+1d, GM complication)
   - ✅ Bonus dice from assists
   - ✅ Apply consequences based on result

7. **Rally**
   - ✅ Only available at 0-3 Momentum
   - ✅ Re-enables disabled trait
   - ✅ Spends variable Momentum
   - ✅ One use per reset
   - ✅ Reset restores availability

8. **Reset**
   - ✅ Reset Momentum to 5
   - ✅ Reduce Addiction by 2
   - ✅ Restore Rally for all characters
   - ✅ Keep other state intact

### Edge Cases

1. **Boundary Conditions**
   - Momentum at 0
   - Momentum at 10
   - Harm clock at 5/6 (one segment from dying)
   - Harm clock at 6/6 (dying)
   - All 3 harm clocks filled

2. **Invalid Operations**
   - Add trait to non-existent character
   - Spend Momentum when crew not found
   - Rally when Momentum > 3
   - Rally when already used
   - Use stim when addicted

3. **Concurrent Operations**
   - Multiple players lean into traits simultaneously
   - Multiple players spend Momentum at same time
   - GM adds Momentum while player spends it

---

## Automated Test Examples

### Complete Test Suite

```bash
# Create test file structure
mkdir -p tests/api
mkdir -p tests/integration

# Run example test
npm test -- characterApi.test.ts
```

### Example: Character API Test Suite

```typescript
// tests/api/characterApi.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('CharacterAPI - Complete Test Suite', () => {
  let store, api, crewId, characterId;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);

    // Setup common test data
    crewId = api.crew.create('Test Crew');
    characterId = api.character.create({
      name: 'Test Character',
      traits: [
        { name: 'Role', category: 'role', disabled: false },
        { name: 'Background', category: 'background', disabled: false }
      ],
      actionDots: {
        shoot: 3, command: 2, skirmish: 1, skulk: 0,
        wreck: 0, finesse: 0, survey: 2, study: 1,
        tech: 0, attune: 0, consort: 1, sway: 2
      }
    });
    api.crew.addCharacter({ crewId, characterId });
  });

  describe('create()', () => {
    it('should create character with valid data', () => {
      const newCharId = api.character.create({ /* ... */ });
      expect(newCharId).toBeDefined();
    });

    it('should reject >12 total action dots', () => {
      expect(() => {
        api.character.create({ /* actionDots with total > 12 */ });
      }).toThrow();
    });
  });

  describe('addTrait()', () => {
    it('should add trait and return trait ID', () => {
      const traitId = api.character.addTrait({
        characterId,
        trait: {
          name: 'New Trait',
          category: 'scar',
          disabled: false
        }
      });

      expect(traitId).toBeDefined();

      const char = api.character.getCharacter(characterId);
      expect(char.traits).toHaveLength(3);
    });
  });

  describe('setActionDots()', () => {
    it('should set action dots to specific value', () => {
      api.character.setActionDots({
        characterId,
        action: 'shoot',
        dots: 4
      });

      const char = api.character.getCharacter(characterId);
      expect(char.actionDots.shoot).toBe(4);
    });

    it('should reject dots < 0', () => {
      expect(() => {
        api.character.setActionDots({
          characterId,
          action: 'shoot',
          dots: -1
        });
      }).toThrow();
    });

    it('should reject dots > 4', () => {
      expect(() => {
        api.character.setActionDots({
          characterId,
          action: 'shoot',
          dots: 5
        });
      }).toThrow();
    });
  });

  describe('leanIntoTrait()', () => {
    it('should disable trait and gain 2 Momentum', () => {
      const char = api.character.getCharacter(characterId);
      const traitId = char.traits[0].id;

      const result = api.character.leanIntoTrait({
        characterId,
        traitId,
        crewId
      });

      expect(result.traitDisabled).toBe(true);
      expect(result.momentumGained).toBe(2);

      const crew = api.crew.getCrew(crewId);
      expect(crew.currentMomentum).toBe(7);
    });
  });

  describe('useRally()', () => {
    it('should fail when Momentum > 3', () => {
      // Momentum starts at 5
      expect(() => {
        api.character.useRally({
          characterId,
          crewId,
          momentumToSpend: 2
        });
      }).toThrow('Rally only available at 0-3 Momentum');
    });

    it('should succeed when Momentum <= 3', () => {
      // Reduce to 3
      api.crew.setMomentum({ crewId, amount: 3 });

      // Disable a trait first
      const char = api.character.getCharacter(characterId);
      const traitId = char.traits[0].id;
      api.character.leanIntoTrait({ characterId, traitId, crewId });

      // Reset Momentum for test
      api.crew.setMomentum({ crewId, amount: 3 });

      // Rally should work
      const result = api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 2
      });

      expect(result.rallyUsed).toBe(true);
      expect(result.traitReEnabled).toBe(true);
      expect(result.newMomentum).toBe(1);
    });
  });
});
```

### Running Tests with Coverage

```bash
# Run all tests with coverage
npm run test:coverage

# Expected output:
# File                    | % Stmts | % Branch | % Funcs | % Lines
# -------------------------|---------|----------|---------|----------
# src/api/implementations/ |   95.2  |   87.3   |   98.1  |   94.8
# characterApi.ts          |   98.5  |   92.1   |  100.0  |   98.2
# crewApi.ts               |   96.3  |   85.7   |  100.0  |   95.9
# actionApi.ts             |   94.1  |   82.4   |   96.7  |   93.5
```

---

## Best Practices

### 1. Test Data Factories

Create helper functions for common test setups:

```typescript
// tests/helpers/factories.ts
export function createTestCharacter(api, overrides = {}) {
  return api.character.create({
    name: 'Test Character',
    traits: [
      { name: 'Role', category: 'role', disabled: false },
      { name: 'Background', category: 'background', disabled: false }
    ],
    actionDots: {
      shoot: 3, command: 2, skirmish: 1, skulk: 0,
      wreck: 0, finesse: 0, survey: 2, study: 1,
      tech: 0, attune: 0, consort: 1, sway: 2
    },
    ...overrides
  });
}

export function createTestCrew(api, name = 'Test Crew') {
  return api.crew.create(name);
}
```

### 2. Assertion Helpers

```typescript
// tests/helpers/assertions.ts
export function expectMomentum(api, crewId, expectedValue) {
  const momentum = api.query.getMomentum(crewId);
  expect(momentum).toBe(expectedValue);
}

export function expectTraitDisabled(api, characterId, traitId) {
  const char = api.character.getCharacter(characterId);
  const trait = char.traits.find(t => t.id === traitId);
  expect(trait.disabled).toBe(true);
}
```

### 3. Snapshot Testing

```typescript
it('should match character snapshot', () => {
  const characterId = createTestCharacter(api);
  const character = api.character.getCharacter(characterId);

  expect(character).toMatchSnapshot();
});
```

### 4. Test Isolation

Each test should be independent:

```typescript
beforeEach(() => {
  // Fresh store for each test
  store = configureStore();
  api = createGameAPI(store);
});

afterEach(() => {
  // Cleanup if needed
  store = null;
  api = null;
});
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm install
      - run: npm test
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Summary

### Testing Layers

1. **Unit Tests** - Individual API methods (fast, isolated)
2. **Integration Tests** - Complete workflows (realistic, comprehensive)
3. **Manual Tests** - Browser console (exploratory, user-facing)

### Coverage Goals

- Unit tests: **>90%** coverage
- Integration tests: **All critical workflows**
- Manual tests: **All macros verified in Foundry**

### Test Organization

```
tests/
├── api/              # Unit tests for API methods
├── integration/      # Workflow tests
├── helpers/          # Test utilities and factories
└── fixtures/         # Test data
```

### Next Steps

1. Create `tests/api/characterApi.test.ts`
2. Run `npm test` to verify
3. Add integration tests for key workflows
4. Set up CI/CD pipeline
5. Reach 90% coverage before release

---

Happy testing! 🎲
