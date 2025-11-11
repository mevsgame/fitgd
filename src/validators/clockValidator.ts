import type { Clock, ClockType } from '../types';
import { DEFAULT_CONFIG } from '../config/gameConfig';

/**
 * Clock Validator
 *
 * Type-specific validation for harm, consumable, and addiction clocks.
 */

/**
 * Validates segment amount is non-negative
 */
export function validateSegmentAmount(amount: number): void {
  if (amount < 0) {
    throw new Error(`Segment amount cannot be negative, got ${amount}`);
  }

  if (!Number.isInteger(amount)) {
    throw new Error(`Segment amount must be an integer, got ${amount}`);
  }
}

/**
 * Validates adding segments won't exceed max
 */
export function validateSegmentAddition(
  clock: Clock,
  amount: number
): void {
  const newTotal = clock.segments + amount;

  if (newTotal > clock.maxSegments) {
    throw new Error(
      `Cannot add ${amount} segments to clock ${clock.id}. ` +
      `Current: ${clock.segments}, Max: ${clock.maxSegments}, ` +
      `Would be: ${newTotal}`
    );
  }
}

/**
 * Validates segments are within valid range (0 to maxSegments)
 */
export function validateSegmentRange(
  segments: number,
  maxSegments: number
): void {
  if (segments < 0 || segments > maxSegments) {
    throw new Error(
      `Segments must be between 0 and ${maxSegments}, got ${segments}`
    );
  }
}

/**
 * Get max segments for a clock type
 */
export function getMaxSegments(
  clockType: ClockType,
  rarity?: 'common' | 'uncommon' | 'rare',
  customSize?: number
): number {
  switch (clockType) {
    case 'harm':
      return DEFAULT_CONFIG.clocks.harm.segments; // 6

    case 'consumable':
      if (!rarity) {
        throw new Error('Consumable clocks require a rarity');
      }
      return DEFAULT_CONFIG.clocks.consumable.segments[rarity];

    case 'addiction':
      return DEFAULT_CONFIG.clocks.addiction.segments; // 8

    case 'progress':
      if (!customSize) {
        throw new Error('Progress clocks require a custom size (4, 6, 8, or 12)');
      }
      return customSize; // Caller provides size after validation

    default:
      throw new Error(`Unknown clock type: ${clockType}`);
  }
}

/**
 * Validate harm clock creation
 */
export function validateHarmClockCount(
  existingHarmClocks: Clock[]
): void {
  const maxHarmClocks = DEFAULT_CONFIG.clocks.harm.maxClocks; // 3

  if (existingHarmClocks.length >= maxHarmClocks) {
    throw new Error(
      `Character already has ${maxHarmClocks} harm clocks. ` +
      `4th harm clock must replace existing clock with fewest segments.`
    );
  }
}

/**
 * Find harm clock with fewest segments (for replacement)
 */
export function findClockWithFewestSegments(clocks: Clock[]): Clock | null {
  if (clocks.length === 0) return null;

  return clocks.reduce((min, clock) =>
    clock.segments < min.segments ? clock : min
  );
}

/**
 * Validate only one addiction clock per character
 */
export function validateSingleAddictionClock(
  existingAddictionClocks: Clock[]
): void {
  if (existingAddictionClocks.length > 0) {
    throw new Error(
      'Character already has an addiction clock. Only one addiction clock per character is allowed.'
    );
  }
}

/**
 * Check if clock is filled
 */
export function isClockFilled(clock: Clock): boolean {
  return clock.segments >= clock.maxSegments;
}

/**
 * Check if clock is frozen (for consumables)
 */
export function isClockFrozen(clock: Clock): boolean {
  return clock.metadata?.frozen === true;
}

/**
 * Validate consumable clock metadata
 */
export function validateConsumableMetadata(
  rarity?: 'common' | 'uncommon' | 'rare',
  tier?: 'accessible' | 'inaccessible'
): void {
  if (!rarity) {
    throw new Error('Consumable clocks require a rarity (common, uncommon, rare)');
  }

  if (!tier) {
    throw new Error('Consumable clocks require a tier (accessible, inaccessible)');
  }

  const validRarities = ['common', 'uncommon', 'rare'];
  if (!validRarities.includes(rarity)) {
    throw new Error(`Invalid rarity: ${rarity}. Must be common, uncommon, or rare.`);
  }

  const validTiers = ['accessible', 'inaccessible'];
  if (!validTiers.includes(tier)) {
    throw new Error(`Invalid tier: ${tier}. Must be accessible or inaccessible.`);
  }
}

/**
 * Calculate addiction clock reduction on reset
 */
export function calculateAddictionReduction(currentSegments: number): number {
  const reduction = DEFAULT_CONFIG.clocks.addiction.resetReduction; // 2
  return Math.max(0, currentSegments - reduction);
}

/**
 * Validate clock exists
 */
export function validateClockExists(
  clock: Clock | undefined,
  clockId: string
): asserts clock is Clock {
  if (!clock) {
    throw new Error(`Clock ${clockId} not found`);
  }
}

/**
 * Validate progress clock size
 */
export function validateProgressClockSize(maxSegments: number): void {
  const allowedSizes = DEFAULT_CONFIG.clocks.progress.allowedSizes;

  if (!allowedSizes.includes(maxSegments)) {
    throw new Error(
      `Progress clock size must be one of: ${allowedSizes.join(', ')}. Got ${maxSegments}.`
    );
  }
}
