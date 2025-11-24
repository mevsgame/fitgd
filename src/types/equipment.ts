/**
 * Equipment tier determines momentum cost on first lock (rules_primer.md)
 * - common: Free to lock, always available (declare freely)
 * - rare: Costs 1 Momentum on first lock between Resets
 * - epic: Costs 1 Momentum on first lock between Resets (must be earned as story reward)
 */
export type EquipmentTier = 'common' | 'rare' | 'epic';

/**
 * Legacy alias for backwards compatibility during transition
 * @deprecated Use EquipmentTier instead
 */
export type EquipmentRarity = EquipmentTier;

/**
 * Equipment category determines usage pattern in rolls
 * - active: Selected as secondary in dice pool (weapons, tools, devices)
 * - passive: GM approves during roll conversation (armor, implants, augmentations)
 * - consumable: Single-use items, depletes after use (grenades, stims, medkits)
 */
export type EquipmentCategory = 'active' | 'passive' | 'consumable';

/**
 * Mechanical effects granted by equipment items
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
 * Equipment instance state (normalized in characterSlice)
 *
 * @example
 * {
 *   itemId: "item-123",
 *   equipped: true,
 *   locked: false,
 *   consumed: false
 * }
 */
export interface EquipmentState {
  itemId: string;             // ID of the equipment item
  equipped: boolean;          // Is currently equipped?
  locked: boolean;            // Cannot be unequipped until Reset (item was used in roll)
  consumed: boolean;          // Consumable has been used (still occupies slots, unavailable)
}

/**
 * Equipment item stored on Character
 *
 * Includes both data (name, category, tier, etc.) and state (equipped, locked, consumed flags).
 * Fully editable by GM or player (for Common items).
 */
export interface Equipment {
  // Instance identity
  id: string;

  // Core equipment data (editable by GM or player)
  name: string;
  category: EquipmentCategory;  // 'active' | 'passive' | 'consumable'
  tier: EquipmentTier;          // 'common' | 'rare' | 'epic'
  slots: number;                // Slots occupied (default 1)
  description: string; 

  // Instance state flags
  equipped: boolean;            // Is currently equipped?
  locked: boolean;              // Cannot be unequipped until Reset (item was used in roll)
  consumed: boolean;            // Consumable has been used (still occupies slots, unavailable)

  // Modifiers (bonuses provided to dice pool)
  modifiers?: {
    diceBonus?: number;
    dicePenalty?: number;
    positionBonus?: number;
    positionPenalty?: number;
    effectBonus?: number;
    effectPenalty?: number;
  };

  // Provenance (event sourcing metadata)
  acquiredAt: number;           // Timestamp when acquired
  acquiredVia?: 'starting' | 'flashback' | 'earned';

  // Flexible metadata
  metadata?: Record<string, unknown>;
}