import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import {
  validateStartingTraits,
  validateStartingActionDots,
  validateActionDots,
  validateTraitCount,
  validateTraitGrouping,
  validateActionDotAdvancement,
  calculateTotalActionDots,
} from '../validators/characterValidator';
import { DEFAULT_CONFIG } from '../config';
import { isOrphanedCommand } from '../utils/commandUtils';
import type {
  Character,
  Trait,
  ActionDots,
  Equipment,
  Command,
} from '../types';

/**
 * Character Slice State
 */
export interface CharacterState {
  byId: Record<string, Character>;
  allIds: string[];
  history: Command[];
}

const initialState: CharacterState = {
  byId: {},
  allIds: [],
  history: [],
};

/**
 * Payload Types
 */
interface CreateCharacterPayload {
  name: string;
  traits: Trait[];
  actionDots: ActionDots;
  userId?: string;
}

interface AddTraitPayload {
  characterId: string;
  trait: Trait;
  userId?: string;
}

interface DisableTraitPayload {
  characterId: string;
  traitId: string;
  userId?: string;
}

interface EnableTraitPayload {
  characterId: string;
  traitId: string;
  userId?: string;
}

interface RemoveTraitPayload {
  characterId: string;
  traitId: string;
  userId?: string;
}

interface UpdateTraitNamePayload {
  characterId: string;
  traitId: string;
  name: string;
  userId?: string;
}

interface SetActionDotsPayload {
  characterId: string;
  action: keyof ActionDots;
  dots: number;
  userId?: string;
}

interface AddEquipmentPayload {
  characterId: string;
  equipment: Equipment;
  userId?: string;
}

interface RemoveEquipmentPayload {
  characterId: string;
  equipmentId: string;
  userId?: string;
}

interface UseRallyPayload {
  characterId: string;
  userId?: string;
}

interface ResetRallyPayload {
  characterId: string;
  userId?: string;
}

interface GroupTraitsPayload {
  characterId: string;
  traitIds: string[];
  groupedTrait: Trait;
  userId?: string;
}

interface CreateTraitFromFlashbackPayload {
  characterId: string;
  trait: Trait;
  userId?: string;
}

interface AdvanceActionDotsPayload {
  characterId: string;
  action: keyof ActionDots;
  userId?: string;
}

/**
 * Character Slice
 */
