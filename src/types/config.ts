/**
 * Game Configuration
 *
 * All game rules as data (no magic numbers).
 * Can be overridden per campaign for playtesting adjustments.
 */

import { ClockSize } from "./clock";
import type { EquipmentTier } from "./equipment";

export interface GameConfig {
  character: {
    startingTraitCount: number;
    maxTraitCount?: number; // Optional cap, TBD via playtesting
    startingApproachDots: number;
    maxDotsPerApproach: number;
    maxDotsAtCreation: number;
    defaultLoadLimit: number; // Default max slots per character
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

  equipment: {
    // Momentum cost on first lock based on tier
    momentumCostByTier: Record<EquipmentTier, number>;
  };

  resolution: {
    // Momentum generated on failure/partial success
    momentumOnConsequence: {
      controlled: number;
      risky: number;
      desperate: number;
      impossible: number;
    };
    // Consequence segments base (effect modifiers applied elsewhere)
    consequenceSegmentsBase: {
      controlled: number;
      risky: number;
      desperate: number;
      impossible: number;
    };
    // Success clock base progress based on Position
    successClockBase: {
      controlled: number;
      risky: number;
      desperate: number;
      impossible: number;
    };
    // Effect modifier applied to consequences and success clocks
    effectModifier: {
      limited: number;
      standard: number;
      great: number;
      spectacular: number;
    };
    // Success segments (legacy, may be deprecated)
    successSegments: {
      lesser: number,
      standard: number,
      great: number,
      spectacular: number
    };

  };
}
