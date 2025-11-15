/**
 * Clock Query Utilities
 *
 * Pure functions for querying clocks by category, owner, etc.
 */

import type { Clock, ClockCategory, OwnerType } from '@/types/clock';

/**
 * Get clocks by category
 */
export function getClocksByCategory(
  clocks: Clock[],
  category: ClockCategory
): Clock[] {
  return clocks.filter(c => c.category === category);
}

/**
 * Get clocks by owner
 */
export function getClocksByOwner(
  clocks: Clock[],
  ownerId: string,
  category?: ClockCategory
): Clock[] {
  return clocks.filter(c =>
    c.ownerId === ownerId &&
    (!category || c.category === category)
  );
}

/**
 * Get harm clocks for character
 */
export function getHarmClocks(clocks: Clock[], characterId: string): Clock[] {
  return getClocksByOwner(clocks, characterId, 'harm');
}

/**
 * Get threat clocks for crew/scene
 */
export function getThreatClocks(clocks: Clock[], ownerId: string): Clock[] {
  return getClocksByOwner(clocks, ownerId, 'threat');
}

/**
 * Get progress clocks for crew/scene
 */
export function getProgressClocks(clocks: Clock[], ownerId: string): Clock[] {
  return getClocksByOwner(clocks, ownerId, 'progress');
}

/**
 * Get addiction clock for crew (should be max 1)
 */
export function getAddictionClock(clocks: Clock[], crewId: string): Clock | null {
  const addictionClocks = getClocksByOwner(clocks, crewId, 'addiction');
  return addictionClocks.length > 0 ? addictionClocks[0] : null;
}

/**
 * Get consumable clocks for crew
 */
export function getConsumableClocks(clocks: Clock[], crewId: string): Clock[] {
  return getClocksByOwner(clocks, crewId, 'consumable');
}

/**
 * Get consequence clocks (harm + threat) for context
 */
export function getConsequenceClocks(
  clocks: Clock[],
  characterId: string,
  crewId: string
): Clock[] {
  return [
    ...getHarmClocks(clocks, characterId),
    ...getThreatClocks(clocks, crewId)
  ];
}

/**
 * Get success clocks (progress) for context
 */
export function getSuccessClocks(
  clocks: Clock[],
  characterId: string,
  crewId: string
): Clock[] {
  return [
    ...getProgressClocks(clocks, characterId),
    ...getProgressClocks(clocks, crewId)
  ];
}

/**
 * Check if clock is filled
 */
export function isClockFilled(clock: Clock): boolean {
  return clock.segments >= clock.maxSegments;
}

/**
 * Check if clock is empty
 */
export function isClockEmpty(clock: Clock): boolean {
  return clock.segments === 0;
}

/**
 * Check if character is dying (has filled harm clock)
 */
export function isCharacterDying(clocks: Clock[], characterId: string): boolean {
  return getHarmClocks(clocks, characterId).some(isClockFilled);
}

/**
 * Get total harm segments for character
 */
export function getTotalHarmSegments(clocks: Clock[], characterId: string): number {
  return getHarmClocks(clocks, characterId)
    .reduce((total, clock) => total + clock.segments, 0);
}

/**
 * Get clock fill percentage
 */
export function getClockFillPercentage(clock: Clock): number {
  return clock.maxSegments > 0 ? (clock.segments / clock.maxSegments) * 100 : 0;
}
