import type { GameConfig } from '../types';

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
    startingActionDots: 12,
    maxActionDotsPerAction: 4,
    maxActionDotsAtCreation: 3,
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
    consumable: {
      segments: {
        common: 8,
        uncommon: 6,
        epic: 4,
      },
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

  resolution: {
    // Momentum generated on failure/partial success (rules_primer.md:40-48)
    momentumOnConsequence: {
      controlled: 1,
      risky: 2,
      desperate: 4,
      impossible: 6,
    },
    // Harm segments based on Position and Effect (rules_primer.md:144-146)
    harmSegments: {
      controlled: {
        limited: 0,    // Controlled + Limited = 0 segments
        standard: 1,   // Controlled + Standard = 1 segment
        great: 2,      // Controlled + Great = 2 segments
        spectacular: 3,// Controlled + Spectacular = 3 segments
      },
      risky: {
        limited: 2,    // Risky + Limited = 2 segments
        standard: 3,   // Risky + Standard = 3 segments
        great: 4,      // Risky + Great = 4 segments
        spectacular: 5,// Risky + Spectacular = 5 segments
      },
      desperate: {
        limited: 4,    // Desperate + Limited = 4 segments
        standard: 5,   // Desperate + Standard = 5 segments
        great: 6,      // Desperate + Great = 6 segments (Dying)
        spectacular: 7,// Desperate + Spectacular = 7 segments (over max, dying)
      },
      impossible: {
        limited: 5,    // Impossible + Limited = 5 segments
        standard: 6,   // Impossible + Standard = 6 segments (Dying)
        great: 7,      // Impossible + Great = 7 segments (over max, dying)
        spectacular: 8,// Impossible + Spectacular = 8 segments (over max, dying)
      },
    },
  },
};
