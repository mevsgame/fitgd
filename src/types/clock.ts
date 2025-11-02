/**
 * Clock Types
 *
 * Abstract entity for tracking harm, consumables, and addiction.
 * High-change entity with separate store and full command history.
 */

export type ClockType = 'harm' | 'consumable' | 'addiction';

export interface Clock {
  id: string;

  /** Entity this clock belongs to (characterId, crewId, or itemType) */
  entityId: string;

  /** Type of clock */
  clockType: ClockType;

  /** Optional subtype (e.g., "Physical Harm", "grenades", etc.) */
  subtype?: string;

  /** Current segments filled */
  segments: number;

  /** Maximum segments (6 for harm, 8 for addiction, 4/6/8 for consumables) */
  maxSegments: number;

  /** Flexible metadata for type-specific data */
  metadata?: ClockMetadata;

  createdAt: number;
  updatedAt: number;
}

export interface ClockMetadata {
  /** For consumable clocks */
  rarity?: 'common' | 'uncommon' | 'rare';
  tier?: 'accessible' | 'inaccessible';
  frozen?: boolean;

  /** Extensible for future clock types */
  [key: string]: unknown;
}
