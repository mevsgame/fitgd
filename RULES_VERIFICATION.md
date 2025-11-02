# Rules Verification Checklist

Comparing our implementation plan against `rules_primer.md`, `trait.md`, and `gear.md`.

## ✅ Character Creation

| Rule | Config Value | Status |
|------|--------------|--------|
| 2 starting traits (1 role, 1 background) | `startingTraitCount: 2` | ✅ |
| 12 action dots total | `startingActionDots: 12` | ✅ |
| Max 3 dots per action at creation | `maxActionDotsAtCreation: 3` | ✅ |
| Max 4 dots per action (advancement) | `maxActionDotsPerAction: 4` | ✅ |
| Equipment based on traits | Equipment[] field in Character | ✅ |

## ✅ Momentum System

| Rule | Implementation | Status |
|------|----------------|--------|
| Starts at 5 | `startingMomentum: 5` | ✅ |
| Capped at 10 | `maxMomentum: 10` | ✅ |
| Spend: Push (1), Flashback (1) | `spendMomentum()` | ✅ |
| Generate: Desperate +4, Risky +2, Controlled +1 | `addMomentum()` | ✅ |
| Lean into trait: +2 Momentum | `addMomentum()` + `disableTrait()` | ✅ |
| Reset to 5 | `resetMomentum()` | ✅ |

## ✅ Harm Clocks

| Rule | Config/Implementation | Status |
|------|----------------------|--------|
| 6-segment clocks | `harm.segments: 6` | ✅ |
| Max 3 per character | `harm.maxClocks: 3` | ✅ |
| 4th harm replaces lowest | Validation in clockSlice | ✅ Planned |
| Position × Effect table determines segments | Game logic (external) | ✅ N/A |
| 6/6 = dying | Validation rule | ✅ Planned |

## ✅ Rally (Low Momentum Recovery)

| Rule | Implementation | Status |
|------|----------------|--------|
| Only at 0-3 Momentum | `rally.maxMomentumToUse: 3` | ✅ |
| One use per character per Reset | `rallyAvailable: boolean` | ✅ |
| Controlled position | Game logic (external) | ✅ N/A |
| Gains 1-4 Momentum | Game logic + `addMomentum()` | ✅ N/A |
| Can re-enable disabled trait | `enableTrait()` | ✅ |

## ✅ Stims & Addiction

| Rule | Config/Implementation | Status |
|------|----------------------|--------|
| 8-segment addiction clock | `addiction.segments: 8` | ✅ |
| Reduces by 2 after Reset | `addiction.resetReduction: 2` | ✅ |
| When filled: gain "Addict" trait | Cross-slice logic | ✅ Planned |
| When filled: stims locked for team | `canUseStim()` validation | ✅ |
| One clock per crew | `entityId = crewId` | ✅ |

## ✅ Consumables

| Rule | Config/Implementation | Status |
|------|----------------------|--------|
| Common: 8 segments | `consumable.segments.common: 8` | ✅ |
| Uncommon: 6 segments | `consumable.segments.uncommon: 6` | ✅ |
| Rare: 4 segments | `consumable.segments.rare: 4` | ✅ |
| After use: roll d6, advance clock | Game logic (external) | ✅ N/A |
| When filled: tier downgrades | `metadata.tier` update | ✅ Planned |
| When filled: all clocks freeze | `metadata.frozen` on all same-subtype | ✅ Planned |
| Validation before use | `canUseConsumable()` | ✅ |

## ✅ Traits

| Rule | Implementation | Status |
|------|----------------|--------|
| Categories: role, background, scar, flashback, grouped | TraitCategory type | ✅ |
| Acquire via Flashback (1 Momentum) | `addTrait()` | ✅ |
| Acquire from Scars (heal harm to 0) | `addTrait()` with category='scar' | ✅ |
| Disable (Lean into trait +2 Momentum) | `disableTrait()` | ✅ |
| Re-enable via Rally or Reset | `enableTrait()` | ✅ |
| Group 3 traits into 1 | `groupTraits()` | ✅ |

