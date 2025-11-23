import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { generateId } from '../utils/uuid';
import { isOrphanedCommand } from '../utils/commandUtils';
import {
  validateApproachAdvancement,
  validateApproachDots,
  validateTraitAddition,
  validateTraitRemoval,
  validateTraitUpdate,
  validateStartingTraits,
  validateStartingApproaches,
} from '../validators/characterValidator';
import { DEFAULT_CONFIG } from '../config';
import type { Character, Trait, Approaches, Equipment, Command } from '../types';

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
  id?: string;
  name: string;
  traits: Trait[];
  approaches: Approaches;
  equipment?: Equipment[];
  loadLimit?: number;
  userId?: string;
}

interface AddTraitPayload {
  characterId: string;
  trait: Trait;
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

interface SetApproachPayload {
  characterId: string;
  approach: keyof Approaches;
  dots: number;
  userId?: string;
}

interface AdvanceApproachPayload {
  characterId: string;
  approach: keyof Approaches;
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

interface UpdateEquipmentPayload {
  characterId: string;
  equipmentId: string;
  updates: Partial<Equipment>;
  userId?: string;
}

interface ToggleEquippedPayload {
  characterId: string;
  equipmentId: string;
  equipped: boolean;
  userId?: string;
}

interface CreateTraitFromFlashbackPayload {
  characterId: string;
  trait: Trait;
  userId?: string;
}

interface LockEquipmentPayload {
  characterId: string;
  equipmentId: string;
  userId?: string;
}

interface UnlockAllEquipmentPayload {
  characterId: string;
  userId?: string;
}

interface MarkEquipmentDepletedPayload {
  characterId: string;
  equipmentId: string;
  userId?: string;
}

interface ReplenishConsumablesPayload {
  characterId: string;
  userId?: string;
}

interface MarkEquipmentUsedPayload {
  characterId: string;
  equipmentId: string;
  userId?: string;
}

interface AutoEquipItemsPayload {
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
        // Validate payload
        validateStartingTraits(payload.traits);
        validateStartingApproaches(payload.approaches);

        const timestamp = Date.now();
        const totalDots = Object.values(payload.approaches).reduce((a, b) => a + b, 0);
        const unallocated = DEFAULT_CONFIG.character.startingApproachDots - totalDots;

        // Ensure all traits have id and acquiredAt
        const traitsWithIds = payload.traits.map(trait => ({
          ...trait,
          id: trait.id || generateId(),
          acquiredAt: trait.acquiredAt || timestamp,
        }));

        const character: Character = {
          id: payload.id || generateId(),
          name: payload.name,
          traits: traitsWithIds,
          approaches: payload.approaches,
          unallocatedApproachDots: unallocated,
          equipment: payload.equipment || [],
          loadLimit: payload.loadLimit || DEFAULT_CONFIG.character.defaultLoadLimit,
          rallyAvailable: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        return { payload: character };
      },
    },

