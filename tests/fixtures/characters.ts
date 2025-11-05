import type { Character, Trait, ActionDots, Equipment } from '../../src/types';

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

export const mockActionDots_Balanced: ActionDots = {
  shoot: 2,
  skirmish: 2,
  skulk: 1,
  wreck: 1,
  finesse: 1,
  survey: 1,
  study: 1,
  tech: 1,
  attune: 0,
  command: 1,
  consort: 1,
  sway: 0,
};

export const mockActionDots_Specialist: ActionDots = {
  shoot: 3,
  skirmish: 3,
  skulk: 2,
  wreck: 0,
  finesse: 1,
  survey: 1,
  study: 0,
  tech: 0,
  attune: 0,
  command: 2,
  consort: 0,
  sway: 0,
};

export const mockEquipment_LasRifle: Equipment = {
  id: 'equip-1',
  name: 'Las Rifle',
  tier: 'accessible',
  category: 'weapon',
  description: 'Standard issue energy weapon',
};

export const mockEquipment_FlakArmor: Equipment = {
  id: 'equip-2',
  name: 'Flak Armor',
  tier: 'accessible',
  category: 'armor',
  description: 'Provides basic protection',
};

export const mockCharacter_SergeantKane: Character = {
  id: 'char-1',
  name: 'Sergeant Kane',
  traits: [mockTrait_Role, mockTrait_Background],
  actionDots: mockActionDots_Balanced,
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
  actionDots: mockActionDots_Specialist,
  equipment: [mockEquipment_LasRifle],
  rallyAvailable: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
