import type { Store } from '@reduxjs/toolkit';
import {
  createCrew,
  addCharacterToCrew,
  removeCharacterFromCrew,
  setMomentum,
  addMomentum,
  spendMomentum as spendMomentumAction,
} from '../../slices/crewSlice';
import { performMomentumReset } from '../../resources';

/**
 * Crew API Implementation
 *
 * High-level functions for crew management and Momentum
 */
export function createCrewAPI(store: Store) {
  return {
    /**
     * Create a new crew
     */
    create(name: string): string {
      store.dispatch(createCrew({ name }));

      const state = store.getState();
      return state.crews.allIds[state.crews.allIds.length - 1];
    },

    /**
     * Add character to crew
     */
    addCharacter(params: { crewId: string; characterId: string }): void {
      const { crewId, characterId } = params;
      store.dispatch(addCharacterToCrew({ crewId, characterId }));
    },

    /**
     * Remove character from crew
     */
    removeCharacter(params: { crewId: string; characterId: string }): void {
      const { crewId, characterId } = params;
      store.dispatch(removeCharacterFromCrew({ crewId, characterId }));
    },

    /**
     * Set Momentum (e.g., session start)
     */
    setMomentum(params: { crewId: string; amount: number }): number {
      const { crewId, amount } = params;

      store.dispatch(setMomentum({ crewId, amount }));

      const state = store.getState();
      return state.crews.byId[crewId]?.currentMomentum ?? 0;
    },

    /**
     * Add Momentum (from consequences, etc.)
     */
    addMomentum(params: { crewId: string; amount: number }): number {
      const { crewId, amount } = params;

      store.dispatch(addMomentum({ crewId, amount }));

      const state = store.getState();
      return state.crews.byId[crewId]?.currentMomentum ?? 0;
    },

    /**
     * Spend Momentum (for push, flashback, etc.)
     */
    spendMomentum(params: { crewId: string; amount: number }): number {
      const { crewId, amount } = params;

      const state = store.getState();
      const crew = state.crews.byId[crewId];

      if (!crew) {
        throw new Error(`Crew ${crewId} not found`);
      }

      if (crew.currentMomentum < amount) {
        throw new Error(`Insufficient Momentum (have ${crew.currentMomentum}, need ${amount})`);
      }

      // Use the proper spendMomentum action
      store.dispatch(spendMomentumAction({ crewId, amount }));

      const newState = store.getState();
      return newState.crews.byId[crewId]?.currentMomentum ?? 0;
    },

    /**
     * Perform complete Momentum Reset (end of act)
     */
    performReset(crewId: string) {
      return performMomentumReset(store, { crewId });
    },

    /**
     * Get crew
     */
    getCrew(crewId: string) {
      const state = store.getState();
      return state.crews.byId[crewId] ?? null;
    },

    /**
     * Get current Momentum
     */
    getMomentum(crewId: string): number {
      const state = store.getState();
      return state.crews.byId[crewId]?.currentMomentum ?? 0;
    },
  };
}
