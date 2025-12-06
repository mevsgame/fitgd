/**
 * Equipment Sheet Dialog
 *
 * Unified editor for creating and editing equipment items.
 * - Create mode: Creates new equipment on character with defaults
 * - Edit mode: Updates existing equipment properties
 * - Role-based access: Players can only create/edit Common tier items
 */

import type { Equipment } from '@/types/equipment';
import { prepareEquipmentData } from '../utils/equipment-form-handler';

interface EquipmentEditData {
  equipment: Equipment;
  mode: 'create' | 'edit';
  tiers: string[];
  categories: string[];
  isGM: boolean;
  canEditTier: boolean;
  modifiers: {
    dice: number;
    position: number;
    effect: number;
  };
  restrictedCreation: boolean;
}

export class EquipmentEditDialog extends FormApplication {
  private characterId: string;
  private mode: 'create' | 'edit';

  /**
   * Create a new Equipment Edit Dialog
   * @param characterId - Character to add/edit equipment for
   * @param equipment - Equipment object (for edit mode) or template (for create mode)
   * @param mode - 'create' or 'edit'
   * @param options - Additional options
   */
  constructor(
    characterId: string,
    equipment: Partial<Equipment> | Equipment,
    mode: 'create' | 'edit' = 'edit',
    options: Partial<FormApplicationOptions> = {}
  ) {
    super(equipment, options);
    this.characterId = characterId;
    this.mode = mode;
  }

  static get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'dialog', 'equipment-edit'] as unknown as string[],
      template: 'systems/forged-in-the-grimdark/templates/dialogs/equipment-edit.html',
      width: 500,
      height: 'auto' as any,
      title: 'Equipment',
      submitOnChange: false,
      closeOnSubmit: true,
    });
  }

  get title(): string {
    return this.mode === 'create' ? 'Create Equipment' : 'Edit Equipment';
  }

  getData(): EquipmentEditData {
    const equipment = this.object as Partial<Equipment>;
    const isGM = game.user!.isGM;

    // Players can only edit tier if equipment is already Common
    const isCommon = (equipment as Equipment).tier === 'common' || this.mode === 'create';
    const canEditTier = isGM || isCommon;

    // Calculate combined modifier values from bonus/penalty pairs
    const mods = (equipment as Equipment).modifiers || {};
    const diceModifier = (mods.diceBonus || 0) - (mods.dicePenalty || 0);
    const positionModifier = (mods.positionBonus || 0) - (mods.positionPenalty || 0);
    const effectModifier = (mods.effectBonus || 0) - (mods.effectPenalty || 0);

    const restrictedCreation = !isGM && this.mode === 'create';

    return {
      equipment: equipment as Equipment,
      mode: this.mode,
      tiers: ['common', 'rare', 'epic'],
      categories: ['active', 'passive', 'consumable'],
      isGM,
      canEditTier,
      modifiers: {
        dice: diceModifier,
        position: positionModifier,
        effect: effectModifier,
      },
      restrictedCreation,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Wire up custom buttons
    html.find('.cancel-btn').click(() => (this as any).close());
    html.find('.save-btn').click(() => this._onSubmit(new Event('submit')));

    // Category Change Logic: auto-set defaults
    html.find('select[name="category"]').change((event) => {
      const category = (event.target as HTMLSelectElement).value;
      const diceInput = html.find('input[name="modifiers.dice"]');
      const positionInput = html.find('input[name="modifiers.position"]');
      const effectInput = html.find('input[name="modifiers.effect"]');

      if (category === 'active') {
        // Active creates +1d default, reset others
        diceInput.val(1);
        positionInput.val(0);
        effectInput.val(0);
      } else if (category === 'passive') {
        // Passive resets all modifiers to 0
        diceInput.val(0);
        positionInput.val(0);
        effectInput.val(0);
      }
    });
  }

  protected async _updateObject(_event: Event, formData: Record<string, any>): Promise<void> {
    const equipment = this.object as Partial<Equipment>;
    const isGM = game.user!.isGM;

    // Use shared validation logic
    const result = prepareEquipmentData(formData as any, isGM, this.mode);

    if (!result.success) {
      ui.notifications?.error(result.error || 'Unknown error');
      return;
    }

    const finalData = result.data!;

    if (this.mode === 'create') {
      // Create mode
      const newEquipment: Equipment = {
        id: crypto.randomUUID(),
        name: finalData.name!,
        category: finalData.category!,
        tier: finalData.tier!,
        slots: finalData.slots!,
        description: finalData.description || '',
        equipped: false,
        locked: false,
        consumed: false,
        modifiers: finalData.modifiers!,
        acquiredAt: Date.now(),
        acquiredVia: isGM ? 'earned' : 'earned',
      };

      await game.fitgd.bridge.execute({
        type: 'characters/addEquipment',
        payload: {
          characterId: this.characterId,
          equipment: newEquipment,
        },
      });

      ui.notifications?.info(`Created ${finalData.name}`);
    } else {
      // Edit mode
      const equipmentId = (equipment as Equipment).id;
      const changes: Partial<Equipment> = {
        name: finalData.name,
        category: finalData.category,
        tier: finalData.tier,
        slots: finalData.slots,
        description: finalData.description,
        modifiers: finalData.modifiers,
      };

      await game.fitgd.bridge.execute({
        type: 'characters/updateEquipment',
        payload: {
          characterId: this.characterId,
          equipmentId,
          updates: changes,
        },
      });

      ui.notifications?.info(`Updated ${finalData.name}`);
    }
  }
}
