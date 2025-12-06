import type { Equipment } from '@/types/equipment';

export interface EquipmentFormData {
    name: string;
    slots: string | number;
    tier?: string;
    category?: string;
    description?: string;
    'modifiers.dice'?: string | number;
    'modifiers.position'?: string | number;
    'modifiers.effect'?: string | number;
    restrictedType?: 'active' | 'passive';
}

export interface ValidationResult {
    success: boolean;
    error?: string;
    data?: Partial<Equipment>;
}

/**
 * Validates and prepares equipment data from form submission
 * Pure function for easier testing
 */
export function prepareEquipmentData(
    formData: EquipmentFormData,
    isGM: boolean,
    mode: 'create' | 'edit'
): ValidationResult {
    const restrictedCreation = !isGM && mode === 'create';

    // Validate name
    const name = formData.name?.trim();
    if (!name || name.length === 0) {
        return { success: false, error: 'Equipment name is required' };
    }
    if (name.length > 50) {
        return { success: false, error: 'Equipment name must be 50 characters or less' };
    }

    // Validate slots
    const slots = typeof formData.slots === 'string' ? parseInt(formData.slots, 10) : formData.slots;
    if (isNaN(slots) || slots < 1) {
        return { success: false, error: 'Equipment must occupy at least 1 slot' };
    }

    // Validate tier restrictions (Standard Mode Check)
    const tier = formData.tier as Equipment['tier'];
    if (!restrictedCreation && !isGM && tier !== 'common') {
        return { success: false, error: 'Players can only create or edit Common tier equipment' };
    }

    // Parse modifiers (Standard Mode)
    const diceInput = formData['modifiers.dice'];
    const posInput = formData['modifiers.position'];
    const effInput = formData['modifiers.effect'];

    const diceModifier = diceInput ? (typeof diceInput === 'string' ? parseInt(diceInput, 10) : diceInput) : 0;
    const positionModifier = posInput ? (typeof posInput === 'string' ? parseInt(posInput, 10) : posInput) : 0;
    const effectModifier = effInput ? (typeof effInput === 'string' ? parseInt(effInput, 10) : effInput) : 0;

    const modifiers: Equipment['modifiers'] = {
        diceBonus: diceModifier > 0 ? diceModifier : undefined,
        dicePenalty: diceModifier < 0 ? Math.abs(diceModifier) : undefined,
        positionBonus: positionModifier > 0 ? positionModifier : undefined,
        positionPenalty: positionModifier < 0 ? Math.abs(positionModifier) : undefined,
        effectBonus: effectModifier > 0 ? effectModifier : undefined,
        effectPenalty: effectModifier < 0 ? Math.abs(effectModifier) : undefined,
    };

    const finalData: Partial<Equipment> = {
        name,
        slots,
        description: formData.description || ''
    };

    if (restrictedCreation) {
        const restrictedType = formData.restrictedType;

        if (restrictedType === 'active') {
            finalData.category = 'active';
            finalData.tier = 'common';
            finalData.modifiers = { diceBonus: 1 };
        } else if (restrictedType === 'passive') {
            finalData.category = 'passive';
            finalData.tier = 'common';
            finalData.modifiers = {};
        } else {
            return { success: false, error: 'Invalid equipment type selected' };
        }
    } else {
        // Normal mode validation
        if (!formData.category) {
            // In edit mode we might preserve existing category if not in form, 
            // but typically form has all fields. For safety:
            if (mode === 'create' && !formData.category) return { success: false, error: 'Category is required' };
        }

        finalData.category = formData.category as Equipment['category'];
        finalData.tier = tier;
        finalData.modifiers = modifiers;
    }

    return { success: true, data: finalData };
}
