export type EquipmentRarity = 'common' | 'uncommon' | 'epic'
export type EquipmentTier = 'accessible' | 'inaccessible'
export type EquipmentAcquisition = 'creation' | 'flashback' | 'reward' | 'loot'

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