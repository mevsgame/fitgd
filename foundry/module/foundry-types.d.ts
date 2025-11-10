/**
 * Minimal Foundry VTT type declarations
 *
 * These are stub declarations to allow type checking of Foundry integration code
 * without requiring the full Foundry VTT type definitions.
 */

// Global Foundry objects
declare const game: any;
declare const ui: any;
declare const foundry: any;
declare const CONFIG: any;

// Foundry classes
declare class Application {
  constructor(options?: any);
  render(force?: boolean, options?: any): this;
  close(options?: any): Promise<void>;
  getData(options?: any): any;
  activateListeners(html: any): void;
  static get defaultOptions(): any;
}

declare class FormApplication extends Application {
  _updateObject(event: Event, formData: any): Promise<void>;
}

declare class Dialog extends Application {
  static prompt(config: any): Promise<any>;
  constructor(data: any, options?: any);
}

declare class ChatMessage {
  static create(data: any, options?: any): Promise<ChatMessage>;
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
