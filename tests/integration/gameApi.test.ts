import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import characterReducer from '../../src/slices/characterSlice';
import crewReducer from '../../src/slices/crewSlice';
import clockReducer from '../../src/slices/clockSlice';
import { createGameAPI } from '../../src/api';

/**
 * Integration Tests for Complete Game API
 *
 * These tests demonstrate full gameplay flows using the high-level API
 */

describe('Game API Integration', () => {
  let store: ReturnType<typeof configureStore>;
  let game: ReturnType<typeof createGameAPI>;

  beforeEach(() => {
    // Create store with all reducers
    store = configureStore({
      reducer: {
        characters: characterReducer,
        crews: crewReducer,
        clocks: clockReducer,
      },
    });

    // Create game API
    game = createGameAPI(store);
  });

  describe('Complete Gameplay Session', () => {
    it('should support a full mission flow', () => {
      // === SETUP: Create crew and characters ===

      const crewId = game.crew.create('Strike Team Alpha');
      expect(crewId).toBeDefined();

      const char1Id = game.character.create({
        name: 'Sergeant Kane',
        traits: [
          {
            id: 'trait-kane-1',
            name: 'Served with Elite Infantry',
            category: 'role',
            disabled: false,
            acquiredAt: Date.now(),
          },
          {
            id: 'trait-kane-2',
            name: 'Survived Hive Gangs',
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

      const char2Id = game.character.create({
        name: 'Corporal Vex',
        traits: [
          { id: 'trait-vex-1', name: 'Tech-Priest Acolyte', category: 'role', disabled: false, acquiredAt: Date.now() },
          { id: 'trait-vex-2', name: 'Escaped Servitor', category: 'background', disabled: false, acquiredAt: Date.now() },
        ],
        approaches: {
          force: 2,
          guile: 1,
          focus: 1,
          spirit: 0,
        },
      });

      game.crew.addCharacter({ crewId, characterId: char1Id });
      game.crew.addCharacter({ crewId, characterId: char2Id });

      // === SESSION START: Set Momentum to 5 ===

      const startMomentum = game.crew.setMomentum({ crewId, amount: 5 });
      expect(startMomentum).toBe(5);

      // === ACTION 1: Kane makes a risky shot, pushes for extra die ===

      // Push yourself (spend 1 Momentum)
      const pushResult = game.action.push({
        crewId,
        type: 'extra-die',
      });

      expect(pushResult.momentumSpent).toBe(1);
      expect(pushResult.newMomentum).toBe(4); // 5 - 1

      // Roll fails (1-3), take risky/standard harm as consequence
      const failureConsequences = game.action.applyConsequences({
        crewId,
        characterId: char1Id,
        position: 'risky',
        effect: 'standard',
        result: 'failure',
        harmType: 'Physical Harm',
      });

      expect(failureConsequences.momentumGenerated).toBe(2); // Risky = +2
      expect(failureConsequences.newMomentum).toBe(6); // 4 + 2
      expect(failureConsequences.harmApplied).toBeDefined();
      expect(failureConsequences.harmApplied?.segmentsAdded).toBe(2); // Risky/Standard = 2
      expect(failureConsequences.harmApplied?.isDying).toBe(false);

      // === ACTION 2: Vex performs a flashback to establish "Knows Security Protocols" ===

      const flashbackResult = game.action.flashback({
        crewId,
        characterId: char2Id,
        trait: {
          name: 'Knows Security Protocols',
          disabled: false,
          description: 'Worked as security technician in previous posting',
        },
      });

      expect(flashbackResult.momentumSpent).toBe(1);
      expect(flashbackResult.newMomentum).toBe(5); // 6 - 1
      expect(flashbackResult.traitId).toBeDefined();

      // Verify trait was added
      const vexTraits = game.query.getAvailableTraits(char2Id);
      expect(vexTraits).toHaveLength(3); // 2 starting + 1 flashback

      // === ACTION 3: Kane leans into "Served with Elite Infantry" for +2 Momentum ===

      const kaneTraits = game.character.getCharacter(char1Id)!.traits;
      const eliteTraitId = kaneTraits.find(
        (t: { name: string; id: string }) => t.name === 'Served with Elite Infantry'
      )!.id;

      const leanResult = game.character.leanIntoTrait({
        characterId: char1Id,
        traitId: eliteTraitId,
        crewId,
      });

      expect(leanResult.traitDisabled).toBe(true);
      expect(leanResult.momentumGained).toBe(2);
      expect(leanResult.newMomentum).toBe(7); // 5 + 2

      // === ACTION 4: Use consumable (frag grenade) ===

      const grenadeResult = game.resource.useConsumable({
        crewId,
        characterId: char1Id,
        consumableType: 'frag_grenades',
        depletionRoll: 3,
      });

      expect(grenadeResult.clockId).toBeDefined();
      expect(grenadeResult.segmentsAdded).toBe(3);
      expect(grenadeResult.isFrozen).toBe(false);

      // === ACTION 5: Success! No consequences ===

      const successResult = game.action.applyConsequences({
        crewId,
        characterId: char1Id,
        position: 'controlled',
        effect: 'great',
        result: 'success',
      });

      expect(successResult.momentumGenerated).toBe(0); // Success = no Momentum
      expect(successResult.newMomentum).toBe(7); // Unchanged

      // === ACTION 6: Desperate situation, use stim to reroll ===

      const stimResult = game.resource.useStim({
        crewId,
        characterId: char1Id,
        addictionRoll: 2,
      });

      expect(stimResult.clockId).toBeDefined();
      expect(stimResult.segmentsAdded).toBe(2);
      expect(stimResult.isAddicted).toBe(false); // Not filled yet

      // === QUERIES: Check game state ===

      const canRally = game.query.canUseRally({ characterId: char1Id, crewId });
      expect(canRally).toBe(false); // Momentum is 7, rally only at 0-3

      const isDying = game.query.isDying(char1Id);
      expect(isDying).toBe(false); // Only 3/6 harm

      const harmClocks = game.query.getHarmClocks(char1Id);
      expect(harmClocks).toHaveLength(1);
      expect(harmClocks[0].segments).toBe(2);

      const canUseStims = game.query.canUseStim(crewId);
      expect(canUseStims).toBe(true); // Addiction not filled

      const canUseGrenades = game.query.canUseConsumable({
        crewId,
        consumableType: 'frag_grenades',
      });
      expect(canUseGrenades).toBe(true); // Not frozen

      // === DOWNTIME: Recover from harm ===

      const recoveryResult = game.harm.recover({
        characterId: char1Id,
        clockId: harmClocks[0].id,
        segments: 2,
      });

      expect(recoveryResult.segmentsCleared).toBe(2);
      expect(recoveryResult.newSegments).toBe(0); // 2 - 2 = 0
      expect(recoveryResult.clockCleared).toBe(true);

      // === PROGRESS CLOCK: Track long-term project ===

      const projectId = game.clock.createProgress({
        entityId: crewId,
        name: 'Establish Safe House',
        maxSegments: 8,
        category: 'long-term-project',
        description: 'Build a secure base of operations',
      });

      expect(projectId).toBeDefined();

      const projectAdvance = game.clock.advance({ clockId: projectId, segments: 3 });
      expect(projectAdvance.newSegments).toBe(3);
      expect(projectAdvance.isFilled).toBe(false);

      const projectClocks = game.query.getProgressClocks(crewId);
      expect(projectClocks).toHaveLength(1);
      expect(projectClocks[0].name).toBe('Establish Safe House');
      expect(projectClocks[0].segments).toBe(3);

      // === END OF ACT: Momentum Reset ===

      // Lower Momentum first to demonstrate recovery
      game.crew.setMomentum({ crewId, amount: 2 });

      const resetResult = game.crew.performReset(crewId);

      expect(resetResult.newMomentum).toBe(5); // Reset to 5
      // expect(resetResult.addictionReduced).toBe(0); // Not returned by performReset
      expect(resetResult.charactersReset).toHaveLength(2); // Both characters

      // Verify elite trait re-enabled
      const kaneTraitsAfterReset = game.query.getAvailableTraits(char1Id);
      expect(kaneTraitsAfterReset).toHaveLength(2); // Both traits re-enabled

      // Rally is reset but only available at 0-3 Momentum
      // Lower Momentum to test Rally availability
      game.crew.setMomentum({ crewId, amount: 2 });

      const canRallyAfterReset = game.query.canUseRally({
        characterId: char1Id,
        crewId,
      });
      expect(canRallyAfterReset).toBe(true); // Momentum at 2, rally reset
    });

    it('should handle Rally correctly', () => {
      const crewId = game.crew.create('Test Crew');
      const charId = game.character.create({
        name: 'Test Character',
        traits: [
          { id: 'trait-1', name: 'Test Trait', category: 'role', disabled: false, acquiredAt: Date.now() },
          { id: 'trait-2', name: 'Another Trait', category: 'background', disabled: true, acquiredAt: Date.now() },
        ],
        approaches: {
          force: 2,
          guile: 1,
          focus: 1,
          spirit: 0,
        },
      });

      game.crew.addCharacter({ crewId, characterId: charId });

      // Lower Momentum to 2 (Rally available at 0-3)
      game.crew.setMomentum({ crewId, amount: 2 });

      // Rally should be available
      const canRally = game.query.canUseRally({ characterId: charId, crewId });
      expect(canRally).toBe(true);

      // Get disabled trait
      const traits = game.character.getCharacter(charId)!.traits;
      const disabledTraitId = traits.find((t: { disabled: boolean; id: string }) => t.disabled)!.id;

      // Use Rally (spend 1 Momentum, re-enable trait)
      const rallyResult = game.character.useRally({
        characterId: charId,
        crewId,
        traitId: disabledTraitId,
        momentumToSpend: 1,
      });

      expect(rallyResult.rallyUsed).toBe(true);
      expect(rallyResult.traitReEnabled).toBe(true);
      expect(rallyResult.momentumSpent).toBe(1);
      expect(rallyResult.newMomentum).toBe(1); // 2 - 1

      // Rally should not be available anymore (used)
      const canRallyAgain = game.query.canUseRally({ characterId: charId, crewId });
      expect(canRallyAgain).toBe(false);

      // Trait should be enabled
      const traitsAfter = game.query.getAvailableTraits(charId);
      expect(traitsAfter).toHaveLength(2);
    });

    it('should handle harm and scar conversion', () => {
      const crewId = game.crew.create('Test Crew');
      const charId = game.character.create({
        name: 'Test Character',
        traits: [
          { id: 'trait-test-1', name: 'Test Trait', category: 'role', disabled: false, acquiredAt: Date.now() },
          { id: 'trait-test-2', name: 'Another Trait', category: 'background', disabled: false, acquiredAt: Date.now() },
        ],
        approaches: {
          force: 2,
          guile: 1,
          focus: 1,
          spirit: 0,
        },
      });

      // Take harm
      const harmResult = game.harm.take({
        characterId: charId,
        harmType: 'Shaken Morale',
        position: 'controlled',
      });

      expect(harmResult.segmentsAdded).toBe(1); // Controlled/Standard = 1
      expect(harmResult.isDying).toBe(false);

      // Recover to 0
      const recoverResult = game.harm.recover({
        characterId: charId,
        clockId: harmResult.clockId,
        segments: 1,
      });

      expect(recoverResult.clockCleared).toBe(true);

      // Convert to scar
      const scarResult = game.harm.convertToScar({
        characterId: charId,
        clockId: harmResult.clockId,
        trait: {
          name: 'Haunted by Close Call',
          disabled: false,
          description: 'Nearly died, forever changed',
        },
      });

      expect(scarResult.traitId).toBeDefined();
      expect(scarResult.clockDeleted).toBe(true);

      // Verify scar trait was added
      const traits = game.character.getCharacter(charId)!.traits;
      const scarTrait = traits.find((t: { name: string }) => t.name === 'Haunted by Close Call');
      expect(scarTrait).toBeDefined();
      expect(scarTrait?.category).toBe('scar');
    });
  });
});



