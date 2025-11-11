import { configureStore } from '../../src/store';
import {
  createCharacter,
  addTrait,
  pruneOrphanedHistory as pruneOrphanedCharacterHistory,
  hydrateCharacters,
} from '../../src/slices/characterSlice';
import {
  createCrew,
  addMomentum,
  pruneOrphanedHistory as pruneOrphanedCrewHistory,
  hydrateCrews,
} from '../../src/slices/crewSlice';
import {
  createClock,
  addSegments,
  deleteClock,
  pruneOrphanedClockHistory,
} from '../../src/slices/clockSlice';
import {
  selectOrphanedCommands,
  selectOrphanedCommandCount,
} from '../../src/selectors/historySelectors';
import type { ActionDots } from '../../src/types';

describe('Auto-Prune History', () => {
  describe('Character slice - pruneOrphanedHistory', () => {
    it('should prune orphaned commands when character is deleted', () => {
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

      // Verify history before prune (2 commands: create + addTrait)
      expect(store.getState().characters.history.length).toBe(2);

      // Simulate deletion by hydrating with empty state (preserves history)
      store.dispatch(hydrateCharacters({}));

      // Verify character is gone but history remains
      expect(store.getState().characters.allIds.length).toBe(0);
      expect(store.getState().characters.history.length).toBe(2);

      // Dispatch prune action
      store.dispatch(pruneOrphanedCharacterHistory());

      // Verify history after prune - all commands should be removed
      // (since there's no deleteCharacter command in history)
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

      // Verify we have 2 commands
      expect(store.getState().characters.history.length).toBe(2);

      // Hydrate with only char2 (simulates char1 being deleted)
      const char2Data = store.getState().characters.byId[char2.payload.id];
      store.dispatch(hydrateCharacters({ [char2.payload.id]: char2Data }));

      // Verify only char2 exists now
      expect(store.getState().characters.allIds.length).toBe(1);
      expect(store.getState().characters.allIds[0]).toBe(char2.payload.id);

      // Prune
      store.dispatch(pruneOrphanedCharacterHistory());

      const finalState = store.getState();

      // Char2's create command should still exist, char1's should be gone
      expect(finalState.characters.history.length).toBe(1);

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

    it('should identify orphaned commands correctly', () => {
      const store = configureStore();

      // Create character and add trait
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

      store.dispatch(
        addTrait({
          characterId: result.payload.id,
          trait: {
            id: 'trait-3',
            name: 'Battle Scarred',
            category: 'scar',
            disabled: false,
            acquiredAt: Date.now(),
          },
        })
      );

      // No orphaned commands yet
      let orphaned = selectOrphanedCommands(store.getState());
      expect(orphaned.characters.length).toBe(0);

      // Delete character by hydrating with empty state
      store.dispatch(hydrateCharacters({}));

      // Now should have 2 orphaned commands
      orphaned = selectOrphanedCommands(store.getState());
      expect(orphaned.characters.length).toBe(2);
      expect(orphaned.total).toBe(2);
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

      // Verify history before (2 commands: create + addMomentum)
      expect(store.getState().crews.history.length).toBe(2);

      // Simulate crew deletion by hydrating with empty state
      store.dispatch(hydrateCrews({}));

      // Verify crew is gone but history remains
      expect(store.getState().crews.allIds.length).toBe(0);
      expect(store.getState().crews.history.length).toBe(2);

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

    it('should not prune commands for existing clocks', () => {
      const store = configureStore();

      // Create two clocks
      const clock1 = store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical',
        })
      );

      const clock2 = store.dispatch(
        createClock({
          entityId: 'char-2',
          clockType: 'harm',
          subtype: 'Morale',
        })
      );

      // Delete only clock1
      store.dispatch(deleteClock({ clockId: clock1.payload.id }));

      // Verify history (3 commands: create1, create2, delete1)
      expect(store.getState().clocks.history.length).toBe(3);

      // Prune
      store.dispatch(pruneOrphanedClockHistory());

      const finalState = store.getState();

      // Should have 2 commands: delete1 (audit) + create2 (still exists)
      expect(finalState.clocks.history.length).toBe(2);

      // Clock2's create command should still exist
      const clock2CreateCommand = finalState.clocks.history.find(
        (cmd) =>
          cmd.payload &&
          typeof cmd.payload === 'object' &&
          'id' in cmd.payload &&
          cmd.payload.id === clock2.payload.id &&
          cmd.type === 'clocks/createClock'
      );

      expect(clock2CreateCommand).toBeDefined();

      // Delete command should exist
      const deleteCommand = finalState.clocks.history.find(
        (cmd) => cmd.type === 'clocks/deleteClock'
      );

      expect(deleteCommand).toBeDefined();
    });
  });

  describe('selectOrphanedCommands selector', () => {
    it('should calculate orphaned commands correctly', () => {
      const store = configureStore();

      // Create entities
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

      // Simulate deletion by hydrating with empty states
      store.dispatch(hydrateCharacters({}));
      store.dispatch(hydrateCrews({}));
      store.dispatch(deleteClock({ clockId: clock.payload.id }));

      // Get orphaned commands
      const orphaned = selectOrphanedCommands(store.getState());

      expect(orphaned.characters.length).toBe(1);
      expect(orphaned.crews.length).toBe(1);
      // Clock has 1 create (orphaned), but delete is NOT orphaned (audit trail)
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
