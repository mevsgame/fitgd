import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import crewReducer, {
  createCrew,
  addCharacterToCrew,
  removeCharacterFromCrew,
  setMomentum,
  addMomentum,
  spendMomentum,
  resetMomentum,
} from '../../src/slices/crewSlice';
import { DEFAULT_CONFIG } from '../../src/config';

describe('crewSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore();
  });

  describe('createCrew', () => {
    it('should create a crew with starting momentum of 5', () => {
      store.dispatch(createCrew({ name: 'Strike Team Alpha' }));

      const state = store.getState().crews;
      const crewId = state.allIds[0];
      const crew = state.byId[crewId];

      expect(crew).toBeDefined();
      expect(crew.name).toBe('Strike Team Alpha');
      expect(crew.currentMomentum).toBe(DEFAULT_CONFIG.crew.startingMomentum); // 5
      expect(crew.characters).toEqual([]);
    });
  });

  describe('character management', () => {
    let crewId: string;

    beforeEach(() => {
      store.dispatch(createCrew({ name: 'Test Crew' }));
      crewId = store.getState().crews.allIds[0];
    });

    it('should add a character to crew', () => {
      const characterId = 'char-123';

      store.dispatch(addCharacterToCrew({ crewId, characterId }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.characters).toHaveLength(1);
      expect(crew.characters[0]).toBe(characterId);
    });

    it('should remove a character from crew', () => {
      const characterId = 'char-123';

      store.dispatch(addCharacterToCrew({ crewId, characterId }));
      store.dispatch(removeCharacterFromCrew({ crewId, characterId }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.characters).toHaveLength(0);
    });

    it('should not add duplicate character IDs', () => {
      const characterId = 'char-123';

      store.dispatch(addCharacterToCrew({ crewId, characterId }));

      expect(() => {
        store.dispatch(addCharacterToCrew({ crewId, characterId }));
      }).toThrow();
    });
  });

  describe('momentum management', () => {
    let crewId: string;

    beforeEach(() => {
      store.dispatch(createCrew({ name: 'Test Crew' }));
      crewId = store.getState().crews.allIds[0];
    });

    it('should set momentum directly', () => {
      store.dispatch(setMomentum({ crewId, amount: 7 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(7);
    });

    it('should add momentum', () => {
      // Starts at 5
      store.dispatch(addMomentum({ crewId, amount: 2 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(7);
    });

    it('should cap momentum at 10', () => {
      store.dispatch(setMomentum({ crewId, amount: 9 }));
      store.dispatch(addMomentum({ crewId, amount: 4 })); // Would be 13

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(DEFAULT_CONFIG.crew.maxMomentum); // 10
    });

    it('should spend momentum', () => {
      // Starts at 5
      store.dispatch(spendMomentum({ crewId, amount: 2 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(3);
    });

    it('should reject spending more momentum than available', () => {
      // Starts at 5
      expect(() => {
        store.dispatch(spendMomentum({ crewId, amount: 6 }));
      }).toThrow();
    });

    it('should not allow negative momentum', () => {
      expect(() => {
        store.dispatch(setMomentum({ crewId, amount: -1 }));
      }).toThrow();
    });

    it('should reset momentum to starting value (5)', () => {
      store.dispatch(setMomentum({ crewId, amount: 2 }));
      store.dispatch(resetMomentum({ crewId }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(DEFAULT_CONFIG.crew.startingMomentum); // 5
    });
  });

  describe('momentum generation scenarios', () => {
    let crewId: string;

    beforeEach(() => {
      store.dispatch(createCrew({ name: 'Test Crew' }));
      crewId = store.getState().crews.allIds[0];
    });

    it('should generate momentum from Desperate consequence (+4)', () => {
      // Starts at 5
      store.dispatch(addMomentum({ crewId, amount: 4 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(9);
    });

    it('should generate momentum from Risky consequence (+2)', () => {
      // Starts at 5
      store.dispatch(addMomentum({ crewId, amount: 2 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(7);
    });

    it('should generate momentum from Controlled consequence (+1)', () => {
      // Starts at 5
      store.dispatch(addMomentum({ crewId, amount: 1 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(6);
    });

    it('should generate momentum from leaning into trait (+2)', () => {
      // Starts at 5
      store.dispatch(addMomentum({ crewId, amount: 2 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(7);
    });

    it('should lose excess momentum when capping', () => {
      store.dispatch(setMomentum({ crewId, amount: 8 }));
      store.dispatch(addMomentum({ crewId, amount: 4 })); // Would be 12, caps at 10

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(10); // Lost 2 momentum
    });
  });

  describe('momentum spending scenarios', () => {
    let crewId: string;

    beforeEach(() => {
      store.dispatch(createCrew({ name: 'Test Crew' }));
      crewId = store.getState().crews.allIds[0];
    });

    it('should spend 1 momentum for Push Yourself', () => {
      // Starts at 5
      store.dispatch(spendMomentum({ crewId, amount: 1 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(4);
    });

    it('should spend 1 momentum for Flashback', () => {
      // Starts at 5
      store.dispatch(spendMomentum({ crewId, amount: 1 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(4);
    });

    it('should allow spending to 0 momentum', () => {
      store.dispatch(spendMomentum({ crewId, amount: 5 }));

      const crew = store.getState().crews.byId[crewId];
      expect(crew.currentMomentum).toBe(0);
    });
  });
});



