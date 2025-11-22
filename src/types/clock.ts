/**
 * Clock Types
 *
 * Abstract entity for tracking harm, addiction, and progress.
 * High-change entity with separate store and full command history.
 */

export type ClockSize = 4 | 6 | 8 | 12;
export type ClockType = 'harm' | 'addiction' | 'progress';
export type ProgressClockCategory = 'long-term-project' | 'threat' | 'personal-goal' | 'obstacle' | 'faction';

export interface Clock {
  id: string;

  /** Entity this clock belongs to (characterId, crewId, sceneId, campaignId, etc.) */
  entityId: string;

  /** Type of clock */
  clockType: ClockType;

  /** Optional subtype (e.g., "Physical Harm", "Infiltrate the Hive", etc.) */
  subtype?: string;

  /** Current segments filled */
  segments: number;

  /** Maximum segments (6 for harm, 8 for addiction, 4/6/8/12 for progress) */
  maxSegments: ClockSize;

  /** Flexible metadata for type-specific data */
  metadata?: ClockMetadata;

  createdAt: number;
  updatedAt: number;
}

export interface ClockMetadata {
  /** For progress clocks */
  category?: ProgressClockCategory;
  isCountdown?: boolean; // True if clock represents threat/danger increasing
  description?: string; // Detailed description of what the clock represents

  /** Extensible for future clock types */
  [key: string]: unknown;
}
