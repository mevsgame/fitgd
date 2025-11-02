import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import {
  validateStartingTraits,
  validateStartingActionDots,
  validateActionDots,
  validateTraitCount,
} from '../validators/characterValidator';
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
      },
      prepare: (payload: CreateCharacterPayload) => {
        // Validate
        validateStartingTraits(payload.traits);
        validateStartingActionDots(payload.actionDots);

        const now = Date.now();
        const character: Character = {
          id: generateId(),
          name: payload.name,
          traits: payload.traits,
          actionDots: payload.actionDots,
          equipment: [],
          rallyAvailable: true,
          createdAt: now,
          updatedAt: now,
        };

        // Create command for history
        const command: Command = {
          type: 'character/createCharacter',
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
      },
      prepare: (payload: AddTraitPayload) => {
        const command: Command = {
          type: 'character/addTrait',
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
      },
      prepare: (payload: DisableTraitPayload) => {
        const command: Command = {
          type: 'character/disableTrait',
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
      },
      prepare: (payload: EnableTraitPayload) => {
        const command: Command = {
          type: 'character/enableTrait',
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

        character.actionDots[actionName] = dots;
        character.updatedAt = Date.now();
      },
      prepare: (payload: SetActionDotsPayload) => {
        const command: Command = {
          type: 'character/setActionDots',
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
      },
      prepare: (payload: AddEquipmentPayload) => {
        const command: Command = {
          type: 'character/addEquipment',
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
      },
      prepare: (payload: RemoveEquipmentPayload) => {
        const command: Command = {
          type: 'character/removeEquipment',
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
      },
      prepare: (payload: UseRallyPayload) => {
        const command: Command = {
          type: 'character/useRally',
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
      },
      prepare: (payload: ResetRallyPayload) => {
        const command: Command = {
          type: 'character/resetRally',
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
  },
});

export const {
  createCharacter,
  addTrait,
  disableTrait,
  enableTrait,
  setActionDots,
  addEquipment,
  removeEquipment,
  useRally,
  resetRally,
} = characterSlice.actions;

export default characterSlice.reducer;
