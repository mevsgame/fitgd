import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';
import type { EnhancedStore } from '@reduxjs/toolkit';
import type { RootState } from '../../src/store';
import type { GameAPI } from '../../src/api';

describe('Debug API', () => {
    let store: EnhancedStore<RootState>;
    let api: GameAPI;

    beforeEach(() => {
        store = configureStore();
        api = createGameAPI(store);
    });

    it('should create character', () => {
        const characterId = api.character.create({
            name: 'Operative 7',
            traits: [
                {
                    id: 'trait-1',
                    name: 'Veteran Sniper',
                    category: 'role',
                    disabled: false,
                    acquiredAt: Date.now(),
                },
                {
                    id: 'trait-2',
                    name: 'Hive City Survivor',
                    category: 'background',
                    disabled: false,
                    acquiredAt: Date.now(),
                },
            ],
            approaches: {
                force: 2,
                guile: 1,
                focus: 1,
                spirit: 0,
            },
        });
        expect(characterId).toBeDefined();
    });
});
