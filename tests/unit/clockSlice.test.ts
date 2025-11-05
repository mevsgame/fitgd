import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import clockReducer, {
  createClock,
  addSegments,
  clearSegments,
  deleteClock,
  updateMetadata,
  changeSubtype,
} from '../../src/slices/clockSlice';
import { DEFAULT_CONFIG } from '../../src/config';

describe('clockSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        clocks: clockReducer,
      },
    });
  });

  describe('createClock - harm clocks', () => {
    it('should create a harm clock with 6 max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock).toBeDefined();
      expect(clock.entityId).toBe('character-123');
      expect(clock.clockType).toBe('harm');
      expect(clock.subtype).toBe('Physical Harm');
      expect(clock.segments).toBe(0);
      expect(clock.maxSegments).toBe(DEFAULT_CONFIG.clocks.harm.segments); // 6
    });

    it('should index harm clock by entityId', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];

      expect(state.byEntityId['character-123']).toContain(clockId);
    });

    it('should index harm clock by type', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];

      expect(state.byType['harm']).toContain(clockId);
    });

    it('should index harm clock by typeAndEntity', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];

      expect(state.byTypeAndEntity['harm:character-123']).toContain(clockId);
    });

    it('should allow up to 3 harm clocks per character', () => {
      const characterId = 'character-123';

      // Create 3 harm clocks
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Shaken Morale',
        })
      );
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Psychic Corruption',
        })
      );

      const state = store.getState().clocks;
      const harmClocks = state.byTypeAndEntity[`harm:${characterId}`];

      expect(harmClocks).toHaveLength(3);
    });

    it('should replace clock with fewest segments when creating 4th harm clock', () => {
      const characterId = 'character-123';

      // Create 3 harm clocks with different segment counts
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );
      const clock1Id = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId: clock1Id, amount: 3 })); // 3 segments

      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Shaken Morale',
        })
      );
      const clock2Id = store.getState().clocks.allIds[1];
      store.dispatch(addSegments({ clockId: clock2Id, amount: 5 })); // 5 segments

      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Psychic Corruption',
        })
      );
      const clock3Id = store.getState().clocks.allIds[2];
      store.dispatch(addSegments({ clockId: clock3Id, amount: 2 })); // 2 segments (fewest)

      // Create 4th harm clock - should replace clock with 2 segments
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Exhaustion',
        })
      );

      const state = store.getState().clocks;
      const harmClocks = state.byTypeAndEntity[`harm:${characterId}`];

      // Should still have 3 clocks
      expect(harmClocks).toHaveLength(3);

      // Clock with 2 segments should be replaced
      const replacedClock = state.byId[clock3Id];
      expect(replacedClock.subtype).toBe('Exhaustion');
      expect(replacedClock.segments).toBe(2); // Segments remain
    });
  });

  describe('createClock - consumable clocks', () => {
    it('should create a common consumable clock with 8 max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'consumable',
          subtype: 'frag_grenades',
          rarity: 'common',
          tier: 'accessible',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.clockType).toBe('consumable');
      expect(clock.maxSegments).toBe(DEFAULT_CONFIG.clocks.consumable.segments.common); // 8
      expect(clock.metadata?.rarity).toBe('common');
      expect(clock.metadata?.tier).toBe('accessible');
      expect(clock.metadata?.frozen).toBe(false);
    });

    it('should create an uncommon consumable clock with 6 max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'consumable',
          subtype: 'melta_charges',
          rarity: 'uncommon',
          tier: 'accessible',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.maxSegments).toBe(DEFAULT_CONFIG.clocks.consumable.segments.uncommon); // 6
    });

    it('should create a rare consumable clock with 4 max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'consumable',
          subtype: 'plasma_cells',
          rarity: 'rare',
          tier: 'accessible',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.maxSegments).toBe(DEFAULT_CONFIG.clocks.consumable.segments.rare); // 4
    });

    it('should freeze consumable clock when filled', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'consumable',
          subtype: 'frag_grenades',
          rarity: 'common',
          tier: 'accessible',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Fill the clock (8 segments)
      store.dispatch(addSegments({ clockId, amount: 8 }));

      const clock = store.getState().clocks.byId[clockId];

      expect(clock.segments).toBe(8);
      expect(clock.metadata?.frozen).toBe(true);
      expect(clock.metadata?.tier).toBe('inaccessible'); // Downgraded
    });

    it('should freeze all other clocks of same subtype when one fills', () => {
      const crewId = 'crew-456';
      const subtype = 'frag_grenades';

      // Create multiple grenade clocks for different characters
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'consumable',
          subtype,
          rarity: 'common',
          tier: 'accessible',
        })
      );
      const clock1Id = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId: clock1Id, amount: 5 })); // 5/8

      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'consumable',
          subtype,
          rarity: 'common',
          tier: 'accessible',
        })
      );
      const clock2Id = store.getState().clocks.allIds[1];
      store.dispatch(addSegments({ clockId: clock2Id, amount: 3 })); // 3/8

      // Fill the first clock
      store.dispatch(addSegments({ clockId: clock1Id, amount: 3 })); // 8/8

      const state = store.getState().clocks;

      // First clock should be filled and frozen
      expect(state.byId[clock1Id].segments).toBe(8);
      expect(state.byId[clock1Id].metadata?.frozen).toBe(true);

      // Second clock should be frozen at 3 segments
      expect(state.byId[clock2Id].segments).toBe(3);
      expect(state.byId[clock2Id].metadata?.frozen).toBe(true);
    });
  });

  describe('createClock - addiction clock', () => {
    it('should create an addiction clock with 8 max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'addiction',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.clockType).toBe('addiction');
      expect(clock.maxSegments).toBe(DEFAULT_CONFIG.clocks.addiction.segments); // 8
      expect(clock.segments).toBe(0);
    });

    it('should allow only one addiction clock per crew', () => {
      const crewId = 'crew-456';

      // Create first addiction clock
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'addiction',
        })
      );

      // Attempt to create second addiction clock should fail
      expect(() => {
        store.dispatch(
          createClock({
            entityId: crewId,
            clockType: 'addiction',
          })
        );
      }).toThrow();
    });

    it('should reduce addiction clock by 2 on momentum reset', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'addiction',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Add 6 segments
      store.dispatch(addSegments({ clockId, amount: 6 }));

      // Reset (reduce by 2)
      store.dispatch(clearSegments({ clockId, amount: 2 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(4);
    });

    it('should not reduce addiction clock below 0', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'addiction',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Add 1 segment
      store.dispatch(addSegments({ clockId, amount: 1 }));

      // Reset (reduce by 2, but min is 0)
      store.dispatch(clearSegments({ clockId, amount: 2 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(0);
    });
  });

  describe('addSegments', () => {
    it('should add segments to a clock', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(addSegments({ clockId, amount: 3 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(3);
    });

    it('should not exceed max segments', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Try to add 10 segments (max is 6)
      expect(() => {
        store.dispatch(addSegments({ clockId, amount: 10 }));
      }).toThrow();
    });

    it('should reject negative segment amounts', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      expect(() => {
        store.dispatch(addSegments({ clockId, amount: -1 }));
      }).toThrow();
    });
  });

  describe('clearSegments', () => {
    it('should clear segments from a clock', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(addSegments({ clockId, amount: 5 }));
      store.dispatch(clearSegments({ clockId, amount: 2 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(3);
    });

    it('should not go below 0 segments', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(addSegments({ clockId, amount: 2 }));
      store.dispatch(clearSegments({ clockId, amount: 5 })); // Would go negative

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(0);
    });
  });

  describe('deleteClock', () => {
    it('should delete a clock and remove from all indexes', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(deleteClock({ clockId }));

      const state = store.getState().clocks;

      expect(state.byId[clockId]).toBeUndefined();
      expect(state.allIds).not.toContain(clockId);

      // When last clock is deleted, index entries are removed entirely
      expect(state.byEntityId['character-123']).toBeUndefined();
      expect(state.byType['harm']).toBeUndefined();
      expect(state.byTypeAndEntity['harm:character-123']).toBeUndefined();
    });
  });

  describe('updateMetadata', () => {
    it('should update clock metadata', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'consumable',
          subtype: 'frag_grenades',
          rarity: 'common',
          tier: 'accessible',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(
        updateMetadata({
          clockId,
          metadata: { frozen: true, tier: 'inaccessible' },
        })
      );

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.metadata?.frozen).toBe(true);
      expect(clock.metadata?.tier).toBe('inaccessible');
    });
  });

  describe('changeSubtype', () => {
    it('should change clock subtype (4th harm clock replacement)', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(addSegments({ clockId, amount: 2 }));

      store.dispatch(
        changeSubtype({
          clockId,
          newSubtype: 'Exhaustion',
        })
      );

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.subtype).toBe('Exhaustion');
      expect(clock.segments).toBe(2); // Segments remain
    });
  });

  describe('dying mechanics', () => {
    it('should mark character as dying when harm clock reaches 6/6', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      store.dispatch(addSegments({ clockId, amount: 6 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(6);
      expect(clock.maxSegments).toBe(6);
      // Application layer will check segments === maxSegments to determine dying
    });

    it('should reduce 6/6 harm clock to 5/6 after momentum reset', () => {
      store.dispatch(
        createClock({
          entityId: 'character-123',
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Fill clock to 6/6
      store.dispatch(addSegments({ clockId, amount: 6 }));

      // After momentum reset, reduce to 5/6
      store.dispatch(clearSegments({ clockId, amount: 1 }));

      const clock = store.getState().clocks.byId[clockId];
      expect(clock.segments).toBe(5);
    });
  });

  describe('progress clocks', () => {
    it('should create a 4-clock progress clock', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Infiltrate Underhive',
          maxSegments: 4,
          category: 'long-term-project',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.clockType).toBe('progress');
      expect(clock.maxSegments).toBe(4);
      expect(clock.segments).toBe(0);
      expect(clock.metadata?.category).toBe('long-term-project');
    });

    it('should create a 6-clock progress clock', () => {
      store.dispatch(
        createClock({
          entityId: 'character-789',
          clockType: 'progress',
          subtype: 'Earn Trust of Mechanicus',
          maxSegments: 6,
          category: 'personal-goal',
          description: 'Complete tasks for Tech-Priests',
        })
      );

      const state = store.getState().clocks;
      const clockId = state.allIds[0];
      const clock = state.byId[clockId];

      expect(clock.maxSegments).toBe(6);
      expect(clock.metadata?.category).toBe('personal-goal');
      expect(clock.metadata?.description).toBe('Complete tasks for Tech-Priests');
    });

    it('should create an 8-clock progress clock', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Establish Safe House',
          maxSegments: 8,
          category: 'long-term-project',
        })
      );

      const clock = store.getState().clocks.byId[store.getState().clocks.allIds[0]];
      expect(clock.maxSegments).toBe(8);
    });

    it('should create a 12-clock progress clock', () => {
      store.dispatch(
        createClock({
          entityId: 'campaign',
          clockType: 'progress',
          subtype: 'Stop the Heresy',
          maxSegments: 12,
          category: 'faction',
        })
      );

      const clock = store.getState().clocks.byId[store.getState().clocks.allIds[0]];
      expect(clock.maxSegments).toBe(12);
    });

    it('should create a countdown clock (threat)', () => {
      store.dispatch(
        createClock({
          entityId: 'scene-current',
          clockType: 'progress',
          subtype: 'Inquisitor Closes In',
          maxSegments: 4,
          category: 'threat',
          isCountdown: true,
        })
      );

      const clock = store.getState().clocks.byId[store.getState().clocks.allIds[0]];
      expect(clock.metadata?.category).toBe('threat');
      expect(clock.metadata?.isCountdown).toBe(true);
    });

    it('should reject invalid progress clock sizes', () => {
      expect(() => {
        store.dispatch(
          createClock({
            entityId: 'crew-456',
            clockType: 'progress',
            subtype: 'Invalid Clock',
            maxSegments: 5, // Not in [4, 6, 8, 12]
          })
        );
      }).toThrow();
    });

    it('should reject progress clock without maxSegments', () => {
      expect(() => {
        store.dispatch(
          createClock({
            entityId: 'crew-456',
            clockType: 'progress',
            subtype: 'Missing Size',
            // maxSegments missing
          } as any)
        );
      }).toThrow();
    });

    it('should allow adding and clearing segments on progress clocks', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Research Project',
          maxSegments: 8,
        })
      );

      const clockId = store.getState().clocks.allIds[0];

      // Add segments
      store.dispatch(addSegments({ clockId, amount: 3 }));
      expect(store.getState().clocks.byId[clockId].segments).toBe(3);

      // Add more
      store.dispatch(addSegments({ clockId, amount: 2 }));
      expect(store.getState().clocks.byId[clockId].segments).toBe(5);

      // Clear some
      store.dispatch(clearSegments({ clockId, amount: 1 }));
      expect(store.getState().clocks.byId[clockId].segments).toBe(4);
    });

    it('should index progress clocks by entityId', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Project 1',
          maxSegments: 6,
        })
      );

      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Project 2',
          maxSegments: 8,
        })
      );

      const state = store.getState().clocks;
      const crewClocks = state.byEntityId['crew-456'];

      expect(crewClocks).toHaveLength(2);
    });

    it('should index progress clocks by type', () => {
      store.dispatch(
        createClock({
          entityId: 'crew-456',
          clockType: 'progress',
          subtype: 'Project 1',
          maxSegments: 6,
        })
      );

      const state = store.getState().clocks;
      const progressClocks = state.byType['progress'];

      expect(progressClocks).toHaveLength(1);
    });
  });
});
