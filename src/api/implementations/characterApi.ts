import type { Store } from '@reduxjs/toolkit';
import type { Trait, ActionDots, Equipment } from '../../types';
import {
  createCharacter,
  addTrait as addTraitAction,
  disableTrait,
  enableTrait,
  groupTraits,
  setActionDots as setActionDotsAction,
  advanceActionDots,
  addEquipment,
  removeEquipment,
  addUnallocatedDots as addUnallocatedDotsAction,
  useRally,
} from '../../slices/characterSlice';
import { addMomentum, spendMomentum } from '../../slices/crewSlice';
import { DEFAULT_CONFIG } from '../../config';
import { generateId } from '../../utils/uuid';

/**
 * Character API Implementation
 *
 * High-level functions for character actions
 */
export function createCharacterAPI(store: Store) {
  return {
    /**
     * Create a new character
     */
    create(params: {
      name: string;
      traits: Omit<Trait, 'id' | 'acquiredAt'>[];
      actionDots: ActionDots;
    }): string {
      const traits: Trait[] = params.traits.map((t) => ({
        ...t,
        id: generateId(),
        acquiredAt: Date.now(),
      }));

      store.dispatch(
        createCharacter({
          name: params.name,
          traits,
          actionDots: params.actionDots,
        })
      );

      const state = store.getState();
      return state.characters.allIds[state.characters.allIds.length - 1];
    },

    /**
     * Lean into a trait (disable it, gain +2 Momentum)
     */
    leanIntoTrait(params: {
      characterId: string;
      traitId: string;
      crewId: string;
    }): { traitDisabled: boolean; momentumGained: number; newMomentum: number } {
      const { characterId, traitId, crewId } = params;

      // Disable the trait
      store.dispatch(disableTrait({ characterId, traitId }));

      // Add 2 Momentum (rules: leaning into trait gives +2)
      const momentumGained = 2;
      store.dispatch(addMomentum({ crewId, amount: momentumGained }));

      const state = store.getState();
      const newMomentum = state.crews.byId[crewId]?.currentMomentum ?? 0;

      return {
        traitDisabled: true,
        momentumGained,
        newMomentum,
      };
    },

    /**
     * Use Rally (spend Momentum when low, re-enable trait)
     */
    useRally(params: {
      characterId: string;
      crewId: string;
      traitId?: string;
      momentumToSpend: number;
    }): {
      rallyUsed: boolean;
      traitReEnabled: boolean;
      momentumSpent: number;
      newMomentum: number;
    } {
      const { characterId, crewId, traitId, momentumToSpend } = params;

      const state = store.getState();
      const crew = state.crews.byId[crewId];
      const character = state.characters.byId[characterId];

      if (!crew) {
        throw new Error(`Crew ${crewId} not found`);
      }

      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      // Validate Momentum is 0-3
      const maxMomentumForRally =
        DEFAULT_CONFIG.rally?.maxMomentumToUse ?? 3;
      if (crew.currentMomentum > maxMomentumForRally) {
        throw new Error(
          `Rally only available at 0-${maxMomentumForRally} Momentum (current: ${crew.currentMomentum})`
        );
      }

      // Validate rally is available
      if (!character.rallyAvailable) {
        throw new Error('Rally already used this reset');
      }

      // Spend Momentum
      store.dispatch(spendMomentum({ crewId, amount: momentumToSpend }));

      // Mark rally as used
      store.dispatch(useRally({ characterId }));

      // Re-enable trait if provided
      let traitReEnabled = false;
      if (traitId) {
        store.dispatch(enableTrait({ characterId, traitId }));
        traitReEnabled = true;
      }

      const updatedState = store.getState();
      const newMomentum = updatedState.crews.byId[crewId].currentMomentum;

      return {
        rallyUsed: true,
        traitReEnabled,
        momentumSpent: momentumToSpend,
        newMomentum,
      };
    },

    /**
     * Advance action dots (milestone reward)
     */
    advanceActionDots(params: {
      characterId: string;
      action: keyof ActionDots;
    }): number {
      const { characterId, action } = params;

      store.dispatch(advanceActionDots({ characterId, action }));

      const state = store.getState();
      const character = state.characters.byId[characterId];

      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      return character.actionDots[action];
    },

    /**
     * Group three traits into one broader trait
     */
    groupTraits(params: {
      characterId: string;
      traitIds: [string, string, string];
      newTrait: Omit<Trait, 'id' | 'acquiredAt'>;
    }): string {
      const { characterId, traitIds, newTrait } = params;

      const traitWithId: Trait = {
        ...newTrait,
        id: generateId(),
        category: 'grouped',
        acquiredAt: Date.now(),
      };

      store.dispatch(
        groupTraits({
          characterId,
          traitIds,
          groupedTrait: traitWithId,
        })
      );

      return traitWithId.id;
    },

    /**
     * Add equipment to character
     */
    addEquipment(params: {
      characterId: string;
      equipment: Omit<Equipment, 'id'>;
    }): string {
      const { characterId, equipment } = params;

      const equipmentWithId: Equipment = {
        ...equipment,
        id: generateId(),
      };

      store.dispatch(addEquipment({ characterId, equipment: equipmentWithId }));

      return equipmentWithId.id;
    },

    /**
     * Remove equipment from character
     */
    removeEquipment(params: {
      characterId: string;
      equipmentId: string;
    }): void {
      const { characterId, equipmentId } = params;
      store.dispatch(removeEquipment({ characterId, equipmentId }));
    },

    /**
     * Add a trait to character
     */
    addTrait(params: {
      characterId: string;
      trait: Omit<Trait, 'id' | 'acquiredAt'>;
    }): string {
      const { characterId, trait } = params;

      const traitWithId: Trait = {
        ...trait,
        id: generateId(),
        acquiredAt: Date.now(),
      };

      store.dispatch(addTraitAction({ characterId, trait: traitWithId }));

      return traitWithId.id;
    },

    /**
     * Set action dots to a specific value
     */
    setActionDots(params: {
      characterId: string;
      action: keyof ActionDots;
      dots: number;
    }): number {
      const { characterId, action, dots } = params;

      if (dots < 0 || dots > 4) {
        throw new Error(`Action dots must be between 0 and 4 (got ${dots})`);
      }

      store.dispatch(setActionDotsAction({ characterId, action, dots }));

      const state = store.getState();
      const character = state.characters.byId[characterId];

      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      return character.actionDots[action];
    },

    /**
     * Add unallocated action dots (for GM rewards/milestones)
     */
    addUnallocatedDots(params: {
      characterId: string;
      amount: number;
    }): number {
      const { characterId, amount } = params;

      if (amount < 1) {
        throw new Error('Amount must be at least 1');
      }

      store.dispatch(addUnallocatedDotsAction({ characterId, amount }));

      const state = store.getState();
      const character = state.characters.byId[characterId];

      if (!character) {
        throw new Error(`Character ${characterId} not found`);
      }

      return character.unallocatedActionDots;
    },

    /**
     * Get character
     */
    getCharacter(characterId: string) {
      const state = store.getState();
      return state.characters.byId[characterId] ?? null;
    },

    /**
     * Get available (not disabled) traits
     */
    getAvailableTraits(characterId: string): Trait[] {
      const state = store.getState();
      const character = state.characters.byId[characterId];

      if (!character) {
        return [];
      }

      return character.traits.filter((t: Trait) => !t.disabled);
    },
  };
}
