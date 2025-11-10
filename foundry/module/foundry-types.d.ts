/**
 * Foundry VTT type declarations
 *
 * Type declarations for Foundry VTT integration code.
 * These provide type safety for common Foundry API patterns without requiring
 * the full @league-of-foundry-developers/foundry-vtt-types package.
 */

// Global Foundry objects
declare const game: any;
declare const ui: any;
declare const foundry: any;
declare const CONFIG: any;

// jQuery (used extensively in Foundry)
declare type JQuery = any;

// Foundry classes
declare class Application {
  constructor(options?: any);
  element: JQuery;
  render(force?: boolean, options?: any): this;
  close(options?: any): Promise<void>;
  getData(options?: any): any;
  activateListeners(html: any): void;
  _render(force?: boolean, options?: any): Promise<void>;
  static get defaultOptions(): any;
}

declare class FormApplication extends Application {
  _updateObject(event: Event, formData: any): Promise<void>;
}

declare class Dialog extends Application {
  static prompt(config: any): Promise<any>;
  static confirm(config: any): Promise<boolean>;
  constructor(data: any, options?: any);
}

declare class ChatMessage {
  static create(data: any, options?: any): Promise<ChatMessage>;
  static getSpeaker(options?: any): any;
}

declare class Roll {
  constructor(formula: string, data?: any);
  evaluate(options?: any): Promise<Roll>;
  total: number;
  dice: any[];
  terms: any[];
  formula: string;
  toMessage(messageData?: any, options?: any): Promise<ChatMessage>;
}

// Hooks API
declare namespace Hooks {
  function once(hook: string, fn: Function): void;
  function on(hook: string, fn: Function): void;
  function off(hook: string, fn: Function): void;
  function call(hook: string, ...args: any[]): boolean;
}

// Socket API
declare class SocketInterface {
  on(event: string, callback: Function): void;
  emit(event: string, data: any): void;
}

// Actor and Item Sheet classes
declare class ActorSheet extends FormApplication {
  actor: any;
  static get defaultOptions(): any;
  getData(options?: any): any;
  activateListeners(html: JQuery): void;
}

declare class ItemSheet extends FormApplication {
  item: any;
  static get defaultOptions(): any;
  getData(options?: any): any;
}

// Global registries
declare namespace Actors {
  function registerSheet(scope: string, sheetClass: typeof ActorSheet, options?: any): void;
  function unregisterSheet(scope: string, sheetClass: typeof ActorSheet, types?: string[]): void;
}

declare namespace Items {
  function registerSheet(scope: string, sheetClass: typeof ItemSheet, options?: any): void;
  function unregisterSheet(scope: string, sheetClass: typeof ItemSheet, types?: string[]): void;
}

// Handlebars helpers
declare namespace Handlebars {
  function registerHelper(name: string, fn: Function): void;
  class SafeString {
    constructor(str: string);
  }
}

// Macro class
declare class Macro {
  static create(data: any, options?: any): Promise<Macro>;
}

// socketlib (third-party module)
declare const socketlib: any;

// Extend Window interface to include game-specific properties
interface Window {
  fitgd?: any;
}
