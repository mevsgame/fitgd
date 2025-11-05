import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import {
  validateMomentumValue,
  validateSufficientMomentum,
  validateMomentumAmount,
  capMomentum,
  validateCharacterInCrew,
  validateCharacterNotInCrew,
} from '../validators/crewValidator';
import { DEFAULT_CONFIG } from '../config';
import type { Crew, Command } from '../types';

/**
 * Crew Slice State
 */
export interface CrewState {
  byId: Record<string, Crew>;
  allIds: string[];
  history: Command[];
}

const initialState: CrewState = {
  byId: {},
  allIds: [],
  history: [],
};

/**
 * Payload Types
 */
interface CreateCrewPayload {
  name: string;
  userId?: string;
}

interface AddCharacterToCrewPayload {
  crewId: string;
  characterId: string;
  userId?: string;
}

interface RemoveCharacterFromCrewPayload {
  crewId: string;
  characterId: string;
  userId?: string;
}

interface SetMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface AddMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface SpendMomentumPayload {
  crewId: string;
  amount: number;
  userId?: string;
}

interface ResetMomentumPayload {
  crewId: string;
  userId?: string;
}

/**
 * Crew Slice
 */
const crewSlice = createSlice({
  name: 'crews',
  initialState,
  reducers: {
    createCrew: {
      reducer: (state, action: PayloadAction<Crew>) => {
        const crew = action.payload;
        state.byId[crew.id] = crew;
        state.allIds.push(crew.id);

        // Log command to history
        state.history.push({
          type: 'crews/createCrew',
          payload: crew,
          timestamp: crew.createdAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: CreateCrewPayload) => {
        const timestamp = Date.now();
        const crew: Crew = {
          id: generateId(),
          name: payload.name,
          characters: [],
          currentMomentum: DEFAULT_CONFIG.crew.startingMomentum, // 5
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        return { payload: crew };
      },
    },

    addCharacterToCrew: {
      reducer: (state, action: PayloadAction<AddCharacterToCrewPayload>) => {
        const { crewId, characterId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate character not already in crew
        validateCharacterNotInCrew(crew, characterId);

        crew.characters.push(characterId);
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/addCharacterToCrew',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AddCharacterToCrewPayload) => {
        return { payload };
      },
    },

    removeCharacterFromCrew: {
      reducer: (state, action: PayloadAction<RemoveCharacterFromCrewPayload>) => {
        const { crewId, characterId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate character is in crew
        validateCharacterInCrew(crew, characterId);

        crew.characters = crew.characters.filter((id) => id !== characterId);
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/removeCharacterFromCrew',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: RemoveCharacterFromCrewPayload) => {
        return { payload };
      },
    },

    setMomentum: {
      reducer: (state, action: PayloadAction<SetMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate momentum value
        validateMomentumValue(amount);

        crew.currentMomentum = amount;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/setMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: SetMomentumPayload) => {
        return { payload };
      },
    },

    addMomentum: {
      reducer: (state, action: PayloadAction<AddMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate amount is non-negative
        validateMomentumAmount(amount);

        // Add momentum and cap at max (10)
        const newMomentum = crew.currentMomentum + amount;
        crew.currentMomentum = capMomentum(newMomentum);
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/addMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AddMomentumPayload) => {
        return { payload };
      },
    },

    spendMomentum: {
      reducer: (state, action: PayloadAction<SpendMomentumPayload>) => {
        const { crewId, amount } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Validate sufficient momentum
        validateSufficientMomentum(crew.currentMomentum, amount);

        crew.currentMomentum -= amount;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/spendMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: SpendMomentumPayload) => {
        return { payload };
      },
    },

    resetMomentum: {
      reducer: (state, action: PayloadAction<ResetMomentumPayload>) => {
        const { crewId } = action.payload;
        const crew = state.byId[crewId];

        if (!crew) {
          throw new Error(`Crew ${crewId} not found`);
        }

        // Reset to starting value (5)
        crew.currentMomentum = DEFAULT_CONFIG.crew.startingMomentum;
        crew.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'crews/resetMomentum',
          payload: action.payload,
          timestamp: crew.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: ResetMomentumPayload) => {
        return { payload };
      },
    },
  },
});

export const {
  createCrew,
  addCharacterToCrew,
  removeCharacterFromCrew,
  setMomentum,
  addMomentum,
  spendMomentum,
  resetMomentum,
} = crewSlice.actions;

export default crewSlice.reducer;
