/**
 * Game Configuration
 *
 * All game rules as data (no magic numbers).
 * Can be overridden per campaign for playtesting adjustments.
 */

import { ClockSize } from "./clock";

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
      segments: ClockSize;
    };
    consumable: {
      segments: {
        common: ClockSize;
        uncommon: ClockSize;
        epic: ClockSize;
      };
    };
    addiction: {
      segments: ClockSize;
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
      impossible: number;
    };
    // Harm segments based on Position and Effect
    harmSegments: {
      controlled: number;
      risky: number;
      desperate: number;
      impossible: number;
    };
  };
}
