/**
 * Base Selection Dialog
 *
 * Abstract base class for selection dialogs.
 * Provides common patterns: list rendering, filtering, callbacks.
 */

// @ts-check

/**
 * @typedef {Object} BaseSelectionDialogOptions
 * @property {Array<any>} items - Items to select from
 * @property {Function} onSelect - Callback when item selected: (itemId) => void
 * @property {string} title - Dialog title
 * @property {boolean} [allowCreate] - Show "Create New" button?
 * @property {Function} [onCreate] - Callback for create button
 * @property {Function} [renderItem] - Custom item renderer: (item) => HTML string
 * @property {string} [emptyMessage] - Message when no items
 * @property {boolean} [showSearch] - Show search input?
 * @property {number} [width] - Dialog width in pixels
 * @property {number|string} [height] - Dialog height (pixels or 'auto')
 */

/**
 * Base class for selection dialogs
 *
 * Subclasses should override:
 * - _defaultRenderItem(item) - Custom item rendering
 * - static get defaultOptions() - Custom Foundry options
 */
export class BaseSelectionDialog extends Application {
  /**
   * @param {BaseSelectionDialogOptions} options
   */
  constructor(options) {
    super({
      classes: ['fitgd-selection-dialog', 'dialog'],
      width: options.width || 400,
      height: options.height || 'auto',
      resizable: true,
    });

    this.options = options;
    this.data = {
      items: options.items || [],
      allowCreate: options.allowCreate || false,
      emptyMessage: options.emptyMessage || 'No items available',
      showSearch: options.showSearch !== false, // Default: true
    };
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: 'modules/forged-in-the-grimdark/templates/dialogs/base-selection-dialog.html',
      classes: ['fitgd-selection-dialog', 'dialog'],
      width: 400,
      height: 'auto',
      resizable: true,
    });
  }

  /** @override */
  get title() {
    return this.options.title || 'Select Item';
  }

  /** @override */
  async getData(options = {}) {
    const data = await super.getData(options);

    return {
      ...data,
      ...this.data,
      renderItem: this.options.renderItem || this._defaultRenderItem.bind(this),
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Item selection
    html.find('[data-action="select-item"]').click(this._onSelectItem.bind(this));

    // Create new
    if (this.data.allowCreate) {
      html.find('[data-action="create-new"]').click(this._onCreateNew.bind(this));
    }

    // Search
    if (this.data.showSearch) {
      html.find('[name="search"]').on('input', this._onSearch.bind(this));
    }
  }

  /**
   * Handle item selection
   *
   * @param {Event} event - Click event
   * @private
   */
  async _onSelectItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;

    if (this.options.onSelect) {
      await this.options.onSelect(itemId);
    }

    this.close();
  }

  /**
   * Handle create new
   *
   * @param {Event} event - Click event
   * @private
   */
  async _onCreateNew(event) {
    event.preventDefault();

    if (this.options.onCreate) {
      await this.options.onCreate();
    }

    this.close();
  }

  /**
   * Handle search input
   *
   * @param {Event} event - Input event
   * @private
   */
  _onSearch(event) {
    const query = event.target.value.toLowerCase();
    const items = this.element.find('[data-action="select-item"]');

    items.each((i, el) => {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(query) ? '' : 'none';
    });
  }

  /**
   * Default item renderer (override in subclasses)
   *
   * @param {any} item - Item to render
   * @returns {string} HTML string
   * @protected
   */
  _defaultRenderItem(item) {
    return `<div class="item-name">${item.name || item.id}</div>`;
  }
}
