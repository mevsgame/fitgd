import { describe, it, expect } from 'vitest';
import {
    selectActiveEquipment,
    selectPassiveEquipment,
    selectCurrentLoad,
    selectCanEquipItem,
    selectAllEquippedItems,
    selectUnequippedItems,
    selectIsAtMaxLoad,
} from '../../src/selectors/equipmentSelectors';
import type { Character, Equipment } from '../../src/types';

describe('equipmentSelectors', () => {
    const mockCharacter: Character = {
        id: 'char-1',
        name: 'Test Character',
        traits: [],
        approaches: { force: 2, guile: 1, focus: 1, spirit: 0 },
        unallocatedApproachDots: 0,
        equipment: [
            {
                id: 'equip-1',
                name: 'Las Rifle',
                type: 'equipment',
                tier: 'common',
                category: 'weapon',
                description: 'Active weapon',
                passive: false,
                equipped: true,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            },
            {
                id: 'equip-2',
                name: 'Armor Plating',
                type: 'equipment',
                tier: 'common',
                category: 'armor',
                description: 'Passive armor',
                passive: true,
                equipped: true,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            },
            {
                id: 'equip-3',
                name: 'Chainsword',
                type: 'equipment',
                tier: 'common',
                category: 'weapon',
                description: 'Unequipped weapon',
                passive: false,
                equipped: false,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            },
            {
                id: 'equip-4',
                name: 'Medkit',
                type: 'consumable',
                tier: 'common',
                category: 'tool',
                description: 'Active tool',
                passive: false,
                equipped: true,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            },
        ],
        rallyAvailable: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    describe('selectActiveEquipment', () => {
        it('should return equipped items without passive tag', () => {
            const active = selectActiveEquipment(mockCharacter);
            expect(active).toHaveLength(2);
            expect(active.map((e) => e.id)).toEqual(['equip-1', 'equip-4']);
        });

        it('should return empty array if no active equipment', () => {
            const char: Character = {
                ...mockCharacter,
                equipment: [
                    {
                        id: 'equip-1',
                        name: 'Armor',
                        tier: 'common',
                        category: 'armor',
                        description: 'Passive only',
                        passive: true,
                        equipped: true,
                        locked: false,
                        depleted: false,
                        acquiredAt: Date.now(),
                    },
                ],
            };
            const active = selectActiveEquipment(char);
            expect(active).toHaveLength(0);
        });
    });

    describe('selectPassiveEquipment', () => {
        it('should return equipped items with passive tag', () => {
            const passive = selectPassiveEquipment(mockCharacter);
            expect(passive).toHaveLength(1);
            expect(passive[0].id).toBe('equip-2');
        });
    });

    describe('selectCurrentLoad', () => {
        it('should count all equipped items', () => {
            const load = selectCurrentLoad(mockCharacter);
            expect(load).toBe(3); // Las Rifle, Armor, Medkit
        });

        it('should return 0 if no equipped items', () => {
            const char: Character = {
                ...mockCharacter,
                equipment: mockCharacter.equipment.map((e) => ({
                    ...e,
                    equipped: false,
                })),
            };
            const load = selectCurrentLoad(char);
            expect(load).toBe(0);
        });
    });

    describe('selectCanEquipItem', () => {
        it('should return true if item is already equipped', () => {
            const item = mockCharacter.equipment[0]; // Already equipped
            const canEquip = selectCanEquipItem(mockCharacter, item);
            expect(canEquip).toBe(true);
        });

        it('should return true if under load limit', () => {
            const item = mockCharacter.equipment[2]; // Unequipped
            const canEquip = selectCanEquipItem(mockCharacter, item);
            expect(canEquip).toBe(true); // 3 equipped, max is 5
        });

        it('should return false if at max load', () => {
            const char: Character = {
                ...mockCharacter,
                equipment: [
                    ...Array(5)
                        .fill(null)
                        .map((_, i) => ({
                            id: `equip-${i}`,
                            name: `Item ${i}`,
                            tier: 'common' as const,
                            category: 'weapon',
                            description: 'Test',
                            passive: false,
                            equipped: true,
                            locked: false,
                            depleted: false,
                            acquiredAt: Date.now(),
                        })),
                    {
                        id: 'equip-new',
                        name: 'New Item',
                        tier: 'common',
                        category: 'weapon',
                        description: 'Unequipped',
                        passive: false,
                        equipped: false,
                        locked: false,
                        depleted: false,
                        acquiredAt: Date.now(),
                    },
                ],
            };
            const newItem = char.equipment[5];
            const canEquip = selectCanEquipItem(char, newItem);
            expect(canEquip).toBe(false);
        });
    });

    describe('selectAllEquippedItems', () => {
        it('should return all equipped items', () => {
            const equipped = selectAllEquippedItems(mockCharacter);
            expect(equipped).toHaveLength(3);
        });
    });

    describe('selectUnequippedItems', () => {
        it('should return all unequipped items', () => {
            const unequipped = selectUnequippedItems(mockCharacter);
            expect(unequipped).toHaveLength(1);
            expect(unequipped[0].id).toBe('equip-3');
        });
    });

    describe('selectIsAtMaxLoad', () => {
        it('should return false if under max load', () => {
            const atMax = selectIsAtMaxLoad(mockCharacter);
            expect(atMax).toBe(false); // 3 < 5
        });

        it('should return true if at max load', () => {
            const char: Character = {
                ...mockCharacter,
                equipment: Array(5)
                    .fill(null)
                    .map((_, i) => ({
                        id: `equip-${i}`,
                        name: `Item ${i}`,
                        tier: 'common' as const,
                        category: 'weapon',
                        description: 'Test',
                        passive: false,
                        equipped: true,
                        locked: false,
                        depleted: false,
                        acquiredAt: Date.now(),
                    })),
            };
            const atMax = selectIsAtMaxLoad(char);
            expect(atMax).toBe(true);
        });
    });
});
