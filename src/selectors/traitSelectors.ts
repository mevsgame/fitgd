import { Character } from '../types';

/**
 * Identify which characters have the fewest traits in a given list.
 * Useful for the "Grouping Traits" flashback rule.
 * 
 * @param characters List of characters to evaluate
 * @returns Array of character IDs that have the minimum number of traits
 */
export const selectIdsWithFewestTraits = (characters: Character[]): string[] => {
    if (characters.length === 0) return [];

    // Determine trait counts
    const charCounts = characters.map(c => ({
        id: c.id,
        count: c.traits.length
    }));

    // Find minimum count
    const minCount = Math.min(...charCounts.map(c => c.count));

    // Filter characters matching minimum
    return charCounts
        .filter(c => c.count === minCount)
        .map(c => c.id);
};
