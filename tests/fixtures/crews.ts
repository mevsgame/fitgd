import type { Crew } from '../../src/types';
import { mockCharacter_SergeantKane, mockCharacter_Rookie } from './characters';

/**
 * Test Fixtures - Crews
 *
 * Sample crews for unit and integration tests.
 */

export const mockCrew_StrikeTeamAlpha: Crew = {
  id: 'crew-1',
  name: 'Strike Team Alpha',
  characters: [mockCharacter_SergeantKane.id, mockCharacter_Rookie.id],
  currentMomentum: 5, // Starting momentum
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockCrew_Empty: Crew = {
  id: 'crew-2',
  name: 'Unassigned Squad',
  characters: [],
  currentMomentum: 5,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockCrew_LowMomentum: Crew = {
  id: 'crew-3',
  name: 'Desperate Team',
  characters: [mockCharacter_SergeantKane.id],
  currentMomentum: 2, // Low momentum (can use Rally)
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockCrew_HighMomentum: Crew = {
  id: 'crew-4',
  name: 'Riding High',
  characters: [mockCharacter_SergeantKane.id],
  currentMomentum: 9, // Near max
  createdAt: Date.now(),
  updatedAt: Date.now(),
};



