import { describe, it, expect } from 'vitest';
import { selectIdsWithFewestTraits } from './traitSelectors';
import { Character, Trait } from '../types';

describe('traitSelectors', () => {
    // Helper to create a mock character with a specific number of traits
    const createMockCharacter = (id: string, traitCount: number): Character => {
        const traits: Trait[] = Array(traitCount).fill(null).map((_, i) => ({
            id: `trait-${id}-${i}`,
            name: `Trait ${i}`,
            category: 'background',
            disabled: false,
            acquiredAt: 0
        }));

        return {
            id,
            name: `Char ${id}`,
            traits,
            approaches: { force: 0, guile: 0, focus: 0, spirit: 0 },
            unallocatedApproachDots: 0,
            equipment: [],
            loadLimit: 5,
            rallyAvailable: true,
            createdAt: 0,
            updatedAt: 0
        };
    };

    describe('selectIdsWithFewestTraits', () => {
        it('should return empty list for empty input', () => {
            expect(selectIdsWithFewestTraits([])).toEqual([]);
        });

        it('should return the single character ID if only one exists', () => {
            const char = createMockCharacter('1', 3);
            expect(selectIdsWithFewestTraits([char])).toEqual(['1']);
        });

        it('should return the ID of the character with strictly fewest traits', () => {
            const char1 = createMockCharacter('1', 5);
            const char2 = createMockCharacter('2', 3); // Fewest
            const char3 = createMockCharacter('3', 4);

            const result = selectIdsWithFewestTraits([char1, char2, char3]);
            expect(result).toEqual(['2']);
        });

        it('should return multiple IDs in case of a tie', () => {
            const char1 = createMockCharacter('1', 3); // Fewest (tied)
            const char2 = createMockCharacter('2', 5);
            const char3 = createMockCharacter('3', 3); // Fewest (tied)

            const result = selectIdsWithFewestTraits([char1, char2, char3]);
            expect(result).toContain('1');
            expect(result).toContain('3');
            expect(result).toHaveLength(2);
        });

        it('should return all IDs if everyone has the same number of traits', () => {
            const char1 = createMockCharacter('1', 4);
            const char2 = createMockCharacter('2', 4);
            const char3 = createMockCharacter('3', 4);

            const result = selectIdsWithFewestTraits([char1, char2, char3]);
            expect(result).toHaveLength(3);
            expect(result).toContain('1');
            expect(result).toContain('2');
            expect(result).toContain('3');
        });
    });
});
