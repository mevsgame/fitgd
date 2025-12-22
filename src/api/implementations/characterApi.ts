import type { Store } from '@reduxjs/toolkit';
import type { Trait, Approaches, Equipment } from '../../types';
import {
  createCharacter,
  addTrait as addTraitAction,
  disableTrait as disableTraitAction,
  enableTrait as enableTraitAction,
  removeTrait as removeTraitAction,
  updateTraitName as updateTraitNameAction,
  updateTraitDescription as updateTraitDescriptionAction,
  setApproach as setApproachAction,
  advanceApproach as advanceApproachAction,
  addEquipment,
  removeEquipment,
  useRally as useRallyAction,
  resetRally as resetRallyAction,
  addUnallocatedDots as addUnallocatedDotsAction,
} from '../../slices/characterSlice';
import {
  addMomentum,
  spendMomentum,
} from '../../slices/crewSlice';
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
    /**
     * Create a new character
     */
    create(params: {
      id?: string;
      name: string;
      traits: (Trait | Omit<Trait, 'id' | 'acquiredAt'>)[];
      approaches: Approaches;
    }): string {
      const id = params.id || generateId();
      const traits = params.traits.map(t => ({
        ...t,
        id: 'id' in t ? t.id : generateId(),
        acquiredAt: 'acquiredAt' in t ? t.acquiredAt : Date.now(),
      })) as Trait[];

      store.dispatch(
        createCharacter({
          id,
          name: params.name,
          traits,
          approaches: params.approaches,
        })
      );
      return id;
    },

    /**
     * Add a trait to character
     */
    addTrait(characterId: string, trait: Trait | Omit<Trait, 'id' | 'acquiredAt'>): string {
      const traitWithId = {
        ...trait,
        id: 'id' in trait ? trait.id : generateId(),
        acquiredAt: 'acquiredAt' in trait ? trait.acquiredAt : Date.now(),
      } as Trait;

      store.dispatch(addTraitAction({ characterId, trait: traitWithId }));
      return traitWithId.id;
    },

    /**
     * Remove a trait from character
     */
    removeTrait(characterId: string, traitId: string): void {
      store.dispatch(removeTraitAction({ characterId, traitId }));
    },

    /**
     * Update a trait's name
     */
    updateTraitName(characterId: string, traitId: string, name: string): void {
      store.dispatch(updateTraitNameAction({ characterId, traitId, name }));
    },

    /**
     * Update a trait's description
     */
    updateTraitDescription(characterId: string, traitId: string, description: string): void {
      store.dispatch(updateTraitDescriptionAction({ characterId, traitId, description }));
    },

    /**
     * Disable a trait
     */
    disableTrait(characterId: string, traitId: string): void {
      store.dispatch(disableTraitAction({ characterId, traitId }));
    },

    /**
     * Enable a trait
     */
    enableTrait(characterId: string, traitId: string): void {
      store.dispatch(enableTraitAction({ characterId, traitId }));
    },

    /**
     * Lean into a trait (disable it to gain momentum)
     */
    leanIntoTrait(params: {
      characterId: string;
      traitId: string;
      crewId: string;
    }) {
      const { characterId, traitId, crewId } = params;

      // Disable trait
      store.dispatch(disableTraitAction({ characterId, traitId }));

      // Gain momentum (standard +2 for leaning into trait)
      const momentumGained = 2;
      store.dispatch(addMomentum({ crewId, amount: momentumGained }));

      const state = store.getState();
      const crew = state.crews.byId[crewId];

      return {
        traitDisabled: true,
        momentumGained,
        newMomentum: crew.currentMomentum,
      };
    },

    /**
     * Group traits
     */
    groupTraits(params: {
      characterId: string;
      traitIds: string[];
      newTrait: Partial<Trait>;
    }): void {
      const { characterId, traitIds, newTrait } = params;

      // Remove old traits
      traitIds.forEach(traitId => {
        store.dispatch(removeTraitAction({ characterId, traitId }));
      });

      // Add new grouped trait
      const traitToAdd: Trait = {
        id: generateId(),
        name: newTrait.name || 'Grouped Trait',
        category: 'grouped',
        disabled: false,
        description: newTrait.description || '',
        acquiredAt: Date.now(),
        ...newTrait
      };

      store.dispatch(addTraitAction({ characterId, trait: traitToAdd }));
    },

    /**
     * Set approach dots
     */
    setApproach(params: {
      characterId: string;
      approach: keyof Approaches;
      dots: number;
    }): void {
      const { characterId, approach, dots } = params;
      // Validation happens in reducer
      store.dispatch(setApproachAction({ characterId, approach, dots }));
    },

    /**
     * Advance approach
     */
    advanceApproach(params: {
      characterId: string;
      approach: keyof Approaches;
    }): void {
      store.dispatch(advanceApproachAction(params));
    },

    /**
     * Add unallocated dots
     */
    addUnallocatedDots(params: { characterId: string; amount: number }): Promise<void> {
      store.dispatch(addUnallocatedDotsAction(params));
      return Promise.resolve();
    },

    /**
     * Add equipment
     */
    addEquipment(characterId: string, equipment: Equipment): void {
      store.dispatch(addEquipment({ characterId, equipment }));
    },

    /**
     * Remove equipment
     */
    removeEquipment(characterId: string, equipmentId: string): void {
      store.dispatch(removeEquipment({ characterId, equipmentId }));
    },

    /**
     * Use Rally
     */
    useRally(params: {
      characterId: string;
      crewId: string;
      traitId?: string;
      momentumToSpend: number;
    }) {
      const { characterId, crewId, traitId, momentumToSpend } = params;
      const state = store.getState();
      const character = state.characters.byId[characterId];
      const crew = state.crews.byId[crewId];

      if (!character) throw new Error(`Character ${characterId} not found`);
      if (!crew) throw new Error(`Crew ${crewId} not found`);

      if (!character.rallyAvailable) {
        throw new Error(`Rally already used for character ${characterId}`);
      }

      if (crew.currentMomentum > 3) {
        throw new Error('Rally only available at 0-3 Momentum');
      }

      // Spend momentum
      store.dispatch(spendMomentum({ crewId, amount: momentumToSpend }));

      // Re-enable trait if provided
      if (traitId) {
        store.dispatch(enableTraitAction({ characterId, traitId, userId: 'system' }));
      }

      // Mark rally used
      store.dispatch(useRallyAction({ characterId }));

      // Re-fetch state to get updated momentum
      const updatedState = store.getState();
      const updatedCrew = updatedState.crews.byId[crewId];

      return {
        rallyUsed: true,
        traitReEnabled: !!traitId,
        momentumSpent: momentumToSpend,
        newMomentum: updatedCrew.currentMomentum,
      };
    },

    /**
     * Reset Rally
     */
    resetRally(characterId: string): Promise<void> {
      store.dispatch(resetRallyAction({ characterId }));
      return Promise.resolve();
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

    /**
     * Can use rally?
     */
    canUseRally(characterId: string): boolean {
      const state = store.getState();
      const character = state.characters.byId[characterId];
      return character?.rallyAvailable ?? false;
    },
  };
}
