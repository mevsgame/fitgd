import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import {
    createCharacter,
    addEquipment,
    toggleEquipped,
} from '../../src/slices/characterSlice';
import type { Trait, Approaches, Equipment } from '../../src/types';
import { DEFAULT_CONFIG } from '../../src/config';

describe('characterSlice - Equipment Load Limits', () => {
    let store: ReturnType<typeof configureStore>;
    let characterId: string;

    beforeEach(() => {
        store = configureStore();

        const traits: Trait[] = [
            {
                id: 'trait-1',
                name: 'Role',
                category: 'role',
                disabled: false,
                acquiredAt: Date.now(),
            },
            {
                id: 'trait-2',
                name: 'Background',
                category: 'background',
                disabled: false,
                acquiredAt: Date.now(),
            },
        ];

        const approaches: Approaches = {
            force: 2,
            guile: 1,
            focus: 1,
            spirit: 0,
        };

        store.dispatch(
            createCharacter({
                name: 'Test Character',
                traits,
                approaches,
            })
        );

        characterId = store.getState().characters.allIds[0];
    });

    describe('toggleEquipped', () => {
        it('should enforce maxLoad limit when equipping', () => {
            const maxLoad = DEFAULT_CONFIG.character.maxLoad;

            // Add maxLoad items and equip them all
            for (let i = 0; i < maxLoad; i++) {
                const equipment: Equipment = {
                    id: `equip-${i}`,
                    name: `Item ${i}`,
                    tier: 'common',
                    category: 'weapon',
                    description: `Test item ${i}`,
                    passive: false,
                    equipped: false,
                    locked: false,
                    depleted: false,
                    acquiredAt: Date.now(),
                };
                store.dispatch(addEquipment({ characterId, equipment }));
                store.dispatch(
                    toggleEquipped({
                        characterId,
                        equipmentId: `equip-${i}`,
                        equipped: true,
                    })
                );
            }

            // Verify all items are equipped
            let character = store.getState().characters.byId[characterId];
            const equippedCount = character.equipment.filter((e) => e.equipped).length;
            expect(equippedCount).toBe(maxLoad);

            // Try to equip one more item (should be blocked)
            const extraEquipment: Equipment = {
                id: 'equip-extra',
                name: 'Extra Item',
                tier: 'common',
                category: 'weapon',
                description: 'Should not be equipped',
                passive: false,
                equipped: false,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            };
            store.dispatch(addEquipment({ characterId, equipment: extraEquipment }));
            store.dispatch(
                toggleEquipped({
                    characterId,
                    equipmentId: 'equip-extra',
                    equipped: true,
                })
            );

            // Verify extra item was NOT equipped
            character = store.getState().characters.byId[characterId];
            const extraItem = character.equipment.find((e) => e.id === 'equip-extra');
            expect(extraItem?.equipped).toBe(false);

            // Total equipped should still be maxLoad
            const finalEquippedCount = character.equipment.filter(
                (e) => e.equipped
            ).length;
            expect(finalEquippedCount).toBe(maxLoad);
        });
    });

    describe('equipment passive flag', () => {
        it('should create equipment with passive flag', () => {
            const equipment: Equipment = {
                id: 'equip-1',
                name: 'Armor Plating',
                tier: 'common',
                category: 'armor',
                description: 'Passive protection',
                passive: true,
                equipped: true,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            };

            store.dispatch(addEquipment({ characterId, equipment }));

            const character = store.getState().characters.byId[characterId];
            expect(character.equipment[0].passive).toBe(true);
        });

        it('should create equipment as active by default', () => {
            const equipment: Equipment = {
                id: 'equip-1',
                name: 'Las Rifle',
                tier: 'common',
                category: 'weapon',
                description: 'Standard issue laser rifle',
                passive: false,
                equipped: false,
                locked: false,
                depleted: false,
                acquiredAt: Date.now(),
            };

            store.dispatch(addEquipment({ characterId, equipment }));

            const character = store.getState().characters.byId[characterId];
            expect(character.equipment[0].passive).toBe(false);
        });
    });
});
