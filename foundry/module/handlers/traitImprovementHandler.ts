/**
 * Trait Improvement Handler
 *
 * Manages trait improvement calculations for display:
 * - Trait transaction improvements
 * - Equipment improvements
 * - Push improvements
 * - Flashback improvements
 *
 * This handler encapsulates the 64-line _computeImprovements calculation from PlayerActionWidget.
 */

import type { Character } from '@/types/character';
import type { PlayerRoundState } from '@/types/playerRoundState';

/**
 * Configuration for trait improvement operations
 */
export interface TraitImprovementHandlerConfig {
  character: Character | null;
}

/**
 * Trait Improvement Handler
 *
 * Responsible for calculating and formatting improvements text including:
 * - Trait transaction improvements (using, creating, consolidating)
 * - Equipment improvements
 * - Push improvements (die or effect)
 * - Flashback improvements
 *
 * @example
 * const handler = new TraitImprovementHandler({ character });
 * const improvements = handler.computeImprovements(playerState);
 * // Returns: ['Using trait: Daring (Position +1) [1M]', 'Using Lockpicks', ...]
 */
export class TraitImprovementHandler {
  constructor(private config: TraitImprovementHandlerConfig) {}

  /**
   * Compute improvements preview text based on player state
   *
   * @param playerState - Current player round state
   * @returns Array of improvement descriptions for display
   *
   * @example
   * const improvements = handler.computeImprovements(playerState);
   * improvements.forEach(text => console.log(text));
   * // Output: "Using trait: Daring (Position +1) [1M]"
   * //         "Using Lockpicks"
   */
  computeImprovements(playerState: PlayerRoundState | null): string[] {
    if (!playerState) return [];

    const improvements: string[] = [];

    // Trait transaction (new system)
    if (playerState.traitTransaction) {
      const transaction = playerState.traitTransaction;

      if (transaction.mode === 'existing') {
        const trait = this.config.character!.traits.find(t => t.id === transaction.selectedTraitId);
        if (trait) {
          improvements.push(`Using trait: '${trait.name}' (Position +1) [1M]`);
        }
      } else if (transaction.mode === 'new') {
        improvements.push(`Creating new trait: '${transaction.newTrait!.name}' (Position +1) [1M]`);
      } else if (transaction.mode === 'consolidate') {
        const traitNames = transaction.consolidation!.traitIdsToRemove
          .map(id => this.config.character!.traits.find(t => t.id === id)?.name)
          .filter(Boolean);
        improvements.push(
          `Consolidating: ${traitNames.join(', ')} → '${transaction.consolidation!.newTrait.name}' (Position +1) [1M]`
        );
      }
    }

    // Legacy trait improvement (fallback)
    if (playerState.selectedTraitId && !playerState.traitTransaction) {
      const trait = this.config.character!.traits.find(t => t.id === playerState.selectedTraitId);
      if (trait) {
        improvements.push(`Using '${trait.name}' trait`);
      }
    }

    // Equipment improvements
    if (playerState.equippedForAction && playerState.equippedForAction.length > 0) {
      const equipment = this.config.character!.equipment.filter(e =>
        playerState.equippedForAction!.includes(e.id)
      );
      equipment.forEach(eq => {
        improvements.push(`Using ${eq.name}`);
      });
    }

    // Push improvement
    if (playerState.pushed) {
      const pushLabel = playerState.pushType === 'extra-die' ? '+1d' : 'Effect +1';
      improvements.push(`Push Yourself (${pushLabel}) [1M]`);
    }

    // Flashback (legacy)
    if (playerState.flashbackApplied) {
      improvements.push('Flashback applied');
    }

    return improvements;
  }

  /**
   * Check if character has available (non-disabled) traits
   *
   * @returns true if character has at least one available trait
   */
  hasAvailableTraits(): boolean {
    if (!this.config.character) return false;
    return this.config.character.traits.some(t => !t.disabled);
  }

  /**
   * Get available trait count
   *
   * @returns Number of non-disabled traits
   */
  getAvailableTraitCount(): number {
    if (!this.config.character) return 0;
    return this.config.character.traits.filter(t => !t.disabled).length;
  }

  /**
   * Get equipment count
   *
   * @returns Number of equipment items
   */
  getEquipmentCount(): number {
    if (!this.config.character) return 0;
    return this.config.character.equipment.length;
  }
}
