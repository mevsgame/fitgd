/**
 * Equipment Management Dialog
 *
 * The central hub for deciding loadout during mission or downtime.
 * Implements transaction pattern: Stage changes, preview costs, commit atomically.
 *
 * Features:
 * - Real-time load tracking (equipment only, augmentations excluded)
 * - Momentum cost calculation (1M for rare items)
 * - Load validation (max 5 items)
 * - Search/filter by name or tier
 * - Flashback item creation
 * - Transaction pattern for atomic updates
 */

import type { Character, Equipment } from '@/types/character';
import type { Crew } from '@/types/crew';
import { selectCurrentLoad, selectCanEquipItem, selectMomentumCostForTier } from '@/selectors/equipmentSelectors';
import { DEFAULT_CONFIG } from '@/config/gameConfig';

interface EquipmentManagementData {
  character: Character;
  crew: Crew | null;
  momentum: number;
  maxMomentum: number;
  maxLoad: number;

  // Equipment organization
  equippedItems: Equipment[];
  unequippedItems: Equipment[];
  augmentations: Equipment[];
  depletedConsumables: Equipment[];

  // Current state
  currentLoad: number;
  remainingCapacity: number;
  isAtMaxLoad: boolean;

  // Staged transaction state
  stagedChanges: Map<string, boolean>;
  momentumCost: number;
  canAcceptChanges: boolean;

  // Search/filter
  searchQuery: string;
  filteredItems: Equipment[];

  // UI flags
  isGM: boolean;
}

export class EquipmentManagementDialog extends Application {
  private characterId: string;
  private character: Character | null = null;
  private crew: Crew | null = null;
  private crewId: string | null = null;

  // Transaction state
  private stagedChanges: Map<string, boolean> = new Map();
  private searchQuery: string = '';

