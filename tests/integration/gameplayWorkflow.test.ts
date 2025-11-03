/**
 * Gameplay Workflow Integration Tests
 *
 * Tests complete end-to-end game workflows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '../../src/store';
import { createGameAPI } from '../../src/api';

describe('Complete Gameplay Workflows', () => {
  let store;
  let api;

  beforeEach(() => {
    store = configureStore();
    api = createGameAPI(store);
  });

  describe('Character Creation → Crew Assignment → Action Roll → Consequences', () => {
    it('should complete full workflow', () => {
      // Step 1: Create crew
      const crewId = api.crew.create('Strike Team Alpha');
      expect(api.crew.getMomentum(crewId)).toBe(5);

      // Step 2: Create character
      const characterId = api.character.create({
        name: 'Sergeant Kane',
        traits: [
          {
            name: 'Served with Elite Infantry',
            category: 'role',
            disabled: false,
          },
          {
            name: 'Survived Hive Gang Wars',
            category: 'background',
            disabled: false,
          },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });

      // Step 3: Add to crew
      api.crew.addCharacter({ crewId, characterId });

      // Step 4: Simulate failed risky roll with standard effect
      const harmResult = api.action.applyConsequences({
        crewId,
        characterId,
        position: 'risky',
        effect: 'standard',
        result: 'failure',
        harmType: 'Physical Harm',
      });

      // Verify Momentum gained
      expect(harmResult.momentumGenerated).toBe(2); // Risky = +2
      expect(api.crew.getMomentum(crewId)).toBe(7); // 5 + 2

      // Verify harm applied
      expect(harmResult.harmApplied).toBeDefined();
      expect(harmResult.harmApplied.segmentsAdded).toBe(3); // Risky/Standard = 3
      expect(harmResult.harmApplied.isDying).toBe(false);

      // Step 5: Check harm clocks
      const harmClocks = api.query.getHarmClocks(characterId);
      expect(harmClocks).toHaveLength(1);
      expect(harmClocks[0].segments).toBe(3);
      expect(harmClocks[0].maxSegments).toBe(6);
    });
  });

  describe('Momentum Economy Complete Cycle', () => {
    it('should handle full Momentum cycle from high to low and back', () => {
      // Setup
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Trait 1', category: 'role', disabled: false },
          { name: 'Trait 2', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      api.crew.addCharacter({ crewId, characterId });

      // Start at 5
      expect(api.query.getMomentum(crewId)).toBe(5);

      // Spend 1 for Push
      api.action.push({ crewId, type: 'extra-die' });
      expect(api.query.getMomentum(crewId)).toBe(4);

      // Spend 1 for Flashback
      api.action.flashback({
        crewId,
        characterId,
        trait: {
          name: 'Studied Enemy Tactics',
          disabled: false,
        },
      });
      expect(api.query.getMomentum(crewId)).toBe(3);

      // Can Rally at 3 Momentum
      expect(api.query.canUseRally({ characterId, crewId })).toBe(true);

      // Gain 2 from leaning into trait
      const character = api.character.getCharacter(characterId);
      const traitId = character.traits[0].id;
      api.character.leanIntoTrait({ characterId, traitId, crewId });
      expect(api.query.getMomentum(crewId)).toBe(5);

      // Gain 4 from desperate consequence
      api.crew.addMomentum({ crewId, amount: 4 });
      expect(api.query.getMomentum(crewId)).toBe(9);

      // Add 5 more (should cap at 10, lose 4)
      api.crew.addMomentum({ crewId, amount: 5 });
      expect(api.query.getMomentum(crewId)).toBe(10);

      // Perform Reset
      api.crew.performReset(crewId);
      expect(api.query.getMomentum(crewId)).toBe(5);
    });
  });

  describe('Rally System', () => {
    it('should properly restrict Rally usage', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Trait 1', category: 'role', disabled: false },
          { name: 'Trait 2', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      api.crew.addCharacter({ crewId, characterId });

      // Disable a trait
      const character = api.character.getCharacter(characterId);
      const traitId = character.traits[0].id;
      api.character.leanIntoTrait({ characterId, traitId, crewId });

      // At 7 Momentum, Rally should fail
      expect(api.query.getMomentum(crewId)).toBe(7);
      expect(() => {
        api.character.useRally({
          characterId,
          crewId,
          traitId,
          momentumToSpend: 2,
        });
      }).toThrow('Rally only available at 0-3 Momentum');

      // Reduce to 3 Momentum
      api.crew.setMomentum({ crewId, amount: 3 });

      // Rally should work now
      const rallyResult = api.character.useRally({
        characterId,
        crewId,
        traitId,
        momentumToSpend: 2,
      });

      expect(rallyResult.rallyUsed).toBe(true);
      expect(rallyResult.traitReEnabled).toBe(true);
      expect(rallyResult.newMomentum).toBe(1);

      // Trait should be re-enabled
      const updatedChar = api.character.getCharacter(characterId);
      expect(updatedChar.traits.find((t) => t.id === traitId).disabled).toBe(
        false
      );

      // Rally should not be available again until reset
      expect(api.query.canUseRally({ characterId, crewId })).toBe(false);

      // Reset should restore Rally flag (but can't use Rally yet because Momentum is 5, not 0-3)
      api.crew.performReset(crewId);
      const resetCharacter = api.character.getCharacter(characterId);
      expect(resetCharacter.rallyAvailable).toBe(true);
    });
  });

  describe('Harm Progression to Dying', () => {
    it('should mark character as dying at 6/6 harm', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      api.crew.addCharacter({ crewId, characterId });

      // Take 3 segments (not dying)
      api.harm.take({
        characterId,
        harmType: 'Physical Harm',
        position: 'risky',
        effect: 'standard',
      });
      expect(api.query.isDying(characterId)).toBe(false);

      // Take 3 more segments (6 total, dying)
      const result = api.harm.take({
        characterId,
        harmType: 'Physical Harm',
        position: 'risky',
        effect: 'standard',
      });

      expect(result.isDying).toBe(true);
      expect(api.query.isDying(characterId)).toBe(true);

      const harmClocks = api.query.getHarmClocks(characterId);
      expect(harmClocks[0].segments).toBe(6);
    });

    it('should recover from harm', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });

      // Take harm
      api.harm.take({
        characterId,
        harmType: 'Physical Harm',
        position: 'risky',
        effect: 'standard',
      });

      const harmClocks = api.query.getHarmClocks(characterId);
      expect(harmClocks[0].segments).toBe(3);

      // Recover 2 segments
      api.harm.recover({
        characterId,
        clockId: harmClocks[0].id,
        segments: 2,
      });

      const updatedClocks = api.query.getHarmClocks(characterId);
      expect(updatedClocks[0].segments).toBe(1);
    });
  });

  describe('Trait Management', () => {
    it('should handle trait lifecycle (add, disable, re-enable, group)', () => {
      const crewId = api.crew.create('Team');
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Trait 1', category: 'role', disabled: false },
          { name: 'Trait 2', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });
      api.crew.addCharacter({ crewId, characterId });

      // Start with 2 traits
      let character = api.character.getCharacter(characterId);
      expect(character.traits).toHaveLength(2);

      // Add trait via Flashback
      api.crew.setMomentum({ crewId, amount: 5 });
      api.action.flashback({
        crewId,
        characterId,
        trait: {
          name: 'Studied Enemy',
          disabled: false,
        },
      });

      character = api.character.getCharacter(characterId);
      expect(character.traits).toHaveLength(3);

      // Group 3 traits into 1
      const traitIds = character.traits.map((t) => t.id);
      api.character.groupTraits({
        characterId,
        traitIds: [traitIds[0], traitIds[1], traitIds[2]],
        newTrait: {
          name: 'Veteran Soldier',
          disabled: false,
        },
      });

      character = api.character.getCharacter(characterId);
      expect(character.traits).toHaveLength(1); // 3 consumed, 1 created
      expect(character.traits[0].name).toBe('Veteran Soldier');
      expect(character.traits[0].category).toBe('grouped');
    });
  });

  describe('Action Dots Advancement', () => {
    it('should allow advancement to 4 dots after creation', () => {
      const characterId = api.character.create({
        name: 'Test',
        traits: [
          { name: 'Role', category: 'role', disabled: false },
          { name: 'Background', category: 'background', disabled: false },
        ],
        actionDots: {
          shoot: 3,
          command: 2,
          skirmish: 1,
          skulk: 0,
          wreck: 0,
          finesse: 0,
          survey: 2,
          study: 1,
          tech: 0,
          attune: 0,
          consort: 1,
          sway: 2,
        },
      });

      // Can't have 4 at creation, but can advance to 4
      api.character.advanceActionDots({
        characterId,
        action: 'shoot',
      });

      const character = api.character.getCharacter(characterId);
      expect(character.actionDots.shoot).toBe(4);
    });
  });
});
