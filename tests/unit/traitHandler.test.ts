import { describe, it, expect, beforeEach } from 'vitest';
import { TraitHandler } from '../../foundry/module/handlers/traitHandler';
import type { TraitTransaction } from '../../src/types/playerRoundState';
import { asReduxId } from '../../foundry/module/types/ids';

describe('TraitHandler', () => {
  let handler: TraitHandler;

  beforeEach(() => {
    handler = new TraitHandler({
      characterId: 'char-123',
      characterName: 'Alice',
    });
  });

  describe('createTraitActions', () => {
    it('should return empty array for existing trait mode', () => {
      const transaction: TraitTransaction = {
        mode: 'existing',
        selectedTraitId: 'trait-456',
      };

      const actions = handler.createTraitActions(transaction);

      expect(actions.length).toBe(0);
    });

    it('should create addTrait action for new trait mode', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Daring',
          description: 'You are bold and fearless',
        },
      };

      const actions = handler.createTraitActions(transaction, () => 'test-trait-id');

      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('characters/addTrait');
      expect(actions[0].payload.characterId).toBe('char-123');
      expect(actions[0].payload.trait.name).toBe('Daring');
      expect(actions[0].payload.trait.category).toBe('flashback');
      expect(actions[0].payload.trait.id).toBe('test-trait-id');
    });

    it('should create trait with current timestamp for new trait', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Daring',
          description: 'You are bold and fearless',
        },
      };

      const before = Date.now();
      const actions = handler.createTraitActions(transaction, () => 'test-id');
      const after = Date.now();

      expect(actions[0].payload.trait.acquiredAt).toBeGreaterThanOrEqual(before);
      expect(actions[0].payload.trait.acquiredAt).toBeLessThanOrEqual(after);
    });

    it('should create consolidate actions for consolidate mode', () => {
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: ['trait-1', 'trait-2', 'trait-3'],
          newTrait: {
            name: 'Hardened',
            description: 'You have overcome many challenges',
          },
        },
      };

      const actions = handler.createTraitActions(transaction, () => 'consolidated-id');

      // 3 removals + 1 addition = 4 actions
      expect(actions.length).toBe(4);
      expect(actions[0].type).toBe('characters/removeTrait');
      expect(actions[1].type).toBe('characters/removeTrait');
      expect(actions[2].type).toBe('characters/removeTrait');
      expect(actions[3].type).toBe('characters/addTrait');
    });

    it('should create consolidated trait with grouped category', () => {
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: ['trait-1', 'trait-2', 'trait-3'],
          newTrait: {
            name: 'Hardened',
            description: 'You have overcome many challenges',
          },
        },
      };

      const actions = handler.createTraitActions(transaction, () => 'consolidated-id');

      const addTraitAction = actions[3];
      expect(addTraitAction.payload.trait.category).toBe('grouped');
      expect(addTraitAction.payload.trait.name).toBe('Hardened');
    });

    it('should use provided ID generator for new traits', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Bold',
          description: 'Fearless in action',
        },
      };

      const mockIdGenerator = () => 'custom-id-123';
      const actions = handler.createTraitActions(transaction, mockIdGenerator);

      expect(actions[0].payload.trait.id).toBe('custom-id-123');
    });

    it('should remove all specified traits in consolidate mode', () => {
      const traitIds = ['trait-a', 'trait-b', 'trait-c'];
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: traitIds,
          newTrait: {
            name: 'Combined',
            description: 'Combined trait',
          },
        },
      };

      const actions = handler.createTraitActions(transaction, () => 'combined-id');

      const removeActions = actions.filter(a => a.type === 'characters/removeTrait');
      expect(removeActions.length).toBe(3);
      expect(removeActions[0].payload.traitId).toBe('trait-a');
      expect(removeActions[1].payload.traitId).toBe('trait-b');
      expect(removeActions[2].payload.traitId).toBe('trait-c');
    });
  });

  describe('willMakeChanges', () => {
    it('should return false for existing trait mode', () => {
      const transaction: TraitTransaction = {
        mode: 'existing',
        selectedTraitId: 'trait-123',
      };

      expect(handler.willMakeChanges(transaction)).toBe(false);
    });

    it('should return true for new trait mode', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Bold',
          description: 'Fearless',
        },
      };

      expect(handler.willMakeChanges(transaction)).toBe(true);
    });

    it('should return true for consolidate mode', () => {
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: ['trait-1', 'trait-2', 'trait-3'],
          newTrait: {
            name: 'Combined',
            description: 'Combined trait',
          },
        },
      };

      expect(handler.willMakeChanges(transaction)).toBe(true);
    });
  });

  describe('getAffectedReduxId', () => {
    it('should return properly formatted Redux ID', () => {
      const id = handler.getAffectedReduxId();

      expect(id).toBe(asReduxId('char-123'));
    });
  });

  describe('getCharacterName', () => {
    it('should return configured character name', () => {
      expect(handler.getCharacterName()).toBe('Alice');
    });

    it('should return default name when not configured', () => {
      const handlerNoName = new TraitHandler({
        characterId: 'char-123',
      });

      expect(handlerNoName.getCharacterName()).toBe('Character');
    });
  });

  describe('getTransactionDescription', () => {
    it('should describe existing trait usage', () => {
      const transaction: TraitTransaction = {
        mode: 'existing',
        selectedTraitId: 'trait-123',
      };

      const description = handler.getTransactionDescription(transaction);

      expect(description).toContain('existing');
      expect(description).toContain('trait-123');
    });

    it('should describe new trait creation', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Daring',
          description: 'Bold and fearless',
        },
      };

      const description = handler.getTransactionDescription(transaction);

      expect(description).toContain('new');
      expect(description).toContain('Daring');
    });

    it('should describe trait consolidation', () => {
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: ['trait-1', 'trait-2', 'trait-3'],
          newTrait: {
            name: 'Hardened',
            description: 'Combined trait',
          },
        },
      };

      const description = handler.getTransactionDescription(transaction);

      expect(description.toLowerCase()).toContain('consolidat');
      expect(description).toContain('Hardened');
    });
  });

  describe('integration scenario: full trait workflow', () => {
    it('should handle new trait workflow', () => {
      const transaction: TraitTransaction = {
        mode: 'new',
        newTrait: {
          name: 'Daring',
          description: 'Bold and fearless',
        },
      };

      // Check if changes will be made
      expect(handler.willMakeChanges(transaction)).toBe(true);

      // Create actions with mock ID generator
      const actions = handler.createTraitActions(transaction, () => 'new-trait-id');

      expect(actions.length).toBe(1);
      expect(actions[0].type).toBe('characters/addTrait');
      expect(actions[0].payload.characterId).toBe('char-123');
      expect(actions[0].payload.trait.name).toBe('Daring');

      // Get affected ID
      const id = handler.getAffectedReduxId();
      expect(id).toBe(asReduxId('char-123'));
    });

    it('should handle consolidation workflow', () => {
      const transaction: TraitTransaction = {
        mode: 'consolidate',
        consolidation: {
          traitIdsToRemove: ['scar-1', 'scar-2', 'scar-3'],
          newTrait: {
            name: 'Resilient',
            description: 'Hardened by experience',
          },
        },
      };

      // Check if changes will be made
      expect(handler.willMakeChanges(transaction)).toBe(true);

      // Create actions with mock ID generator
      const actions = handler.createTraitActions(transaction, () => 'consolidated-id');

      // Should have 3 removals + 1 addition
      expect(actions.length).toBe(4);

      // Verify all are for same character
      for (const action of actions) {
        expect(action.payload.characterId).toBe('char-123');
      }
    });

    it('should handle using existing trait', () => {
      const transaction: TraitTransaction = {
        mode: 'existing',
        selectedTraitId: 'existing-trait-id',
      };

      // Check if changes will be made
      expect(handler.willMakeChanges(transaction)).toBe(false);

      // Create actions (should be empty)
      const actions = handler.createTraitActions(transaction);

      expect(actions.length).toBe(0);

      // Still get proper description
      const description = handler.getTransactionDescription(transaction);
      expect(description).toContain('existing');
    });
  });
});
