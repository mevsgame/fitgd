/**
 * Clock Migration Utilities
 *
 * Functions for migrating from old clock system (clockType, entityId, subtype)
 * to new typed system (category, ownerId, ownerType, name).
 */

import type { Clock, ClockCategory, HarmType, ThreatCategory, ProgressCategory, OwnerType } from '@/types/clock';

/**
 * Migrate a clock from old format to new typed format
 *
 * This is ADDITIVE - adds new fields while preserving old ones for backward compatibility.
 */
export function migrateClockToTyped(oldClock: Clock): Clock {
  // Infer category from clockType
  const category = inferCategory(oldClock);

  // Infer ownerType from clockType and context
  const ownerType = inferOwnerType(oldClock);

  // Generate name from subtype or category
  const name = oldClock.subtype || generateDefaultName(category);

  // Migrate metadata to typed fields
  const metadata = migrateMetadata(oldClock, category);

  return {
    ...oldClock,
    // New required fields
    category,
    ownerId: oldClock.entityId,
    ownerType,
    name,
    metadata,
    // Keep old fields for backward compatibility
    entityId: oldClock.entityId,
    clockType: oldClock.clockType,
    subtype: oldClock.subtype,
  };
}

/**
 * Infer ClockCategory from old clockType
 */
function inferCategory(clock: Clock): ClockCategory {
  // Check if it's a threat (progress clock with isCountdown flag)
  if (clock.clockType === 'progress' && clock.metadata?.isCountdown) {
    return 'threat';
  }

  // Otherwise, map directly
  switch (clock.clockType) {
    case 'harm':
      return 'harm';
    case 'addiction':
      return 'addiction';
    case 'consumable':
      return 'consumable';
    case 'progress':
      return 'progress';
    default:
      return 'progress'; // fallback
  }
}

/**
 * Infer OwnerType from clockType
 */
function inferOwnerType(clock: Clock): OwnerType {
  // Harm clocks are always character-owned
  if (clock.clockType === 'harm') {
    return 'character';
  }

  // All others are crew-owned by default
  // (can be overridden manually if needed)
  return 'crew';
}

/**
 * Generate default name based on category
 */
function generateDefaultName(category: ClockCategory): string {
  switch (category) {
    case 'harm':
      return 'Physical Harm';
    case 'threat':
      return 'Threat Clock';
    case 'progress':
      return 'Progress Clock';
    case 'addiction':
      return 'Addiction';
    case 'consumable':
      return 'Consumable';
    default:
      return 'Clock';
  }
}

/**
 * Migrate metadata to include typed fields
 */
function migrateMetadata(clock: Clock, category: ClockCategory): Clock['metadata'] {
  const metadata = { ...clock.metadata };

  // Infer harmType from subtype
  if (category === 'harm' && clock.subtype) {
    metadata.harmType = inferHarmType(clock.subtype);
  }

  // Infer threatCategory from old category or subtype
  if (category === 'threat') {
    if (clock.metadata?.category) {
      metadata.threatCategory = inferThreatCategory(clock.metadata.category as string);
    } else if (clock.subtype) {
      metadata.threatCategory = inferThreatCategory(clock.subtype);
    }
  }

  // Infer progressCategory from old category
  if (category === 'progress' && clock.metadata?.category) {
    metadata.progressCategory = inferProgressCategory(clock.metadata.category as string);
  }

  return metadata;
}

/**
 * Infer HarmType from subtype string
 */
function inferHarmType(subtype: string): HarmType {
  const normalized = subtype.toLowerCase();

  if (normalized.includes('physical') || normalized.includes('wound')) {
    return 'physical';
  }
  if (normalized.includes('morale') || normalized.includes('shaken') || normalized.includes('mental')) {
    return 'morale';
  }
  if (normalized.includes('radiation') || normalized.includes('rad')) {
    return 'radiation';
  }
  if (normalized.includes('infection') || normalized.includes('disease') || normalized.includes('poison')) {
    return 'infection';
  }
  if (normalized.includes('psychic') || normalized.includes('warp') || normalized.includes('corruption')) {
    return 'psychic';
  }

  // Default to physical
  return 'physical';
}

/**
 * Infer ThreatCategory from category/subtype string
 */
function inferThreatCategory(str: string): ThreatCategory {
  const normalized = str.toLowerCase();

  if (normalized.includes('reinforcement') || normalized.includes('enemy')) {
    return 'enemy-reinforcements';
  }
  if (normalized.includes('alarm')) {
    return 'alarm-level';
  }
  if (normalized.includes('pursuit') || normalized.includes('chase')) {
    return 'pursuit';
  }
  if (normalized.includes('detection') || normalized.includes('spotted')) {
    return 'detection';
  }
  if (normalized.includes('collapse') || normalized.includes('environmental')) {
    return 'environmental-collapse';
  }
  if (normalized.includes('time')) {
    return 'time-pressure';
  }

  // Default to enemy-reinforcements
  return 'enemy-reinforcements';
}

/**
 * Infer ProgressCategory from old category string
 */
function inferProgressCategory(str: string): ProgressCategory {
  const normalized = str.toLowerCase();

  if (normalized.includes('extended') || normalized.includes('action')) {
    return 'extended-action';
  }
  if (normalized.includes('project') || normalized.includes('long-term')) {
    return 'long-term-project';
  }
  if (normalized.includes('personal') || normalized.includes('goal')) {
    return 'personal-goal';
  }
  if (normalized.includes('faction') || normalized.includes('relationship')) {
    return 'faction-relationship';
  }
  if (normalized.includes('obstacle')) {
    return 'obstacle';
  }

  // Default to extended-action
  return 'extended-action';
}

/**
 * Check if a clock has been migrated to typed system
 */
export function isClockMigrated(clock: Clock): boolean {
  return Boolean(
    clock.category &&
    clock.ownerId &&
    clock.ownerType &&
    clock.name
  );
}

/**
 * Migrate all clocks in a state object
 */
export function migrateAllClocks(clocks: Record<string, Clock>): Record<string, Clock> {
  const migrated: Record<string, Clock> = {};

  for (const [id, clock] of Object.entries(clocks)) {
    migrated[id] = isClockMigrated(clock) ? clock : migrateClockToTyped(clock);
  }

  return migrated;
}
