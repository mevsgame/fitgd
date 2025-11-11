import { configureStore } from '../../src/store';
import {
  createCharacter,
  addTrait,
  pruneOrphanedHistory as pruneOrphanedCharacterHistory,
} from '../../src/slices/characterSlice';
import {
  createCrew,
  addMomentum,
  pruneOrphanedHistory as pruneOrphanedCrewHistory,
} from '../../src/slices/crewSlice';
import {
  createClock,
  addSegments,
  deleteClock,
  pruneOrphanedHistory as pruneOrphanedClockHistory,
} from '../../src/slices/clockSlice';
import {
  selectOrphanedCommands,
  selectOrphanedCommandCount,
} from '../../src/selectors/historySelectors';
import type { ActionDots } from '../../src/types';

describe('Auto-Prune History', () => {
  describe('Character slice - pruneOrphanedHistory', () => {
    it('should identify orphaned commands after character deletion', () => {
      const store = configureStore();

      // Create character
      const result = store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits: [
            {
              id: 'trait-1',
              name: 'Soldier',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2',
              name: 'Veteran',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 2,
            skirmish: 1,
            skulk: 0,
            wreck: 0,
            finesse: 0,
            survey: 1,
            study: 0,
            tech: 0,
            attune: 0,
            command: 2,
            consort: 0,
            sway: 0,
          } as ActionDots,
        })
      );

      const characterId = result.payload.id;

      // Add trait (creates more commands)
      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-3',
            name: 'Battle Scarred',
            category: 'scar',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      // Manually remove character from state (simulating deletion)
      // Note: We don't have a deleteCharacter action yet, so we simulate
      const state = store.getState();
      state.characters.byId = {}; // Clear characters
      state.characters.allIds = [];

      // Check orphaned count
      const orphaned = selectOrphanedCommands(store.getState());

      // Should have 2 orphaned commands (createCharacter + addTrait)
      expect(orphaned.characters.length).toBe(2);
      expect(orphaned.total).toBe(2);
    });

    it('should prune orphaned commands when action dispatched', () => {
      const store = configureStore();

      // Create character
      const result = store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits: [
            {
              id: 'trait-1',
              name: 'Soldier',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2',
              name: 'Veteran',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 2,
            skirmish: 1,
            skulk: 0,
            wreck: 0,
            finesse: 0,
            survey: 1,
            study: 0,
            tech: 0,
            attune: 0,
            command: 2,
            consort: 0,
            sway: 0,
          } as ActionDots,
        })
      );

      const characterId = result.payload.id;

      // Add trait
      store.dispatch(
        addTrait({
          characterId,
          trait: {
            id: 'trait-3',
            name: 'Battle Scarred',
            category: 'scar',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      // Verify history before prune
      expect(store.getState().characters.history.length).toBe(2);

      // Simulate character deletion
      const state = store.getState();
      state.characters.byId = {};
      state.characters.allIds = [];

      // Dispatch prune action
      store.dispatch(pruneOrphanedCharacterHistory());

      // Verify history after prune - all commands should be removed
      // (since we don't have deleteCharacter command in history)
      expect(store.getState().characters.history.length).toBe(0);
    });

    it('should not prune commands for existing characters', () => {
      const store = configureStore();

      // Create two characters
      const char1 = store.dispatch(
        createCharacter({
          name: 'Character 1',
          traits: [
            {
              id: 'trait-1',
              name: 'Soldier',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2',
              name: 'Veteran',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 2,
            skirmish: 1,
            skulk: 0,
            wreck: 0,
            finesse: 0,
            survey: 1,
            study: 0,
            tech: 0,
            attune: 0,
            command: 2,
            consort: 0,
            sway: 0,
          } as ActionDots,
        })
      );

      const char2 = store.dispatch(
        createCharacter({
          name: 'Character 2',
          traits: [
            {
              id: 'trait-3',
              name: 'Officer',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-4',
              name: 'Noble',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 1,
            skirmish: 0,
            skulk: 0,
            wreck: 0,
            finesse: 1,
            survey: 1,
            study: 1,
            tech: 0,
            attune: 0,
            command: 3,
            consort: 2,
            sway: 2,
          } as ActionDots,
        })
      );

      // Delete only char1 (simulate)
      const state = store.getState();
      delete state.characters.byId[char1.payload.id];
      state.characters.allIds = state.characters.allIds.filter(
        (id) => id !== char1.payload.id
      );

      // Prune
      store.dispatch(pruneOrphanedCharacterHistory());

      const finalState = store.getState();

      // Char2's create command should still exist
      const char2CreateCommand = finalState.characters.history.find(
        (cmd) =>
          cmd.payload &&
          typeof cmd.payload === 'object' &&
          'id' in cmd.payload &&
          cmd.payload.id === char2.payload.id &&
          cmd.type === 'characters/createCharacter'
      );

      expect(char2CreateCommand).toBeDefined();
    });
  });

  describe('Crew slice - pruneOrphanedHistory', () => {
    it('should prune orphaned crew commands', () => {
      const store = configureStore();

      // Create crew
      const crew = store.dispatch(createCrew({ name: 'Strike Team' }));
      const crewId = crew.payload.id;

      // Add momentum
      store.dispatch(addMomentum({ crewId, amount: 2 }));

      // Verify history before
      expect(store.getState().crews.history.length).toBe(2);

      // Simulate crew deletion
      const state = store.getState();
      state.crews.byId = {};
      state.crews.allIds = [];

      // Prune
      store.dispatch(pruneOrphanedCrewHistory());

      // Verify all commands pruned
      expect(store.getState().crews.history.length).toBe(0);
    });
  });

  describe('Clock slice - pruneOrphanedHistory', () => {
    it('should prune orphaned clock commands but keep deletion commands', () => {
      const store = configureStore();

      // Create clock
      const clock = store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = clock.payload.id;

      // Add segments
      store.dispatch(addSegments({ clockId, amount: 3 }));

      // Delete clock (this creates a delete command)
      store.dispatch(deleteClock({ clockId }));

      // Verify history before prune
      const stateBefore = store.getState();
      expect(stateBefore.clocks.history.length).toBe(3); // create, addSegments, delete

      // Prune orphaned commands
      store.dispatch(pruneOrphanedClockHistory());

      // Verify history after prune
      const stateAfter = store.getState();

      // Only the deletion command should remain (for audit trail)
      expect(stateAfter.clocks.history.length).toBe(1);
      expect(stateAfter.clocks.history[0].type).toBe('clocks/deleteClock');
    });
  });

  describe('selectOrphanedCommands selector', () => {
    it('should calculate orphaned commands correctly', () => {
      const store = configureStore();

      // Create and then simulate deletion of entities
      const char = store.dispatch(
        createCharacter({
          name: 'Test Char',
          traits: [
            {
              id: 'trait-1',
              name: 'Soldier',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2',
              name: 'Veteran',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 2,
            skirmish: 1,
            skulk: 0,
            wreck: 0,
            finesse: 0,
            survey: 1,
            study: 0,
            tech: 0,
            attune: 0,
            command: 2,
            consort: 0,
            sway: 0,
          } as ActionDots,
        })
      );

      const crew = store.dispatch(createCrew({ name: 'Test Crew' }));

      const clock = store.dispatch(
        createClock({
          entityId: 'entity-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      // Simulate deletion
      const state = store.getState();
      state.characters.byId = {};
      state.characters.allIds = [];
      state.crews.byId = {};
      state.crews.allIds = [];
      state.clocks.byId = {};
      state.clocks.allIds = [];

      // Get orphaned commands
      const orphaned = selectOrphanedCommands(store.getState());

      expect(orphaned.characters.length).toBe(1);
      expect(orphaned.crews.length).toBe(1);
      expect(orphaned.clocks.length).toBe(1);
      expect(orphaned.total).toBe(3);
    });

    it('should report zero orphaned commands when all entities exist', () => {
      const store = configureStore();

      // Create entities
      store.dispatch(
        createCharacter({
          name: 'Test Char',
          traits: [
            {
              id: 'trait-1',
              name: 'Soldier',
              category: 'role',
              disabled: false,
              acquiredAt: Date.now(),
            },
            {
              id: 'trait-2',
              name: 'Veteran',
              category: 'background',
              disabled: false,
              acquiredAt: Date.now(),
            },
          ],
          actionDots: {
            shoot: 2,
            skirmish: 1,
            skulk: 0,
            wreck: 0,
            finesse: 0,
            survey: 1,
            study: 0,
            tech: 0,
            attune: 0,
            command: 2,
            consort: 0,
            sway: 0,
          } as ActionDots,
        })
      );

      store.dispatch(createCrew({ name: 'Test Crew' }));

      // Get orphaned commands (none should exist)
      const orphanedCount = selectOrphanedCommandCount(store.getState());

      expect(orphanedCount).toBe(0);
    });
  });
});