const characterSlice = createSlice({
  name: 'characters',
  initialState,
  reducers: {
    createCharacter: {
      reducer: (state, action: PayloadAction<Character>) => {
        const character = action.payload;
        state.byId[character.id] = character;
        state.allIds.push(character.id);

        // Log command to history
        state.history.push({
          type: 'characters/createCharacter',
          payload: character,
          timestamp: character.createdAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: CreateCharacterPayload) => {
        // Validate
        validateStartingTraits(payload.traits);
        validateStartingActionDots(payload.actionDots);

        const now = Date.now();

        // Calculate unallocated dots (12 - sum of allocated)
        const allocatedDots = calculateTotalActionDots(payload.actionDots);
        const unallocatedDots = DEFAULT_CONFIG.character.startingActionDots - allocatedDots;

        const character: Character = {
          id: generateId(),
          name: payload.name,
          traits: payload.traits,
          actionDots: payload.actionDots,
          unallocatedActionDots: unallocatedDots,
          equipment: [],
          rallyAvailable: true,
          createdAt: now,
          updatedAt: now,
        };

        // Create command for history
        const command: Command = {
          type: 'characters/createCharacter',
          payload: character,
          timestamp: now,
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload: character,
          meta: { command },
        };
      },
    },

    addTrait: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; trait: Trait }>
      ) => {
        const { characterId, trait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.traits.push(trait);
        character.updatedAt = Date.now();

        // Validate trait count if configured
        validateTraitCount(character);

        // Log command to history
        state.history.push({
          type: 'characters/addTrait',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: AddTraitPayload) => {
        const command: Command = {
          type: 'characters/addTrait',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    disableTrait: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; traitId: string }>
      ) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const trait = character.traits.find((t) => t.id === traitId);
        if (!trait) {
          throw new Error(
            `Trait ${traitId} not found on character ${characterId}`
          );
        }

        trait.disabled = true;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/disableTrait',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: DisableTraitPayload) => {
        const command: Command = {
          type: 'characters/disableTrait',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    enableTrait: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; traitId: string }>
      ) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const trait = character.traits.find((t) => t.id === traitId);
        if (!trait) {
          throw new Error(
            `Trait ${traitId} not found on character ${characterId}`
          );
        }

        trait.disabled = false;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/enableTrait',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: EnableTraitPayload) => {
        const command: Command = {
          type: 'characters/enableTrait',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    removeTrait: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; traitId: string }>
      ) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.traits = character.traits.filter((t) => t.id !== traitId);
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/removeTrait',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: RemoveTraitPayload) => {
        const command: Command = {
          type: 'characters/removeTrait',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    updateTraitName: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; traitId: string; name: string }>
      ) => {
        const { characterId, traitId, name } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const trait = character.traits.find((t) => t.id === traitId);
        if (!trait) {
          throw new Error(
            `Trait ${traitId} not found on character ${characterId}`
          );
        }

        trait.name = name.trim();
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/updateTraitName',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: UpdateTraitNamePayload) => {
        const command: Command = {
          type: 'characters/updateTraitName',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    setActionDots: {
      reducer: (
        state,
        action: PayloadAction<{
          characterId: string;
          action: keyof ActionDots;
          dots: number;
        }>
      ) => {
        const { characterId, action: actionName, dots } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate dots value
        validateActionDots(actionName, dots);

        // Calculate difference and adjust unallocated dots
        const oldDots = character.actionDots[actionName];
        const difference = dots - oldDots;

        // Check if we have enough unallocated dots
        if (difference > character.unallocatedActionDots) {
          throw new Error(
            `Not enough unallocated action dots (need ${difference}, have ${character.unallocatedActionDots})`
          );
        }

        character.actionDots[actionName] = dots;
        character.unallocatedActionDots -= difference;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/setActionDots',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: SetActionDotsPayload) => {
        const command: Command = {
          type: 'characters/setActionDots',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    addEquipment: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; equipment: Equipment }>
      ) => {
        const { characterId, equipment } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.equipment.push(equipment);
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/addEquipment',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: AddEquipmentPayload) => {
        const command: Command = {
          type: 'characters/addEquipment',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    removeEquipment: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; equipmentId: string }>
      ) => {
        const { characterId, equipmentId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.equipment = character.equipment.filter(
          (e) => e.id !== equipmentId
        );
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/removeEquipment',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: RemoveEquipmentPayload) => {
        const command: Command = {
          type: 'characters/removeEquipment',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    addUnallocatedDots: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; amount: number }>
      ) => {
        const { characterId, amount } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        if (amount < 0) {
          throw new Error('Cannot add negative unallocated dots');
        }

        character.unallocatedActionDots += amount;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/addUnallocatedDots',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: { characterId: string; amount: number; userId?: string }) => {
        const command: Command = {
          type: 'characters/addUnallocatedDots',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    useRally: {
      reducer: (state, action: PayloadAction<{ characterId: string }>) => {
        const { characterId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        if (!character.rallyAvailable) {
          throw new Error(
            `Character ${characterId} has already used their Rally`
          );
        }

        character.rallyAvailable = false;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/useRally',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: UseRallyPayload) => {
        const command: Command = {
          type: 'characters/useRally',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    resetRally: {
      reducer: (state, action: PayloadAction<{ characterId: string }>) => {
        const { characterId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.rallyAvailable = true;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/resetRally',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: ResetRallyPayload) => {
        const command: Command = {
          type: 'characters/resetRally',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    groupTraits: {
      reducer: (
        state,
        action: PayloadAction<{
          characterId: string;
          traitIds: string[];
          groupedTrait: Trait;
        }>
      ) => {
        const { characterId, traitIds, groupedTrait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate trait grouping
        validateTraitGrouping(character, traitIds);

        // Remove the 3 original traits
        character.traits = character.traits.filter(
          (t) => !traitIds.includes(t.id)
        );

        // Add the grouped trait
        character.traits.push(groupedTrait);
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/groupTraits',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: GroupTraitsPayload) => {
        const command: Command = {
          type: 'characters/groupTraits',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    createTraitFromFlashback: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; trait: Trait }>
      ) => {
        const { characterId, trait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Flashback traits have category 'flashback'
        if (trait.category !== 'flashback') {
          throw new Error(
            'Trait created from flashback must have category "flashback"'
          );
        }

        character.traits.push(trait);
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/createTraitFromFlashback',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: CreateTraitFromFlashbackPayload) => {
        const command: Command = {
          type: 'characters/createTraitFromFlashback',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    advanceActionDots: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; action: keyof ActionDots }>
      ) => {
        const { characterId, action: actionType } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate advancement
        validateActionDotAdvancement(character, actionType);

        // Advance by 1
        character.actionDots[actionType] += 1;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/advanceActionDots',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: AdvanceActionDotsPayload) => {
        const command: Command = {
          type: 'characters/advanceActionDots',
          payload,
          timestamp: Date.now(),
          version: 1,
          userId: payload.userId,
          commandId: generateId(),
        };

        return {
          payload,
          meta: { command },
        };
      },
    },

    /**
     * Prune command history
     *
     * Clears all command history, keeping only the current state snapshot.
     * This reduces memory/storage usage while maintaining current game state.
     */
    pruneHistory: (state) => {
      state.history = [];
    },

    /**
     * Prune orphaned command history
     *
     * Removes commands that reference characters that no longer exist in the current state.
     * This is useful for automatic cleanup after character deletion while preserving:
     * 1. Commands for characters that still exist
     * 2. Deletion commands themselves (for audit trail)
     *
     * Used by auto-prune feature to reduce storage without losing current state or audit trail.
     *
     * @example
     * ```typescript
     * // Character was created, modified, then deleted
     * // Before: [createCharacter, addTrait, deleteCharacter]
     * // After: [deleteCharacter]  // Only deletion command kept for audit
     * ```
     */
    pruneOrphanedHistory: (state) => {
      const currentCharacterIds = new Set(state.allIds);

      state.history = state.history.filter((command) => {
        return !isOrphanedCommand(command, currentCharacterIds);
      });
    },

    /**
     * Hydrate state from serialized snapshot
     *
     * Used when loading saved state from Foundry world settings.
     * Replaces entire state with the provided snapshot.
     */
    hydrateCharacters: (state, action: PayloadAction<Record<string, Character>>) => {
      const characters = action.payload;

      state.byId = characters;
      state.allIds = Object.keys(characters);
      state.history = []; // No history in snapshots
    },
  },
});

export const {
  createCharacter,
  addTrait,
  disableTrait,
  enableTrait,
  removeTrait,
  updateTraitName,
  setActionDots,
  addEquipment,
  removeEquipment,
  addUnallocatedDots,
  useRally,
  resetRally,
  groupTraits,
  createTraitFromFlashback,
  advanceActionDots,
  pruneHistory,
  pruneOrphanedHistory,
  hydrateCharacters,
} = characterSlice.actions;

export { characterSlice };
export default characterSlice.reducer;
