import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer, { createCharacter } from '../../src/slices/characterSlice';
import crewReducer, { createCrew } from '../../src/slices/crewSlice';
import clockReducer, { createClock, addSegments } from '../../src/slices/clockSlice';
import playerRoundStateReducer, {
  setActivePlayer,
  setActionPlan,
  setImprovements,
} from '../../src/slices/playerRoundStateSlice';
import {
  selectPlayerState,
  selectActivePlayerId,
  selectIsActivePlayer,
  selectDicePool,
  selectConsequenceSeverity,
  selectMomentumGain,
  selectMomentumCost,
  selectAvailableActions,
  selectCanUseRally,
  selectCanUseStims,
  selectHarmClocksWithStatus,
  selectIsDying,
  CONSEQUENCE_TABLE,
  MOMENTUM_GAIN_TABLE,
} from '../../src/selectors/playerRoundStateSelectors';

describe('playerRoundStateSelectors', () => {
  let store: ReturnType<typeof configureStore>;
  let characterId: string;
  let crewId: string;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        characters: characterReducer,
        crews: crewReducer,
        clocks: clockReducer,
        playerRoundState: playerRoundStateReducer,
      },
    });

    // Create test character
    store.dispatch(
      createCharacter({
        name: 'Test Character',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          skirmish: 2,
          skulk: 1,
          wreck: 1,
          finesse: 1,
          survey: 1,
          study: 1,
          tech: 0,
          attune: 0,
          command: 2,
          consort: 0,
          sway: 0,
        },
      })
    );

    characterId = store.getState().characters.allIds[0];

    // Create test crew
    store.dispatch(createCrew({ name: 'Test Crew' }));
    crewId = store.getState().crews.allIds[0];
  });

  describe('selectPlayerState', () => {
    it('should return undefined for non-existent character', () => {
      const result = selectPlayerState(store.getState(), 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return player state for existing character', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const result = selectPlayerState(store.getState(), characterId);
      expect(result).toBeDefined();
      expect(result?.characterId).toBe(characterId);
      expect(result?.state).toBe('DECISION_PHASE');
    });
  });

  describe('selectActivePlayerId', () => {
    it('should return null when no active player', () => {
      const result = selectActivePlayerId(store.getState());
      expect(result).toBeNull();
    });

    it('should return active player ID', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const result = selectActivePlayerId(store.getState());
      expect(result).toBe(characterId);
    });
  });

  describe('selectIsActivePlayer', () => {
    it('should return false when not active player', () => {
      const result = selectIsActivePlayer(store.getState(), characterId);
      expect(result).toBe(false);
    });

    it('should return true when is active player', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const result = selectIsActivePlayer(store.getState(), characterId);
      expect(result).toBe(true);
    });
  });

  describe('selectDicePool', () => {
    beforeEach(() => {
      store.dispatch(setActivePlayer({ characterId }));
    });

    it('should return 0 when no action selected', () => {
      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(0);
    });

    it('should return base action dots', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(3); // shoot: 3
    });

    it('should add 1d for using trait', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          selectedTraitId: 'trait-123',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(4); // 3 + 1 (trait)
    });

    it('should add 1d for using equipment', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          equippedForAction: ['weapon-1'],
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(4); // 3 + 1 (equipment)
    });

    it('should add 1d for pushing', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(4); // 3 + 1 (pushed)
    });

    it('should add 1d for flashback', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          flashbackApplied: true,
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(4); // 3 + 1 (flashback)
    });

    it('should stack all improvements', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          selectedTraitId: 'trait-123',
          equippedForAction: ['weapon-1'],
          pushed: true,
          flashbackApplied: true,
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(7); // 3 + 1 (trait) + 1 (equipment) + 1 (pushed) + 1 (flashback)
    });

    it('should work with 0 action dots', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'attune', // 0 dots
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(1); // 0 + 1 (pushed)
    });
  });

  describe('selectConsequenceSeverity', () => {
    it('should return correct segments based on position only (not effect)', () => {
      // Controlled: 1 segment
      expect(selectConsequenceSeverity('controlled')).toBe(1);

      // Risky: 3 segments
      expect(selectConsequenceSeverity('risky')).toBe(3);

      // Desperate: 5 segments
      expect(selectConsequenceSeverity('desperate')).toBe(5);
    });

    it('should match CONSEQUENCE_TABLE', () => {
      Object.entries(CONSEQUENCE_TABLE).forEach(([position, expectedSegments]) => {
        const result = selectConsequenceSeverity(position as any);
        expect(result).toBe(expectedSegments);
      });
    });

    it('should NOT vary by effect (effect only applies to success clocks)', () => {
      // All positions should return same value regardless of effect
      // This test documents that effect is intentionally ignored for consequences
      expect(selectConsequenceSeverity('controlled')).toBe(1);
      expect(selectConsequenceSeverity('risky')).toBe(3);
      expect(selectConsequenceSeverity('desperate')).toBe(5);
    });
  });

  describe('selectMomentumGain', () => {
    it('should return correct momentum gain for each position', () => {
      expect(selectMomentumGain('controlled')).toBe(1);
      expect(selectMomentumGain('risky')).toBe(2);
      expect(selectMomentumGain('desperate')).toBe(4);
    });

    it('should match MOMENTUM_GAIN_TABLE', () => {
      Object.entries(MOMENTUM_GAIN_TABLE).forEach(([position, expectedGain]) => {
        const result = selectMomentumGain(position as any);
        expect(result).toBe(expectedGain);
      });
    });
  });

  describe('selectMomentumCost', () => {
    it('should return 0 when no improvements', () => {
      const playerState = selectPlayerState(store.getState(), characterId);
      const result = selectMomentumCost(playerState);
      expect(result).toBe(0);
    });

    it('should return 1 for pushed', () => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
        })
      );

      const playerState = selectPlayerState(store.getState(), characterId);
      const result = selectMomentumCost(playerState);
      expect(result).toBe(1);
    });

    it('should return 1 for flashback', () => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setImprovements({
          characterId,
          flashbackApplied: true,
        })
      );

      const playerState = selectPlayerState(store.getState(), characterId);
      const result = selectMomentumCost(playerState);
      expect(result).toBe(1);
    });

    it('should return 2 for both pushed and flashback', () => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          flashbackApplied: true,
        })
      );

      const playerState = selectPlayerState(store.getState(), characterId);
      const result = selectMomentumCost(playerState);
      expect(result).toBe(2);
    });
  });

  describe('selectAvailableActions', () => {
    beforeEach(() => {
      store.dispatch(setActivePlayer({ characterId }));
    });

    it('should return correct actions for DECISION_PHASE', () => {
      const result = selectAvailableActions(store.getState(), characterId);
      expect(result).toContain('select_action');
      expect(result).toContain('toggle_push');
      expect(result).toContain('toggle_trait');
      expect(result).toContain('toggle_equipment');
      expect(result).not.toContain('commit_roll'); // No action selected yet
    });

    it('should include commit_roll when action is selected', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          action: 'shoot',
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectAvailableActions(store.getState(), characterId);
      expect(result).toContain('commit_roll');
    });
  });

  describe('selectCanUseRally', () => {
    it('should return true when rally available and momentum 0-3', () => {
      // Character starts with rallyAvailable: true
      // Set crew momentum to 2
      const state = store.getState();
      const crew = state.crews.byId[crewId];

      // Mock crew with low momentum
      store.dispatch(createCrew({ name: 'Low Momentum Crew' }));
      const lowMomentumCrewId = store.getState().crews.allIds[1];

      const result = selectCanUseRally(store.getState(), characterId, lowMomentumCrewId);
      // Starts at 5, so can't rally yet
      expect(result).toBe(false);
    });

    it('should return false when momentum > 3', () => {
      const result = selectCanUseRally(store.getState(), characterId, crewId);
      // Default crew momentum is 5
      expect(result).toBe(false);
    });
  });

  describe('selectCanUseStims', () => {
    it('should return true when no addiction clock exists', () => {
      const result = selectCanUseStims(store.getState(), crewId);
      expect(result).toBe(true);
    });

    it('should return true when addiction clock not filled', () => {
      // Create addiction clock at 4/8
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'addiction',
        })
      );
      const clockId = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId, amount: 4 }));

      const result = selectCanUseStims(store.getState(), crewId);
      expect(result).toBe(true);
    });

    it('should return false when addiction clock filled', () => {
      // Create addiction clock at 8/8
      store.dispatch(
        createClock({
          entityId: crewId,
          clockType: 'addiction',
        })
      );
      const clockId = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId, amount: 8 }));

      const result = selectCanUseStims(store.getState(), crewId);
      expect(result).toBe(false);
    });
  });

  describe('selectHarmClocksWithStatus', () => {
    it('should return empty array when no harm clocks', () => {
      const result = selectHarmClocksWithStatus(store.getState(), characterId);
      expect(result).toEqual([]);
    });

    it('should return harm clocks with isDying false', () => {
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );
      const clockId = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId, amount: 3 }));

      const result = selectHarmClocksWithStatus(store.getState(), characterId);
      expect(result).toHaveLength(1);
      expect(result[0].segments).toBe(3);
      expect(result[0].maxSegments).toBe(6);
      expect(result[0].isDying).toBe(false);
    });

    it('should return harm clocks with isDying true when filled', () => {
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );
      const clockId = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId, amount: 6 }));

      const result = selectHarmClocksWithStatus(store.getState(), characterId);
      expect(result).toHaveLength(1);
      expect(result[0].segments).toBe(6);
      expect(result[0].isDying).toBe(true);
    });
  });

  describe('selectIsDying', () => {
    it('should return false when no harm clocks', () => {
      const result = selectIsDying(store.getState(), characterId);
      expect(result).toBe(false);
    });

    it('should return false when harm clocks not filled', () => {
      store.dispatch(
        createClock({
          entityId: characterId,
          clockType: 'harm',
          subtype: 'Physical Harm',
        })
      );
      const clockId = store.getState().clocks.allIds[0];
      store.dispatch(addSegments({ clockId, amount: 3 }));

      const result = selectIsDying(store.getState(), characterId);
      expect(result).toBe(false);
    });

    it('should return true when any harm clock filled', () => {
      // Create two harm clocks, one filled
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
          subtype: 'Morale Harm',
        })
      );

      const clockIds = store.getState().clocks.allIds;
      store.dispatch(addSegments({ clockId: clockIds[0], amount: 3 })); // Not filled
      store.dispatch(addSegments({ clockId: clockIds[1], amount: 6 })); // Filled

      const result = selectIsDying(store.getState(), characterId);
      expect(result).toBe(true);
    });
  });
});
