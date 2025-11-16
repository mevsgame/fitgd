/**
 * Trait Handler
 *
 * Manages trait transaction workflow:
 * - Uses existing traits
 * - Creates new flashback traits
 * - Consolidates multiple traits into grouped traits
 * - Manages trait creation/removal Redux actions
 *
 * This handler encapsulates the 76-line trait application logic that was
 * previously in PlayerActionWidget._applyTraitTransaction.
 */

import type { Trait, TraitConsolidation } from '@/types/character';
import type { TraitTransaction } from '@/types/playerRoundState';
import { asReduxId } from '../types/ids';

/**
 * Configuration for trait operations
 */
export interface TraitHandlerConfig {
  characterId: string;
  characterName?: string;
}

/**
 * Trait Handler
 *
 * Responsible for managing trait transactions including:
 * - Using existing traits (no action needed)
 * - Creating new flashback traits
 * - Consolidating multiple traits into grouped traits
 * - Redux action creation for trait changes
 *
 * @example
 * const handler = new TraitHandler(config);
 * const actions = handler.createTraitActions(transaction);
 * await game.fitgd.bridge.executeBatch(actions);
 */
export class TraitHandler {
  constructor(private config: TraitHandlerConfig) {}

  /**
   * Create Redux actions for a trait transaction
   *
   * @param transaction - The trait transaction to apply
   * @param generateId - Optional ID generator (for testing)
   * @returns Array of Redux actions to execute
   *
   * @example
   * const transaction = playerState.traitTransaction;
   * const actions = handler.createTraitActions(transaction);
   * // Actions will be based on transaction mode:
   * // - 'existing': empty array (no changes)
   * // - 'new': [addTrait action]
   * // - 'consolidate': [removeTrait x3, addTrait]
   */
  createTraitActions(
    transaction: TraitTransaction,
    generateId?: () => string
  ): Array<{ type: string; payload: any }> {
    const actions: Array<{ type: string; payload: any }> = [];

    if (transaction.mode === 'existing') {
      // No character changes needed for using existing trait
      console.log(`FitGD | Using existing trait: ${transaction.selectedTraitId}`);

    } else if (transaction.mode === 'new') {
      // Create new flashback trait
      const newTrait: Trait = {
        id: generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator()),
        name: transaction.newTrait!.name,
        description: transaction.newTrait!.description,
        category: 'flashback',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.config.characterId,
          trait: newTrait,
        },
      });

      console.log(`FitGD | Will create new trait: ${newTrait.name}`);

    } else if (transaction.mode === 'consolidate') {
      // Remove 3 traits and create consolidated trait
      const consolidation = transaction.consolidation!;

      // Queue removal of the 3 traits
      for (const traitId of consolidation.traitIdsToRemove) {
        actions.push({
          type: 'characters/removeTrait',
          payload: {
            characterId: this.config.characterId,
            traitId,
          },
        });
      }

      // Queue creation of consolidated trait
      const consolidatedTrait: Trait = {
        id: generateId ? generateId() : (foundry?.utils?.randomID?.() || this._defaultIdGenerator()),
        name: consolidation.newTrait.name,
        description: consolidation.newTrait.description,
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.config.characterId,
          trait: consolidatedTrait,
        },
      });

      console.log(`FitGD | Will consolidate traits into: ${consolidatedTrait.name}`);
    }

    return actions;
  }

  /**
   * Determine if a trait transaction will make changes
   *
   * @param transaction - The trait transaction
   * @returns true if transaction will result in character changes
   */
  willMakeChanges(transaction: TraitTransaction): boolean {
    return transaction.mode !== 'existing';
  }

  /**
   * Get affected Redux ID for this character
   *
   * @returns Redux ID for Bridge API
   */
  getAffectedReduxId(): string {
    return asReduxId(this.config.characterId);
  }

  /**
   * Get character name for notifications
   *
   * @returns Character name or 'Character'
   */
  getCharacterName(): string {
    return this.config.characterName || 'Character';
  }

  /**
   * Get description of trait changes for logging
   *
   * @param transaction - The trait transaction
   * @returns Human-readable description of changes
   */
  getTransactionDescription(transaction: TraitTransaction): string {
    if (transaction.mode === 'existing') {
      return `Using existing trait: ${transaction.selectedTraitId}`;
    } else if (transaction.mode === 'new') {
      return `Creating new flashback trait: ${transaction.newTrait?.name}`;
    } else if (transaction.mode === 'consolidate') {
      const count = transaction.consolidation?.traitIdsToRemove.length || 0;
      return `Consolidating ${count} traits into: ${transaction.consolidation?.newTrait.name}`;
    }
    return 'Unknown trait transaction';
  }

  /**
   * Default ID generator for testing environments
   * @private
   */
  private _defaultIdGenerator(): string {
    return `trait-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
