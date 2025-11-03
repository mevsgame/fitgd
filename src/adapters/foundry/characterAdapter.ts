import type { Store } from '@reduxjs/toolkit';
import type { Character, Trait, Equipment } from '../../types';
import type {
  FoundryActor,
  FoundryCharacterData,
  HarmClockData,
  ClockColor,
} from './types';
import { FITGD_CLOCK_COLORS } from './types';

/**
 * Character Adapter
 *
 * Converts Redux Character state to Foundry Actor format
 * FitGD rules: Momentum-based, harm clocks, Rally mechanic
 */

/**
 * Export character as Foundry Actor
 */
export function exportCharacterToFoundry(
  store: Store,
  characterId: string
): FoundryActor | null {
  const state = store.getState();
  const character = state.characters.byId[characterId];

  if (!character) {
    return null;
  }

  // Get harm clocks for this character
  const harmClocks = getCharacterHarmClocks(store, characterId);

  // Get traits as Foundry Items
  const traitItems = character.traits.map((trait: Trait) => ({
    _id: trait.id,
    name: trait.name,
    type: 'trait' as const,
    system: {
      category: trait.category,
      disabled: trait.disabled,
      description: trait.description,
      acquiredAt: trait.acquiredAt,
    },
  }));

  // Get equipment as Foundry Items
  const equipmentItems = character.equipment.map((equipment: Equipment) => ({
    _id: equipment.id,
    name: equipment.name,
    type: 'equipment' as const,
    system: {
      tier: equipment.tier,
      category: equipment.category,
      description: equipment.description,
    },
  }));

  const foundryActor: FoundryActor = {
    _id: character.id,
    name: character.name,
    type: 'character',
    system: {
      actions: {
        shoot: { value: character.actionDots.shoot },
        skirmish: { value: character.actionDots.skirmish },
        skulk: { value: character.actionDots.skulk },
        wreck: { value: character.actionDots.wreck },
        finesse: { value: character.actionDots.finesse },
        survey: { value: character.actionDots.survey },
        study: { value: character.actionDots.study },
        tech: { value: character.actionDots.tech },
        attune: { value: character.actionDots.attune },
        command: { value: character.actionDots.command },
        consort: { value: character.actionDots.consort },
        sway: { value: character.actionDots.sway },
      },
      rally: {
        available: character.rallyAvailable,
      },
      harm: harmClocks,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    },
    items: [...traitItems, ...equipmentItems],
    prototypeToken: {
      actorLink: true, // Link token to actor for persistence
    },
  };

  return foundryActor;
}

/**
 * Import Foundry Actor to Redux Character state
 * (Used when loading from Foundry)
 */
export function importCharacterFromFoundry(
  foundryActor: FoundryActor
): Character | null {
  if (foundryActor.type !== 'character') {
    return null;
  }

  const system = foundryActor.system as FoundryCharacterData;

  // Extract traits from items
  const traits = (foundryActor.items || [])
    .filter((item) => item.type === 'trait')
    .map((item) => {
      const traitData = item.system as any;
      return {
        id: item._id,
        name: item.name,
        category: traitData.category,
        disabled: traitData.disabled,
        description: traitData.description,
        acquiredAt: traitData.acquiredAt,
      };
    });

  // Extract equipment from items
  const equipment = (foundryActor.items || [])
    .filter((item) => item.type === 'equipment')
    .map((item) => {
      const equipData = item.system as any;
      return {
        id: item._id,
        name: item.name,
        tier: equipData.tier,
        category: equipData.category,
        description: equipData.description,
      };
    });

  const character: Character = {
    id: foundryActor._id,
    name: foundryActor.name,
    traits,
    actionDots: {
      shoot: system.actions.shoot.value,
      skirmish: system.actions.skirmish.value,
      skulk: system.actions.skulk.value,
      wreck: system.actions.wreck.value,
      finesse: system.actions.finesse.value,
      survey: system.actions.survey.value,
      study: system.actions.study.value,
      tech: system.actions.tech.value,
      attune: system.actions.attune.value,
      command: system.actions.command.value,
      consort: system.actions.consort.value,
      sway: system.actions.sway.value,
    },
    unallocatedActionDots: system.unallocatedActionDots ?? 0,
    equipment,
    rallyAvailable: system.rally.available,
    createdAt: system.createdAt,
    updatedAt: system.updatedAt,
  };

  return character;
}

/**
 * Get harm clocks for character (derived from Redux clocks)
 */
function getCharacterHarmClocks(store: Store, characterId: string): HarmClockData[] {
  const state = store.getState();
  const harmClocksKey = `harm:${characterId}`;
  const harmClockIds = state.clocks.byTypeAndEntity[harmClocksKey] || [];

  return harmClockIds.map((clockId: string) => {
    const clock = state.clocks.byId[clockId];
    return {
      id: clock.id,
      type: clock.subtype || 'Harm',
      segments: clock.segments,
      maxSegments: clock.maxSegments,
      color: getHarmClockColor(clock.subtype),
    };
  });
}

/**
 * Determine clock color based on harm type
 */
function getHarmClockColor(harmType?: string): ClockColor {
  if (!harmType) return 'red';

  const type = harmType.toLowerCase();
  if (type.includes('morale') || type.includes('shaken')) {
    return FITGD_CLOCK_COLORS.morale_harm;
  }

  // Default to physical harm (red)
  return FITGD_CLOCK_COLORS.physical_harm;
}

/**
 * Sync character changes to Foundry Actor
 * (Called after Redux state updates)
 */
export function syncCharacterToFoundry(
  store: Store,
  characterId: string,
  foundryActor: any // Actual Foundry Actor instance
): void {
  const exportedData = exportCharacterToFoundry(store, characterId);
  if (!exportedData) return;

  // Update Foundry actor data
  foundryActor.update({
    name: exportedData.name,
    system: exportedData.system,
  });

  // Sync items (traits/equipment)
  // Note: Foundry item sync is more complex, may need separate implementation
}
