/**
 * Consequence Data Resolver
 *
 * Resolves consequence transaction data for template rendering:
 * - Resolves IDs to character/clock objects
 * - Calculates derived values (segments, momentum)
 * - Determines consequence configuration status
 *
 * This handler encapsulates the 82-line _getConsequenceData method from PlayerActionWidget.
 */

import type { RootState } from '@/store';
import type { Character } from '@/types/character';
import type { Clock } from '@/types/clock';
import type { PlayerRoundState, ConsequenceTransaction, Position, Effect } from '@/types/playerRoundState';
import {
  selectEffectivePosition,
  selectEffectiveEffect,
  selectConsequenceSeverity,
  selectMomentumGain,
  selectDefensiveSuccessValues,
} from '@/selectors/playerRoundStateSelectors';

/**
 * Resolved consequence data for template
 */
export interface ResolvedConsequenceData {
  consequenceTransaction: ConsequenceTransaction | null;
  harmTargetCharacter: Character | null;
  selectedHarmClock: Clock | null;
  selectedCrewClock: Clock | null;
  calculatedHarmSegments: number;
  calculatedMomentumGain: number;
  effectivePosition: Position;
  effectiveEffect: Effect;
  consequenceConfigured: boolean;
  defensiveSuccessValues?: any; // DefensiveSuccessValues from Redux
  useDefensiveSuccess?: boolean;
}

/**
 * Configuration for consequence data resolution
 */
export interface ConsequenceDataResolverConfig {
  characterId: string;
}

/**
 * Consequence Data Resolver
 *
 * Responsible for resolving consequence transaction data including:
 * - Resolving character and clock references from IDs
 * - Computing consequence severity based on position
 * - Computing momentum gain based on position
 * - Determining if consequence is fully configured
 *
 * @example
 * const resolver = new ConsequenceDataResolver(config);
 * const data = resolver.resolveConsequenceData(state, playerState);
 */
export class ConsequenceDataResolver {
  constructor(private config: ConsequenceDataResolverConfig) {}

  /**
   * Resolve consequence transaction data for template rendering
   *
   * @param state - Redux state
   * @param playerState - Current player round state
   * @returns Resolved consequence data with objects and calculated values
   *
   * @example
   * const data = resolver.resolveConsequenceData(state, playerState);
   * template.render({
   *   harmTarget: data.harmTargetCharacter,
   *   selectedClock: data.selectedHarmClock,
   *   segments: data.calculatedHarmSegments,
   * });
   */
  resolveConsequenceData(state: RootState, playerState: PlayerRoundState | null): ResolvedConsequenceData {
    const transaction = playerState?.consequenceTransaction;

    if (!transaction) {
      return {
        consequenceTransaction: null,
        harmTargetCharacter: null,
        selectedHarmClock: null,
        selectedCrewClock: null,
        calculatedHarmSegments: 0,
        calculatedMomentumGain: 0,
        effectivePosition: selectEffectivePosition(state, this.config.characterId),
        effectiveEffect: selectEffectiveEffect(state, this.config.characterId),
        consequenceConfigured: false,
      };
    }

    // Resolve harm target character
    let harmTargetCharacter: Character | null = null;
    if (transaction.harmTargetCharacterId) {
      harmTargetCharacter = state.characters.byId[transaction.harmTargetCharacterId] || null;
    }

    // Resolve selected harm clock
    let selectedHarmClock: Clock | null = null;
    if (transaction.harmClockId) {
      selectedHarmClock = state.clocks.byId[transaction.harmClockId] || null;
    }

    // Resolve selected crew clock
    let selectedCrewClock: Clock | null = null;
    if (transaction.crewClockId) {
      selectedCrewClock = state.clocks.byId[transaction.crewClockId] || null;
    }

    // Calculate harm segments and momentum gain using effective position
    // Note: Effect does NOT apply to consequences - only to success clocks
    const effectivePosition = selectEffectivePosition(state, this.config.characterId);
    let effectiveEffect = selectEffectiveEffect(state, this.config.characterId);

    // Check if defensive success is being used
    let calculatedHarmSegments = selectConsequenceSeverity(effectivePosition);
    let calculatedMomentumGain = selectMomentumGain(effectivePosition);

    if (transaction.useDefensiveSuccess) {
      // Defensive success reduces position by one step AND effect by one tier
      const defensiveValues = selectDefensiveSuccessValues(state, this.config.characterId);
      const defensivePosition = defensiveValues.defensivePosition;
      const defensiveEffect = defensiveValues.defensiveEffect;

      calculatedHarmSegments = defensivePosition ? selectConsequenceSeverity(defensivePosition) : 0;
      // Effect is reduced when using defensive success
      effectiveEffect = defensiveEffect || 'limited';
      // Momentum ALWAYS comes from original position, not reduced position
      calculatedMomentumGain = selectMomentumGain(effectivePosition);
    }

    // Determine if consequence is fully configured
    let consequenceConfigured = false;
    if (transaction.consequenceType === 'harm') {
      // Harm is configured if: target selected AND clock selected
      consequenceConfigured = Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      // Crew clock is configured if: clock selected (segments calculated automatically from position)
      consequenceConfigured = Boolean(transaction.crewClockId);
    }

    return {
      consequenceTransaction: transaction,
      harmTargetCharacter,
      selectedHarmClock,
      selectedCrewClock,
      calculatedHarmSegments,
      calculatedMomentumGain,
      effectivePosition,
      effectiveEffect,
      consequenceConfigured,
      defensiveSuccessValues: selectDefensiveSuccessValues(state, this.config.characterId),
      useDefensiveSuccess: transaction?.useDefensiveSuccess || false,
    };
  }

