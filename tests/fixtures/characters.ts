import type { Character, Trait, Approaches, Equipment } from '../../src/types';

/**
 * Test Fixtures - Characters
 *
 * Sample characters for unit and integration tests.
 */

export const mockTrait_Role: Trait = {
  id: 'trait-role-1',
  name: 'Served with Elite Infantry Regiment',
  category: 'role',
  disabled: false,
  description: 'Veteran of countless battles',
  acquiredAt: Date.now(),
};

export const mockTrait_Background: Trait = {
  id: 'trait-bg-1',
  name: 'Survived City Underbelly Gang Wars',
  category: 'background',
  disabled: false,
  description: 'Knows the streets like the back of their hand',
  acquiredAt: Date.now(),
};

export const mockApproaches_Balanced: Approaches = {
  force: 2,
  guile: 1,
  focus: 1,
  spirit: 1,
};

export const mockApproaches_Specialist: Approaches = {
  force: 2,
  guile: 0,
  focus: 2,
  spirit: 1,
};

export const mockEquipment_LasRifle: Equipment = {
  id: 'equip-1',
  name: 'Las Rifle',
  tier: 'accessible',
  rarity: 'common',
  category: 'weapon',
  description: 'Standard issue energy weapon',
  img: undefined,
  tags: ['ranged', 'energy'],
  equipped: false,
  acquiredAt: Date.now(),
  acquiredVia: 'creation' as const,
  sourceItemId: undefined,
  metadata: {},
};

export const mockEquipment_FlakArmor: Equipment = {
  id: 'equip-2',
  name: 'Flak Armor',
  tier: 'accessible',
  rarity: 'common',
  category: 'armor',
  description: 'Provides basic protection',
  img: undefined,
  tags: ['armor', 'protection'],
  equipped: false,
  acquiredAt: Date.now(),
  acquiredVia: 'creation' as const,
  sourceItemId: undefined,
  metadata: {},
};

export const mockCharacter_SergeantKane: Character = {
  id: 'char-1',
  name: 'Sergeant Kane',
  traits: [mockTrait_Role, mockTrait_Background],
  approaches: mockApproaches_Balanced,
  unallocatedApproachDots: 0,
  equipment: [mockEquipment_LasRifle, mockEquipment_FlakArmor],
  rallyAvailable: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockCharacter_Rookie: Character = {
  id: 'char-2',
  name: 'Rookie Davis',
  traits: [
    { ...mockTrait_Role, id: 'trait-role-2', name: 'Fresh from Military Academy' },
    { ...mockTrait_Background, id: 'trait-bg-2', name: 'Idealistic Youth' },
  ],
  approaches: mockApproaches_Specialist,
  unallocatedApproachDots: 0,
  equipment: [mockEquipment_LasRifle],
  rallyAvailable: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
