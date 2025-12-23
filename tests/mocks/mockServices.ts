/**
 * Mock Service Implementations for Testing
 * 
 * Provides mock implementations of DiceService, NotificationService, and DialogFactory
 * for use in integration tests. These mocks allow deterministic testing without
 * requiring Foundry VTT APIs.
 */

import { vi } from 'vitest';
import type { DiceService, RollResult } from '../../foundry/module/services/diceService';
import type { NotificationService } from '../../foundry/module/services/notificationService';
import type { DialogFactory, FlashbackItemCallback } from '../../foundry/module/services/dialogFactory';

/* -------------------------------------------- */
/*  Mock Dice Service                           */
/* -------------------------------------------- */

/**
 * Mock implementation of DiceService
 * 
 * Allows tests to control dice roll results for deterministic testing.
 * Tracks all rolls and chat posts for verification.
 */
export class MockDiceService implements DiceService {
    // Track all rolls for verification
    public rolls: number[][] = [];
    public chatPosts: Array<{ result: number[], characterId: string, flavor: string }> = [];

    // Queue of predetermined results (FIFO)
    private resultQueue: number[][] = [];

    /**
     * Set the next roll result(s)
     * @param results - Array of roll results to return in order
     */
    public setNextRolls(...results: number[][]): void {
        this.resultQueue.push(...results);
    }

    /**
     * Reset all tracking data
     */
    public reset(): void {
        this.rolls = [];
        this.chatPosts = [];
        this.resultQueue = [];
    }

    async roll(dicePool: number): Promise<number[]> {
        // Use predetermined result if available, otherwise generate default
        const result = this.resultQueue.shift() || this.generateDefaultRoll(dicePool);
        this.rolls.push(result);
        return result;
    }

    async rollWithObject(dicePool: number): Promise<RollResult> {
        const results = await this.roll(dicePool);
        // Return a mock Roll object
        return {
            results,
            roll: { total: results.reduce((a, b) => a + b, 0) } as any
        };
    }

    async rollAndPostToChat(dicePool: number, characterId: string, flavor: string): Promise<number[]> {
        const result = await this.roll(dicePool);
        this.chatPosts.push({ result, characterId, flavor });
        return result;
    }

    async rollWithDiceSoNice(dicePool: number): Promise<number[]> {
        // Just roll, no chat post - simulates Dice So Nice without message
        return this.roll(dicePool);
    }

    /**
     * Generate a default roll result (for when no predetermined result is set)
     */
    private generateDefaultRoll(dicePool: number): number[] {
        if (dicePool === 0) {
            return [3]; // Desperate roll default
        }
        // Generate descending sequence: [6, 5, 4, ...]
        return Array.from({ length: dicePool }, (_, i) => Math.max(1, 6 - i));
    }
}

/* -------------------------------------------- */
/*  Mock Notification Service                   */
/* -------------------------------------------- */

/**
 * Mock implementation of NotificationService
 * 
 * Tracks all notifications for verification without displaying UI.
 */
export class MockNotificationService implements NotificationService {
    public infoMessages: string[] = [];
    public warnMessages: string[] = [];
    public errorMessages: string[] = [];

    // Vitest spies for advanced verification
    public info = vi.fn((message: string) => {
        this.infoMessages.push(message);
    });

    public warn = vi.fn((message: string) => {
        this.warnMessages.push(message);
    });

    public error = vi.fn((message: string) => {
        this.errorMessages.push(message);
    });

    /**
     * Reset all tracking data
     */
    public reset(): void {
        this.infoMessages = [];
        this.warnMessages = [];
        this.errorMessages = [];
        this.info.mockClear();
        this.warn.mockClear();
        this.error.mockClear();
    }
}

/* -------------------------------------------- */
/*  Mock Dialog Factory                         */
/* -------------------------------------------- */

/**
 * Mock dialog instance
 * Tracks render calls and provides callback simulation
 */
export class MockDialog {
    public rendered = false;
    public renderCount = 0;

    constructor(
        public type: 'rally' | 'flashback-traits' | 'flashback-item',
        public characterId?: string,
        public crewId?: string,
        public onSubmit?: FlashbackItemCallback
    ) { }

    render(force: boolean): void {
        this.rendered = true;
        this.renderCount++;
    }

    /**
     * Simulate user submitting the dialog
     * (For testing dialog callbacks)
     */
    async simulateSubmit(data?: any): Promise<void> {
        if (this.type === 'flashback-item' && this.onSubmit) {
            await this.onSubmit(data);
        }
    }
}

/**
 * Mock implementation of DialogFactory
 * 
 * Creates mock dialogs that track creation and rendering without displaying UI.
 */
export class MockDialogFactory implements DialogFactory {
    public dialogs: MockDialog[] = [];

    createRallyDialog(characterId: string, crewId: string): { render: (force: boolean) => void } {
        const dialog = new MockDialog('rally', characterId, crewId);
        this.dialogs.push(dialog);
        return dialog;
    }

    createFlashbackTraitsDialog(characterId: string, crewId: string): { render: (force: boolean) => void } {
        const dialog = new MockDialog('flashback-traits', characterId, crewId);
        this.dialogs.push(dialog);
        return dialog;
    }

    createFlashbackItemDialog(onSubmit: FlashbackItemCallback): { render: (force: boolean) => void } {
        const dialog = new MockDialog('flashback-item', undefined, undefined, onSubmit);
        this.dialogs.push(dialog);
        return dialog;
    }

    /**
     * Reset all tracking data
     */
    public reset(): void {
        this.dialogs = [];
    }

    /**
     * Get the last created dialog of a specific type
     */
    public getLastDialog(type?: 'rally' | 'flashback-traits' | 'flashback-item'): MockDialog | undefined {
        if (type) {
            return [...this.dialogs].reverse().find(d => d.type === type);
        }
        return this.dialogs[this.dialogs.length - 1];
    }
}

/* -------------------------------------------- */
/*  Factory Functions                           */
/* -------------------------------------------- */

/**
 * Create a complete set of mock services
 * 
 * @returns Object containing all mock services with shared reset function
 */
export function createMockServices() {
    const diceService = new MockDiceService();
    const notificationService = new MockNotificationService();
    const dialogFactory = new MockDialogFactory();

    return {
        diceService,
        notificationService,
        dialogFactory,

        /**
         * Reset all services at once
         */
        resetAll(): void {
            diceService.reset();
            notificationService.reset();
            dialogFactory.reset();
        }
    };
}