    addTrait: {
      reducer: (state, action: PayloadAction<AddTraitPayload>) => {
        const { characterId, trait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Ensure trait has id and acquiredAt
        const traitWithId = {
          ...trait,
          id: trait.id || generateId(),
          acquiredAt: trait.acquiredAt || Date.now(),
        };

        // Validate trait addition
        validateTraitAddition(character, traitWithId);

        character.traits.push(traitWithId);
        character.updatedAt = Date.now();

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

    createTraitFromFlashback: {
      reducer: (state, action: PayloadAction<CreateTraitFromFlashbackPayload>) => {
        const { characterId, trait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Ensure trait has id and acquiredAt
        const traitWithId = {
          ...trait,
          id: trait.id || generateId(),
          acquiredAt: trait.acquiredAt || Date.now(),
        };

        // Flashback traits bypass some validation but we still check basics
        character.traits.push(traitWithId);
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

    groupTraits: {
      reducer: (state, action: PayloadAction<{ characterId: string; traitIds: string[]; groupedTrait: Trait; userId?: string }>) => {
        const { characterId, traitIds, groupedTrait } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        if (traitIds.length !== 3) {
          throw new Error('Must group exactly 3 traits');
        }

        // Verify all traits exist
        const traitsExist = traitIds.every(id => character.traits.some(t => t.id === id));
        if (!traitsExist) {
          throw new Error('One or more traits not found');
        }

        // Remove old traits
        character.traits = character.traits.filter(t => !traitIds.includes(t.id));

        // Add new grouped trait
        const newTrait = {
          ...groupedTrait,
          id: groupedTrait.id || generateId(),
          category: 'grouped' as const,
          acquiredAt: Date.now(),
        };
        character.traits.push(newTrait);
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/groupTraits',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: { characterId: string; traitIds: string[]; groupedTrait: Trait; userId?: string }) => ({ payload }),
    },

    disableTrait: {
      reducer: (state, action: PayloadAction<{ characterId: string; traitId: string; userId?: string }>) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];
        if (!character) return;

        const trait = character.traits.find(t => t.id === traitId);
        if (trait) {
          trait.disabled = true;
          character.updatedAt = Date.now();

          state.history.push({
            type: 'characters/disableTrait',
            payload: action.payload,
            timestamp: character.updatedAt,
            version: 1,
            commandId: generateId(),
            userId: action.payload.userId,
          });
        }
      },
      prepare: (payload: { characterId: string; traitId: string; userId?: string }) => ({ payload }),
    },

    enableTrait: {
      reducer: (state, action: PayloadAction<{ characterId: string; traitId: string; userId?: string }>) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];
        if (!character) return;

        const trait = character.traits.find(t => t.id === traitId);
        if (trait) {
          trait.disabled = false;
          character.updatedAt = Date.now();

          state.history.push({
            type: 'characters/enableTrait',
            payload: action.payload,
            timestamp: character.updatedAt,
            version: 1,
            commandId: generateId(),
            userId: action.payload.userId,
          });
        }
      },
      prepare: (payload: { characterId: string; traitId: string; userId?: string }) => ({ payload }),
    },

    removeTrait: {
      reducer: (state, action: PayloadAction<RemoveTraitPayload>) => {
        const { characterId, traitId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate trait removal
        validateTraitRemoval(character, traitId);

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
      reducer: (state, action: PayloadAction<UpdateTraitNamePayload>) => {
        const { characterId, traitId, name } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate trait update
        validateTraitUpdate(character, traitId, { name });

        const trait = character.traits.find((t) => t.id === traitId);
        if (trait) {
          trait.name = name;
          character.updatedAt = Date.now();
        }

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

    setApproach: {
      reducer: (state, action: PayloadAction<SetApproachPayload>) => {
        const { characterId, approach, dots } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Calculate cost/refund
        const currentDots = character.approaches[approach];
        const diff = dots - currentDots;

        // Validate new value
        // Validate new value - moved to prepare
        // validateApproachDots(dots);

        // Check if we have enough unallocated dots (if increasing)
        if (diff > 0 && character.unallocatedApproachDots < diff) {
          throw new Error(
            `Insufficient unallocated dots (need ${diff}, have ${character.unallocatedApproachDots})`
          );
        }

        character.approaches[approach] = dots;
        character.unallocatedApproachDots -= diff;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/setApproach',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: SetApproachPayload) => {
        validateApproachDots(payload.dots);
        const command: Command = {
          type: 'characters/setApproach',
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
      reducer: (state, action: PayloadAction<AddEquipmentPayload>) => {
        const { characterId, equipment } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Generate ID if not present
        if (!equipment.id) {
          equipment.id = generateId();
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
      reducer: (state, action: PayloadAction<RemoveEquipmentPayload>) => {
        const { characterId, equipmentId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        character.equipment = character.equipment.filter((e) => e.id !== equipmentId);
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

    updateEquipment: {
      reducer: (state, action: PayloadAction<UpdateEquipmentPayload>) => {
        const { characterId, equipmentId, updates } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const equipment = character.equipment.find((e) => e.id === equipmentId);
        if (equipment) {
          Object.assign(equipment, updates);
          character.updatedAt = Date.now();
        }

        // Log command to history
        state.history.push({
          type: 'characters/updateEquipment',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: UpdateEquipmentPayload) => {
        const command: Command = {
          type: 'characters/updateEquipment',
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

    toggleEquipped: {
      reducer: (state, action: PayloadAction<ToggleEquippedPayload>) => {
        const { characterId, equipmentId, equipped } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const equipment = character.equipment.find((e) => e.id === equipmentId);

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        // If equipping, check load limit
        if (equipped && !equipment.equipped) {
          const currentLoad = character.equipment.filter(e => e.equipped).reduce((sum, e) => sum + e.slots, 0);
          if (currentLoad + equipment.slots > character.loadLimit) {
            // Block equipping if load limit reached
            return;
          }
        }

        // If unequipping, check if locked
        if (!equipped && equipment.equipped && equipment.locked) {
          // Block unequipping if locked
          throw new Error(`Cannot unequip locked item ${equipment.name} until Momentum Reset`);
        }

        equipment.equipped = equipped;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/toggleEquipped',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: ToggleEquippedPayload) => {
        const command: Command = {
          type: 'characters/toggleEquipped',
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

    advanceApproach: {
      reducer: (
        state,
        action: PayloadAction<{ characterId: string; approach: keyof Approaches }>
      ) => {
        const { characterId, approach } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Validate advancement
        validateApproachAdvancement(character, approach);

        character.approaches[approach] += 1;
        character.updatedAt = Date.now();

        // Log command to history
        state.history.push({
          type: 'characters/advanceApproach',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: undefined,
        });
      },
      prepare: (payload: AdvanceApproachPayload) => {
        const command: Command = {
          type: 'characters/advanceApproach',
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
      reducer: (state, action: PayloadAction<{ characterId: string; userId?: string }>) => {
        const { characterId, userId } = action.payload;
        const character = state.byId[characterId];
        if (!character) return;

        if (!character.rallyAvailable) {
          throw new Error(`Rally already used for character ${characterId}`);
        }

        character.rallyAvailable = false;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/useRally',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId,
        });
      },
      prepare: (payload: { characterId: string; userId?: string }) => ({ payload }),
    },

    addUnallocatedDots: {
      reducer: (state, action: PayloadAction<{ characterId: string; amount: number; userId?: string }>) => {
        const { characterId, amount } = action.payload;
        const character = state.byId[characterId];
        if (!character) return;

        character.unallocatedApproachDots += amount;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/addUnallocatedDots',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: { characterId: string; amount: number; userId?: string }) => ({ payload }),
    },

    /**
     * Lock equipment when equipped (rules_primer.md: "Once an item is equipped, it remains equipped until the next Momentum Reset")
     * This action explicitly marks equipment as locked, preventing manual unequipping during gameplay
     */
    lockEquipment: {
      reducer: (state, action: PayloadAction<LockEquipmentPayload>) => {
        const { characterId, equipmentId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const equipment = character.equipment.find((e) => e.id === equipmentId);

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        equipment.locked = true;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/lockEquipment',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: LockEquipmentPayload) => {
        const command: Command = {
          type: 'characters/lockEquipment',
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
     * Unlock all equipment when Momentum Reset occurs (rules_primer.md: "At the start of a Momentum Reset, you can unequip any number of items")
     */
    unlockAllEquipment: {
      reducer: (state, action: PayloadAction<UnlockAllEquipmentPayload>) => {
        const { characterId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Unlock all equipped items
        character.equipment.forEach((equip) => {
          if (equip.equipped) {
            equip.locked = false;
          }
        });

        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/unlockAllEquipment',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: UnlockAllEquipmentPayload) => {
        const command: Command = {
          type: 'characters/unlockAllEquipment',
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
     * Mark consumable as depleted when used (rules_primer.md: "Single-use items that provide higher bonuses. After use, they remain equipped but become unusable")
     */
    markEquipmentDepleted: {
      reducer: (state, action: PayloadAction<MarkEquipmentDepletedPayload>) => {
        const { characterId, equipmentId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const equipment = character.equipment.find((e) => e.id === equipmentId);

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        equipment.consumed = true;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/markEquipmentDepleted',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: MarkEquipmentDepletedPayload) => {
        const command: Command = {
          type: 'characters/markEquipmentDepleted',
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
     * Replenish consumables on Momentum Reset (rules_primer.md: "Consumables are removed or replenished during a Momentum Reset")
     */
    replenishConsumables: {
      reducer: (state, action: PayloadAction<ReplenishConsumablesPayload>) => {
        const { characterId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Reset consumed flag for all consumable-category items
        character.equipment.forEach((equip) => {
          if (equip.category === 'consumable') {
            equip.consumed = false;
          }
        });

        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/replenishConsumables',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: ReplenishConsumablesPayload) => {
        const command: Command = {
          type: 'characters/replenishConsumables',
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
     * Mark equipment as used (locked) when selected for an action
     * Rules: Once equipment is used in an action, it cannot be unequipped until next Momentum Reset
     */
    markEquipmentUsed: {
      reducer: (state, action: PayloadAction<MarkEquipmentUsedPayload>) => {
        const { characterId, equipmentId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        const equipment = character.equipment.find((e) => e.id === equipmentId);

        if (!equipment) {
          throw new Error(`Equipment ${equipmentId} not found`);
        }

        equipment.locked = true;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/markEquipmentUsed',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: MarkEquipmentUsedPayload) => {
        const command: Command = {
          type: 'characters/markEquipmentUsed',
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
     * Auto-equip items marked with autoEquip flag at Momentum Reset
     * Rules: At reset, items flagged with autoEquip: true are automatically re-equipped
     */
    autoEquipItems: {
      reducer: (state, action: PayloadAction<AutoEquipItemsPayload>) => {
        const { characterId } = action.payload;
        const character = state.byId[characterId];

        if (!character) {
          throw new Error(`Character ${characterId} not found`);
        }

        // Unlock all equipment after reset
        character.equipment.forEach((equip) => {
          equip.locked = false;
        });

        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/autoEquipItems',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId: action.payload.userId,
        });
      },
      prepare: (payload: AutoEquipItemsPayload) => {
        const command: Command = {
          type: 'characters/autoEquipItems',
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
      reducer: (state, action: PayloadAction<{ characterId: string; userId?: string }>) => {
        const { characterId, userId } = action.payload;
        const character = state.byId[characterId];
        if (!character) return;

        character.rallyAvailable = true;
        character.updatedAt = Date.now();

        state.history.push({
          type: 'characters/resetRally',
          payload: action.payload,
          timestamp: character.updatedAt,
          version: 1,
          commandId: generateId(),
          userId,
        });
      },
      prepare: (payload: { characterId: string; userId?: string }) => ({ payload }),
    },

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

    cleanupOrphanedCharacters: (state, action: PayloadAction<{ validIds: string[] }>) => {
      const { validIds } = action.payload;
      const validIdSet = new Set(validIds);
      const charsToRemove: string[] = [];

      for (const charId of state.allIds) {
        if (!validIdSet.has(charId)) {
          charsToRemove.push(charId);
        }
      }

      for (const charId of charsToRemove) {
        delete state.byId[charId];
      }

      state.allIds = state.allIds.filter(id => !charsToRemove.includes(id));
    },

    hydrateCharacters: (state, action: PayloadAction<Record<string, Character>>) => {
      const characters = action.payload;
      state.byId = characters;
      state.allIds = Object.keys(characters);
      state.history = [];
    },
  },
});

export const {
  createCharacter,
  addTrait,
  createTraitFromFlashback,
  groupTraits,
  disableTrait,
  enableTrait,
  removeTrait,
  updateTraitName,
  setApproach,
  addEquipment,
  removeEquipment,
  updateEquipment,
  toggleEquipped,
  lockEquipment,
  unlockAllEquipment,
  markEquipmentDepleted,
  replenishConsumables,
  markEquipmentUsed,
  autoEquipItems,
  advanceApproach,
  addUnallocatedDots,
  useRally,
  resetRally,
  pruneHistory: pruneCharacterHistory,
  pruneOrphanedHistory,
  cleanupOrphanedCharacters,
  hydrateCharacters,
} = characterSlice.actions;

export { characterSlice };
export default characterSlice.reducer;
