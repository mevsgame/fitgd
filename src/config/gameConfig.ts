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
        rare: 4,
      },
    },
    addiction: {
      segments: 8,          // 8-segment addiction clock
      resetReduction: 2,    // Reduce by 2 on Momentum Reset
    },
  },

  rally: {
    maxMomentumToUse: 3, // Rally only available at 0-3 Momentum
  },
};
