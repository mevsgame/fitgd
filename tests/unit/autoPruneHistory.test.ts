import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import {
  createCharacter,
  addTrait,
  pruneOrphanedHistory as pruneOrphanedCharacterHistory,
} from '../../src/slices/characterSlice';
import {
  createCrew,
  addMomentum,
  pruneOrphanedCrewHistory,
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
import type { Approaches } from '../../src/types';

describe('Auto-Prune History', () => {
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
      store.dispatch(pruneOrphanedClockHistory({ validIds: new Set(store.getState().clocks.allIds) }));

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
      store.dispatch(pruneOrphanedClockHistory({ validIds: new Set(store.getState().clocks.allIds) }));

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

    it('should handle multiple deletions correctly', () => {
      const store = configureStore();

      // Create three clocks
      const clock1 = store.dispatch(
        createClock({
          entityId: 'entity-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      const clock2 = store.dispatch(
        createClock({
          entityId: 'entity-2',
          clockType: 'progress',
          maxSegments: 6,
        })
      );

      const clock3 = store.dispatch(
        createClock({
          entityId: 'entity-3',
          clockType: 'progress',
          maxSegments: 4,
        })
      );

      // Add segments to all
      store.dispatch(addSegments({ clockId: clock1.payload.id, amount: 2 }));
      store.dispatch(addSegments({ clockId: clock2.payload.id, amount: 3 }));
      store.dispatch(addSegments({ clockId: clock3.payload.id, amount: 1 }));

      // Verify we have 6 commands (3 creates + 3 addSegments)
      expect(store.getState().clocks.history.length).toBe(6);

      // Delete clock1 and clock2
      store.dispatch(deleteClock({ clockId: clock1.payload.id }));
      store.dispatch(deleteClock({ clockId: clock2.payload.id }));

      // Now have 8 commands (3 creates + 3 adds + 2 deletes)
      expect(store.getState().clocks.history.length).toBe(8);

      // Prune
      store.dispatch(pruneOrphanedClockHistory({ validIds: new Set(store.getState().clocks.allIds) }));

      const finalState = store.getState();

      // Should have 4 commands:
      // - 2 delete commands (audit trail)
      // - 1 create for clock3 (still exists)
      // - 1 addSegments for clock3 (still exists)
      expect(finalState.clocks.history.length).toBe(4);

      // Verify clock3's commands still exist
      const clock3Commands = finalState.clocks.history.filter(
        (cmd) =>
          cmd.payload &&
          typeof cmd.payload === 'object' &&
          'id' in cmd.payload &&
          cmd.payload.id === clock3.payload.id
      );

      expect(clock3Commands.length).toBe(1); // Just the create command

      const clock3AddCommand = finalState.clocks.history.find(
        (cmd) =>
          cmd.payload &&
          typeof cmd.payload === 'object' &&
          'clockId' in cmd.payload &&
          cmd.payload.clockId === clock3.payload.id &&
          cmd.type === 'clocks/addSegments'
      );

      expect(clock3AddCommand).toBeDefined();

      // Verify both delete commands exist
      const deleteCommands = finalState.clocks.history.filter(
        (cmd) => cmd.type === 'clocks/deleteClock'
      );

      expect(deleteCommands.length).toBe(2);
    });
  });

  describe('selectOrphanedCommands selector', () => {
    it('should identify orphaned commands correctly', () => {
      const store = configureStore();

      // Create clocks
      const clock1 = store.dispatch(
        createClock({
          entityId: 'entity-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      const clock2 = store.dispatch(
        createClock({
          entityId: 'entity-2',
          clockType: 'progress',
          maxSegments: 6,
        })
      );

      store.dispatch(addSegments({ clockId: clock1.payload.id, amount: 2 }));

      // No orphaned commands yet (all entities exist)
      let orphaned = selectOrphanedCommands(store.getState());
      expect(orphaned.clocks.length).toBe(0);
      expect(orphaned.total).toBe(0);

      // Delete clock1
      store.dispatch(deleteClock({ clockId: clock1.payload.id }));

      // Now clock1's create and addSegments commands are orphaned
      // (but NOT the delete command - that's kept for audit)
      orphaned = selectOrphanedCommands(store.getState());
      expect(orphaned.clocks.length).toBe(2); // create + addSegments
      expect(orphaned.total).toBe(2);

      // Delete commands should NOT be counted as orphaned
      const deleteCommand = store.getState().clocks.history.find(
        (cmd) => cmd.type === 'clocks/deleteClock'
      );
      expect(deleteCommand).toBeDefined();
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
          approaches: {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
          } as Approaches,
        })
      );

      store.dispatch(createCrew({ name: 'Test Crew' }));

      store.dispatch(
        createClock({
          entityId: 'entity-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      // Get orphaned commands (none should exist - all entities still exist)
      const orphanedCount = selectOrphanedCommandCount(store.getState());

      expect(orphanedCount).toBe(0);
    });

    it('should correctly count orphaned commands across all entity types', () => {
      const store = configureStore();

      // Create multiple clocks
      const clock1 = store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          maxSegments: 6,
        })
      );

      const clock2 = store.dispatch(
        createClock({
          entityId: 'char-2',
          clockType: 'harm',
          maxSegments: 6,
        })
      );

      const clock3 = store.dispatch(
        createClock({
          entityId: 'crew-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      // Add operations to clocks
      store.dispatch(addSegments({ clockId: clock1.payload.id, amount: 2 }));
      store.dispatch(addSegments({ clockId: clock2.payload.id, amount: 3 }));
      store.dispatch(addSegments({ clockId: clock3.payload.id, amount: 4 }));

      // Delete clock1 and clock2 (but not clock3)
      store.dispatch(deleteClock({ clockId: clock1.payload.id }));
      store.dispatch(deleteClock({ clockId: clock2.payload.id }));

      // Calculate orphaned commands
      const orphaned = selectOrphanedCommands(store.getState());

      // Clock1: 2 orphaned (create + addSegments)
      // Clock2: 2 orphaned (create + addSegments)
      // Clock3: 0 orphaned (still exists)
      // Delete commands: NOT orphaned (kept for audit)
      expect(orphaned.clocks.length).toBe(4);
      expect(orphaned.total).toBe(4);

      // Verify clock3's commands are NOT counted as orphaned
      const clock3CreateCommand = store.getState().clocks.history.find(
        (cmd) =>
          cmd.payload &&
          typeof cmd.payload === 'object' &&
          'id' in cmd.payload &&
          cmd.payload.id === clock3.payload.id
      );

      expect(clock3CreateCommand).toBeDefined();
    });
  });

  describe('pruneOrphanedHistory action behavior', () => {
    it('should do nothing if no commands are orphaned', () => {
      const store = configureStore();

      // Create entities that will persist
      store.dispatch(
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
          approaches: {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
          } as Approaches,
        })
      );

      store.dispatch(createCrew({ name: 'Crew 1' }));

      const clock = store.dispatch(
        createClock({
          entityId: 'entity-1',
          clockType: 'progress',
          maxSegments: 8,
        })
      );

      // Record history lengths before pruning
      const characterHistoryBefore = store.getState().characters.history.length;
      const crewHistoryBefore = store.getState().crews.history.length;
      const clockHistoryBefore = store.getState().clocks.history.length;

      // Prune all slices
      store.dispatch(pruneOrphanedCharacterHistory());
      store.dispatch(pruneOrphanedCrewHistory());
      store.dispatch(pruneOrphanedClockHistory({ validIds: new Set(store.getState().clocks.allIds) }));

      // History should be unchanged (no orphaned commands)
      expect(store.getState().characters.history.length).toBe(characterHistoryBefore);
      expect(store.getState().crews.history.length).toBe(crewHistoryBefore);
      expect(store.getState().clocks.history.length).toBe(clockHistoryBefore);
    });

    it('should preserve deletion commands for audit trail', () => {
      const store = configureStore();

      // Create multiple clocks
      const clocks = [];
      for (let i = 0; i < 5; i++) {
        const clock = store.dispatch(
          createClock({
            entityId: `entity-${i}`,
            clockType: 'progress',
            maxSegments: 8,
          })
        );
        clocks.push(clock.payload.id);
      }

      // Delete all clocks
      for (const clockId of clocks) {
        store.dispatch(deleteClock({ clockId }));
      }

      // Prune
      store.dispatch(pruneOrphanedClockHistory({ validIds: new Set(store.getState().clocks.allIds) }));

      const finalState = store.getState();

      // Should have exactly 5 delete commands (1 per clock)
      expect(finalState.clocks.history.length).toBe(5);

      // All should be delete commands
      const allAreDeletes = finalState.clocks.history.every(
        (cmd) => cmd.type === 'clocks/deleteClock'
      );

      expect(allAreDeletes).toBe(true);
    });
  });
});




