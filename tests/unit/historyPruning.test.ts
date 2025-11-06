import { configureStore } from '../../src/store';
import { createCharacter, pruneHistory as pruneCharacterHistory } from '../../src/slices/characterSlice';
import { createCrew, pruneCrewHistory } from '../../src/slices/crewSlice';
import { createClock, pruneClockHistory } from '../../src/slices/clockSlice';
import {
  selectHistoryStats,
  selectTotalCommandCount,
  selectHistorySizeKB,
  selectIsHistoryEmpty,
} from '../../src/selectors/historySelectors';
import { createFoundryAdapter } from '../../src/adapters/foundry';
import type { ActionDots } from '../../src/types';

describe('History Pruning', () => {
  describe('Slice-level pruning', () => {
    it('should prune character history while maintaining state', () => {
      const store = configureStore();

      // Create characters
      store.dispatch(
        createCharacter({
          name: 'Test Character',
          traits: [
            { id: 'trait-1', name: 'Soldier', category: 'role', disabled: false, acquiredAt: Date.now() },
            { id: 'trait-2', name: 'Veteran', category: 'background', disabled: false, acquiredAt: Date.now() },
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

      // Verify history exists
      let state = store.getState();
      expect(state.characters.history.length).toBe(1);
      expect(state.characters.allIds.length).toBe(1);

      // Prune history
      store.dispatch(pruneCharacterHistory());

      // Verify history cleared but state maintained
      state = store.getState();
      expect(state.characters.history.length).toBe(0);
      expect(state.characters.allIds.length).toBe(1);
      expect(state.characters.byId[state.characters.allIds[0]].name).toBe('Test Character');
    });

    it('should prune crew history while maintaining state', () => {
      const store = configureStore();

      // Create crew
      store.dispatch(createCrew({ name: 'Strike Team Alpha' }));

      // Verify history exists
      let state = store.getState();
      expect(state.crews.history.length).toBe(1);
      expect(state.crews.allIds.length).toBe(1);

      // Prune history
      store.dispatch(pruneCrewHistory());

      // Verify history cleared but state maintained
      state = store.getState();
      expect(state.crews.history.length).toBe(0);
      expect(state.crews.allIds.length).toBe(1);
      expect(state.crews.byId[state.crews.allIds[0]].name).toBe('Strike Team Alpha');
    });

    it('should prune clock history while maintaining state', () => {
      const store = configureStore();

      // Create clock
      store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      // Verify history exists
      let state = store.getState();
      expect(state.clocks.history.length).toBe(1);
      expect(state.clocks.allIds.length).toBe(1);

      // Prune history
      store.dispatch(pruneClockHistory());

      // Verify history cleared but state maintained
      state = store.getState();
      expect(state.clocks.history.length).toBe(0);
      expect(state.clocks.allIds.length).toBe(1);
      expect(state.clocks.byId[state.clocks.allIds[0]].clockType).toBe('harm');
    });
  });

  describe('History statistics selectors', () => {
    it('should calculate accurate history stats', () => {
      const store = configureStore();

      // Create some entities
      store.dispatch(
        createCharacter({
          name: 'Character 1',
          traits: [
            { id: 'trait-1', name: 'Soldier', category: 'role', disabled: false, acquiredAt: Date.now() },
            { id: 'trait-2', name: 'Veteran', category: 'background', disabled: false, acquiredAt: Date.now() },
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

      store.dispatch(createCrew({ name: 'Crew 1' }));

      store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const state = store.getState();
      const stats = selectHistoryStats(state);

      expect(stats.characterCommands).toBe(1);
      expect(stats.crewCommands).toBe(1);
      expect(stats.clockCommands).toBe(1);
      expect(stats.totalCommands).toBe(3);
      expect(stats.estimatedSizeKB).toBeGreaterThanOrEqual(0); // 3 commands may round to 0KB
      expect(stats.oldestCommandTimestamp).not.toBeNull();
      expect(stats.newestCommandTimestamp).not.toBeNull();
    });

    it('should report empty history correctly', () => {
      const store = configureStore();
      const state = store.getState();

      expect(selectIsHistoryEmpty(state)).toBe(true);
      expect(selectTotalCommandCount(state)).toBe(0);
      expect(selectHistorySizeKB(state)).toBe(0);

      const stats = selectHistoryStats(state);
      expect(stats.oldestCommandTimestamp).toBeNull();
      expect(stats.newestCommandTimestamp).toBeNull();
      expect(stats.timeSpanHours).toBeNull();
    });

    it('should estimate history size approximately', () => {
      const store = configureStore();

      // Create 100 commands
      for (let i = 0; i < 100; i++) {
        store.dispatch(
          createCharacter({
            name: `Character ${i}`,
            traits: [
              { id: `trait-${i}-1`, name: 'Soldier', category: 'role', disabled: false, acquiredAt: Date.now() },
              { id: `trait-${i}-2`, name: 'Veteran', category: 'background', disabled: false, acquiredAt: Date.now() },
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
      }

      const state = store.getState();
      const sizeKB = selectHistorySizeKB(state);

      // 100 commands * ~150 bytes = ~15KB
      expect(sizeKB).toBeGreaterThan(10);
      expect(sizeKB).toBeLessThan(30);
    });
  });

  describe('Foundry adapter pruneAllHistory', () => {
    it('should prune all history across all slices', () => {
      const store = configureStore();
      const adapter = createFoundryAdapter(store);

      // Create entities in all slices
      store.dispatch(
        createCharacter({
          name: 'Character 1',
          traits: [
            { id: 'trait-1', name: 'Soldier', category: 'role', disabled: false, acquiredAt: Date.now() },
            { id: 'trait-2', name: 'Veteran', category: 'background', disabled: false, acquiredAt: Date.now() },
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

      store.dispatch(createCrew({ name: 'Crew 1' }));

      store.dispatch(
        createClock({
          entityId: 'char-1',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      // Verify history exists
      let stats = adapter.getHistoryStats();
      expect(stats.totalCommands).toBe(3);

      // Prune all history
      adapter.pruneAllHistory();

      // Verify all history cleared
      stats = adapter.getHistoryStats();
      expect(stats.totalCommands).toBe(0);
      expect(stats.characterCommands).toBe(0);
      expect(stats.crewCommands).toBe(0);
      expect(stats.clockCommands).toBe(0);

      // Verify state maintained
      const state = store.getState();
      expect(state.characters.allIds.length).toBe(1);
      expect(state.crews.allIds.length).toBe(1);
      expect(state.clocks.allIds.length).toBe(1);
    });

    it('should report accurate stats before and after pruning', () => {
      const store = configureStore();
      const adapter = createFoundryAdapter(store);

      // Create multiple entities
      for (let i = 0; i < 5; i++) {
        store.dispatch(
          createCharacter({
            name: `Character ${i}`,
            traits: [
              { id: `trait-${i}-1`, name: 'Soldier', category: 'role', disabled: false, acquiredAt: Date.now() },
              { id: `trait-${i}-2`, name: 'Veteran', category: 'background', disabled: false, acquiredAt: Date.now() },
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
      }

      const statsBefore = adapter.getHistoryStats();
      expect(statsBefore.totalCommands).toBe(5);
      expect(statsBefore.estimatedSizeKB).toBeGreaterThan(0);

      adapter.pruneAllHistory();

      const statsAfter = adapter.getHistoryStats();
      expect(statsAfter.totalCommands).toBe(0);
      expect(statsAfter.estimatedSizeKB).toBe(0);
    });
  });
});
