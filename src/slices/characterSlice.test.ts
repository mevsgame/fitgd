import { describe, it, expect } from 'vitest';
import characterReducer, {
    createCharacter,
    setApproach,
    toggleEquipped,
    addEquipment,
} from './characterSlice';
import { Approaches } from '../types';

describe('characterSlice', () => {
    const mockApproaches: Approaches = {
        force: 1,
        guile: 0,
        focus: 0,
        spirit: 0,
    };

    const mockTraits = [
        { id: 't1', name: 'Role', category: 'role', disabled: false, acquiredAt: 0 },
        { id: 't2', name: 'Background', category: 'background', disabled: false, acquiredAt: 0 },
    ] as any[];

    it('should create a character with valid approaches', () => {
        const initialState = { byId: {}, allIds: [], history: [] };
        const action = createCharacter({
            name: 'Test Char',
            traits: mockTraits,
            approaches: mockApproaches,
        });

        const state = characterReducer(initialState, action);
        const charId = state.allIds[0];
        const char = state.byId[charId];

        expect(char.name).toBe('Test Char');
        expect(char.approaches).toEqual(mockApproaches);
        // Total allocated = 1. Starting = 5. Unallocated = 4.
        expect(char.unallocatedApproachDots).toBe(4);
    });

    it('should set approach dots correctly', () => {
        const initialState = { byId: {}, allIds: [], history: [] };
        const createAction = createCharacter({
            name: 'Test Char',
            traits: mockTraits,
            approaches: mockApproaches,
        });
        let state = characterReducer(initialState, createAction);
        const charId = state.allIds[0];

        // Increase Force from 1 to 2
        const setAction = setApproach({
            characterId: charId,
            approach: 'force',
            dots: 2,
        });
        state = characterReducer(state, setAction);

        expect(state.byId[charId].approaches.force).toBe(2);
        expect(state.byId[charId].unallocatedApproachDots).toBe(3); // Decreased by 1
    });

    it('should enforce load limit when equipping items', () => {
        const initialState = { byId: {}, allIds: [], history: [] };
        const createAction = createCharacter({
            name: 'Test Char',
            traits: mockTraits,
            approaches: mockApproaches,
        });
        let state = characterReducer(initialState, createAction);
        const charId = state.allIds[0];

        // Add 6 items
        for (let i = 0; i < 6; i++) {
            state = characterReducer(
                state,
                addEquipment({
                    characterId: charId,
                    equipment: {
                        id: `item-${i}`,
                        name: `Item ${i}`,
                        tier: 'accessible',
                        category: 'gear',
                        rarity: 'common',
                        description: 'Test item',
                        passive: false,
                        equipped: false,
                        acquiredAt: Date.now(),
                    },
                })
            );
        }

        const items = state.byId[charId].equipment;

        // Equip 5 items (Max Load)
        for (let i = 0; i < 5; i++) {
            state = characterReducer(
                state,
                toggleEquipped({
                    characterId: charId,
                    equipmentId: items[i].id,
                    equipped: true,
                })
            );
            expect(state.byId[charId].equipment[i].equipped).toBe(true);
        }

        // Try to equip 6th item (Should fail/no-op)
        state = characterReducer(
            state,
            toggleEquipped({
                characterId: charId,
                equipmentId: items[5].id,
                equipped: true,
            })
        );

        expect(state.byId[charId].equipment[5].equipped).toBe(false);
    });
});
