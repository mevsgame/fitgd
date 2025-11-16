import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config';
import { generateId } from '../../src/utils/uuid';

describe('Config', () => {
  it('should have valid DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(DEFAULT_CONFIG.character.startingTraitCount).toBe(2);
    expect(DEFAULT_CONFIG.character.startingActionDots).toBe(12);
    expect(DEFAULT_CONFIG.crew.startingMomentum).toBe(5);
    expect(DEFAULT_CONFIG.crew.maxMomentum).toBe(10);
    expect(DEFAULT_CONFIG.clocks.harm.maxClocks).toBe(3);
    expect(DEFAULT_CONFIG.clocks.harm.segments).toBe(6);
  });

  it('should have valid clock configurations', () => {
    expect(DEFAULT_CONFIG.clocks.consumable.segments.common).toBe(8);
    expect(DEFAULT_CONFIG.clocks.consumable.segments.uncommon).toBe(6);
    expect(DEFAULT_CONFIG.clocks.consumable.segments.epic).toBe(4);
    expect(DEFAULT_CONFIG.clocks.addiction.segments).toBe(8);
    expect(DEFAULT_CONFIG.clocks.addiction.resetReduction).toBe(2);
  });

  it('should have valid rally configuration', () => {
    expect(DEFAULT_CONFIG.rally.maxMomentumToUse).toBe(3);
  });
});

describe('UUID', () => {
  it('should generate valid UUIDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2); // Should be unique
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should generate 100 unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100); // All unique
  });
});
