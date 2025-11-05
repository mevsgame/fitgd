# FitGD Usage Examples

Comprehensive examples for using the FitGD Core API in various scenarios.

## Table of Contents

- [Quick Start](#quick-start)
- [Character Creation](#character-creation)
- [Action Resolution](#action-resolution)
- [Harm & Recovery](#harm--recovery)
- [Momentum Management](#momentum-management)
- [Traits & Rally](#traits--rally)
- [Resources & Consumables](#resources--consumables)
- [Progress Clocks](#progress-clocks)
- [Complete Mission Flow](#complete-mission-flow)
- [Foundry VTT Integration](#foundry-vtt-integration)

---

## Quick Start

```typescript
import { configureStore, createGameAPI } from '@fitgd/core';

// Initialize the store
const store = configureStore();

// Create the game API
const game = createGameAPI(store);

// Now you can use game.character, game.crew, game.action, etc.
```

---

## Character Creation

### Basic Character

```typescript
const characterId = game.character.create({
  name: "Sergeant Kane",
  traits: [
    {
      name: "Served with Elite Infantry",
      category: "role",
      disabled: false
    },
    {
      name: "Survived Hive Gangs",
      category: "background",
      disabled: false
    }
  ],
  actionDots: {
    shoot: 3,
    command: 2,
    skirmish: 1,
    skulk: 1,
    wreck: 1,
    finesse: 1,
    survey: 1,
    study: 1,
    tech: 0,
    attune: 0,
    consort: 1,
    sway: 1
  }
});
```

### Adding Equipment

```typescript
// Add weapon
game.character.addEquipment({
  characterId,
  equipment: {
    name: "Lasgun",
    tier: "accessible",
    category: "weapon",
    description: "Standard-issue las weapon"
  }
});

// Add armor
game.character.addEquipment({
  characterId,
  equipment: {
    name: "Flak Armor",
    tier: "accessible",
    category: "armor"
  }
});

// Add rare equipment
game.character.addEquipment({
  characterId,
  equipment: {
    name: "Power Sword",
    tier: "epic",
    category: "weapon",
    description: "Ceremonial power weapon from a fallen officer"
  }
});
```

### Advancing Action Dots

```typescript
// Advance shoot from 3 to 4 (max)
const newRating = game.character.advanceActionDots({
  characterId,
  action: "shoot"
});
console.log(`Shoot advanced to ${newRating}`);
```

---

## Action Resolution

### Pushing Yourself

```typescript
const crewId = "crew-123";

// Spend 1 Momentum for extra die
const pushResult = game.action.push({
  crewId,
  type: "extra-die"
});
console.log(`Pushed! Momentum: ${pushResult.newMomentum}`);

// Other push types:
game.action.push({ crewId, type: "improved-position" });
game.action.push({ crewId, type: "improved-effect" });
```

### Flashback

```typescript
// Spend 1 Momentum + gain a new trait
const flashbackResult = game.action.flashback({
  crewId,
  characterId,
  trait: {
    name: "Studied the Enemy Commander",
    disabled: false,
    description: "During downtime, researched their tactics"
  }
});

console.log(`Flashback! New trait: ${flashbackResult.traitId}`);
console.log(`Momentum: ${flashbackResult.newMomentum}`);
```

### Applying Consequences

```typescript
// After a risky/standard roll with limited effect
const consequenceResult = game.action.applyConsequences({
  crewId,
  characterId,
  position: "risky",
  effect: "limited",
  harmType: "Physical Harm" // optional, if harm is taken
});

console.log(`Gained ${consequenceResult.momentumGenerated} Momentum`);
if (consequenceResult.harmApplied) {
  console.log(`Took ${consequenceResult.harmApplied.segmentsAdded} harm`);
}
```

---

## Harm & Recovery

### Taking Harm

```typescript
// Controlled/Standard = 1 segment
const harm1 = game.harm.take({
  characterId,
  harmType: "Shaken Morale",
  position: "controlled",
  effect: "standard"
});
console.log(`Took ${harm1.segmentsAdded} segments of morale harm`);

// Risky/Standard = 2 segments
const harm2 = game.harm.take({
  characterId,
  harmType: "Physical Harm",
  position: "risky",
  effect: "standard"
});
console.log(`Now at ${harm2.newSegments}/6 on physical harm clock`);

// Desperate/Standard = 3 segments
const harm3 = game.harm.take({
  characterId,
  harmType: "Physical Harm",
  position: "desperate",
  effect: "standard"
});

// Check if dying
if (game.query.isDying(characterId)) {
  console.log("Character is dying! (6/6 on any harm clock)");
}
```

### Recovering from Harm

```typescript
// Get harm clocks
const harmClocks = game.query.getHarmClocks(characterId);
const physicalHarm = harmClocks.find(c => c.type === "Physical Harm");

if (physicalHarm) {
  // Clear 2 segments
  const recovery = game.harm.recover({
    characterId,
    clockId: physicalHarm.id,
    segments: 2
  });

  console.log(`Recovered ${recovery.segmentsCleared} segments`);
  console.log(`Clock at ${recovery.newSegments}/6`);

  if (recovery.clockCleared) {
    console.log("Harm clock completely healed!");
  }
}
```

### Converting Harm to Scar

```typescript
// When harm is fully healed or completely filled
const scar = game.harm.convertToScar({
  characterId,
  clockId: physicalHarm.id,
  trait: {
    name: "War-Torn Veteran",
    disabled: false,
    description: "Carries scars from brutal combat"
  }
});

console.log(`Harm converted to scar trait: ${scar.traitId}`);
```

---

## Momentum Management

### Starting a Crew

```typescript
// Create crew (starts with 5 Momentum)
const crewId = game.crew.create("Strike Team Alpha");

// Add characters
game.crew.addCharacter({ crewId, characterId: char1 });
game.crew.addCharacter({ crewId, characterId: char2 });
game.crew.addCharacter({ crewId, characterId: char3 });

// Check Momentum
const momentum = game.query.getMomentum(crewId);
console.log(`Crew Momentum: ${momentum}/10`);
```

### Gaining Momentum

```typescript
// From consequences (built into applyConsequences)
game.action.applyConsequences({
  crewId,
  characterId,
  position: "desperate",
  effect: "limited"
});
// Automatically adds Momentum based on position/effect

// Or manually add Momentum
const newMomentum = game.crew.addMomentum({ crewId, amount: 2 });
console.log(`Momentum: ${newMomentum}/10`); // Capped at 10
```

### Spending Momentum

```typescript
// Push yourself (1 Momentum)
game.action.push({ crewId, type: "extra-die" });

// Flashback (1 Momentum)
game.action.flashback({ crewId, characterId, trait: {...} });

// Rally (0-3 Momentum, only available at 0-3)
if (game.query.canUseRally(characterId)) {
  game.character.useRally({
    characterId,
    crewId,
    momentumToSpend: 2, // Spend 2, get 1 back
    traitId: disabledTraitId // Re-enable this trait
  });
}
```

### Reset Event

```typescript
// Perform Reset (Momentum → 5, Addiction -2, Rally reset)
const resetResult = game.crew.performReset(crewId);

console.log(`Momentum reset to ${resetResult.newMomentum}`);
console.log(`Addiction reduced by ${resetResult.addictionReduced}`);
console.log(`${resetResult.charactersReset.length} characters Rally reset`);
```

---

## Traits & Rally

### Leaning Into a Trait

```typescript
// Spend a trait for Momentum
const leanResult = game.character.leanIntoTrait({
  characterId,
  traitId: "trait-role-123",
  crewId
});

console.log(`Trait disabled: ${leanResult.traitDisabled}`);
console.log(`Gained ${leanResult.momentumGained} Momentum`);
console.log(`New Momentum: ${leanResult.newMomentum}`);
```

### Using Rally

```typescript
// Rally is only available at 0-3 Momentum
if (game.crew.getMomentum(crewId) <= 3) {
  const availableTraits = game.character.getAvailableTraits(characterId);
  const disabledTraits = availableTraits.filter(t => t.disabled);

  if (disabledTraits.length > 0) {
    // Spend 2 Momentum, get 1 back, re-enable trait
    const rallyResult = game.character.useRally({
      characterId,
      crewId,
      momentumToSpend: 2,
      traitId: disabledTraits[0].id
    });

    console.log(`Rally! Trait re-enabled: ${rallyResult.traitReEnabled}`);
    console.log(`Momentum: ${rallyResult.newMomentum}`);
  }
}
```

### Grouping Traits

```typescript
// Combine 3 traits into 1 broader trait
const groupedTraitId = game.character.groupTraits({
  characterId,
  traitIds: ["trait-1", "trait-2", "trait-3"],
  newTrait: {
    name: "Veteran of the Long War",
    disabled: false,
    description: "Fought across multiple campaigns"
  }
});

console.log(`Grouped into: ${groupedTraitId}`);
```

---

## Resources & Consumables

### Using Consumables

```typescript
// Check if consumable is available
if (game.query.canUseConsumable(crewId, "frag_grenades")) {
  // Use consumable (advances depletion clock)
  const result = game.resource.useConsumable({
    crewId,
    consumableType: "frag_grenades"
  });

  console.log(`Grenades: ${result.newSegments}/${result.maxSegments}`);

  if (result.tierDowngraded) {
    console.log(`Tier downgraded to: ${result.newTier}`);
  }

  if (result.frozen) {
    console.log("Grenades depleted! No longer accessible.");
  }
}
```

### Using Stims

```typescript
// Check if stims are available (addiction not filled)
if (game.query.canUseStim(crewId)) {
  // Use stim (advances addiction clock)
  const result = game.resource.useStim({
    crewId,
    characterId
  });

  console.log(`Addiction: ${result.addictionSegments}/${result.addictionMax}`);

  if (result.addictionFilled) {
    console.log("Crew is addicted! Stims locked.");
    console.log(`Addict trait added to: ${result.addictTraitAddedTo}`);
  }
}
```

---

## Progress Clocks

### Creating Clocks

```typescript
// Long-term project (6 segments)
const projectId = game.clock.createProgress({
  entityId: crewId,
  name: "Infiltrate Command Bunker",
  segments: 6,
  category: "long-term-project",
  description: "Multi-session objective"
});

// Threat countdown (8 segments)
const threatId = game.clock.createProgress({
  entityId: crewId,
  name: "Enemy Reinforcements Arrive",
  segments: 8,
  category: "threat",
  isCountdown: true,
  description: "When filled, enemy reinforcements appear"
});
```

### Advancing Clocks

```typescript
// Advance progress clock
const progressResult = game.clock.advance({
  clockId: projectId,
  segments: 2
});

console.log(`Progress: ${progressResult.newSegments}/6`);

if (progressResult.isFilled) {
  console.log("Project completed!");
}
```

### Querying Clocks

```typescript
// Get all progress clocks for a crew
const clocks = game.query.getProgressClocks(crewId);

clocks.forEach(clock => {
  console.log(`${clock.name}: ${clock.segments}/${clock.maxSegments}`);
  if (clock.isCountdown) {
    console.log("  (Countdown - ticking up!)");
  }
});
```

---

## Complete Mission Flow

```typescript
import { configureStore, createGameAPI } from '@fitgd/core';

// Setup
const store = configureStore();
const game = createGameAPI(store);

// 1. Create crew and characters
const crewId = game.crew.create("Delta Squad");

const sarge = game.character.create({
  name: "Sergeant Rook",
  traits: [
    { name: "Veteran NCO", category: "role", disabled: false },
    { name: "Lost His Squad", category: "background", disabled: false }
  ],
  actionDots: {
    shoot: 3, command: 3, skirmish: 2, skulk: 1,
    wreck: 1, finesse: 0, survey: 1, study: 0,
    tech: 0, attune: 0, consort: 1, sway: 0
  }
});

game.crew.addCharacter({ crewId, characterId: sarge });

// 2. Mission objective (progress clock)
const missionId = game.clock.createProgress({
  entityId: crewId,
  name: "Disable Enemy Artillery",
  segments: 6,
  category: "long-term-project"
});

// 3. Action: Risky move
console.log("=== Approach under fire ===");
const momentum1 = game.query.getMomentum(crewId);
console.log(`Starting Momentum: ${momentum1}`);

// Push for extra die
game.action.push({ crewId, type: "extra-die" });
console.log(`After push: ${game.query.getMomentum(crewId)}`);

// Roll succeeds but takes harm
const consequences1 = game.action.applyConsequences({
  crewId,
  characterId: sarge,
  position: "risky",
  effect: "standard",
  harmType: "Physical Harm"
});

console.log(`Gained ${consequences1.momentumGenerated} Momentum from consequences`);
console.log(`Took ${consequences1.harmApplied?.segmentsAdded} harm`);

// Advance mission clock
game.clock.advance({ clockId: missionId, segments: 2 });

// 4. Desperate situation - lean into trait
console.log("\n=== Pinned down! ===");
const traits = game.character.getAvailableTraits(sarge);
const veteranTrait = traits.find(t => t.name === "Veteran NCO");

const leanResult = game.character.leanIntoTrait({
  characterId: sarge,
  traitId: veteranTrait.id,
  crewId
});

console.log(`Leaned into "${veteranTrait.name}" for +${leanResult.momentumGained} Momentum`);
console.log(`Current Momentum: ${leanResult.newMomentum}`);

// Take more harm
game.harm.take({
  characterId: sarge,
  harmType: "Physical Harm",
  position: "desperate",
  effect: "standard"
});

// 5. Check if Rally is needed
if (game.query.getMomentum(crewId) <= 3) {
  console.log("\n=== Rally available! ===");

  if (game.query.canUseRally(sarge)) {
    const rallyResult = game.character.useRally({
      characterId: sarge,
      crewId,
      momentumToSpend: 2,
      traitId: veteranTrait.id // Re-enable the trait
    });

    console.log("Rallied! Trait re-enabled.");
    console.log(`Momentum: ${rallyResult.newMomentum}`);
  }
}

// 6. Complete mission
game.clock.advance({ clockId: missionId, segments: 4 }); // Fill remaining

const finalClocks = game.query.getProgressClocks(crewId);
const mission = finalClocks.find(c => c.name === "Disable Enemy Artillery");

if (mission?.segments >= mission?.maxSegments) {
  console.log("\n=== MISSION COMPLETE ===");
}

// 7. Reset for next mission
console.log("\n=== Reset ===");
const reset = game.crew.performReset(crewId);
console.log(`Momentum reset to ${reset.newMomentum}`);
console.log(`${reset.charactersReset.length} characters' Rally reset`);
```

---

## Foundry VTT Integration

```typescript
import { configureStore, createGameAPI, createFoundryAdapter } from '@fitgd/core';

// Initialize core
const store = configureStore();
const game = createGameAPI(store);
const foundry = createFoundryAdapter(store);

// Export character to Foundry Actor
const character = game.character.create({...});
const foundryActor = foundry.exportCharacter(character.id);

// In Foundry, create actor
const actor = await Actor.create(foundryActor);

// Subscribe to Redux changes and sync to Foundry
store.subscribe(() => {
  foundry.syncCharacter(character.id, actor);
});

// Import from Foundry
const importedCharId = foundry.importCharacter(actor.toObject());
```

See [docs/FITGD_VS_BLADES.md](./FITGD_VS_BLADES.md) for detailed Foundry integration patterns.

---

## Next Steps

- Read the [API Documentation](../docs/api/) for complete type definitions
- See [FITGD_VS_BLADES.md](./FITGD_VS_BLADES.md) for rules comparison
- Check [CLAUDE.md](../CLAUDE.md) for implementation details
- Explore the [test files](../tests/) for additional examples

---

## Common Patterns

### Check Before Acting

```typescript
// Always check availability first
if (game.query.canUseRally(characterId)) {
  game.character.useRally({...});
}

if (game.query.canUseStim(crewId)) {
  game.resource.useStim({...});
}

if (game.query.getMomentum(crewId) >= 1) {
  game.action.push({...});
}
```

### Query State

```typescript
// Get current Momentum
const momentum = game.query.getMomentum(crewId);

// Check if character is dying
const isDying = game.query.isDying(characterId);

// Get available traits (not disabled)
const traits = game.character.getAvailableTraits(characterId);

// Get all harm clocks
const harmClocks = game.query.getHarmClocks(characterId);

// Get all progress clocks
const progress = game.query.getProgressClocks(crewId);
```

### Event Sourcing

```typescript
// Export full state
const state = foundry.exportState();
await saveToFoundryWorld(state);

// Export command history
const history = foundry.exportHistory();
await saveToFoundryJournal(history);

// Replay commands (reconstruct state)
foundry.replayCommands(loadedHistory);
```
