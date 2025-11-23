/**
 * Equipment tier determines acquisition cost and availability (rules_primer.md)
 * - common: Free to equip, always available (declare freely)
 * - rare: Costs 1 Momentum to acquire via flashback (requires justifying Trait)
 * - epic: Cannot be acquired via flashback, must be earned as story reward
 */
export type EquipmentTier = 'common' | 'rare' | 'epic';

/**
 * Legacy alias for backwards compatibility during transition
 * @deprecated Use EquipmentTier instead
 */
export type EquipmentRarity = 'common' | 'rare' | 'epic';

/**
 * Mechanical effects granted by equipment categories
 */
export interface EquipmentEffect {
  // Dice modifiers
  diceBonus?: number;        // +1d, +2d
  dicePenalty?: number;      // -1d (heavy, unwieldy gear)

  // Effect modifiers (proposal shown to player)
  effectBonus?: number;      // Improve effect by N levels
  effectPenalty?: number;    // Reduce effect by N levels

  // Position modifiers (proposal shown to player)
  positionBonus?: number;    // Improve position by N steps (defensive gear)
  positionPenalty?: number;  // Worsen position by N steps (loud, obvious gear)

  // Critical bonuses
  criticalEffectBonus?: number;
  criticalDiceBonus?: number;
}

/**
 * Equipment category configuration
 */
export interface EquipmentCategoryConfig {
  name: string;
  effect: EquipmentEffect;
  description?: string;
}