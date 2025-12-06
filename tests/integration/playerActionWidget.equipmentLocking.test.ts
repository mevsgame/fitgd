/**
 * Equipment Locking Integration Tests
 *
 * TDD tests for equipment locking on roll commit.
 * These tests SHOULD FAIL until the feature is implemented.
 *
 * Per docs/player-action-widget.md:
 * - Equipment locks when roll is committed
 * - First-lock momentum cost (1M for Rare/Epic, 0M for Common)
 * - Consumables are marked as depleted when locked
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';
import type { Equipment } from '../../src/types/character';

describe('PlayerActionWidget - Equipment Locking on Roll Commit', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Active Equipment Locking', () => {
        /**
         * RULE: Active equipment selected in equippedForAction
         * should become locked when roll is committed
         */
        it('should lock Active equipment on roll commit', async () => {
            const activeEquipment: Equipment = {
                id: 'eq-active',
                name: 'Chainsword',
                tier: 'common',
                category: 'active',
                slots: 1,
                locked: false, // Initially unlocked
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [activeEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 5,
                }),
                rollResults: [6, 5, 4], // Success
            });

            // Setup roll plan with Active equipment
            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-active');

            // Verify equipment is selected
            expect(harness.getPlayerState()?.equippedForAction).toContain('eq-active');

            // Execute roll
            await harness.clickRoll();

            // CRITICAL ASSERTION: Equipment should now be locked
            const character = harness.getCharacter();
            const equipment = character?.equipment.find(e => e.id === 'eq-active');
            expect(equipment?.locked).toBe(true);
        });

        it('should lock multiple Active equipment items on roll commit', async () => {
            // Multi-select scenario (if supported)
            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [
                        { id: 'eq-1', name: 'Weapon', tier: 'common', category: 'active', slots: 1, locked: false, equipped: true, consumed: false, acquiredAt: Date.now() },
                        { id: 'eq-2', name: 'Shield', tier: 'common', category: 'active', slots: 1, locked: false, equipped: true, consumed: false, acquiredAt: Date.now() },
                    ],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-1');
            await harness.clickRoll();

            const character = harness.getCharacter();
            const eq1 = character?.equipment.find(e => e.id === 'eq-1');
            expect(eq1?.locked).toBe(true);
        });
    });

    describe('Passive Equipment Locking', () => {
        /**
         * RULE: GM-approved Passive equipment (approvedPassiveId)
         * should become locked when roll is committed
         */
        it('should lock GM-approved Passive equipment on roll commit', async () => {
            const passiveEquipment: Equipment = {
                id: 'eq-passive',
                name: 'Power Armor',
                tier: 'rare',
                category: 'passive',
                slots: 2,
                locked: false,
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true, // GM session to approve passive
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [passiveEquipment],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.approvePassive('eq-passive');

            // Verify passive is approved
            expect(harness.getPlayerState()?.approvedPassiveId).toBe('eq-passive');

            await harness.clickRoll();

            // CRITICAL ASSERTION: Passive should now be locked
            const character = harness.getCharacter();
            const equipment = character?.equipment.find(e => e.id === 'eq-passive');
            expect(equipment?.locked).toBe(true);
        });
    });

    describe('Consumable Equipment Locking and Depletion', () => {
        /**
         * RULE: Consumables should be BOTH locked AND consumed on roll commit
         */
        it('should lock AND deplete Consumable on roll commit', async () => {
            const consumable: Equipment = {
                id: 'eq-consumable',
                name: 'Stims Pack',
                tier: 'common',
                category: 'consumable',
                slots: 1,
                locked: false,
                equipped: true,
                consumed: false, // Not yet consumed
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [consumable],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-consumable');
            await harness.clickRoll();

            const character = harness.getCharacter();
            const equipment = character?.equipment.find(e => e.id === 'eq-consumable');

            // CRITICAL ASSERTION: Both locked AND consumed
            expect(equipment?.locked).toBe(true);
            expect(equipment?.consumed).toBe(true);
        });
    });

    describe('First-Lock Momentum Cost', () => {
        /**
         * RULE: Rare/Epic items cost 1M on first lock
         * Common items cost 0M
         */
        it('should deduct 1M for first-lock of Rare equipment', async () => {
            const rareEquipment: Equipment = {
                id: 'eq-rare',
                name: 'Plasma Rifle',
                tier: 'rare',
                category: 'active',
                slots: 1,
                locked: false, // Not yet locked - first time use
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [rareEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 5, // Starting momentum
                }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-rare');
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 1
            const crew = harness.getCrew();
            expect(crew?.currentMomentum).toBe(4); // 5 - 1 = 4
        });

        it('should deduct 1M for first-lock of Epic equipment', async () => {
            const epicEquipment: Equipment = {
                id: 'eq-epic',
                name: 'Power Sword',
                tier: 'epic',
                category: 'active',
                slots: 2,
                locked: false,
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [epicEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 5,
                }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-epic');
            await harness.clickRoll();

            const crew = harness.getCrew();
            expect(crew?.currentMomentum).toBe(4); // 5 - 1 = 4
        });

        it('should NOT deduct momentum for Common equipment', async () => {
            const commonEquipment: Equipment = {
                id: 'eq-common',
                name: 'Basic Rifle',
                tier: 'common',
                category: 'active',
                slots: 1,
                locked: false,
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [commonEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 5,
                }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-common');
            await harness.clickRoll();

            const crew = harness.getCrew();
            expect(crew?.currentMomentum).toBe(5); // Unchanged - common is free
        });

        it('should NOT deduct momentum for already-locked equipment', async () => {
            // Equipment that was locked in a previous roll
            const alreadyLockedEquipment: Equipment = {
                id: 'eq-locked',
                name: 'Previously Used Rifle',
                tier: 'rare',
                category: 'active',
                slots: 1,
                locked: true, // Already locked from previous usage
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [alreadyLockedEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 5,
                }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-locked');
            await harness.clickRoll();

            const crew = harness.getCrew();
            expect(crew?.currentMomentum).toBe(5); // Unchanged - already locked
        });
    });

    describe('Momentum Validation', () => {
        /**
         * RULE: Roll should be blocked if insufficient momentum for equipment locks
         */
        it('should block roll when insufficient momentum for Rare equipment first-lock', async () => {
            const rareEquipment: Equipment = {
                id: 'eq-rare',
                name: 'Expensive Item',
                tier: 'rare',
                category: 'active',
                slots: 1,
                locked: false,
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [rareEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: 0, // No momentum!
                }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-rare');

            // Roll should fail or show error
            // The actual behavior may vary (blocked button, error notification, etc.)
            // We'll check that state doesn't transition to ROLLING
            try {
                await harness.clickRoll();
            } catch {
                // Expected to throw or fail
            }

            const playerState = harness.getPlayerState();
            // Should NOT have reached SUCCESS_COMPLETE or GM_RESOLVING_CONSEQUENCE
            expect(playerState?.state).not.toBe('SUCCESS_COMPLETE');
            expect(playerState?.outcome).toBeUndefined();
        });
    });

    describe('Idempotency', () => {
        /**
         * RULE: Locking already-locked items should be idempotent
         */
        it('should keep equipment locked if already locked', async () => {
            const alreadyLockedEquipment: Equipment = {
                id: 'eq-locked',
                name: 'Locked Item',
                tier: 'common',
                category: 'active',
                slots: 1,
                locked: true, // Already locked
                equipped: true,
                consumed: false,
                acquiredAt: Date.now(),
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [alreadyLockedEquipment],
                }),
                crew: createMockCrew({ id: 'crew-1', characters: ['char-1'], currentMomentum: 5 }),
                rollResults: [6, 5, 4],
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');
            await harness.selectSecondary('eq-locked');
            await harness.clickRoll();

            const character = harness.getCharacter();
            const equipment = character?.equipment.find(e => e.id === 'eq-locked');
            expect(equipment?.locked).toBe(true); // Still locked
        });
    });
});