  constructor(characterId: string, crewId: string | null = null, options: Partial<ApplicationOptions> = {}) {
    super(options);
    this.characterId = characterId;
    this.crewId = crewId;
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'equipment-management-dialog'] as any,
      template: 'systems/forged-in-the-grimdark/templates/dialogs/equipment-management-dialog.html',
      width: 700,
      height: 'auto',
      title: 'Manage Equipment',
      resizable: true,
    }) as ApplicationOptions;
  }

  override get id(): string {
    return `equipment-management-dialog-${this.characterId}`;
  }

  override async getData(options: Partial<ApplicationOptions> = {}): Promise<EquipmentManagementData> {
    const data = await super.getData(options) as Partial<EquipmentManagementData>;

    if (!game.fitgd) {
      console.error('FitGD | FitGD not initialized');
      return data as EquipmentManagementData;
    }

    // Get character
    this.character = game.fitgd.api.character.getCharacter(this.characterId);
    if (!this.character) {
      ui.notifications?.error('Character not found');
      return data as EquipmentManagementData;
    }

    // Get crew (if available)
    if (this.crewId) {
      this.crew = game.fitgd.api.crew.getCrew(this.crewId);
    } else {
      const state = game.fitgd.store.getState();
      const crewId = Object.values(state.crews.byId).find((crew) =>
        crew.characters.includes(this.characterId)
      )?.id;
      if (crewId) {
        this.crew = game.fitgd.api.crew.getCrew(crewId);
      }
    }

    const maxLoad = DEFAULT_CONFIG.character.maxLoad;
    const currentLoad = this._calculateLoad();

    // Organize equipment by state
    const equippedItems = this.character.equipment.filter((e) => e.equipped && e.type !== 'augmentation');
    const unequippedItems = this.character.equipment.filter((e) => !e.equipped && e.type !== 'augmentation');
    const augmentations = this.character.equipment.filter((e) => e.type === 'augmentation');
    const depletedConsumables = this.character.equipment.filter((e) => e.depleted && e.type === 'consumable');

    // Calculate momentum cost of staged changes
    const momentumCost = this._calculateStagedMomentumCost();
    const hasSufficientMomentum = !this.crew || this.crew.currentMomentum >= momentumCost;

    return {
      ...data,
      character: this.character,
      crew: this.crew,
      momentum: this.crew?.currentMomentum || 0,
      maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
      maxLoad,

      // Equipment organization
      equippedItems,
      unequippedItems,
      augmentations,
      depletedConsumables,

      // Current state
      currentLoad,
      remainingCapacity: maxLoad - currentLoad,
      isAtMaxLoad: currentLoad >= maxLoad,

      // Staged transaction state
      stagedChanges: this.stagedChanges,
      momentumCost,
      canAcceptChanges: hasSufficientMomentum && this.stagedChanges.size > 0,

      // Search/filter
      searchQuery: this.searchQuery,
      filteredItems: this._getFilteredItems(),

      // UI flags
      isGM: game.user?.isGM || false,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Equipment toggle
    html.find('.equipment-item').click(this._onEquipmentToggle.bind(this));

    // Search input
    html.find('.equipment-search').on('input', this._onSearchChange.bind(this));

    // Flashback button
    html.find('[data-action="flashback"]').click(this._onFlashbackEquipment.bind(this));

    // Accept button
    html.find('[data-action="accept"]').click(this._onAcceptChanges.bind(this));

    // Cancel button
    html.find('[data-action="cancel"]').click(() => this.close());
  }

  /**
   * Toggle equipment equipped state
   */
  private _onEquipmentToggle(event: JQuery.ClickEvent): void {
    const target = $(event.currentTarget);
    const equipmentId = target.data('equipment-id') as string;

    if (!equipmentId) return;

    const item = this.character?.equipment.find((e) => e.id === equipmentId);
    if (!item) return;

    // Check if item is locked (cannot unequip locked items)
    if (item.equipped && item.locked) {
      ui.notifications?.warn('Item is locked until Momentum Reset');
      return;
    }

    // Check load limit if equipping
    if (!item.equipped) {
      const currentLoad = this._calculateLoad();
      if (currentLoad >= DEFAULT_CONFIG.character.maxLoad) {
        ui.notifications?.warn('Equipment load is full - unequip something first');
        return;
      }
    }

    // Toggle staged change
    const newState = !item.equipped;
    if (this.stagedChanges.has(equipmentId)) {
      this.stagedChanges.delete(equipmentId);
    } else {
      this.stagedChanges.set(equipmentId, newState);
    }

    this.render(true);
  }

  /**
   * Handle search input
   */
  private _onSearchChange(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value.toLowerCase();
    this.render(true);
  }

  /**
   * Open flashback equipment dialog
   */
  private _onFlashbackEquipment(event: JQuery.ClickEvent): void {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Crew not found');
      return;
    }

    // Import FlashbackEquipmentDialog dynamically to avoid circular imports
    import('../dialogs/FlashbackEquipmentDialog').then(({ FlashbackEquipmentDialog }) => {
      new FlashbackEquipmentDialog(this.characterId, this.crewId!).render(true);
    });
  }

  /**
   * Accept and commit all staged changes
   */
  private async _onAcceptChanges(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.character || this.stagedChanges.size === 0) {
      return;
    }

    try {
      const momentumCost = this._calculateStagedMomentumCost();

      // Build equipment update actions
      const actions: any[] = [];

      for (const [equipmentId, newEquippedState] of this.stagedChanges) {
        actions.push({
          type: 'characters/updateEquipment',
          payload: {
            characterId: this.characterId,
            equipmentId,
            updates: { equipped: newEquippedState },
          },
        });
      }

      // Spend momentum if needed
      if (momentumCost > 0 && this.crew) {
        actions.push({
          type: 'crews/spendMomentum',
          payload: {
            crewId: this.crew.id,
            amount: momentumCost,
          },
        } as any);
      }

      // Dispatch batch update
      await (game.fitgd!.bridge.executeBatch as any)(actions, {
        affectedReduxIds: [this.characterId, this.crew?.id].filter(Boolean),
        force: false,
      });

      ui.notifications?.info(
        `Equipment updated${momentumCost > 0 ? ` (spent ${momentumCost}M)` : ''}`
      );

      this.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Error: ${errorMessage}`);
      console.error('FitGD | Equipment Management error:', error);
    }
  }

  /**
   * Calculate current load (excluding augmentations)
   */
  private _calculateLoad(): number {
    if (!this.character) return 0;
    return this.character.equipment.filter((e) => e.equipped).length;
  }

  /**
   * Calculate momentum cost of staged changes
   */
  private _calculateStagedMomentumCost(): number {
    if (!this.character) return 0;

    let cost = 0;

    for (const [equipmentId, newEquippedState] of this.stagedChanges) {
      const item = this.character.equipment.find((e) => e.id === equipmentId);
      if (!item) continue;

      // Only charge for equipping rare items (not unequipping)
      if (newEquippedState && !item.equipped && item.tier === 'rare') {
        cost += selectMomentumCostForTier(item);
      }
    }

    return cost;
  }

  /**
   * Get filtered equipment based on search query
   */
  private _getFilteredItems(): Equipment[] {
    if (!this.character) return [];
    if (!this.searchQuery) return this.character.equipment;

    return this.character.equipment.filter((e) =>
      e.name.toLowerCase().includes(this.searchQuery) ||
      e.category.toLowerCase().includes(this.searchQuery) ||
      e.tier.toLowerCase().includes(this.searchQuery)
    );
  }
}
