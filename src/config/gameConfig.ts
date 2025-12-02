import type { GameConfig } from '../types';
import type { EquipmentTier } from '../types/equipment';

/**
 * Default Game Configuration
 *
 * Based on rules from rules_primer.md.
 * All values are configurable and can be overridden per campaign.
 */
export const DEFAULT_CONFIG: GameConfig = {
  character: {
    startingTraitCount: 2, // 1 role + 1 background
    // maxTraitCount: undefined, // No cap by default, TBD via playtesting
    startingApproachDots: 5,
    maxDotsPerApproach: 4,
    maxDotsAtCreation: 2,
    defaultLoadLimit: 5, // Default max slots per character
  },

  crew: {
    startingMomentum: 5,
    maxMomentum: 10,
    minMomentum: 0,
  },

  clocks: {
    harm: {
      maxClocks: 3, // Max 3 harm clocks per character
      segments: 6,  // 6-segment harm clocks
    },
    addiction: {
      segments: 8,          // 8-segment addiction clock
      resetReduction: 2,    // Reduce by 2 on Momentum Reset
    },
    progress: {
      allowedSizes: [4, 6, 8, 12], // Standard FitD clock sizes
    },
  },

  rally: {
    maxMomentumToUse: 3, // Rally only available at 0-3 Momentum
  },

  equipment: {
    // Momentum cost on first lock based on tier (rules_primer.md)
    // Paid when item is first locked in a roll between Resets
    momentumCostByTier: {
      common: 0,    // Free to lock
      rare: 1,      // 1 Momentum on first lock
      epic: 1,      // 1 Momentum on first lock
    } as Record<EquipmentTier, number>,
  },

  resolution: {
    // Momentum generated on failure/partial success (rules_primer.md:40-48)
    momentumOnConsequence: {
      controlled: 1,
      risky: 2,
      desperate: 4,
      impossible: 6,
    },
    // Consequence segments based on Position (rules_primer.md:144-146)
    // Note: Effect modifiers apply on top of base (will be applied in applyHarmConsequence)
    consequenceSegmentsBase: {
      controlled: 1,
      risky: 2,
      desperate: 4,
      impossible: 6,
    },
    // Success clock base progress based on Position
    successClockBase: {
      controlled: 1,
      risky: 3,
      desperate: 5,
      impossible: 6,
    },
    // Effect modifier for harm and success clocks
    effectModifier: {
      limited: -1,
      standard: 0,
      great: 1,
      spectacular: 2,
    },
    // Success clock segments based on Effect only (position doesn't affect success)
    successSegments: {
      limited: 1,
      standard: 2,
      great: 4,
      spectacular: 6,
    },
  },
};