  /**
   * Check if consequence is fully configured
   *
   * @param transaction - The consequence transaction
   * @returns true if consequence is ready to apply
   */
  isConsequenceConfigured(transaction: ConsequenceTransaction | null | undefined): boolean {
    if (!transaction) return false;

    if (transaction.consequenceType === 'harm') {
      return Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      return Boolean(transaction.crewClockId);
    }

    return false;
  }

  /**
   * Get harm target character from transaction
   *
   * @param state - Redux state
   * @param transaction - The consequence transaction
   * @returns The target character if found, null otherwise
   */
  getHarmTargetCharacter(
    state: RootState,
    transaction: ConsequenceTransaction | null | undefined
  ): Character | null {
    if (!transaction?.harmTargetCharacterId) return null;
    return state.characters.byId[transaction.harmTargetCharacterId] || null;
  }

  /**
   * Get selected clock from transaction
   *
   * @param state - Redux state
   * @param transaction - The consequence transaction
   * @returns The selected clock if found, null otherwise
   */
  getSelectedClock(
    state: RootState,
    transaction: ConsequenceTransaction | null | undefined
  ): Clock | null {
    if (!transaction) return null;

    if (transaction.consequenceType === 'harm' && transaction.harmClockId) {
      return state.clocks.byId[transaction.harmClockId] || null;
    } else if (transaction.consequenceType === 'crew-clock' && transaction.crewClockId) {
      return state.clocks.byId[transaction.crewClockId] || null;
    }

    return null;
  }

  /**
   * Calculate consequence severity for current position
   *
   * @param state - Redux state
   * @returns Number of segments to apply
   */
  calculateSeverity(state: RootState): number {
    const position = selectEffectivePosition(state, this.config.characterId);
    return selectConsequenceSeverity(position);
  }

  /**
   * Calculate momentum gain for current position
   *
   * @param state - Redux state
   * @returns Momentum to gain
   */
  calculateMomentumGain(state: RootState): number {
    const position = selectEffectivePosition(state, this.config.characterId);
    return selectMomentumGain(position);
  }
}
