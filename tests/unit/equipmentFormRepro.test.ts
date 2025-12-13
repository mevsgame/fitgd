
import { describe, it, expect } from 'vitest';
import { prepareEquipmentData, EquipmentFormData } from '../../foundry/module/utils/equipment-form-handler';

describe('Equipment Creation Bug Reproduction', () => {
    // Simulator for what Foundry's _updateObject receives

    it('should handle string "consumable" for restrictedType', () => {
        const formData: EquipmentFormData = {
            name: 'Test Consumable',
            slots: 1,
            restrictedType: 'consumable' as any // simulating the value from radio button
        };

        const result = prepareEquipmentData(formData, false, 'create');
        expect(result.success).toBe(true);
        expect(result.data?.category).toBe('consumable');
    });

    it('should fail if restrictedType is missing or invalid', () => {
        const formData: EquipmentFormData = {
            name: 'Test Invalid',
            slots: 1,
            restrictedType: 'invalid' as any
        };

        const result = prepareEquipmentData(formData, false, 'create');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid equipment type selected: "invalid"');
    });

    it('should handle if restrictedType comes as a different casing (unlikely but possible)', () => {
        const formData: EquipmentFormData = {
            name: 'Test Consumable',
            slots: 1,
            restrictedType: 'Consumable' as any
        };

        const result = prepareEquipmentData(formData, false, 'create');
        // This is expected to fail currently, checking if this is the cause
        expect(result.success).toBe(false);
    });
});
