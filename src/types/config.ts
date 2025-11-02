/**
 * Game Configuration
 *
 * All game rules as data (no magic numbers).
 * Can be overridden per campaign for playtesting adjustments.
 */

export interface GameConfig {
  character: {
    startingTraitCount: number;
    maxTraitCount?: number; // Optional cap, TBD via playtesting
    startingActionDots: number;
    maxActionDotsPerAction: number;
    maxActionDotsAtCreation: number;
  };

  crew: {
    startingMomentum: number;
    maxMomentum: number;
    minMomentum: number;
  };

  clocks: {
    harm: {
      maxClocks: number;
      segments: number;
    };
    consumable: {
      segments: {
        common: number;
        uncommon: number;
        rare: number;
      };
    };
    addiction: {
      segments: number;
      resetReduction: number;
    };
  };

  rally: {
    maxMomentumToUse: number; // Rally only available at 0-3 Momentum
  };
}
