/**
 * Clock Types
 *
 * Abstract entity for tracking harm, consumables, addiction, and progress.
 * High-change entity with separate store and full command history.
 */

import { EquipmentRarity, EquipmentTier } from "./equipment";

/**
 * Clock sizes
 */
export type ClockSize = 4 | 6 | 8 | 12;

/**
 * Clock categories (typed union)
 *
 * Replaces free-form clockType with strongly-typed categories.
 * Each category has specific interaction patterns.
 */
export type ClockCategory =
  | 'harm'          // Character-level consequence (advances on failure/partial)
  | 'threat'        // Crew/scene-level consequence (advances on failure/partial)
  | 'progress'      // Success tracking (advances on success/critical)
  | 'addiction'     // Crew stim addiction tracking
  | 'consumable';   // Depletion tracking (special logic)

/**
 * Harm clock subtypes (strongly typed)
 */
export type HarmType =
  | 'physical'      // Physical injuries
  | 'morale'        // Psychological/mental harm
  | 'radiation'     // Environmental hazard
  | 'infection'     // Disease/toxin
  | 'psychic';      // Warp corruption

/**
 * Threat clock categories (countdown clocks)
 */
export type ThreatCategory =
  | 'enemy-reinforcements'
  | 'alarm-level'
  | 'pursuit'
  | 'detection'
  | 'environmental-collapse'
  | 'time-pressure';

/**
 * Progress clock categories (success tracking)
 */
export type ProgressCategory =
  | 'extended-action'      // Multi-roll obstacle (Infiltrate Vault)
  | 'long-term-project'    // Downtime project (Build Prototype)
  | 'personal-goal'        // Character arc
  | 'faction-relationship' // Reputation tracking
  | 'obstacle';            // Barrier to overcome

/**
 * Owner types
 */
export type OwnerType = 'character' | 'crew' | 'scene' | 'campaign';

/**
 * @deprecated Use ClockCategory instead
 */
export type ClockType = 'harm' | 'consumable' | 'addiction' | 'progress';

/**
 * @deprecated Use ProgressCategory instead
 */
export type ProgressClockCategory = 'long-term-project' | 'threat' | 'personal-goal' | 'obstacle' | 'faction';

export interface Clock {
  id: string;

  // ===== NEW FIELDS (typed system) =====

  /** Clock category (strongly typed) */
  category: ClockCategory;

  /** Owner ID (characterId, crewId, sceneId, etc.) */
  ownerId: string;

  /** Owner type */
  ownerType: OwnerType;

  /** Display name (required) */
  name: string;

  /** Optional description */
  description?: string;

  // ===== OLD FIELDS (deprecated, kept for backward compatibility) =====

  /**
   * @deprecated Use ownerId instead
   */
  entityId: string;

  /**
   * @deprecated Use category instead
   */
  clockType: ClockType;

  /**
   * @deprecated Use name and metadata fields instead
   */
  subtype?: string;

  // ===== SHARED FIELDS =====

  /** Current segments filled */
  segments: number;

  /** Maximum segments (6 for harm, 8 for addiction, 4/6/8 for consumables, 4/6/8/12 for progress) */
  maxSegments: ClockSize;

  /** Type-specific metadata */
  metadata: ClockMetadata;

  createdAt: number;
  updatedAt: number;
}

export interface ClockMetadata {
  // ===== NEW TYPED FIELDS =====

  /** For harm clocks (strongly typed) */
  harmType?: HarmType;

  /** For threat clocks (strongly typed) */
  threatCategory?: ThreatCategory;

  /** For threat clocks: what happens when filled */
  onFillEffect?: string;

  /** For progress clocks (strongly typed) */
  progressCategory?: ProgressCategory;

  /** For progress clocks: what happens when completed */
  onCompleteEffect?: string;

  // ===== CONSUMABLE CLOCK FIELDS =====

  /** For consumable clocks */
  rarity?: EquipmentRarity;
  tier?: EquipmentTier;
  frozen?: boolean;

  // ===== DEPRECATED FIELDS =====

  /**
   * @deprecated Use progressCategory or threatCategory instead
   */
  category?: ProgressClockCategory;

  /**
   * @deprecated Threats are now a separate category
   */
  isCountdown?: boolean;

  /**
   * @deprecated Use onFillEffect or onCompleteEffect instead
   */
  description?: string;

  /** Extensible for future clock types */
  [key: string]: unknown;
}