## ✅ Equipment

| Rule | Implementation | Status |
|------|----------------|--------|
| Tiers: Accessible, Inaccessible, Epic | `tier` enum | ✅ |
| Accessible: declare freely | Game logic | ✅ N/A |
| Inaccessible: 1 Momentum + Trait | Game logic + validation | ✅ N/A |
| Epic: story reward only | Game logic | ✅ N/A |
| Equipment management | `addEquipment()`, `removeEquipment()` | ✅ |

## ✅ Recovery

| Rule | Implementation | Status |
|------|----------------|--------|
| Between missions: 6/6 → 5/6 | `clearSegments(1)` | ✅ |
| Downtime: clear 1/2/4 segments | `clearSegments(n)` | ✅ |
| At 0/6: erase or convert to trait | `deleteClock()` or `addTrait()` | ✅ |

## ✅ Action Dots

| Rule | Config/Implementation | Status |
|------|----------------------|--------|
| 12 actions | ActionDots interface | ✅ |
| shoot, skirmish, skulk, wreck, finesse, survey, study, tech, attune, command, consort, sway | All 12 defined | ✅ |
| 0-4 dots per action | Validation | ✅ Planned |
| Advancement: +1 dot at milestones | `setActionDots()` | ✅ |

---

## 🔍 Edge Cases & Clarifications

### 1. Consumable Clock Freezing (TEAM-WIDE)
**Rules:** "When ANY clock fills... Everyone else's clock for that item freezes at its current count."

**Implementation Plan (Phase 4):**
When a consumable clock (e.g., "frag_grenades") fills:
1. Set `metadata.frozen = true` on the filled clock
2. Query all other clocks with same `subtype` AND same `entityId` (crew)
3. Set `metadata.frozen = true` on ALL of them
4. Downgrade `metadata.tier` (accessible → inaccessible)

**Status:** ✅ Design correct, implementation in Phase 4

### 2. Addiction Character Assignment
**Rules:** "When your clock fills, you gain the 'Addict' Trait..."

**Question:** Which character gets the "Addict" trait when the crew's addiction clock fills?
- The character who used the stim that filled the clock

**Implementation Plan:**
- `crew/useStim` command payload includes `characterId`
- When addiction clock fills, add "Addict" trait to that character
- Lock stims for entire crew (validation at crew level)

**Status:** ✅ Covered in cross-slice validation

### 3. Rally Trait Re-enabling
**Rules:** "If there is a disabled Trait (yours or a teammate's), you may re-enable it as part of the Rally."

**Implementation:**
- Rally is game flow logic (external to our system)
- Our API provides `enableTrait(characterId, traitId)`
- Foundry/game logic calls this during Rally resolution

**Status:** ✅ API primitives provided

### 4. Recovery Between Missions
**Rules:** "After a Momentum Reset, any 6/6 clocks reduce to 5/6."

**Implementation:**
- This is game flow logic (external)
- Our API provides `clearSegments(clockId, 1)`
- Foundry/game logic queries all 6/6 clocks and clears 1 segment

**Status:** ✅ API primitives provided

---

## ✅ Playtesting Questions (Configurable)

The rules mention these need playtesting observation:

| Question | How We Support It |
|----------|-------------------|
| Trait cap? | `maxTraitCount?: number` (optional) |
| Momentum homeostasis? | All values configurable |
| Rally frequency? | `rally.maxMomentumToUse` adjustable |
| Reset cadence? | Game flow, but Momentum values affect it |

**Status:** ✅ All adjustable via GameConfig

---

## 🎯 Final Verdict

**ALL GAME MECHANICS ACCOUNTED FOR** ✅

The implementation plan is **complete and accurate**. All rules from the primer are either:
1. **Directly implemented** in types/config/API
2. **Provided as primitives** for game flow logic (Foundry)
3. **Configurable** for playtesting adjustments

No discrepancies found. Ready to proceed with implementation!
