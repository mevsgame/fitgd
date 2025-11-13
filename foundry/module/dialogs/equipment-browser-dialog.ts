/**
 * Equipment Browser Dialog
 *
 * Shows Foundry Items (compendium + world) as templates.
 * On selection, copies all data to Redux (no reference kept).
 */

import type { Equipment } from '@/types/character';

interface EquipmentTemplate {
  id: string;
  name: string;
  tier: Equipment['tier'];
  category: string;
  description: string;
  img: string;
  source: 'compendium' | 'world';
  sourceItemId: string;
}

interface EquipmentBrowserOptions extends Partial<DialogOptions> {
  tierFilter?: Equipment['tier'] | null;
  categoryFilter?: string | null;
}

export class EquipmentBrowserDialog extends Dialog {
  private characterId: string;
  private tierFilter: Equipment['tier'] | null;
  private categoryFilter: string | null;
  private items: EquipmentTemplate[] = [];

  constructor(characterId: string, options: EquipmentBrowserOptions = {}) {
    const tierFilter = options.tierFilter || null; // 'accessible', 'inaccessible', 'epic', or null (all)
    const categoryFilter = options.categoryFilter || null; // 'weapon', 'armor', 'tool', or null (all)

    super(
      {
        title: 'Add Equipment',
        content: '<div class="equipment-browser-loading">Loading equipment...</div>',
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: 'Add Equipment',
            callback: (html: JQuery) => this._onAddEquipment(html),
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
          },
        },
        default: 'add',
        render: (html: JQuery) => this._onRender(html),
      },
      {
        ...options,
        classes: ['fitgd', 'dialog', 'fitgd-dialog', 'equipment-browser-dialog'],
        width: 700,
        height: 600,
        resizable: true,
      }
    );

    this.characterId = characterId;
    this.tierFilter = tierFilter;
    this.categoryFilter = categoryFilter;
  }

  private async _onRender(html: JQuery): Promise<void> {
    // Load all equipment items (compendium + world)
    this.items = await this._loadEquipmentTemplates();

    // Render equipment list
    const content = await this._renderEquipmentList();

    html.find('.equipment-browser-loading').replaceWith(content);

    // Activate listeners
    this._activateListeners(html);
  }

  /**
   * Load equipment templates from compendium and world
   */
  private async _loadEquipmentTemplates(): Promise<EquipmentTemplate[]> {
    const items: EquipmentTemplate[] = [];

    // World items
    for (const item of game.items) {
      if (item.type === 'equipment') {
        items.push(this._templateFromItem(item, false));
      }
    }

    // Compendium items
    const compendium = game.packs.get('forged-in-the-grimdark.equipment');
    if (compendium) {
      const index = await compendium.getIndex({ fields: ['name', 'type', 'system', 'img'] });

      for (const entry of index) {
        if (entry.type === 'equipment') {
          const item = await compendium.getDocument(entry._id);
          if (item) {
            items.push(this._templateFromItem(item as Item, true));
          }
        }
      }
    }

    // Apply filters
    return items.filter((item) => {
      if (this.tierFilter && item.tier !== this.tierFilter) return false;
      if (this.categoryFilter && item.category !== this.categoryFilter) return false;
      return true;
    });
  }

  /**
   * Convert Foundry Item to equipment template data
   */
  private _templateFromItem(item: Item, fromCompendium = false): EquipmentTemplate {
    return {
      id: item.id || foundry.utils.randomID(),
      name: item.name || 'Unknown',
      tier: (item.system as any).tier as Equipment['tier'],
      category: (item.system as any).category as string,
      description: (item.system as any).description || '',
      img: item.img || '',
      source: fromCompendium ? 'compendium' : 'world',
      sourceItemId: item.id || '', // Track source for reference
    };
  }

  /**
   * Render equipment list HTML
   */
  private async _renderEquipmentList(): Promise<string> {
    const filters = `
      <div class="equipment-browser">
        <div class="browser-filters">
          <select class="tier-filter">
            <option value="all" ${!this.tierFilter ? 'selected' : ''}>All Tiers</option>
            <option value="accessible" ${this.tierFilter === 'accessible' ? 'selected' : ''}>Accessible</option>
            <option value="inaccessible" ${this.tierFilter === 'inaccessible' ? 'selected' : ''}>Inaccessible</option>
            <option value="epic" ${this.tierFilter === 'epic' ? 'selected' : ''}>Epic</option>
          </select>

          <select class="category-filter">
            <option value="all" ${!this.categoryFilter ? 'selected' : ''}>All Categories</option>
            <option value="weapon" ${this.categoryFilter === 'weapon' ? 'selected' : ''}>Weapons</option>
            <option value="armor" ${this.categoryFilter === 'armor' ? 'selected' : ''}>Armor</option>
            <option value="tool" ${this.categoryFilter === 'tool' ? 'selected' : ''}>Tools</option>
          </select>

          <input type="text" class="equipment-search" placeholder="Search by name..."/>
        </div>

        <div class="equipment-list">
          ${this._renderEquipmentItems()}
        </div>
      </div>
    `;

    return filters;
  }

  /**
   * Render individual equipment items
   */
  private _renderEquipmentItems(): string {
    if (this.items.length === 0) {
      return '<p class="no-items">No equipment found matching filters.</p>';
    }

    return this.items
      .map(
        (item) => `
      <label class="browser-equipment-item tier-${item.tier}" data-name="${item.name}">
        <input type="radio" name="equipment" value="${item.id}"/>
        <div class="browser-equipment-row">
          <div class="browser-equipment-icon">
            ${
              item.img
                ? `<img src="${item.img}" alt="${item.name}"/>`
                : '<i class="fas fa-box"></i>'
            }
          </div>

          <div class="browser-equipment-details">
            <h4 class="browser-equipment-name">${item.name}</h4>
            <div class="browser-equipment-meta">
              <span class="tier-badge tier-${item.tier}">${item.tier}</span>
              <span class="category-badge">${item.category}</span>
              <span class="source-badge">${item.source}</span>
            </div>
            <p class="browser-equipment-description">${item.description || '<em>No description</em>'}</p>
          </div>
        </div>
      </label>
    `
      )
      .join('');
  }

  /**
   * Activate event listeners
   */
  private _activateListeners(html: JQuery): void {
    html.find('.tier-filter').change((e) => this._onFilterChange(e, html));
    html.find('.category-filter').change((e) => this._onFilterChange(e, html));
    html.find('.equipment-search').on('input', (e) => this._onSearch(e, html));
  }

  /**
   * Handle filter change
   */
  private _onFilterChange(event: JQuery.ChangeEvent, html: JQuery): void {
    const tierFilter = html.find('.tier-filter').val() as string;
    const categoryFilter = html.find('.category-filter').val() as string;

    this.tierFilter = tierFilter === 'all' ? null : tierFilter as Equipment['tier'];
    this.categoryFilter = categoryFilter === 'all' ? null : categoryFilter;

    this.render(true);
  }

  /**
   * Handle search input
   */
  private _onSearch(event: JQuery.InputEvent, html: JQuery): void {
    const query = (event.target as HTMLInputElement).value.toLowerCase();

    html.find('.browser-equipment-item').each(function () {
      const name = $(this).data('name') as string;
      $(this).toggle(name.toLowerCase().includes(query));
    });
  }

  /**
   * Handle adding equipment (copies template data to Redux)
   */
  private async _onAddEquipment(html: JQuery): Promise<void> {
    const selectedId = html.find('input[name="equipment"]:checked').val() as string;

    if (!selectedId) {
      ui.notifications.warn('Please select an equipment item');
      return;
    }

    const template = this.items.find((t) => t.id === selectedId);

    if (!template) {
      ui.notifications.error('Equipment template not found');
      return;
    }

    // Check tier restrictions (players can only add accessible items)
    if (!game.user.isGM && template.tier === 'inaccessible') {
      ui.notifications.warn('Inaccessible equipment requires a flashback (1 Momentum + trait)');
      // TODO: Open flashback dialog
      return;
    }

    if (!game.user.isGM && template.tier === 'epic') {
      ui.notifications.error(
        'Epic equipment cannot be acquired through flashbacks - must be earned'
      );
      return;
    }

    // Generate unique ID for this equipment instance
    const equipmentId = foundry.utils.randomID();

    // Copy template data to Redux (full duplication, no reference!)
    await game.fitgd.bridge.execute({
      type: 'characters/addEquipment',
      payload: {
        characterId: this.characterId,
        equipment: {
          id: equipmentId,
          name: template.name,
          tier: template.tier,
          category: template.category,
          description: template.description,
          img: template.img,
          equipped: false,
          acquiredVia: 'creation',
          sourceItemId: template.sourceItemId, // Optional: track where it came from
        },
      },
    });

    ui.notifications.info(`Added ${template.name}`);
  }
}
