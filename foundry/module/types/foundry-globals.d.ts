/**
 * Foundry VTT global type definitions
 * Provides type definitions for standard Foundry classes and globals
 * that may not be fully typed in the foundry-vtt-types package
 */

declare global {
  /**
   * Base Application class options
   */
  interface ApplicationOptions {
    title?: string;
    id?: string;
    classes?: string[];
    width?: number;
    height?: number;
    top?: number;
    left?: number;
    popOut?: boolean;
    minimizable?: boolean;
    resizable?: boolean;
    dragDrop?: Array<{ dragSelector: string; dropSelector: string }>;
    scrollY?: string[];
    tabs?: Array<{ navSelector: string; contentSelector: string; initial: string }>;
    [key: string]: unknown;
  }

  /**
   * Dialog-specific options
   */
  interface DialogOptions extends ApplicationOptions {
    content?: string;
    buttons?: Record<
      string,
      {
        icon?: string;
        label?: string;
        callback?: (html?: JQuery) => void | Promise<void>;
      }
    >;
    default?: string;
    close?: (html?: JQuery) => void;
    render?: (html: JQuery) => void;
  }

  /**
   * FormApplication-specific options
   */
  interface FormApplicationOptions extends ApplicationOptions {
    closeOnSubmit?: boolean;
    submitOnChange?: boolean;
    submitOnClose?: boolean;
    [key: string]: unknown;
  }

  /**
   * Position options for rendering
   */
  interface PositionOptions {
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    scale?: number;
  }

  /**
   * Message data for ChatMessage.create()
   */
  interface ChatMessageData {
    type?: string;
    content: string;
    flavor?: string;
    speaker?: {
      actor?: string;
      token?: string;
      alias?: string;
    };
    whisper?: string[];
    blind?: boolean;
    rollMode?: string;
    sound?: string;
    flags?: Record<string, unknown>;
    [key: string]: unknown;
  }

  /**
   * Actor data structure
   */
  interface ActorData {
    _id: string;
    name: string;
    type: string;
    data?: Record<string, unknown>;
    items?: ItemData[];
    flags?: Record<string, unknown>;
    [key: string]: unknown;
  }

  /**
   * Item data structure
   */
  interface ItemData {
    _id: string;
    name: string;
    type: string;
    data?: Record<string, unknown>;
    flags?: Record<string, unknown>;
    [key: string]: unknown;
  }

  /**
   * Collection of actors
   */
  interface ActorCollection {
    get(id: string | null | undefined): Actor | undefined;
    filter(predicate: (actor: Actor) => boolean): Actor[];
    [Symbol.iterator](): Iterator<Actor>;
  }

  /**
   * Collection of items
   */
  interface ItemCollection {
    get(id: string | null | undefined): Item | undefined;
    filter(predicate: (item: Item) => boolean): Item[];
    [Symbol.iterator](): Iterator<Item>;
  }

  /**
   * Base Actor class
   */
  interface Actor {
    readonly id: string;
    name: string;
    type: string;
    data: ActorData;
    items: ItemData[];
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    update(changes: Partial<ActorData>): Promise<Actor>;
    delete(): Promise<void>;
    [key: string]: unknown;
  }

  /**
   * Base Item class
   */
  interface Item {
    readonly id: string;
    name: string;
    type: string;
    data: ItemData;
    parent?: Actor;
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    update(changes: Partial<ItemData>): Promise<Item>;
    delete(): Promise<void>;
    [key: string]: unknown;
  }

  /**
   * ChatMessage class
   */
  interface ChatMessage {
    static create(
      data: ChatMessageData | ChatMessageData[],
      options?: { renderSheet?: boolean }
    ): Promise<ChatMessage | ChatMessage[]>;
    static updateDocuments(updates: unknown[], options?: unknown): Promise<ChatMessage[]>;
    static deleteDocuments(ids: string[], options?: unknown): Promise<void>;
    static getSpeaker(options?: { actor?: string | Actor | null }): { actor?: string; alias?: string };
  }

  /**
   * Roll class for dice operations
   */
  interface Roll {
    result: number;
    dice: Array<{ results: number[] }>;
    static create(formula: string, data?: Record<string, unknown>): Roll;
    evaluate(options?: { async?: boolean }): Roll | Promise<Roll>;
    toMessage(messageData?: Partial<ChatMessageData>, options?: { create?: boolean }): Promise<ChatMessage>;
    total: number;
    formula: string;
    terms: unknown[];
  }

  /**
   * Notification UI service
   */
  interface NotificationService {
    info(message: string, options?: { permanent?: boolean }): void;
    warn(message: string, options?: { permanent?: boolean }): void;
    error(message: string, options?: { permanent?: boolean }): void;
  }

  /**
   * Settings object
   */
  interface Settings {
    get(module: string, key: string): unknown;
    set(module: string, key: string, value: unknown): Promise<unknown>;
    register(module: string, key: string, options: unknown): void;
  }

  /**
   * User object
   */
  interface User {
    readonly id: string;
    name: string;
    isGM: boolean;
    character?: Actor;
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    assignHotbarMacro(macro: unknown, slot: number): Promise<void>;
  }

  /**
   * Game object (main Foundry VTT singleton)
   */
  interface Game {
    actors: ActorCollection;
    items: ItemCollection;
    user: User | null;
    users: User[];
    settings: Settings;
    packs: unknown; // CompendiumCollection (complex type)
    ready: boolean;
    data: {
      world: { name: string; [key: string]: unknown };
      [key: string]: unknown;
    };
    i18n: {
      localize(key: string): string;
      format(key: string, data?: Record<string, unknown>): string;
    };
    [key: string]: unknown;
  }

  /**
   * UI object for Foundry UI services
   */
  interface UI {
    notifications: NotificationService;
    dialogs: Dialog[];
    windows: Record<number, Application>;
    [key: string]: unknown;
  }

  /**
   * Base Application class
   */
  class Application {
    static get defaultOptions(): ApplicationOptions;
    constructor(options?: ApplicationOptions);
    render(force?: boolean, options?: object): Application | Promise<unknown>;
    close(options?: object): Promise<void>;
    minimize(): void;
    maximize(): void;
    setPosition(position?: Partial<PositionOptions>): object;
    bringToTop(): void;
    getData(options?: object): object | Promise<object>;
    activateListeners(html: JQuery): void;
    get id(): string;
    get element(): JQuery;
    get(selector: string): JQuery | null;
    rendered: boolean;
  }

  /**
   * FormApplication class
   */
  class FormApplication extends Application {
    static get defaultOptions(): FormApplicationOptions;
    constructor(object?: object, options?: FormApplicationOptions);
    render(force?: boolean, options?: object): Application | Promise<unknown>;
    _onChangeInput(event: Event): Promise<void>;
    _onSubmit(event: Event | null, options?: object): Promise<unknown>;
    activateListeners(html: JQuery): void;
    object: object;
  }

  /**
   * Dialog class
   */
  class Dialog extends Application {
    constructor(dialogData?: Partial<DialogOptions>, options?: DialogOptions);
    render(force?: boolean, options?: object): this;
    static prompt(options?: DialogOptions): Promise<unknown>;
    static confirm(options?: DialogOptions): Promise<boolean>;
    static wait(options?: DialogOptions): Promise<unknown>;
  }

  /**
   * Global objects
   */
  const game: Game;
  const ui: UI;
  const ChatMessage: ChatMessage;
  const Roll: Roll;
  const Dialog: typeof Dialog;
  const Application: typeof Application;
  const FormApplication: typeof FormApplication;

  /**
   * Namespace for jQuery (Foundry uses jQuery)
   */
  namespace JQuery {
    interface Event {
      originalEvent?: Event;
      currentTarget?: HTMLElement;
      target?: HTMLElement;
      [key: string]: unknown;
    }
  }
}

export {};
