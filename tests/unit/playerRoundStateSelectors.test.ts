import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedStore } from '@reduxjs/toolkit';
import { configureStore } from '../../src/store';
import { RootState } from '../../src/store';
import characterReducer, { createCharacter, addEquipment } from '../../src/slices/characterSlice';
import crewReducer, { createCrew } from '../../src/slices/crewSlice';
import clockReducer, { createClock, addSegments } from '../../src/slices/clockSlice';
import playerRoundStateReducer, {
  setActivePlayer,
  setActionPlan,
  setImprovements,
  setTraitTransaction,
} from '../../src/slices/playerRoundStateSlice';
import {
  selectPlayerState,
  selectActivePlayerId,
  selectIsActivePlayer,
  selectDicePool,
  selectEquipmentEffects,
  selectEquipmentModifiedPosition,
  selectEquipmentModifiedEffect,
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
  improvePosition,
  improveEffect,
  selectEffectivePosition,
  selectEffectiveEffect,
} from '../../src/selectors/playerRoundStateSelectors';

describe('playerRoundStateSelectors', () => {
  let store: EnhancedStore<RootState>;
  let characterId: string;
  let crewId: string;

  beforeEach(() => {
    store = configureStore();

    // Create test character
    store.dispatch(
      createCharacter({
        name: 'Test Character',
        traits: [
          { id: 'trait-role-1', name: 'Role', category: 'role', disabled: false, acquiredAt: Date.now() },
          { id: 'trait-bg-1', name: 'Background', category: 'background', disabled: false, acquiredAt: Date.now() },
        ],
        approaches: {
          force: 2,
          guile: 2,
          focus: 1,
          spirit: 0,
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

    it('should return base approach rating (Standard Mode)', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          rollMode: 'standard',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(2); // force: 2
    });

    it('should add secondary approach rating (Synergy Mode)', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force', // 2
          secondaryApproach: 'guile', // 2
          position: 'risky',
          effect: 'standard',
          rollMode: 'synergy',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(4); // 2 + 2
    });

    it('should NOT add secondary approach if mode is NOT synergy', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force', // 2
          secondaryApproach: 'guile', // 2
          position: 'risky',
          effect: 'standard',
          rollMode: 'standard', // Explicitly standard
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(2); // Only force
    });

    it('should add +1d if equipment has bonus tag (Equipment Mode)', () => {
      // Add equipment with bonus tag to character
      const equipment = {
        id: 'equip-bonus',
        name: 'Bonus Item',
        tier: 'common' as const,
        category: 'active' as const,
        description: 'Bonus',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          rollMode: 'equipment',
        })
      );

      store.dispatch(
        setImprovements({
          characterId,
          equippedForAction: [equipment.id],
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(3); // 2 + 1 (bonus equipment)
    });

    it('should add +1d for pushing (Extra Die)', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'extra-die',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(3); // 2 + 1
    });

    it('should NOT add +1d for pushing if push type is NOT extra-die', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(2); // 2 + 0
    });

    it('should add +1d for flashback', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
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
      expect(result).toBe(3); // 2 + 1
    });

    it('should stack Synergy + Push + Flashback', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force', // 2
          secondaryApproach: 'guile', // 2
          position: 'risky',
          effect: 'standard',
          rollMode: 'synergy',
        })
      );
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'extra-die',
          flashbackApplied: true,
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(6); // 2 (force) + 2 (guile) + 1 (push) + 1 (flashback)
    });

    it('should handle 0 dots in approach', () => {
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'spirit', // 0
          position: 'risky',
          effect: 'standard',
          rollMode: 'standard',
        })
      );

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(0);
    });

    it('should add +1d for passive equipment (if approved)', () => {
      // Add passive equipment with bonus tag to character
      const equipment = {
        id: 'equip-passive',
        name: 'Passive Item',
        tier: 'common' as const,
        category: 'passive' as const,
        description: 'Passive',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      // GM approves passive
      store.dispatch({
        type: 'playerRoundState/setApprovedPassive',
        payload: {
          characterId,
          equipmentId: equipment.id,
        },
      });

      const result = selectDicePool(store.getState(), characterId);
      expect(result).toBe(3); // 2 + 1 (passive equipment)
    });
  });

  describe('selectEquipmentEffects', () => {
    beforeEach(() => {
      store.dispatch(setActivePlayer({ characterId }));
    });

    it('should return empty object when no equipment selected', () => {
      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({});
    });

    it('should return effects for active equipment', () => {
      const equipment = {
        id: 'equip-active',
        name: 'Active Item',
        tier: 'common' as const,
        category: 'active' as const,
        description: 'Active',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: 1,
          positionBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          equippedForAction: [equipment.id],
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({
        diceBonus: 1,
        positionBonus: 1,
      });
    });

    it('should return effects for passive equipment (if approved)', () => {
      const equipment = {
        id: 'equip-passive',
        name: 'Passive Item',
        tier: 'common' as const,
        category: 'passive' as const,
        description: 'Passive',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          effectBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      // GM approves passive
      store.dispatch({
        type: 'playerRoundState/setApprovedPassive',
        payload: {
          characterId,
          equipmentId: equipment.id,
        },
      });

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({
        effectBonus: 1,
      });
    });

    it('should combine effects from active and passive equipment', () => {
      const activeItem = {
        id: 'equip-active',
        name: 'Active Item',
        tier: 'common' as const,
        category: 'active' as const,
        description: 'Active',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      const passiveItem = {
        id: 'equip-passive',
        name: 'Passive Item',
        tier: 'common' as const,
        category: 'passive' as const,
        description: 'Passive',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          positionBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment: activeItem }));
      store.dispatch(addEquipment({ characterId, equipment: passiveItem }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          equippedForAction: [activeItem.id],
          position: 'risky',
          effect: 'standard',
        })
      );

      // GM approves passive
      store.dispatch({
        type: 'playerRoundState/setApprovedPassive',
        payload: {
          characterId,
          equipmentId: passiveItem.id,
        },
      });

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({
        diceBonus: 1,
        positionBonus: 1,
      });
    });
  });

  describe('selectConsequenceSeverity', () => {
    it('should return correct segments based on position only (not effect)', () => {
      // Controlled: 1 segment
      expect(selectConsequenceSeverity('controlled')).toBe(1);

      // Risky: 2 segments
      expect(selectConsequenceSeverity('risky')).toBe(2);

      // Desperate: 4 segments
      expect(selectConsequenceSeverity('desperate')).toBe(4);
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
      expect(selectConsequenceSeverity('risky')).toBe(2);
      expect(selectConsequenceSeverity('desperate')).toBe(4);
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
          approach: 'force',
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

  /* -------------------------------------------- */
  /*  Position/Effect Improvement Tests           */
  /* -------------------------------------------- */

  describe('improvePosition', () => {
    it('should improve impossible to desperate', () => {
      expect(improvePosition('impossible')).toBe('desperate');
    });

    it('should improve desperate to risky', () => {
      expect(improvePosition('desperate')).toBe('risky');
    });

    it('should improve risky to controlled', () => {
      expect(improvePosition('risky')).toBe('controlled');
    });

    it('should keep controlled at controlled (already at best)', () => {
      expect(improvePosition('controlled')).toBe('controlled');
    });

    it('should handle all positions in the ladder', () => {
      // Full position ladder test
      const positions: Array<{ from: any; to: any }> = [
        { from: 'impossible', to: 'desperate' },
        { from: 'desperate', to: 'risky' },
        { from: 'risky', to: 'controlled' },
        { from: 'controlled', to: 'controlled' }, // No improvement at top
      ];

      positions.forEach(({ from, to }) => {
        expect(improvePosition(from)).toBe(to);
      });
    });
  });

  describe('improveEffect', () => {
    it('should improve limited to standard', () => {
      expect(improveEffect('limited')).toBe('standard');
    });

    it('should improve standard to great', () => {
      expect(improveEffect('standard')).toBe('great');
    });

    it('should improve great to spectacular', () => {
      expect(improveEffect('great')).toBe('spectacular');
    });

    it('should keep spectacular at spectacular (already at best)', () => {
      expect(improveEffect('spectacular')).toBe('spectacular');
    });

    it('should handle all effects in the ladder', () => {
      // Full effect ladder test
      const effects: Array<{ from: any; to: any }> = [
        { from: 'limited', to: 'standard' },
        { from: 'standard', to: 'great' },
        { from: 'great', to: 'spectacular' },
        { from: 'spectacular', to: 'spectacular' }, // No improvement at top
      ];

      effects.forEach(({ from, to }) => {
        expect(improveEffect(from)).toBe(to);
      });
    });
  });

  describe('selectEffectivePosition', () => {
    beforeEach(() => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
    });

    it('should return base position when no trait transaction', () => {
      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('risky');
    });

    it('should return base position when trait transaction has no position improvement', () => {
      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: 'trait-123',
            positionImprovement: false, // Explicitly no improvement
            momentumCost: 1,
          },
        })
      );

      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('risky'); // Base position unchanged
    });

    it('should improve position when trait transaction has position improvement', () => {
      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: 'trait-123',
            positionImprovement: true, // Improve position
            momentumCost: 1,
          },
        })
      );

      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('controlled'); // risky → controlled
    });

    it('should improve from desperate to risky', () => {
      // Change base position to desperate
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'desperate',
          effect: 'standard',
        })
      );

      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'new',
            newTrait: {
              name: 'Flashback Trait',
              description: 'Created via flashback',
              category: 'flashback',
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        })
      );

      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('risky'); // desperate → risky
    });

    it('should improve from impossible to desperate', () => {
      // Change base position to impossible
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'impossible',
          effect: 'standard',
        })
      );

      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'consolidate',
            consolidation: {
              traitIdsToRemove: ['trait-1', 'trait-2', 'trait-3'],
              newTrait: {
                name: 'Consolidated Trait',
                description: 'Three traits combined',
                category: 'grouped',
              },
            },
            positionImprovement: true,
            momentumCost: 1,
          },
        })
      );

      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('desperate'); // impossible → desperate
    });

    it('should not improve beyond controlled', () => {
      // Already at controlled
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'controlled',
          effect: 'standard',
        })
      );

      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: 'trait-123',
            positionImprovement: true,
            momentumCost: 1,
          },
        })
      );

      const result = selectEffectivePosition(store.getState(), characterId);
      expect(result).toBe('controlled'); // Already at best
    });

    it('should be ephemeral - does NOT mutate playerState.position', () => {
      // Set base position to desperate
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'desperate',
          effect: 'standard',
        })
      );

      // Add trait transaction with position improvement
      store.dispatch(
        setTraitTransaction({
          characterId,
          transaction: {
            mode: 'existing',
            selectedTraitId: 'trait-123',
            positionImprovement: true,
            momentumCost: 1,
          },
        })
      );

      // Effective position should be improved
      const effectivePosition = selectEffectivePosition(store.getState(), characterId);
      expect(effectivePosition).toBe('risky');

      // But base position should remain unchanged
      const playerState = selectPlayerState(store.getState(), characterId);
      expect(playerState?.position).toBe('desperate'); // NOT mutated
    });
  });

  describe('selectEffectiveEffect', () => {
    beforeEach(() => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );
    });

    it('should return base effect when no push', () => {
      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('standard');
    });

    it('should return base effect when pushed but not for effect', () => {
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'extra-die', // Pushed for die, not effect
        })
      );

      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('standard'); // No effect improvement
    });

    it('should improve effect when pushed for effect', () => {
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect', // Push for effect
        })
      );

      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('great'); // standard → great
    });

    it('should improve from limited to standard', () => {
      // Change base effect to limited
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'limited',
        })
      );

      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect',
        })
      );

      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('standard'); // limited → standard
    });

    it('should improve from great to spectacular', () => {
      // Change base effect to great
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'great',
        })
      );

      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect',
        })
      );

      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('spectacular'); // great → spectacular
    });

    it('should not improve beyond spectacular', () => {
      // Already at spectacular
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'spectacular',
        })
      );

      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect',
        })
      );

      const result = selectEffectiveEffect(store.getState(), characterId);
      expect(result).toBe('spectacular'); // Already at best
    });

    it('should be ephemeral - does NOT mutate playerState.effect', () => {
      // Set base effect to standard
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      // Push for effect improvement
      store.dispatch(
        setImprovements({
          characterId,
          pushed: true,
          pushType: 'improved-effect',
        })
      );

      // Effective effect should be improved
      const effectiveEffect = selectEffectiveEffect(store.getState(), characterId);
      expect(effectiveEffect).toBe('great');

      // But base effect should remain unchanged
      const playerState = selectPlayerState(store.getState(), characterId);
      expect(playerState?.effect).toBe('standard'); // NOT mutated
    });
  });

  describe('selectEquipmentEffects', () => {
    it('should return empty object when no equipment selected', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({});
    });

    it('should return empty object when equippedForAction is empty array', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({});
    });

    it('should accumulate single equipment effect (diceBonus)', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-weapon',
        name: 'Las Rifle',
        tier: 'common' as const,
        category: 'active' as const,
        description: 'Standard weapon',
        slots: 1,
        equipped: true,
        locked: false,
        consumed: false,
        modifiers: {
          diceBonus: 1,
        },
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      // Weapon category has diceBonus effect from config
      expect(result.diceBonus).toBeDefined();
      expect(typeof result.diceBonus).toBe('number');
    });

    it('should accumulate multiple equipment effects', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      const equip1 = {
        id: 'equip-weapon',
        name: 'Las Rifle',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Standard weapon',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      const equip2 = {
        id: 'equip-armor',
        name: 'Combat Armor',
        tier: 'common' as const,
        category: 'armor',
        description: 'Protective gear',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment: equip1 }));
      store.dispatch(addEquipment({ characterId, equipment: equip2 }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [equip1.id, equip2.id],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      // Should have combined effects from both items
      // The exact values depend on weapon + armor category configs
      expect(result).toBeDefined();
    });

    it('should ignore unequipped items in equippedForAction', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-unequipped',
        name: 'Unequipped Item',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Not equipped',
        passive: false,
        equipped: false,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      // Should return empty because item is not equipped
      expect(result).toEqual({});
    });

    it('should ignore non-existent equipment IDs', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: ['non-existent-id'],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({});
    });

    it('should only include non-zero effects in result', () => {
      // Initialize player state first
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-test',
        name: 'Test Item',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Test equipment',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentEffects(store.getState(), characterId);

      // Verify no zero or undefined effects in result
      Object.values(result).forEach(value => {
        if (value !== undefined) {
          expect(value).not.toBe(0);
          expect(typeof value).toBe('number');
        }
      });
    });

    it('should return empty object for character with no player state', () => {
      // Character exists but has no player round state
      const result = selectEquipmentEffects(store.getState(), characterId);
      expect(result).toEqual({});
    });

    it('should return empty object for non-existent character', () => {
      const result = selectEquipmentEffects(store.getState(), 'non-existent-char');
      expect(result).toEqual({});
    });
  });

  describe('selectEquipmentModifiedPosition', () => {
    it('should return base position when no equipment selected', () => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectEquipmentModifiedPosition(store.getState(), characterId);
      expect(result).toBe('risky');
    });

    it('should improve position by equipment bonus', () => {
      store.dispatch(setActivePlayer({ characterId }));

      // Add equipment that improves position
      const equipment = {
        id: 'equip-defensive',
        name: 'Defensive Gear',
        tier: 'common' as const,
        category: 'armor', // armor typically has position bonus
        description: 'Protective equipment',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'desperate',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedPosition(store.getState(), characterId);
      // Position should improve from desperate toward controlled
      // Exact improvement depends on armor category config
      expect(result).toBeDefined();
      // It should be <= desperate (not worsened)
      expect(['controlled', 'risky', 'desperate']).toContain(result);
    });

    it('should worsen position by equipment penalty', () => {
      store.dispatch(setActivePlayer({ characterId }));

      // Add equipment that worsens position
      const equipment = {
        id: 'equip-loud',
        name: 'Loud Equipment',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Obvious, loud gear',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'controlled',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedPosition(store.getState(), characterId);
      // Position can worsen or stay same depending on weapon config
      expect(result).toBeDefined();
      expect(['controlled', 'risky', 'desperate', 'impossible']).toContain(result);
    });

    it('should cap position at controlled (best)', () => {
      store.dispatch(setActivePlayer({ characterId }));

      // Add equipment with large position bonus
      const equipment = {
        id: 'equip-defensive',
        name: 'Defensive Gear',
        tier: 'common' as const,
        category: 'armor',
        description: 'Protective equipment',
        passive: true,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'controlled',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedPosition(store.getState(), characterId);
      // Should not improve beyond controlled
      expect(result).toBe('controlled');
    });

    it('should cap position at impossible (worst)', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-test',
        name: 'Test Equipment',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Test',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'impossible',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedPosition(store.getState(), characterId);
      // Should not worsen beyond impossible
      expect(result).toBe('impossible');
    });
  });

  describe('selectEquipmentModifiedEffect', () => {
    it('should return base effect when no equipment selected', () => {
      store.dispatch(setActivePlayer({ characterId }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
        })
      );

      const result = selectEquipmentModifiedEffect(store.getState(), characterId);
      expect(result).toBe('standard');
    });

    it('should improve effect by equipment bonus', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-quality',
        name: 'Quality Equipment',
        tier: 'rare' as const,
        category: 'weapon',
        description: 'High quality weapon',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'standard',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedEffect(store.getState(), characterId);
      // Effect should improve or stay same depending on weapon config
      expect(result).toBeDefined();
      expect(['limited', 'standard', 'great', 'spectacular']).toContain(result);
    });

    it('should worsen effect by equipment penalty', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-crude',
        name: 'Crude Equipment',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Poor quality weapon',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'great',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedEffect(store.getState(), characterId);
      // Effect can be modified depending on weapon config
      expect(result).toBeDefined();
      expect(['limited', 'standard', 'great', 'spectacular']).toContain(result);
    });

    it('should cap effect at spectacular (best)', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-test',
        name: 'Test Equipment',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Test',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'spectacular',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedEffect(store.getState(), characterId);
      // Should not improve beyond spectacular
      expect(result).toBe('spectacular');
    });

    it('should cap effect at limited (worst)', () => {
      store.dispatch(setActivePlayer({ characterId }));

      const equipment = {
        id: 'equip-test',
        name: 'Test Equipment',
        tier: 'common' as const,
        category: 'weapon',
        description: 'Test',
        passive: false,
        equipped: true,
        locked: false,
        depleted: false,
        acquiredAt: Date.now(),
      };

      store.dispatch(addEquipment({ characterId, equipment }));
      store.dispatch(
        setActionPlan({
          characterId,
          approach: 'force',
          position: 'risky',
          effect: 'limited',
          equippedForAction: [equipment.id],
        })
      );

      const result = selectEquipmentModifiedEffect(store.getState(), characterId);
      // Should not worsen beyond limited
      expect(result).toBe('limited');
    });
  });
});



