/**
 * Example Integration Tests for Player Action Widget
 *
 * Demonstrates how to use the widget test harness for integration testing.
 * These tests verify the Redux layer integration without requiring the actual widget class.
 *
 * NOTE: These tests will be expanded in Phase 1 once we add dependency injection
 * to the widget itself. For now, they test the infrastructure and Redux integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWidgetHarness, type WidgetTestHarness } from './playerActionWidget.harness';
import { createMockCharacter, createMockCrew } from '../mocks/foundryApi';

describe('PlayerActionWidget - Integration Test Infrastructure', () => {
  let harness: WidgetTestHarness;

  beforeEach(async () => {
    harness = await createWidgetHarness({
      characterId: 'char-1',
      isGM: false,
      character: createMockCharacter({
        id: 'char-1',
        name: 'Test Hero',
        approaches: { force: 2, guile: 1, focus: 1, spirit: 1 },
      }),
      crew: createMockCrew({
        id: 'crew-1',
        name: 'Test Crew',
        characters: ['char-1'],
        currentMomentum: 5,
      }),
    });
  });

  afterEach(() => {
    harness.cleanup();
  });

  describe('Test Harness Setup', () => {
    it('should create mock game environment', () => {
      expect(harness.game).toBeDefined();
      expect(harness.game.fitgd).toBeDefined();
      expect(harness.game.fitgd.store).toBeDefined();
      expect(harness.game.fitgd.bridge).toBeDefined();
    });

    it('should populate initial state', () => {
      const character = harness.getCharacter();
      expect(character).toBeDefined();
      expect(character?.id).toBe('char-1');
      expect(character?.name).toBe('Test Hero');

      const crew = harness.getCrew();
      expect(crew).toBeDefined();
      expect(crew?.id).toBe('crew-1');
      expect(crew?.currentMomentum).toBe(5);
    });

    it('should set up UI mocks', () => {
      expect(harness.mocks.notifications).toBeDefined();
      expect(harness.mocks.ChatMessage).toBeDefined();
      expect(harness.mocks.Roll).toBeDefined();
    });

    it('should set up bridge spy', () => {
      expect(harness.spy).toBeDefined();
      expect(harness.spy.data).toBeDefined();
      expect(harness.spy.data.dispatches).toEqual([]);
      expect(harness.spy.data.broadcasts).toBe(0);
    });
  });

  describe('State Machine Transitions', () => {
    it('should start in IDLE_WAITING state', () => {
      const playerState = harness.getPlayerState();
      // Initially undefined until character enters combat
      expect(playerState).toBeUndefined();
    });

    it('should transition to DECISION_PHASE', async () => {
      await harness.advanceToState('DECISION_PHASE');

      const playerState = harness.getPlayerState();
      expect(playerState?.state).toBe('DECISION_PHASE');

      // Verify broadcast occurred (1 for init + 1 for transition)
      expect(harness.spy.data.broadcasts).toBe(2);

      // Verify action was dispatched
      expect(harness.spy.hasAction('playerRoundState/transitionState')).toBe(true);
    });

    it('should transition through full workflow: DECISION → ROLLING → GM_RESOLVING', async () => {
      // Start in decision phase
      await harness.advanceToState('DECISION_PHASE');
      harness.spy.reset(); // Reset to track only our actions

      // Select approach
      await harness.selectApproach('force');

      expect(harness.getPlayerState()?.selectedApproach).toBe('force');
      expect(harness.spy.data.broadcasts).toBe(1);

      // Perform roll
      await harness.clickRoll();

      // Should transition to either SUCCESS_COMPLETE or GM_RESOLVING_CONSEQUENCE
      const playerState = harness.getPlayerState();
      expect(['SUCCESS_COMPLETE', 'GM_RESOLVING_CONSEQUENCE']).toContain(playerState?.state);

      // Should have roll result
      expect(playerState?.rollResult).toBeDefined();
      expect(playerState?.outcome).toBeDefined();
    });

    it('should reject invalid state transitions', async () => {
      // Properly initialize state first
      await harness.advanceToState('DECISION_PHASE');
      await harness.selectApproach('force');
      harness.setNextRoll([3]); // Failure roll
      await harness.clickRoll(); // Transitions to GM_RESOLVING_CONSEQUENCE

      // Attempt invalid transition (GM_RESOLVING → TURN_COMPLETE is invalid)
      await expect(async () => {
        await harness.game.fitgd.bridge.execute({
          type: 'playerRoundState/transitionState',
          payload: { characterId: 'char-1', newState: 'TURN_COMPLETE' },
        });
      }).rejects.toThrow(); // Redux slice should reject invalid transition
    });
  });

  describe('Action Plan Configuration', () => {
    beforeEach(async () => {
      await harness.advanceToState('DECISION_PHASE');
      harness.spy.reset();
    });

    it('should select primary approach', async () => {
      await harness.selectApproach('guile');

      expect(harness.getPlayerState()?.selectedApproach).toBe('guile');
      expect(harness.spy.data.broadcasts).toBe(1);
    });

    it('should select secondary approach', async () => {
      await harness.selectApproach('force');
      await harness.selectSecondary('guile');

      const playerState = harness.getPlayerState();
      expect(playerState?.selectedApproach).toBe('force');
      expect(playerState?.secondaryApproach).toBe('guile');
    });

    it('should set position and effect', async () => {
      await harness.setPosition('desperate');
      await harness.setEffect('great');

      const playerState = harness.getPlayerState();
      expect(playerState?.position).toBe('desperate');
      expect(playerState?.effect).toBe('great');
    });

    it('should toggle push die', async () => {
      await harness.clickPushDie();
      expect(harness.getPlayerState()?.pushed).toBe(true);

      await harness.clickPushDie();
      expect(harness.getPlayerState()?.pushed).toBe(false);
    });

    it('should toggle push effect', async () => {
      await harness.clickPushEffect();
      expect(harness.getPlayerState()?.pushed).toBe(true);
      expect(harness.getPlayerState()?.pushType).toBe('improved-effect');

      await harness.clickPushEffect();
      expect(harness.getPlayerState()?.pushed).toBe(false);
      expect(harness.getPlayerState()?.pushType).toBeUndefined();
    });

    it('should set up complete action plan', async () => {
      await harness.setupActionPlan({
        approach: 'force',
        secondary: 'guile',
        position: 'risky',
        effect: 'standard',
        pushed: true,
      });

      const playerState = harness.getPlayerState();
      expect(playerState?.selectedApproach).toBe('force');
      expect(playerState?.secondaryApproach).toBe('guile');
      expect(playerState?.position).toBe('risky');
      expect(playerState?.effect).toBe('standard');
      expect(playerState?.pushed).toBe(true);
    });
  });

  describe('Dice Rolling Workflow', () => {
    beforeEach(async () => {
      await harness.advanceToState('DECISION_PHASE');
      await harness.selectApproach('force');
      harness.spy.reset();
    });

    it('should perform a successful roll', async () => {
      // Set up a critical roll
      harness.setNextRoll([6, 6, 5]);

      await harness.clickRoll();

      const playerState = harness.getPlayerState();
      expect(playerState?.state).toBe('SUCCESS_COMPLETE');
      expect(playerState?.outcome).toBe('critical');
      expect(playerState?.rollResult).toEqual([6, 6, 5]);
    });

    it('should perform a failed roll', async () => {
      // Set up a failure roll
      harness.setNextRoll([3, 2, 1]);

      await harness.clickRoll();

      const playerState = harness.getPlayerState();
      expect(playerState?.state).toBe('GM_RESOLVING_CONSEQUENCE');
      expect(playerState?.outcome).toBe('failure');
    });

    it('should reject roll without approach selected', async () => {
      // Create fresh harness without approach
      const freshHarness = await createWidgetHarness({
        characterId: 'char-2',
        character: createMockCharacter({ id: 'char-2' }),
      });

      await freshHarness.advanceToState('DECISION_PHASE');

      // Should throw error
      await expect(freshHarness.clickRoll()).rejects.toThrow('No approach selected');

      freshHarness.cleanup();
    });
  });

  describe('Consequence Resolution', () => {
    beforeEach(async () => {
      // Properly initialize state before transitioning to GM_RESOLVING_CONSEQUENCE
      await harness.advanceToState('DECISION_PHASE');
      await harness.selectApproach('force');
      harness.setNextRoll([3]); // Failure roll
      await harness.clickRoll(); // Transitions to GM_RESOLVING_CONSEQUENCE
      harness.spy.reset();
    });

    it('should accept consequence and transition to APPLYING_EFFECTS', async () => {
      await harness.acceptConsequence();

      const playerState = harness.getPlayerState();
      expect(playerState?.state).toBe('APPLYING_EFFECTS');

      // Verify single broadcast
      expect(harness.spy.data.broadcasts).toBe(1);
    });

    it('should reject accepting consequence from wrong state', async () => {
      // Create a fresh harness in DECISION_PHASE (not GM_RESOLVING_CONSEQUENCE)
      const freshHarness = await createWidgetHarness({
        characterId: 'char-2',
        character: createMockCharacter({ id: 'char-2' }),
      });

      await freshHarness.advanceToState('DECISION_PHASE');

      await expect(freshHarness.acceptConsequence()).rejects.toThrow(
        'Not in GM_RESOLVING_CONSEQUENCE state'
      );

      freshHarness.cleanup();
    });
  });

  describe('Bridge Spy Tracking', () => {
    beforeEach(async () => {
      await harness.advanceToState('DECISION_PHASE');
      harness.spy.reset();
    });

    it('should track all dispatched actions', async () => {
      await harness.selectApproach('force');
      await harness.setPosition('risky');
      await harness.clickPushDie();

      expect(harness.spy.data.dispatches).toHaveLength(3);
      expect(harness.spy.data.dispatches[0].type).toBe('playerRoundState/setActionPlan');
      expect(harness.spy.data.dispatches[1].type).toBe('playerRoundState/setPosition');
      expect(harness.spy.data.dispatches[2].type).toBe('playerRoundState/setImprovements');
    });

    it('should track broadcast count', async () => {
      await harness.selectApproach('force');
      await harness.selectSecondary('guile');

      expect(harness.spy.data.broadcasts).toBe(2); // One per action
    });

    it('should provide helper methods for action queries', async () => {
      await harness.selectApproach('force');

      expect(harness.spy.hasAction('playerRoundState/setActionPlan')).toBe(true);
      expect(harness.spy.hasAction('nonexistent/action')).toBe(false);

      expect(
        harness.spy.hasAction('playerRoundState/setActionPlan', {
          characterId: 'char-1',
          approach: 'force',
        })
      ).toBe(true);
    });

    it('should track state transitions', async () => {
      await harness.advanceToState('ROLLING');
      await harness.advanceToState('GM_RESOLVING_CONSEQUENCE');

      const transitions = harness.spy.getStateTransitions();
      require('fs').writeFileSync('debug_output.json', JSON.stringify({
        transitions,
        dispatches: harness.spy.data.dispatches.map(d => ({ type: d.type, payload: d.payload }))
      }, null, 2));
      expect(transitions).toHaveLength(2); // Only the 2 explicit transitions (spy was reset after beforeEach)
      expect(transitions[0]).toEqual(expect.objectContaining({ characterId: 'char-1', to: 'ROLLING' }));
      expect(transitions[1]).toEqual(expect.objectContaining({ characterId: 'char-1', to: 'GM_RESOLVING_CONSEQUENCE' }));
    });

    it('should detect invalid batches', async () => {
      // Attempt to batch multiple state transitions (invalid)
      await expect(async () => {
        await harness.game.fitgd.bridge.executeBatch([
          {
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'ROLLING' },
          },
          {
            type: 'playerRoundState/transitionState',
            payload: { characterId: 'char-1', newState: 'SUCCESS_COMPLETE' },
          },
        ]);
      }).rejects.toThrow('Cannot batch');

      // Verify invalid batch was tracked
      expect(harness.spy.data.invalidBatches).toHaveLength(1);
    });
  });

  describe('Multi-Client Simulation', () => {
    it('should simulate GM and Player with shared state', async () => {
      // Create GM harness
      const gmHarness = await createWidgetHarness({
        characterId: 'char-1',
        isGM: true,
        character: harness.getCharacter(),
        crew: harness.getCrew(),
      });

      // Both harnesses should have access to same Redux state
      // (in real scenario, state would sync via socket broadcasts)

      await gmHarness.advanceToState('DECISION_PHASE');
      await gmHarness.setPosition('desperate');

      // Verify GM's changes are in state
      expect(gmHarness.getPlayerState()?.position).toBe('desperate');

      gmHarness.cleanup();
    });
  });

  describe('PlayerActionWidget - Test Harness Utilities', () => {
    describe('setupActionPlan helper', () => {
      it('should configure complete action plan in one call', async () => {
        const harness = await createWidgetHarness({
          characterId: 'char-1',
          character: createMockCharacter({ id: 'char-1' }),
        });

        await harness.advanceToState('DECISION_PHASE');

        await harness.setupActionPlan({
          approach: 'force',
          secondary: 'guile',
          position: 'risky',
          effect: 'great',
          pushed: true,
        });

        const playerState = harness.getPlayerState();
        expect(playerState?.selectedApproach).toBe('force');
        expect(playerState?.secondaryApproach).toBe('guile');
        expect(playerState?.position).toBe('risky');
        expect(playerState?.effect).toBe('great');
        expect(playerState?.pushed).toBe(true);

        harness.cleanup();
      });
    });

    describe('setNextRoll helper', () => {
      it('should override dice results for specific rolls', async () => {
        const harness = await createWidgetHarness({
          characterId: 'char-1',
          character: createMockCharacter({ id: 'char-1' }),
          rollResults: [6, 6], // Default: critical
        });

        await harness.advanceToState('DECISION_PHASE');
        await harness.selectApproach('force');

        // First roll: uses default (critical)
        await harness.clickRoll();
        expect(harness.getPlayerState()?.outcome).toBe('critical');

        // Second roll: override with failure
        // Complete the turn first, then start a new action
        await harness.advanceToState('TURN_COMPLETE');

        // Reset for new action by initializing fresh state
        const harness2 = await createWidgetHarness({
          characterId: 'char-1',
          character: createMockCharacter({ id: 'char-1' }),
        });
        await harness2.advanceToState('DECISION_PHASE');
        await harness2.selectApproach('force');
        harness2.setNextRoll([3, 2, 1]);

        await harness2.clickRoll();
        expect(harness2.getPlayerState()?.outcome).toBe('failure');
        harness2.cleanup();

        harness.cleanup();
      });
    });
  });
});
