# Insights from Play Examples

Based on `vault/content/examples.md` - real gameplay scenarios confirming our architecture.

---

## ✅ Architecture Confirmations

### 1. Harm Clock Overflow Handling
**Example:** Marcus at 3/6 Physical harm takes 5 more segments → **8/6 rounds to 6/6 (Dying)**

**Implementation Note:**
```typescript
// In clock reducer
const newSegments = Math.min(clock.segments + amount, clock.maxSegments);
// 3 + 5 = 8, min(8, 6) = 6 ✅
```

**Status:** ✅ Our `addSegments()` command will handle this correctly

---

### 2. Consumable Depletion is Team-Wide
**Example:** Sofia's grenade clock fills (3/8 → 8/8). ALL team members' grenade clocks freeze.

**Implementation:**
```typescript
// When consumable clock fills:
1. Query all clocks where:
   - clockType === 'consumable'
   - subtype === filledClock.subtype  // e.g., "frag_grenades"
   - entityId === filledClock.entityId // same crew
2. Set metadata.frozen = true on ALL
3. Downgrade metadata.tier (accessible → inaccessible)
```

**Status:** ✅ Confirmed in Phase 4 design

---

### 3. Rally Re-enables Any Disabled Trait
**Example:** Marcus re-enables his own disabled "Oaths of the Ecclesiarchy" trait during Rally.

**API Design:**
```typescript
// Rally resolution (game logic) calls:
api.character.enableTrait(characterId, traitId);
// OR during rally, any disabled trait can be re-enabled
```

**Status:** ✅ API provides this primitive

---

### 4. Momentum Capping at 10
**Example:** Team at 8, gains +4 from Desperate consequence → **10 (capped), not 12**

**Implementation:**
```typescript
// In crew reducer
const newMomentum = Math.min(
  crew.currentMomentum + amount,
  config.crew.maxMomentum // 10
);
```

**Status:** ✅ Validation planned for Phase 3

---

### 5. Fighting Wounded at 6/6
**Example:** Marcus at 6/6 Physical harm:
- Position worsens on physical actions
- Risky harm → dying again
- Desperate harm → **instant death**

**Game Logic (External to our system):**
Our system provides:
- `isClockFilled(clockId): boolean` → checks if 6/6
- `getClock(clockId)` → returns clock state
- Foundry uses this to modify Position/determine death

**Status:** ✅ API primitives provided

---

### 6. Between Missions Auto-Recovery
**Example:** After Momentum Reset, 6/6 clocks automatically reduce to 5/6.

**Game Flow (Foundry calls):**
```typescript
// On Momentum Reset:
const filledClocks = api.gameState.getAllClocks()
  .filter(c => c.segments >= c.maxSegments);

filledClocks.forEach(clock => {
  api.clock.clearSegments(clock.id, 1); // 6/6 → 5/6
});
```

**Status:** ✅ API primitives provided, game logic external

---

### 7. Trait Creation Through Flashback
**Example:** Kai creates "Astra Militarum Veteran: Anti-Large Specialist" trait via flashback.

**API Flow:**
```typescript
// 1. Spend Momentum
api.crew.spendMomentum(crewId, 1);

// 2. Create trait
const newTrait: Trait = {
  id: generateId(),
  name: "Astra Militarum Veteran: Anti-Large Specialist",
  category: "flashback",
  disabled: false,
  acquiredAt: Date.now(),
};
api.character.addTrait(characterId, newTrait);
```

**Status:** ✅ Supported in Phase 2 design

---

### 8. Group Actions are Game Logic
**Example:** Tomas leads Group Action, takes 1 harm segment per teammate failure.

**Our Role:**
- Store harm clocks for Tomas
- Provide `addSegments(clockId, count)`
- Game logic determines count based on roll results

**Status:** ✅ API primitives provided, calculation external

---

## 🔍 Edge Cases to Handle

### Edge Case 1: Harm Clock Replacement (4th Clock)
**Not in examples, but from rules:**
> "If you would take a fourth type of harm, it replaces the clock with the fewest segments"

**Implementation Plan (Phase 4):**
```typescript
// When creating 4th harm clock:
const existingHarmClocks = getHarmClocks(characterId);
if (existingHarmClocks.length >= config.clocks.harm.maxClocks) {
  // Find clock with fewest segments
  const lowestClock = existingHarmClocks.sort((a, b) =>
    a.segments - b.segments
  )[0];

  // Replace: keep segments, change subtype
  updateClock(lowestClock.id, {
    subtype: newHarmType,
    updatedAt: Date.now()
  });
} else {
  // Create new clock normally
  createHarmClock(characterId, harmType);
}
```

**Status:** ✅ Planned for Phase 4

---

### Edge Case 2: Trait Grouping (3 → 1)
**From rules but not in examples:**
> "Consolidate three similar traits into a single broader one"

**Implementation:**
```typescript
api.character.groupTraits(
  characterId,
  [traitId1, traitId2, traitId3],
  newGroupedTrait
);

// Internal logic:
// 1. Validate all 3 traits exist
// 2. Delete all 3 original traits
// 3. Add new grouped trait with category='grouped'
```

**Status:** ✅ Planned for Phase 5

---

### Edge Case 3: Addiction Trait Assignment
**From rules:** "When your clock fills, you gain the 'Addict' Trait"

**Implementation:**
```typescript
// In crew/useStim command:
payload: {
  crewId: string,
  characterId: string,  // Who used the stim
  segmentsToAdd: number // From d6 roll
}

// If addiction clock fills:
if (addictionClock.segments >= addictionClock.maxSegments) {
  // Add "Addict" trait to the character who triggered it
  addTrait(payload.characterId, {
    name: "Addict",
    category: "scar",
    // ...
  });
}
```

**Status:** ✅ Planned for Phase 4 cross-slice logic

---

## 📊 Summary

**From play examples, we confirmed:**

1. ✅ **Harm overflow** - Correctly clamped to maxSegments
2. ✅ **Consumable depletion** - Team-wide freeze mechanism correct
3. ✅ **Rally trait re-enabling** - API provides primitives
4. ✅ **Momentum capping** - Max 10 enforcement correct
5. ✅ **Fighting wounded** - Game logic uses our state queries
6. ✅ **Auto-recovery** - Game logic uses our primitives
7. ✅ **Trait creation** - Flashback workflow supported
8. ✅ **Group actions** - Game logic uses our commands

**All examples match our architecture!** No design changes needed.

---

## 🎯 Ready for Phase 2

With examples validated, we're confident to proceed with:
- Character System implementation (Phase 2)
- All validations and edge cases documented
- API contracts proven by example gameplay
