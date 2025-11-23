/**
 * Equipment Template Configuration Helper
 *
 * Provides static visibility configurations for Equipment Row View Template
 * Used across different contexts (Character Sheet, Dropdown, GM Grid)
 */

/**
 * Configuration object for equipment row visibility and behavior
 */
export interface EquipmentRowConfig {
  showTier: boolean;
  showBonuses: boolean;
  showSlots: boolean;
  showDescription: boolean;
  showLocked: boolean;
  showEquipped: boolean;
  interactiveEquipped?: boolean;
  expandableDescription?: boolean;
  selectionType?: 'checkbox' | 'radio' | 'icon';
  radioGroupName?: string;
}

/**
 * Character Sheet Configuration
 *
 * Full view with all information visible. Supports interactive controls for equipping/unequipping.
 * Slots and Description are user-toggleable (managed by component state, not this config).
 *
 * Visible Elements:
 * - Name (text) - always
 * - Category Icon - always
 * - Tier Label (badge)
 * - Bonuses (chips)
 * - Locked Icon (if locked)
 * - Equipped Checkbox (if unlocked, interactive)
 * - Slots (user-toggleable)
 * - Description (user-toggleable, expandable)
 */
export const CHARACTER_SHEET_CONFIG: EquipmentRowConfig = {
  showTier: true,
  showBonuses: true,
  showSlots: true,       // User toggleable via separate UI control
  showDescription: true, // User expandable per item
  showLocked: true,
  showEquipped: true,
  interactiveEquipped: true,
  expandableDescription: true,
};

/**
 * Player Action Widget Dropdown Configuration (Active Equipment Selection)
 *
 * Condensed view for selecting Active equipment in dice pool.
 * Single-line compact format: "Chainsword +2d"
 *
 * Visible Elements:
 * - Name (text)
 * - Category Icon
 * - Bonuses (chips)
 * - Hidden: Tier, Locked, Slots, Description, Equipped
 */
export const DROPDOWN_CONFIG: EquipmentRowConfig = {
  showTier: false,
  showBonuses: true,
  showSlots: false,
  showDescription: false,
  showLocked: false,
  showEquipped: false,
};

/**
 * GM Passive Grid Configuration (Passive Equipment Approval)
 *
 * Two-column layout: Equipment Row View + Radio Button
 * Used for GM to approve one Passive equipment per roll
 *
 * Visible Elements:
 * - Name (text)
 * - Category Icon
 * - Tier Label (badge)
 * - Bonuses (chips)
 * - Locked Icon (if locked)
 * - Description (user-expandable)
 * - Radio Button (for selection)
 * - Hidden: Slots
 */
export const GM_PASSIVE_GRID_CONFIG: EquipmentRowConfig = {
  showTier: true,
  showBonuses: true,
  showSlots: false,
  showDescription: true,
  showLocked: true,
  showEquipped: true,
  interactiveEquipped: false,
  expandableDescription: true,
  selectionType: 'radio',
  radioGroupName: 'passive-approval',
};

/**
 * Get configuration for context
 *
 * @param context - Context identifier: 'character-sheet' | 'dropdown' | 'gm-passive-grid'
 * @returns EquipmentRowConfig for context
 *
 * @example
 * const config = getConfigForContext('character-sheet');
 * // returns CHARACTER_SHEET_CONFIG
 */
export function getConfigForContext(
  context: 'character-sheet' | 'dropdown' | 'gm-passive-grid'
): EquipmentRowConfig {
  switch (context) {
    case 'character-sheet':
      return CHARACTER_SHEET_CONFIG;
    case 'dropdown':
      return DROPDOWN_CONFIG;
    case 'gm-passive-grid':
      return GM_PASSIVE_GRID_CONFIG;
    default:
      // Fallback to safe defaults (minimal visibility)
      return {
        showTier: false,
        showBonuses: false,
        showSlots: false,
        showDescription: false,
        showLocked: false,
        showEquipped: false,
      };
  }
}
