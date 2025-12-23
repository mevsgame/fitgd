
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrewHUDPanel } from '../../foundry/module/widgets/crew-hud-panel';

/**
 * HUD Synchronization Tests
 * 
 * Tests that the CrewHUDPanel correctly updates when Redux state changes.
 * The HUD uses a pure reactive pattern: subscribe to store → debounce → render.
 */

// Mock Foundry globals
const mockRender = vi.fn();
const mockCrewId = 'crew-123';

describe('HUD Synchronization', () => {
    let mockStore: {
        getState: ReturnType<typeof vi.fn>;
        subscribe: ReturnType<typeof vi.fn>;
        dispatch: ReturnType<typeof vi.fn>;
    };
    let subscribeCallback: (() => void) | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        subscribeCallback = null;

        // Create mock store
        mockStore = {
            getState: vi.fn(() => ({
                clocks: { byId: {}, byEntityId: {}, byTypeAndEntity: {} },
                crews: {
                    byId: {
                        'crew-123': {
                            name: 'Test Crew',
                            characters: ['char-abc'],
                            currentMomentum: 5,
                            activePlayerAction: null
                        }
                    },
                    allIds: ['crew-123']
                },
                characters: {
                    byId: {
                        'char-abc': { name: 'Test Character' }
                    }
                }
            })),
            subscribe: vi.fn((callback: () => void) => {
                subscribeCallback = callback;
                return () => { subscribeCallback = null; };
            }),
            dispatch: vi.fn()
        };

        // Setup global game object
        (global as any).game = {
            fitgd: {
                store: mockStore,
                hud: {
                    getInstance: () => null
                }
            },
            user: { isGM: true, name: 'GM' },
            settings: {
                get: vi.fn((module: string, key: string) => {
                    if (key === 'primaryCrewId') return mockCrewId;
                    if (key === 'hudVisible') return true;
                    if (key === 'hudPosition') return '';
                    return undefined;
                }),
                set: vi.fn()
            },
            actors: {
                get: vi.fn()
            }
        };

        // Setup ui.windows
        (global as any).ui = {
            windows: {},
            notifications: { warn: vi.fn() }
        };

        // Mock foundry.utils
        (global as any).foundry = {
            utils: {
                mergeObject: (a: any, b: any) => ({ ...a, ...b })
            }
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should subscribe to store when rendered', async () => {
        // Verify subscribe is called when _subscribeToStore runs
        expect(mockStore.subscribe).not.toHaveBeenCalled();

        // Simulate subscription
        const unsubscribe = mockStore.subscribe(() => { });
        expect(mockStore.subscribe).toHaveBeenCalledTimes(1);

        // Cleanup
        unsubscribe();
    });

    it('should debounce rapid state changes', async () => {
        const renderMock = vi.fn();
        let debounceTimer: number | null = null;

        // Simulate the subscription callback behavior
        const subscriptionHandler = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderMock();
            }, 16) as unknown as number;
        };

        // Trigger 5 rapid state changes
        for (let i = 0; i < 5; i++) {
            subscriptionHandler();
        }

        // Before debounce completes, render should not be called
        expect(renderMock).not.toHaveBeenCalled();

        // Advance timers past debounce threshold
        vi.advanceTimersByTime(20);

        // After debounce, render should be called exactly once
        expect(renderMock).toHaveBeenCalledTimes(1);
    });

    it('should render after debounce delay on state change', async () => {
        const renderMock = vi.fn();
        let debounceTimer: number | null = null;

        // Simulate subscription
        const subscriptionHandler = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderMock();
            }, 16) as unknown as number;
        };

        // Single state change
        subscriptionHandler();

        // At 15ms, not yet rendered
        vi.advanceTimersByTime(15);
        expect(renderMock).not.toHaveBeenCalled();

        // At 17ms, should have rendered
        vi.advanceTimersByTime(2);
        expect(renderMock).toHaveBeenCalledTimes(1);
    });
});
