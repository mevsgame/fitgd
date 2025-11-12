/**
 * Equipment Browser Dialog
 *
 * Shows Foundry Items (compendium + world) as templates.
 * On selection, copies all data to Redux (no reference kept).
 */
export class EquipmentBrowserDialog extends Dialog {
  constructor(characterId, options = {}) {
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
            callback: (html) => this._onAddEquipment(html),
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel',
          },
        },
        default: 'add',
        render: (html) => this._onRender(html),
      },
      { ...options, classes: ['fitgd', 'dialog', 'equipment-browser'] }
    );

    this.characterId = characterId;
    this.tierFilter = tierFilter;
    this.categoryFilter = categoryFilter;
    this.items = [];
  }

  async _onRender(html) {
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
  async _loadEquipmentTemplates() {
    const items = [];

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
          items.push(this._templateFromItem(item, true));
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
  _templateFromItem(item, fromCompendium = false) {
    return {
      id: item.id,
      name: item.name,
      tier: item.system.tier,
      category: item.system.category,
      description: item.system.description || '',
      img: item.img,
      source: fromCompendium ? 'compendium' : 'world',
      sourceItemId: item.id, // Track source for reference
    };
  }

  /**
   * Render equipment list HTML
   */
  async _renderEquipmentList() {
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
  _renderEquipmentItems() {
    if (this.items.length === 0) {
      return '<p class="no-items">No equipment found matching filters.</p>';
    }

    return this.items
      .map(
        (item) => `
      <label class="equipment-item tier-${item.tier}" data-name="${item.name}">
        <input type="radio" name="equipment" value="${item.id}"/>

        <div class="equipment-preview">
          ${
            item.img
              ? `<img src="${item.img}" alt="${item.name}"/>`
              : '<div class="equipment-placeholder"><i class="fas fa-box"></i></div>'
          }
        </div>

        <div class="equipment-details">
          <h4>${item.name}</h4>
          <div class="equipment-meta">
            <span class="tier-badge tier-${item.tier}">${item.tier}</span>
            <span class="category-badge">${item.category}</span>
            <span class="source-badge">${item.source}</span>
          </div>
          <p class="equipment-description">${item.description}</p>
        </div>
      </label>
    `
      )
      .join('');
  }

  /**
   * Activate event listeners
   */
  _activateListeners(html) {
    html.find('.tier-filter').change((e) => this._onFilterChange(e, html));
    html.find('.category-filter').change((e) => this._onFilterChange(e, html));
    html.find('.equipment-search').on('input', (e) => this._onSearch(e, html));
  }

  /**
   * Handle filter change
   */
  _onFilterChange(event, html) {
    const tierFilter = html.find('.tier-filter').val();
    const categoryFilter = html.find('.category-filter').val();

    this.tierFilter = tierFilter === 'all' ? null : tierFilter;
    this.categoryFilter = categoryFilter === 'all' ? null : categoryFilter;

    this.render(true);
  }

  /**
   * Handle search input
   */
  _onSearch(event, html) {
    const query = event.target.value.toLowerCase();

    html.find('.equipment-item').each(function () {
      const name = $(this).data('name').toLowerCase();
      $(this).toggle(name.includes(query));
    });
  }

  /**
   * Handle adding equipment (copies template data to Redux)
   */
  async _onAddEquipment(html) {
    const selectedId = html.find('input[name="equipment"]:checked').val();

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

    // Copy template data to Redux (full duplication, no reference!)
    await game.fitgd.bridge.execute({
      type: 'characters/addEquipment',
      payload: {
        characterId: this.characterId,
        equipment: {
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
