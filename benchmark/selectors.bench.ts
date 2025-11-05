/**
 * Performance Benchmarks for Selectors
 *
 * Run with: pnpm run benchmark
 */

import { configureStore } from '../src/store';
import { createCharacter } from '../src/slices/characterSlice';
import { createCrew } from '../src/slices/crewSlice';
import { createClock } from '../src/slices/clockSlice';
import {
  selectCharacterById,
  selectAllCharacters,
  selectCharacterTraits,
} from '../src/selectors/characterSelectors';
import {
  selectCrewById,
  selectCurrentMomentum,
} from '../src/selectors/crewSelectors';
import {
  selectClockById,
  selectClocksByTypeAndEntity,
  selectHarmClocksByCharacter,
} from '../src/selectors/clockSelectors';

// Benchmark helper
function benchmark(name: string, fn: () => void, iterations = 10000): void {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const total = end - start;
  const average = total / iterations;

  console.log(`${name}:`);
  console.log(`  Total: ${total.toFixed(2)}ms`);
  console.log(`  Average: ${average.toFixed(4)}ms per call`);
  console.log(`  Ops/sec: ${(1000 / average).toFixed(0)}`);
  console.log();
}

// Setup test data
function setupTestData() {
  const store = configureStore();

  // Create 100 characters
  const characterIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const id = `char-${i}`;
    store.dispatch(
      createCharacter({
        id,
        name: `Character ${i}`,
        traits: [
          {
            id: `trait-${i}-1`,
            name: `Trait ${i}-1`,
            category: 'role',
            disabled: false,
            acquiredAt: Date.now(),
          },
          {
            id: `trait-${i}-2`,
            name: `Trait ${i}-2`,
            category: 'background',
            disabled: i % 2 === 0, // Half disabled
            acquiredAt: Date.now(),
          },
        ],
        actionDots: {
          shoot: 2,
          skirmish: 1,
          skulk: 1,
          wreck: 1,
          finesse: 1,
          survey: 1,
          study: 1,
          tech: 1,
          attune: 1,
          command: 1,
          consort: 1,
          sway: 0,
        },
      })
    );
    characterIds.push(id);
  }

  // Create 10 crews
  const crewIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = `crew-${i}`;
    store.dispatch(
      createCrew({
        id,
        name: `Crew ${i}`,
      })
    );
    crewIds.push(id);
  }

  // Create 300 clocks (3 per character)
  for (let i = 0; i < 100; i++) {
    const charId = characterIds[i];

    // Harm clocks
    store.dispatch(
      createClock({
        entityId: charId,
        clockType: 'harm',
        subtype: 'Physical Harm',
        maxSegments: 6,
      })
    );

    store.dispatch(
      createClock({
        entityId: charId,
        clockType: 'harm',
        subtype: 'Morale Harm',
        maxSegments: 6,
      })
    );

    // Progress clock for crew
    const crewId = crewIds[i % 10];
    store.dispatch(
      createClock({
        entityId: crewId,
        clockType: 'progress',
        subtype: `Project ${i}`,
        maxSegments: 8,
      })
    );
  }

  return { store, characterIds, crewIds };
}

// Run benchmarks
console.log('=== FitGD Selector Performance Benchmarks ===\n');
console.log('Setting up test data (100 characters, 10 crews, 300 clocks)...\n');

const { store, characterIds, crewIds } = setupTestData();
const state = store.getState();

console.log('=== Character Selectors ===\n');

benchmark('selectCharacterById', () => {
  selectCharacterById(state, characterIds[50]);
});

benchmark('selectAllCharacters', () => {
  selectAllCharacters(state);
});

benchmark('selectCharacterTraits', () => {
  selectCharacterTraits(state, characterIds[50]);
});

console.log('=== Crew Selectors ===\n');

benchmark('selectCrewById', () => {
  selectCrewById(state, crewIds[5]);
});

benchmark('selectCurrentMomentum', () => {
  selectCurrentMomentum(state, crewIds[5]);
});

console.log('=== Clock Selectors ===\n');

// Get a clock ID
const clockId = state.clocks.allIds[0];

benchmark('selectClockById', () => {
  selectClockById(state, clockId);
});

benchmark('selectHarmClocksByCharacter', () => {
  selectHarmClocksByCharacter(state, characterIds[50]);
});

benchmark('selectClocksByTypeAndEntity', () => {
  selectClocksByTypeAndEntity(state, 'harm', characterIds[50]);
});

console.log('=== Results Summary ===\n');
console.log('All selectors completed successfully.');
console.log('Memoization is working if repeated calls are fast.');
console.log();
console.log('Performance targets:');
console.log('  - Simple lookups: <0.01ms (>100k ops/sec)');
console.log('  - Filtered lookups: <0.1ms (>10k ops/sec)');
console.log('  - Complex queries: <1ms (>1k ops/sec)');
