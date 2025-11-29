/**
 * Vitest Setup File for Integration Tests
 * 
 * This file runs before all tests to set up global mocks for Foundry VTT APIs.
 * It ensures that Foundry base classes like Application are available before
 * any test files are loaded.
 */

// Mock Foundry's Application base class globally
(global as any).Application = class MockApplication {
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

// Mock FormApplication (extends Application)
(global as any).FormApplication = class MockFormApplication extends (global as any).Application {
    static get defaultOptions(): any {
        return {
            ...super.defaultOptions,
            classes: [],
            template: '',
            width: 400,
            height: 'auto',
        };
    }
};

// Mock Foundry's Dialog class
(global as any).Dialog = class MockDialog extends (global as any).Application {
    constructor(data: any, options: any) {
        super(options);
        this.data = data;
    }

    static async prompt(options: any): Promise<any> {
        return {};
    }

    static async confirm(options: any): Promise<boolean> {
        return true;
    }
};

console.log('Vitest setup: Foundry Application mocks initialized');
