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
    progress: {
      allowedSizes: number[]; // Standard FitD clock sizes: [4, 6, 8, 12]
    };
  };

  rally: {
    maxMomentumToUse: number; // Rally only available at 0-3 Momentum
  };

  resolution: {
    // Momentum generated on failure/partial success
    momentumOnConsequence: {
      controlled: number;
      risky: number;
      desperate: number;
    };
    // Harm segments based on Position and Effect
    harmSegments: {
      controlled: {
        limited: number;
        standard: number;
        great: number;
      };
      risky: {
        limited: number;
        standard: number;
        great: number;
      };
      desperate: {
        limited: number;
        standard: number;
        great: number;
      };
    };
  };
}
