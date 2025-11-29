/**
 * UI Mock Utilities
 *
 * Provides mocks for Foundry UI systems used by the Player Action Widget:
 * - Notifications (ui.notifications)
 * - Chat Messages (ChatMessage)
 * - Dice Rolling (Roll)
 * - Dialogs (Dialog)
 * - jQuery Events
 *
 * Usage:
 * ```typescript
 * const ui = createMockUI();
 * const ChatMessage = createMockChatMessage();
 * const Roll = createMockRoll([6, 5, 4]);
 *
 * (global as any).ui = ui;
 * (global as any).ChatMessage = ChatMessage;
 * (global as any).Roll = Roll;
 * ```
 */

import { vi } from 'vitest';

/* -------------------------------------------- */
/*  Notification Mocks                          */
/* -------------------------------------------- */

export interface MockNotifications {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

/**
 * Create mock notification system
 *
 * @returns Mock notifications with spy functions
 *
 * @example
 * ```typescript
 * const notifications = createMockNotifications();
 * (global as any).ui = { notifications };
 *
 * // Test code triggers notification
 * widget._onRoll();
 *
 * // Verify
 * expect(notifications.error).toHaveBeenCalledWith('Insufficient Momentum!');
 * ```
 */
export function createMockNotifications(): MockNotifications {
  return {
    info: vi.fn((message: string) => {
      // Can add logging for debugging
      // console.log('[INFO]', message);
    }),
    warn: vi.fn((message: string) => {
      // console.log('[WARN]', message);
    }),
    error: vi.fn((message: string) => {
      // console.log('[ERROR]', message);
    }),
  };
}

/**
 * Create complete mock UI object
 *
 * @returns Mock UI with notifications
 */
export function createMockUI() {
  return {
    notifications: createMockNotifications(),
  };
}

/* -------------------------------------------- */
/*  Chat Message Mocks                          */
/* -------------------------------------------- */

export interface MockChatMessageData {
  content: string;
  speaker?: any;
  flavor?: string;
  whisper?: string[];
  blind?: boolean;
}

export interface MockChatMessage {
  id: string;
  content: string;
  speaker: any;
  flavor?: string;
}

export interface MockChatMessageConstructor {
  create: ReturnType<typeof vi.fn<[MockChatMessageData], Promise<MockChatMessage>>>;
  getSpeaker: ReturnType<typeof vi.fn>;
}

/**
 * Create mock ChatMessage constructor
 *
 * @returns Mock ChatMessage with create and getSpeaker methods
 *
 * @example
 * ```typescript
 * const ChatMessage = createMockChatMessage();
 * (global as any).ChatMessage = ChatMessage;
 *
 * // Test code posts to chat
 * await ChatMessage.create({ content: 'Test message' });
 *
 * // Verify
 * expect(ChatMessage.create).toHaveBeenCalledWith(
 *   expect.objectContaining({ content: 'Test message' })
 * );
 * ```
 */
export function createMockChatMessage(): MockChatMessageConstructor {
  let messageIdCounter = 0;

  return {
    create: vi.fn(async (data: MockChatMessageData): Promise<MockChatMessage> => {
      const id = `chat-msg-${++messageIdCounter}`;
      return {
        id,
        content: data.content,
        speaker: data.speaker || {},
        flavor: data.flavor,
      };
    }),

    getSpeaker: vi.fn((options?: { actor?: any }) => {
      return {
        alias: options?.actor?.name || 'Test User',
        actor: options?.actor?.id,
      };
    }),
  };
}

/* -------------------------------------------- */
/*  Dice Roll Mocks                             */
/* -------------------------------------------- */

export interface MockRollResult {
  result: number;
  active?: boolean;
  discarded?: boolean;
}

export interface MockDie {
  results: MockRollResult[];
  faces: number;
  number: number;
}

export interface MockRollInstance {
  total: number;
  dice: MockDie[];
  terms: any[];
  formula: string;
  toMessage: ReturnType<typeof vi.fn>;
  evaluate: (options?: { async?: boolean }) => Promise<MockRollInstance>;
}

export interface MockRollConstructor {
  create: ReturnType<typeof vi.fn<[string], MockRollInstance>>;
}

/**
 * Create mock Roll constructor with deterministic results
 *
 * @param defaultResults - Default dice results (e.g., [6, 5, 4])
 * @returns Mock Roll constructor
 *
 * @example
 * ```typescript
 * const Roll = createMockRoll([6, 5, 4]);
 * (global as any).Roll = Roll;
 *
 * // Test code rolls dice
 * const roll = await Roll.create('3d6').evaluate();
 *
 * // Results are deterministic
 * expect(roll.dice[0].results).toEqual([
 *   { result: 6 },
 *   { result: 5 },
 *   { result: 4 },
 * ]);
 * ```
 */
export function createMockRoll(defaultResults: number[] = [6, 5, 4]): MockRollConstructor {
  let customResults: number[] | null = null;

  const mockRoll: MockRollConstructor = {
    create: vi.fn((formula: string): MockRollInstance => {
      const results = customResults || defaultResults;
      customResults = null; // Reset for next call

      // Parse formula to determine if it's 2d6kl (desperate) or Nd6
      const isDesperate = formula.includes('kl');
      const total = isDesperate ? Math.min(...results) : Math.max(...results);

      const rollInstance: MockRollInstance = {
        total,
        dice: [
          {
            results: results.map(r => ({ result: r })),
            faces: 6,
            number: results.length,
          },
        ],
        terms: [],
        formula,

        toMessage: vi.fn(async (options?: any) => {
          return {
            id: `roll-msg-${Date.now()}`,
            content: `Rolled ${formula}: ${total}`,
            speaker: options?.speaker || {},
            flavor: options?.flavor,
          };
        }),

        evaluate: vi.fn(async (_options?: { async?: boolean }) => {
          return rollInstance;
        }),
      };

      return rollInstance;
    }),
  };

  return mockRoll;
}

/**
 * Set custom results for the next roll
 *
 * Useful when you need different results for multiple rolls in a test.
 *
 * @param roll - Mock Roll constructor
 * @param results - Results for next roll
 *
 * @example
 * ```typescript
 * const Roll = createMockRoll([6, 6]); // Default: critical
 *
 * // First roll uses default
 * const roll1 = await Roll.create('2d6').evaluate();
 * expect(roll1.total).toBe(6);
 *
 * // Second roll uses custom results
 * setNextRollResults(Roll, [3, 2]); // Failure
 * const roll2 = await Roll.create('2d6').evaluate();
 * expect(roll2.total).toBe(3);
 * ```
 */
export function setNextRollResults(roll: MockRollConstructor, results: number[]): void {
  (roll as any)._customResults = results;
}

/* -------------------------------------------- */
/*  Dialog Mocks                                */
/* -------------------------------------------- */

export interface MockDialogButton {
  icon?: string;
  label: string;
  callback?: (html: any) => void | Promise<void>;
}

export interface MockDialogData {
  title: string;
  content: string;
  buttons: Record<string, MockDialogButton>;
  default?: string;
  close?: () => void;
}

export interface MockDialogInstance {
  render: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

export interface MockDialogConstructor {
  new(data: MockDialogData, options?: any): MockDialogInstance;
}

/**
 * Create mock Dialog constructor
 *
 * @param autoClose - Whether to automatically close dialog after callback (default: true)
 * @returns Mock Dialog constructor
 *
 * @example
 * ```typescript
 * const Dialog = createMockDialog();
 * (global as any).Dialog = Dialog;
 *
 * // Test code creates dialog
 * const dialog = new Dialog({
 *   title: 'Test Dialog',
 *   content: 'Content',
 *   buttons: {
 *     ok: { label: 'OK', callback: (html) => console.log('OK') },
 *   },
 * });
 *
 * // Simulate user clicking OK
 * dialog.render(true);
 * ```
 */
export function createMockDialog(autoClose: boolean = true): MockDialogConstructor {
  return class MockDialog implements MockDialogInstance {
    public render: ReturnType<typeof vi.fn>;
    public close: ReturnType<typeof vi.fn>;

    constructor(
      private data: MockDialogData,
      private options?: any
    ) {
      this.render = vi.fn((force?: boolean) => {
        // Automatically trigger default button callback if autoClose is enabled
        if (autoClose && this.data.default && this.data.buttons[this.data.default]) {
          const button = this.data.buttons[this.data.default];
          if (button.callback) {
            const mockHtml = createMockJQuery();
            button.callback(mockHtml);
          }
        }
      });

      this.close = vi.fn(() => {
        if (this.data.close) {
          this.data.close();
        }
      });
    }
  } as any;
}

/* -------------------------------------------- */
/*  jQuery Event Mocks                          */
/* -------------------------------------------- */

export interface MockJQueryEvent {
  currentTarget: HTMLElement;
  target: HTMLElement;
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
  type: string;
}

/**
 * Create mock jQuery click event
 *
 * @param dataAttributes - HTML data attributes for currentTarget
 * @returns Mock click event
 *
 * @example
 * ```typescript
 * const event = createMockClickEvent({ 'data-action': 'roll' });
 * await widget._onRoll(event);
 * ```
 */
export function createMockClickEvent(
  dataAttributes: Record<string, string> = {}
): MockJQueryEvent {
  const currentTarget = {
    dataset: dataAttributes,
  } as HTMLElement;

  return {
    currentTarget,
    target: currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type: 'click',
  } as any;
}

/**
 * Create mock jQuery change event
 *
 * @param value - Input value
 * @param name - Input name attribute
 * @returns Mock change event
 *
 * @example
 * ```typescript
 * const event = createMockChangeEvent('force', 'approach');
 * await widget._onApproachChange(event);
 * ```
 */
export function createMockChangeEvent(
  value: string,
  name?: string
): MockJQueryEvent {
  const currentTarget = {
    value,
    name: name || '',
  } as HTMLSelectElement;

  return {
    currentTarget: currentTarget as any,
    target: currentTarget as any,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type: 'change',
  } as any;
}

/**
 * Create mock jQuery object
 *
 * @param values - Key-value pairs of selector → element data
 * @returns Mock jQuery instance
 *
 * @example
 * ```typescript
 * const $ = createMockJQuery({
 *   '[name="name"]': { val: () => 'Test Item' },
 *   '[name="cost"]': { val: () => '2' },
 * });
 * ```
 */
export function createMockJQuery(values: Record<string, any> = {}): any {
  return {
    find: vi.fn((selector: string) => {
      const element = values[selector] || {};
      return {
        val: vi.fn(() => element.value || element.val?.() || ''),
        ...element,
      };
    }),
  };
}

/* -------------------------------------------- */
/*  Foundry Utils Mocks                         */
/* -------------------------------------------- */

/**
 * Create mock foundry.utils
 *
 * @returns Mock foundry utils object
 *
 * @example
 * ```typescript
 * (global as any).foundry = { utils: createMockFoundryUtils() };
 * const id = foundry.utils.randomID();
 * ```
 */
export function createMockFoundryUtils() {
  let idCounter = 0;

  return {
    randomID: vi.fn(() => `mock-id-${++idCounter}`),
    mergeObject: vi.fn((original: any, other: any) => ({ ...original, ...other })),
    duplicate: vi.fn((obj: any) => JSON.parse(JSON.stringify(obj))),
    deepClone: vi.fn((obj: any) => JSON.parse(JSON.stringify(obj))),
  };
}

/* -------------------------------------------- */
/*  Complete Mock Setup                         */
/* -------------------------------------------- */

/**
 * Set up all UI mocks in global scope
 *
 * @param options - Configuration options
 * @returns All mock objects for test assertions
 *
 * @example
 * ```typescript
 * const mocks = setupUIMocks({ rollResults: [6, 6] });
 *
 * // Test code runs
 * await widget._onRoll();
 *
 * // Verify
 * expect(mocks.notifications.info).toHaveBeenCalled();
 * expect(mocks.ChatMessage.create).toHaveBeenCalledWith(
 *   expect.objectContaining({ content: expect.stringContaining('SUCCESS') })
 * );
 * ```
 */
export function setupUIMocks(options: {
  rollResults?: number[];
  autoCloseDialogs?: boolean;
} = {}) {
  const { rollResults = [6, 5, 4], autoCloseDialogs = true } = options;

  const ui = createMockUI();
  const ChatMessage = createMockChatMessage();
  const Roll = createMockRoll(rollResults);
  const Dialog = createMockDialog(autoCloseDialogs);
  const foundryUtils = createMockFoundryUtils();

  // Mock Application base class (Foundry's base class for all apps/widgets)
  const Application = class MockApplication {
    constructor(options: any = {}) {
      // Store options
    }

    async render(force?: boolean, options?: any): Promise<any> {
      return this;
    }

    async close(options?: any): Promise<void> {
      // No-op
    }

    async _render(force: boolean, options: any): Promise<void> {
      // No-op
    }

    activateListeners(html: any): void {
      // No-op
    }

    async getData(options?: any): Promise<any> {
      return {};
    }

    static get defaultOptions(): any {
      return {};
    }

    get id(): string {
      return 'mock-app-id';
    }
  };

  // Inject into global scope
  (global as any).ui = ui;
  (global as any).ChatMessage = ChatMessage;
  (global as any).Roll = Roll;
  (global as any).Dialog = Dialog;
  (global as any).Application = Application;
  (global as any).foundry = { utils: foundryUtils };

  return {
    ui,
    notifications: ui.notifications,
    ChatMessage,
    Roll,
    Dialog,
    Application,
    foundryUtils,
  };
}

/**
 * Clean up UI mocks from global scope
 *
 * Call this in afterEach() to prevent test pollution.
 */
export function cleanupUIMocks() {
  delete (global as any).ui;
  delete (global as any).ChatMessage;
  delete (global as any).Roll;
  delete (global as any).Dialog;
  delete (global as any).Application;
  delete (global as any).foundry;
}
