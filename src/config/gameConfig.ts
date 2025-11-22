import type { GameConfig } from '../types';
import type { EquipmentCategoryConfig, EquipmentTier } from '../types/equipment';

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
    maxLoad: 5,
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
    // Momentum cost to acquire equipment via flashback based on tier (rules_primer.md)
    momentumCostByTier: {
      common: 0,          // Declare freely, no cost
      rare: 1,            // Requires 1 Momentum flashback (must justify with Trait)
      epic: Infinity,     // Cannot be acquired via flashback, must be earned
    } as Record<EquipmentTier, number>,

    // Equipment categories and their mechanical effects
    categories: {
      'weapon': {
        name: 'Weapon',
        effect: { diceBonus: 1 },
        description: 'Standard melee or ranged weapon',
      },
      'heavy-weapon': {
        name: 'Heavy Weapon',
        effect: { diceBonus: 2, positionPenalty: 1 },
        description: 'Powerful but unwieldy (heavy bolter, plasma cannon)',
      },
      'precision-tool': {
        name: 'Precision Tool',
        effect: { effectBonus: 1 },
        description: 'Improves quality of work (surgical tools, lockpicks)',
      },
      'stealth-gear': {
        name: 'Stealth Gear',
        effect: { positionBonus: 1 },
        description: 'Reduces risk of detection',
      },
      'armor': {
        name: 'Armor',
        effect: { positionBonus: 1, dicePenalty: 1 },
        description: 'Protective but restrictive',
      },
      'loud-weapon': {
        name: 'Loud Weapon',
        effect: { diceBonus: 1, positionPenalty: 1 },
        description: 'Effective but attracts attention (bolter, grenade launcher)',
      },
    } as Record<string, EquipmentCategoryConfig>,

    // Augmentations do not count toward load limit
    augmentationCategories: ['cybernetic', 'biological', 'psionic'],

    // Consumables are replenished on Momentum Reset
    consumableCategories: ['consumable', 'grenade', 'stim', 'medkit'],
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
    // Sequence segments based on Effect (rules_primer.md:144-146)
    successSegments: {
      lesser: 1,
      standard: 2,
      great: 4,
      spectacular: 6,
    },
  },
};
