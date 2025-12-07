import type { Clock } from '../../src/types';
import { mockCharacter_SergeantKane } from './characters';
import { mockCrew_StrikeTeamAlpha } from './crews';

/**
 * Test Fixtures - Clocks
 *
 * Sample clocks for unit and integration tests.
 */

export const mockClock_PhysicalHarm: Clock = {
  id: 'clock-harm-1',
  entityId: mockCharacter_SergeantKane.id,
  clockType: 'harm',
  subtype: 'Physical Harm',
  segments: 3,
  maxSegments: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockClock_MoraleHarm: Clock = {
  id: 'clock-harm-2',
  entityId: mockCharacter_SergeantKane.id,
  clockType: 'harm',
  subtype: 'Shaken Morale',
  segments: 2,
  maxSegments: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};





export const mockClock_Addiction: Clock = {
  id: 'clock-addiction-1',
  entityId: mockCrew_StrikeTeamAlpha.id,
  clockType: 'addiction',
  segments: 3,
  maxSegments: 8,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const mockClock_AddictionFilled: Clock = {
  id: 'clock-addiction-2',
  entityId: 'crew-999',
  clockType: 'addiction',
  segments: 8,
  maxSegments: 8,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};



