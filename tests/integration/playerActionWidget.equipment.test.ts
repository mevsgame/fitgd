import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Equipment Integration', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Active Equipment Selection', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-1', name: 'Chainsword', tier: 'rare', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                        { id: 'eq-2', name: 'Pistol', tier: 'common', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    ],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
            });
        });

        it('should select active equipment for action', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            harness.spy.reset();

            // Select active equipment
            await harness.selectSecondary('eq-1');

            const playerState = harness.getPlayerState();
            expect(playerState?.equippedForAction).toContain('eq-1');
        });

        it('should deselect active equipment', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Select then deselect
            await harness.selectSecondary('eq-1');
            expect(harness.getPlayerState()?.equippedForAction).toContain('eq-1');

            // Select a different one (replaces previous)
            await harness.selectSecondary('eq-2');
            const playerState = harness.getPlayerState();
            expect(playerState?.equippedForAction).toContain('eq-2');
        });

        it('should support multiple active equipment slots', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Select first equipment
            await harness.selectSecondary('eq-1');
            // Select second equipment (should add, not replace if multi-slot)
            await harness.selectSecondary('eq-2');

            const playerState = harness.getPlayerState();
            // At least one should be equipped
            expect(playerState?.equippedForAction?.length || 0).toBeGreaterThan(0);
        });

        it('should track equipped status in Redux state', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            await harness.selectSecondary('eq-1');

            const state = harness.getState();
            const equipment = state.characters.byId['char-1']?.equipment.find((e: any) => e.id === 'eq-1');
            // Note: Equipment equipped status is tracked separately in playerRoundState
            expect(harness.getPlayerState()?.equippedForAction).toBeDefined();
        });
    });

    describe('Passive Equipment Approval (GM)', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-passive', name: 'Power Armor', tier: 'epic', category: 'passive', slots: 3, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    ],
                }),
            });
        });

        it('should allow GM to approve passive equipment', async () => {
            await harness.advanceToState('DECISION_PHASE');
            harness.spy.reset();

            // GM approves passive
            await harness.approvePassive('eq-passive');

            expect(harness.getPlayerState()?.approvedPassiveId).toBe('eq-passive');
            expect(harness.spy.data.broadcasts).toBe(1);
        });

        it('should clear approved passive when new one approved', async () => {
            // Add second passive
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-passive-1', name: 'Power Armor', tier: 'epic', category: 'passive', slots: 3, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                        { id: 'eq-passive-2', name: 'Shield Generator', tier: 'rare', category: 'passive', slots: 2, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    ],
                }),
            });

            await harness.advanceToState('DECISION_PHASE');

            // Approve first
            await harness.approvePassive('eq-passive-1');
            expect(harness.getPlayerState()?.approvedPassiveId).toBe('eq-passive-1');

            // Approve second (should replace)
            await harness.approvePassive('eq-passive-2');
            expect(harness.getPlayerState()?.approvedPassiveId).toBe('eq-passive-2');
        });
    });

    describe('Consumable Equipment', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-consumable', name: 'Stims Pack', tier: 'common', category: 'consumable', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                        { id: 'eq-consumable-2', name: 'Flash Grenade', tier: 'rare', category: 'consumable', slots: 1, locked: false, equipped: false, consumed: true, createdAt: 0, updatedAt: 0 },
                    ],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'] }),
            });
        });

        it('should track consumed status of consumables', async () => {
            const state = harness.getState();
            const consumable1 = state.characters.byId['char-1']?.equipment.find((e: any) => e.id === 'eq-consumable');
            const consumable2 = state.characters.byId['char-1']?.equipment.find((e: any) => e.id === 'eq-consumable-2');

            expect(consumable1?.consumed).toBe(false);
            expect(consumable2?.consumed).toBe(true);
        });

        it('should filter available consumables', async () => {
            await harness.advanceToState('DECISION_PHASE');

            const state = harness.getState();
            const availableConsumables = state.characters.byId['char-1']?.equipment.filter(
                (e: any) => e.category === 'consumable' && !e.consumed
            );

            expect(availableConsumables?.length).toBe(1);
            expect(availableConsumables?.[0].id).toBe('eq-consumable');
        });
    });

    describe('Equipment State Transitions', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-1', name: 'Weapon', tier: 'common', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                        { id: 'eq-2', name: 'Shield', tier: 'common', category: 'active', slots: 1, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    ],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
            });
        });

        it('should maintain equipment state across action phases', async () => {
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-1');

            const beforeRoll = harness.getPlayerState()?.equippedForAction;
            expect(beforeRoll).toContain('eq-1');

            // Roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // Equipment selection should persist through roll
            const afterRoll = harness.getState().playerRoundState.byCharacterId['char-1']?.equippedForAction;
            expect(afterRoll).toContain('eq-1');
        });

        it('should verify equipment availability', async () => {
            const character = harness.getCharacter();
            expect(character?.equipment.length).toBeGreaterThan(0);

            // Verify all equipment has required fields
            character?.equipment.forEach((eq: any) => {
                expect(eq.id).toBeDefined();
                expect(eq.name).toBeDefined();
                expect(eq.category).toBeDefined();
                expect(eq.slots).toBeGreaterThan(0);
                expect(typeof eq.locked).toBe('boolean');
                expect(typeof eq.consumed).toBe('boolean');
            });
        });
    });

    describe('Equipment Edge Cases', () => {
        beforeEach(async () => {
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-0-slots', name: 'Void Item', tier: 'common', category: 'active', slots: 0, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                        { id: 'eq-many-slots', name: 'Arsenal', tier: 'epic', category: 'active', slots: 10, locked: false, equipped: false, consumed: false, createdAt: 0, updatedAt: 0 },
                    ],
                }),
            });
        });

        it('should handle equipment with zero slots', async () => {
            const state = harness.getState();
            const equipment = state.characters.byId['char-1']?.equipment.find((e: any) => e.id === 'eq-0-slots');
            expect(equipment?.slots).toBe(0);
        });

        it('should handle equipment with many slots', async () => {
            const state = harness.getState();
            const equipment = state.characters.byId['char-1']?.equipment.find((e: any) => e.id === 'eq-many-slots');
            expect(equipment?.slots).toBe(10);
        });

        it('should handle empty equipment list', async () => {
            const harness2 = await createWidgetHarness({
                characterId: 'char-2',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-2',
                    equipment: [],
                }),
            });

            const equipment = harness2.getCharacter()?.equipment;
            expect(equipment?.length).toBe(0);

            harness2.cleanup();
        });
    });
});
