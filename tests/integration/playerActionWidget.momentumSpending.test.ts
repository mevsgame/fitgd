/**
 * Momentum Spending Integration Tests
 *
 * TDD tests to verify momentum is correctly spent on roll commit.
 * These tests should FAIL until the bug is fixed.
 *
 * Per docs/player-action-widget.md and vault/rules_primer.md:
 * - Push Yourself: 1 Momentum (line 38 of rules_primer.md)
 * - Flashback: 1 Momentum per flashback (line 40 of rules_primer.md)
 * - Equipment first-lock (Rare/Epic): 1 Momentum per item (lines 252, 254, 268 of rules_primer.md)
 *
 * The bug: baseMomentumCost (Push/Flashback) is calculated for validation
 * but never actually spent in the roll batch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';
import type { Equipment } from '../../src/types/character';

describe('PlayerActionWidget - Momentum Spending on Roll Commit', () => {
    let harness: WidgetTestHarness;

    afterEach(() => {
        if (harness) harness.cleanup();
    });

    describe('Push Die Momentum Spending', () => {
        /**
         * RULE: Push Yourself costs 1 Momentum (rules_primer.md line 38)
         * BUG: Push momentum cost is calculated but never spent
         */
        it('should spend 1M when using Push Die on roll commit', async () => {
            const initialMomentum = 5;
            const crew = createMockCrew({
                id: 'crew-1',
                characters: ['char-1'],
                currentMomentum: initialMomentum,
            });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Enable Push Die
            await harness.clickPushDie();

            // Verify push is active
            const playerState = harness.getPlayerState();
            expect(playerState?.pushed).toBe(true);
            expect(playerState?.pushType).toBe('extra-die');

            // Set up successful roll to avoid consequence handling
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 1 for push
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum - 1); // 5 - 1 = 4
        });
    });

    describe('Push Effect Momentum Spending', () => {
        /**
         * RULE: Push Yourself costs 1 Momentum (rules_primer.md line 38)
         * BUG: Push momentum cost is calculated but never spent
         */
        it('should spend 1M when using Push Effect on roll commit', async () => {
            const initialMomentum = 5;
            const crew = createMockCrew({
                id: 'crew-1',
                characters: ['char-1'],
                currentMomentum: initialMomentum,
            });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({ id: 'char-1' }),
                crew,
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Enable Push Effect
            await harness.clickPushEffect();

            // Verify push is active
            const playerState = harness.getPlayerState();
            expect(playerState?.pushed).toBe(true);
            expect(playerState?.pushType).toBe('improved-effect');

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 1 for push
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum - 1); // 5 - 1 = 4
        });
    });

    describe('Flashback Momentum Spending', () => {
        /**
         * RULE: Flashback costs 1 Momentum (rules_primer.md line 40)
         * BUG: Flashback momentum cost is calculated but never spent
         */
        it('should spend 1M when using Flashback on roll commit', async () => {
            const initialMomentum = 5;
            const crew = createMockCrew({
                id: 'crew-1',
                characters: ['char-1'],
                currentMomentum: initialMomentum,
            });

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    traits: [{ id: 'trait-1', name: 'Veteran', description: 'Battle hardened', disabled: false }],
                }),
                crew,
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Apply a trait transaction (simulating flashback)
            // This sets up a trait transaction with position improvement and momentum cost
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setTraitTransaction',
                payload: {
                    characterId: 'char-1',
                    transaction: {
                        type: 'flashback',
                        traitId: 'trait-1',
                        positionImprovement: true,
                        momentumCost: 1,
                    },
                },
            });

            // Verify trait transaction is active
            const playerState = harness.getPlayerState();
            expect(playerState?.traitTransaction).toBeDefined();
            expect(playerState?.traitTransaction?.momentumCost).toBe(1);

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 1 for flashback
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum - 1); // 5 - 1 = 4
        });
    });

    describe('Combined Momentum Spending', () => {
        /**
         * RULE: Multiple momentum costs should stack
         * Push (1M) + Rare Equipment First-lock (1M) = 2M total
         */
        it('should spend correct total when combining Push and Equipment first-lock', async () => {
            const initialMomentum = 5;

            const rareEquipment: Equipment = {
                id: 'eq-rare',
                name: 'Plasma Rifle',
                tier: 'rare',
                category: 'active',
                slots: 2,
                equipped: true,
                locked: false,
                consumed: false,
                modifiers: { diceBonus: 2 },
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
                    currentMomentum: initialMomentum,
                }),
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Enable Push Die (1M)
            await harness.clickPushDie();

            // Select Rare equipment (1M for first-lock)
            await harness.selectSecondary('eq-rare');

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 2 total (1 push + 1 equipment)
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum - 2); // 5 - 2 = 3
        });

        /**
         * RULE: All costs must be included
         * Push (1M) + Flashback (1M) + Rare Active (1M) + Rare Passive (1M) = 4M total
         */
        it('should spend correct total when combining Push, Flashback, and multiple Equipment first-locks', async () => {
            const initialMomentum = 6;

            const rareActive: Equipment = {
                id: 'eq-active-rare',
                name: 'Power Sword',
                tier: 'rare',
                category: 'active',
                slots: 2,
                equipped: true,
                locked: false,
                consumed: false,
                modifiers: { diceBonus: 1 },
            };

            const rarePassive: Equipment = {
                id: 'eq-passive-rare',
                name: 'Power Armor',
                tier: 'rare',
                category: 'passive',
                slots: 3,
                equipped: true,
                locked: false,
                consumed: false,
                modifiers: { positionBonus: 1 },
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: true, // GM to approve passive
                character: createMockCharacter({
                    id: 'char-1',
                    traits: [{ id: 'trait-1', name: 'Veteran', description: 'Battle hardened', disabled: false }],
                    equipment: [rareActive, rarePassive],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: initialMomentum,
                }),
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Enable Push Die (1M)
            await harness.clickPushDie();

            // Apply a trait transaction (1M for flashback)
            await harness.game.fitgd.bridge.execute({
                type: 'playerRoundState/setTraitTransaction',
                payload: {
                    characterId: 'char-1',
                    transaction: {
                        type: 'flashback',
                        traitId: 'trait-1',
                        positionImprovement: true,
                        momentumCost: 1,
                    },
                },
            });

            // Select Rare Active equipment (1M for first-lock)
            await harness.selectSecondary('eq-active-rare');

            // GM approves Rare Passive equipment (1M for first-lock)
            await harness.approvePassive('eq-passive-rare');

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // CRITICAL ASSERTION: Momentum should be reduced by 4 total
            // 1 (push) + 1 (flashback) + 1 (rare active) + 1 (rare passive) = 4M
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum - 4); // 6 - 4 = 2
        });
    });

    describe('No Momentum Spent for Free Actions', () => {
        /**
         * RULE: Common equipment costs 0M (rules_primer.md line 250)
         * Standard rolls without push/flashback should not spend momentum
         */
        it('should NOT spend momentum for standard roll with Common equipment', async () => {
            const initialMomentum = 5;

            const commonEquipment: Equipment = {
                id: 'eq-common',
                name: 'Basic Rifle',
                tier: 'common',
                category: 'active',
                slots: 1,
                equipped: true,
                locked: false,
                consumed: false,
                modifiers: { diceBonus: 1 },
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
                    currentMomentum: initialMomentum,
                }),
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Select Common equipment (0M)
            await harness.selectSecondary('eq-common');

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // ASSERTION: Momentum should remain unchanged
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum); // 5 - 0 = 5
        });

        /**
         * RULE: Already-locked equipment costs 0M (rules_primer.md line 268)
         */
        it('should NOT spend momentum for already-locked Rare equipment', async () => {
            const initialMomentum = 5;

            const lockedRareEquipment: Equipment = {
                id: 'eq-rare-locked',
                name: 'Plasma Rifle',
                tier: 'rare',
                category: 'active',
                slots: 2,
                equipped: true,
                locked: true, // Already locked - no first-lock cost
                consumed: false,
                modifiers: { diceBonus: 2 },
            };

            harness = await createWidgetHarness({
                characterId: 'char-1',
                isGM: false,
                character: createMockCharacter({
                    id: 'char-1',
                    equipment: [lockedRareEquipment],
                }),
                crew: createMockCrew({
                    id: 'crew-1',
                    characters: ['char-1'],
                    currentMomentum: initialMomentum,
                }),
            });

            await harness.advanceToState('DECISION_PHASE');
            await harness.selectApproach('force');

            // Select already-locked Rare equipment (0M since already locked)
            await harness.selectSecondary('eq-rare-locked');

            // Set up successful roll
            harness.setNextRoll([6]);
            await harness.clickRoll();

            // ASSERTION: Momentum should remain unchanged
            const crewAfter = harness.getCrew();
            expect(crewAfter?.currentMomentum).toBe(initialMomentum); // 5 - 0 = 5
        });
    });
});
