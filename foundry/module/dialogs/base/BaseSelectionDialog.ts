/**
 * Base Selection Dialog
 *
 * Abstract base class for selection dialogs.
 * Provides common patterns: list rendering, filtering, callbacks.
 */

/**
 * Options for BaseSelectionDialog
 */
export interface BaseSelectionDialogOptions {
  /** Items to select from */
  items: any[];
  /** Callback when item selected */
  onSelect: (itemId: string) => void | Promise<void>;
  /** Dialog title */
  title: string;
  /** Show "Create New" button? */
  allowCreate?: boolean;
  /** Callback for create button */
  onCreate?: () => void | Promise<void>;
  /** Custom item renderer */
  renderItem?: (item: any) => string;
  /** Message when no items */
  emptyMessage?: string;
  /** Show search input? */
  showSearch?: boolean;
  /** Dialog width in pixels */
  width?: number;
  /** Dialog height (pixels or 'auto') */
  height?: number | 'auto';
}

/**
 * Data structure for the dialog
 */
interface DialogData {
  items: any[];
  allowCreate: boolean;
  emptyMessage: string;
  showSearch: boolean;
}

/**
 * Rendered item for getData()
 */
interface RenderedItem {
  id: string;
  html: string;
}

/**
 * Base class for selection dialogs
 *
 * Subclasses should override:
 * - _defaultRenderItem(item) - Custom item rendering
 * - static get defaultOptions() - Custom Foundry options
 */
export class BaseSelectionDialog extends Application {
  private _onSelectCallback: ((itemId: string) => void | Promise<void>) | undefined;
  private _onCreateCallback: (() => void | Promise<void>) | undefined;
  private _renderItemCallback: ((item: any) => string) | undefined;
  private _dialogTitle: string;
  protected data: DialogData;

  constructor(options: BaseSelectionDialogOptions) {
    const height = options.height;
    super({
      classes: ['fitgd-selection-dialog', 'dialog'] as string[],
      width: options.width || 400,
      height: typeof height === 'string' ? undefined : height,
      resizable: true,
    });

    // Store callbacks separately to avoid serialization issues
    this._onSelectCallback = options.onSelect;
    this._onCreateCallback = options.onCreate;
    this._renderItemCallback = options.renderItem;

    // Store title separately (not serializable in some cases)
    this._dialogTitle = options.title;

    // Store only serializable data
    this.data = {
      items: options.items || [],
      allowCreate: options.allowCreate || false,
      emptyMessage: options.emptyMessage || 'No items available',
      showSearch: options.showSearch !== false, // Default: true
    };
  }

  /** @override */
  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: 'systems/forged-in-the-grimdark/templates/dialogs/base-selection-dialog.html',
      classes: ['fitgd-selection-dialog', 'dialog'] as string[],
      width: 400,
      height: undefined,
      resizable: true,
    });
  }

  get title(): string {
    return this._dialogTitle || 'Select Item';
  }

  /** @override */
  override async getData(options: object = {}): Promise<any> {
    const data = await super.getData(options);

    // Pre-render all items to avoid passing functions in data (socket serialization issue)
    const renderFn = this._renderItemCallback || this._defaultRenderItem.bind(this);
    const renderedItems: RenderedItem[] = this.data.items.map(item => ({
      id: item.id,
      html: renderFn(item)
    }));

    return {
      ...data,
      items: renderedItems,
      allowCreate: this.data.allowCreate,
      emptyMessage: this.data.emptyMessage,
      showSearch: this.data.showSearch,
      hasItems: this.data.items.length > 0,
    };
  }

  /** @override */
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Item selection
    html.find('[data-action="select-item"]').on('click', this._onSelectItem.bind(this));

    // Create new
    if (this.data.allowCreate) {
      html.find('[data-action="create-new"]').on('click', this._onCreateNew.bind(this));
    }

    // Search
    if (this.data.showSearch) {
      html.find('[name="search"]').on('input', this._onSearch.bind(this));
    }
  }

  /**
   * Handle item selection
   *
   * @param event - Click event
   * @private
   */
  private async _onSelectItem(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const itemId = (event.currentTarget as HTMLElement).dataset.itemId;

    if (this._onSelectCallback && itemId) {
      await this._onSelectCallback(itemId);
    }

    this.close();
  }

  /**
   * Handle create new
   *
   * @param event - Click event
   * @private
   */
  private async _onCreateNew(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (this._onCreateCallback) {
      await this._onCreateCallback();
    }

    this.close();
  }

  /**
   * Handle search input
   *
   * @param event - Input event
   * @private
   */
  private _onSearch(event: JQuery.TriggeredEvent): void {
    const query = ((event.target as HTMLInputElement).value || '').toLowerCase();
    const items = this.element.find('[data-action="select-item"]');

    items.each((_i: number, el: HTMLElement) => {
      const text = el.textContent?.toLowerCase() || '';
      const matches = text.includes(query);

      // Use CSS class instead of inline style
      if (matches) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  /**
   * Default item renderer (override in subclasses)
   *
   * @param item - Item to render
   * @returns HTML string
   * @protected
   */
  protected _defaultRenderItem(item: any): string {
    return `<div class="item-name">${item.name || item.id}</div>`;
  }
}
