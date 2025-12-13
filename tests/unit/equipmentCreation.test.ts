
import { describe, it, expect } from 'vitest';
import { prepareEquipmentData, EquipmentFormData } from '../../foundry/module/utils/equipment-form-handler';

describe('Equipment Creation Logic (prepareEquipmentData)', () => {

    describe('Restricted Creation Mode (Player Creating Equipment)', () => {
        // Flag: isGM=false, mode='create'
        const isGM = false;
        const mode = 'create';

        it('should create Active equipment with fixed stats', () => {
            const formData: EquipmentFormData = {
                name: 'My Custom Gun',
                slots: 1,
                restrictedType: 'active',
                // User tries to inject other fields
                tier: 'rare',
                category: 'consumable',
                'modifiers.dice': 5
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            const data = result.data!;

            expect(data.name).toBe('My Custom Gun');
            expect(data.tier).toBe('common'); // Forced to common
            expect(data.category).toBe('active'); // Forced to active
            expect(data.modifiers?.diceBonus).toBe(1); // Fixed +1d
            expect(data.modifiers?.positionBonus).toBeUndefined();
        });

        it('should create Passive equipment with +1d bonus', () => {
            const formData: EquipmentFormData = {
                name: 'My Custom Armor',
                slots: 2,
                restrictedType: 'passive',
                // User tries to inject bonuses
                'modifiers.dice': 2
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(true);
            const data = result.data!;

            expect(data.category).toBe('passive');
            expect(data.tier).toBe('common');
            expect(data.modifiers?.diceBonus).toBe(1); // Updated: Passive gets +1d
        });

        it('should create Consumable equipment with +1d and +1 pos', () => {
            const formData: EquipmentFormData = {
                name: 'My Custom Stim',
                slots: 1,
                restrictedType: 'consumable' as any, // 'consumable' will be valid now
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(true);
            const data = result.data!;

            expect(data.category).toBe('consumable');
            expect(data.tier).toBe('common');
            expect(data.modifiers?.diceBonus).toBe(1);
            expect(data.modifiers?.positionBonus).toBe(1);
        });

        it('should reject invalid restrictedType', () => {
            const formData: EquipmentFormData = {
                name: 'Hacked Item',
                slots: 1,
                restrictedType: 'invalid' as any
            };

            const result = prepareEquipmentData(formData, isGM, mode);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid equipment type');
        });

        it('should require name and slots', () => {
            const result = prepareEquipmentData({ slots: 1 } as any, isGM, mode);
            expect(result.success).toBe(false);
            expect(result.error).toContain('name is required');
        });
    });

    describe('Standard Creation Mode (GM Creating Equipment)', () => {
        // Flag: isGM=true, mode='create'
        const isGM = true;
        const mode = 'create';

        it('should allow creating Rare items', () => {
            const formData: EquipmentFormData = {
                name: 'Rare Gun',
                slots: 1,
                category: 'active',
                tier: 'rare',
                'modifiers.dice': 2
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(true);
            expect(result.data!.tier).toBe('rare');
            expect(result.data!.modifiers?.diceBonus).toBe(2);
        });

        it('should allow negative modifiers (penalties)', () => {
            const formData: EquipmentFormData = {
                name: 'Cursed Item',
                slots: 1,
                category: 'active',
                tier: 'common',
                'modifiers.dice': -1,
                'modifiers.position': -1
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(true);
            expect(result.data!.modifiers?.dicePenalty).toBe(1);
            expect(result.data!.modifiers?.diceBonus).toBeUndefined();
            expect(result.data!.modifiers?.positionPenalty).toBe(1);
        });
    });

    describe('Edit Mode (Player Editing)', () => {
        // Flag: isGM=false, mode='edit'
        const isGM = false;
        const mode = 'edit';

        it('should restrict players from changing tier to Rare', () => {
            const formData: EquipmentFormData = {
                name: 'Upgraded Gun',
                slots: 1,
                category: 'active',
                tier: 'rare',
            };

            const result = prepareEquipmentData(formData, isGM, mode);

            expect(result.success).toBe(false);
            expect(result.error).toContain('only create or edit Common');
        });

        it('should allow players to edit Common items', () => {
            const formData: EquipmentFormData = {
                name: 'Renamed Gun',
                slots: 1,
                category: 'active',
                tier: 'common',
                'modifiers.dice': 2 // Players can technically edit stats of common items they own in standard edit mode
            };

            const result = prepareEquipmentData(formData, isGM, mode);
            expect(result.success).toBe(true);
            expect(result.data!.name).toBe('Renamed Gun');
        });
    });
});
