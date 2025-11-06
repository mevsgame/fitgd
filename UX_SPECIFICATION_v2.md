# FORGED IN THE GRIMDARK - UX SPECIFICATION v2.0

## Document Purpose
This is the **implementation-ready specification** based on planning discussions. All design decisions have been made. Ready to code.

---

## Core System Rules Summary

### Equipment System
- **Slots per character:** 5 (configurable in game settings)
- **Accessible equipment:** Uses slots when equipped
- **Inaccessible equipment:** Requires 1M flashback + trait to acquire permanently
- **Epic equipment:** Takes 1 slot, cannot be flashbacked
- **Consumables:** Do NOT use equipment slots (separate system with depletion clocks)
- **Consumable limits:** 2 consumables + stims per character
- **Auto-unequip:** All equipment unequips on Momentum Reset (scene change)
- **Manual management:** Can equip/unequip via character sheet between actions

### Trait System
- **Starting traits:** 2 (1 Role, 1 Background) - character creation only
- **Acquisition methods:**
  1. **Flashback (1M):** Create new trait during action
  2. **Scars:** Convert fully healed harm clock to trait
  3. **Catch-up rule:** If you have lowest/equal trait count in crew, can add trait via sheet (no cost)
- **Trait categories:** Role, Background, Scar, Flashback, Grouped
- **Disabled traits:** Re-enabled by Rally OR Momentum Reset
- **Grouping:** 3 similar traits → 1 broader trait (between sessions/after Reset)

### Momentum & Combat
- **Starting value:** 5 Momentum
- **Reset triggers:**
  - Momentum Reset (narrative)
  - Encounter start (Foundry combat tracker starts)
- **Consequences give Momentum:**
  - Controlled: +1M
  - Risky: +2M
  - Desperate: +4M
- **Spending Momentum:**
  - Push Yourself: 1M (+1d OR +1 Effect OR +1 Position)
  - Flashback: 1M (create trait + mechanical advantage)
  - Rally: Variable based on roll (1-4M gained)

### Harm & Combat Status
- **Harm clocks:** 6 segments, max 3 per character
- **4th harm clock:** Replaces clock with fewest segments
- **Fighting Wounded:** ANY 6/6 harm clock = auto-detected status
  - GM can worsen Position on relevant actions
  - Risky harm on same clock = dying again
  - Desperate harm on same clock = instant death
- **Dying (6/6 harm):**
  - Clockwise turn order
  - Teammates must stabilize before dying player's next turn
  - Even failed stabilization attempt works
  - If not stabilized: Death, Captured, or Lost
- **Recovery:**
  - After Reset: All 6/6 clocks → 5/6 automatically
  - Downtime action: Roll at Controlled, clear 1/2/4 segments based on Effect
  - Fully healed (0/6) → option to convert to Scar trait

### Teamwork
- **Assist:** Help teammate by rolling. If 4-6, they get +1d. Both face own consequences.
- **Protect:** Take consequence meant for teammate. You suffer exact consequence.
- **Group Action:** (Defer to Phase 2+)

### Roll Mechanics
- **0 action dots:** Roll 2d6, take lowest
- **Critical success:** Two 6s on ≥2d6
  - Effect increases by one level
  - Additional advantage
- **Rally critical (two 6s):**
  - Gain 4 Momentum
  - Can improve Position for one or all teammates on their next roll
  - Can re-enable disabled trait

---

## Player Round State Machine

### State Diagram

```
┌──────────────────────────────────────────────────────┐
│                    IDLE_WAITING                      │
│  Status: Not your turn                              │
│  Available Actions:                                  │
│  • [Assist Teammate] (when teammate in DECISION)    │
│  • [Protect Teammate] (when teammate has consequence)│
│  • View crew status, harm clocks                    │
└──────────────────────────────────────────────────────┘
                    ↓ (becomes active combatant)
┌──────────────────────────────────────────────────────┐
│                  DECISION_PHASE                      │
│  Status: Your turn - prepare action                 │
│  Widget: Player Action Widget appears               │
│  Available Actions:                                  │
│  • [Rally] (if Momentum ≤3 and Rally available)     │
│  • [Flashback] (1M, create trait)                   │
│  • [Equipment] (open dialog, equip/use gear)        │
│  • [Traits] (select trait to use)                   │
│  • [Push] (toggle, 1M, +1d or +Effect)              │
│  • [Roll Action] → ROLL_CONFIRM                     │
│  • [Cancel] (revert to clean state)                 │
│                                                      │
│  Sub-states (optional transitions):                 │
│  • RALLY_ROLLING → back to DECISION or → ROLL       │
│  • ASSIST_ROLLING (triggered by teammate)           │
└──────────────────────────────────────────────────────┘
                    ↓ (clicks Roll Action)
┌──────────────────────────────────────────────────────┐
│                   ROLL_CONFIRM                       │
│  Status: Confirm action parameters                  │
│  Widget: Shows summary                              │
│  Display:                                            │
│  • Action selected (e.g., Shoot)                    │
│  • Position & Effect (with improvements)            │
│  • Dice pool (base + modifiers)                     │
│  • Momentum cost preview                            │
│  Available Actions:                                  │
│  • [Back] → DECISION_PHASE                          │
│  • [🎲 COMMIT & ROLL] → ROLLING                     │
└──────────────────────────────────────────────────────┘
                    ↓ (commits roll)
┌──────────────────────────────────────────────────────┐
│                     ROLLING                          │
│  Status: Dice rolling animation                     │
│  Widget: Shows dice results                         │
│  Display:                                            │
│  • Dice values                                       │
│  • Highest die                                       │
│  • Outcome calculation                              │
│  Automatic transition based on result:               │
│  • Critical (two 6s) → SUCCESS_COMPLETE             │
│  • Success (6) → SUCCESS_COMPLETE                   │
│  • Partial (4-5) → CONSEQUENCE_CHOICE               │
│  • Failure (1-3) → CONSEQUENCE_CHOICE               │
└──────────────────────────────────────────────────────┘
         ↓                                ↓
    (Success/Crit)                   (Partial/Fail)
         ↓                                ↓
┌───────────────────┐      ┌───────────────────────────┐
│ SUCCESS_COMPLETE  │      │   CONSEQUENCE_CHOICE       │
│                   │      │   Status: Choose response  │
│ Status: Success!  │      │   Available Actions:       │
│ Apply effects     │      │   • [Use Stims] → REROLL  │
│ Post to chat      │      │   • [Accept] → CONSEQUENCE │
│ End turn          │      └───────────────────────────┘
└───────────────────┘                    ↓
         ↓                        (Accept clicked)
    (Next turn)                          ↓
                          ┌───────────────────────────┐
                          │  CONSEQUENCE_RESOLUTION    │
                          │  Status: Apply consequence │
                          │  Display:                  │
                          │  • Calculated harm/clock   │
                          │  • Momentum gain preview   │
                          │  • Protect button for      │
                          │    teammates (reactive)    │
                          │  Available Actions:        │
                          │  • [Take Harm] (apply)     │
                          │  • [Advance Clock] (apply) │
                          │  • [Worsen Position]       │
                          │  • [Reduced Effect]        │
                          └───────────────────────────┘
                                      ↓
                          ┌───────────────────────────┐
                          │     APPLYING_EFFECTS       │
                          │  Status: Writing to state  │
                          │  • Dispatch Redux commands │
                          │  • Update harm clocks      │
                          │  • Add Momentum            │
                          │  • Post to chat            │
                          └───────────────────────────┘
                                      ↓
                          ┌───────────────────────────┐
                          │      TURN_COMPLETE         │
                          │  Status: Done              │
                          │  • Hide player widget      │
                          │  • Advance turn order      │
                          │  • Next player → DECISION  │
                          └───────────────────────────┘
```

### Special State: REROLL (Stims)

```
CONSEQUENCE_CHOICE (clicked Use Stims)
    ↓
STIMS_ROLLING
  • Make addiction clock roll (1d6)
  • Advance addiction clock
  • Check if filled → "Addict" trait
    ↓
    (If addiction not filled)
    ↓
ROLLING (reroll with same parameters)
  → Same branching as before (Success or Consequence)
    ↓
    (If addiction filled)
    ↓
STIMS_LOCKED
  • Notify: "Stims now locked for entire crew"
  • Add "Addict" trait to character
  • Still proceed with reroll
```

### Reactive States (Other Players)

```
TEAMMATE_DECISION
  • Watching teammate prepare action
  • [Assist Teammate] button visible
    ↓ (clicked Assist)
    ↓
ASSIST_ROLLING
  • Make own roll with own Position/Effect
  • If 4-6: Teammate gets +1d
  • Face own consequences
  • Return to IDLE_WAITING
```

```
TEAMMATE_CONSEQUENCE_RESOLUTION
  • Watching teammate about to take harm
  • [Protect Teammate] button visible
    ↓ (clicked Protect)
    ↓
PROTECT_ACCEPTING
  • Transfer consequence to self
  • Apply harm to self instead
  • Face consequences
  • Return to IDLE_WAITING
```

---

## Widget Specifications

### 1. Player Action Widget

**Trigger:** Appears when player becomes active combatant
**Position:** Bottom-center, 600px wide, auto height
**Dismissible:** No (state-driven, auto-hides on turn end)

#### State: DECISION_PHASE

```
┌──────────────────────────────────────────────────────┐
│  🎯 MARCUS - YOUR TURN                               │
│  Action: [Shoot ▾]  Position: RISKY 🟡 Effect: STD  │
├──────────────────────────────────────────────────────┤
│  💔 HARM CLOCKS:                                     │
│  Physical: ████░░ 4/6  Morale: ██░░░░ 2/6           │
├──────────────────────────────────────────────────────┤
│  PREPARE ACTION:                                     │
│  [Rally] [Flashback] [Equipment] [Traits] [Push]    │
│                                                      │
│  📋 Current Plan:                                    │
│  ┌────────────────────────────────────────────────┐ │
│  │ Action: Shoot (2d6)                           │ │
│  │ Position: RISKY → CONTROLLED                   │ │
│  │   • Using 'Veteran' trait                     │ │
│  │ Effect: STANDARD → GREAT                      │ │
│  │   • Equipped: Lasgun (improves Shoot)         │ │
│  │ Modifiers:                                    │ │
│  │   • Push Yourself: +1d [1M]                   │ │
│  │ ══════════════════════════════════════════     │ │
│  │ TOTAL: 3d6 at Controlled/Great                │ │
│  │ Momentum Cost: -1M (7→6)                      │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [Cancel] [🎲 ROLL ACTION] ← Primary                 │
└──────────────────────────────────────────────────────┘
```

**Button States:**
- **Rally:** Enabled if Momentum ≤3 AND Rally available. Otherwise grayed with tooltip.
- **Flashback:** Enabled if Momentum ≥1. Otherwise grayed.
- **Equipment:** Always enabled (opens dialog)
- **Traits:** Always enabled (opens dialog)
- **Push:** Toggle button. When active, shows checkmark and costs 1M.
- **Roll Action:** Primary button, always enabled in DECISION state.
- **Cancel:** Clears all selections, returns to clean DECISION state.

#### State: ROLL_CONFIRM

```
┌──────────────────────────────────────────────────────┐
│  🎯 CONFIRM ACTION                                   │
│  Ready to roll?                                      │
├──────────────────────────────────────────────────────┤
│  Action: Shoot (3d6)                                 │
│  Position: CONTROLLED 🟢  Effect: GREAT              │
│  Momentum Cost: -1M (Current: 7→6 after roll)       │
├──────────────────────────────────────────────────────┤
│  [← Back] [🎲 COMMIT & ROLL] ← Primary               │
└──────────────────────────────────────────────────────┘
```

#### State: ROLLING

```
┌──────────────────────────────────────────────────────┐
│  🎲 ROLLING...                                       │
├──────────────────────────────────────────────────────┤
│  [Dice animation: 6, 4, 2]                           │
└──────────────────────────────────────────────────────┘
```

#### State: SUCCESS_COMPLETE

```
┌──────────────────────────────────────────────────────┐
│  ✅ SUCCESS! (6)                                      │
│  You hit the target cleanly. No complications.       │
├──────────────────────────────────────────────────────┤
│  Result posted to chat. Turn ending...               │
└──────────────────────────────────────────────────────┘
```

#### State: CONSEQUENCE_CHOICE

```
┌──────────────────────────────────────────────────────┐
│  ⚠️ PARTIAL SUCCESS (5)                              │
│  You hit, but face consequences...                   │
├──────────────────────────────────────────────────────┤
│  [Use Stims & Reroll] [Accept Consequences]          │
└──────────────────────────────────────────────────────┘
```

#### State: CONSEQUENCE_RESOLUTION

```
┌──────────────────────────────────────────────────────┐
│  ⚠️ CONSEQUENCE (Risky Position, Standard Effect)    │
├──────────────────────────────────────────────────────┤
│  Choose consequence type:                            │
│  [Take 3 Harm] [Advance Threat Clock +2]            │
│  [Worsen Position] [Reduced Effect]                 │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ Harm Consequence Reference:                   │ │
│  │ ┌─────────┬─────────┬─────────┬─────────┐    │ │
│  │ │ Pos/Eff │ Limited │ Std     │ Great   │    │ │
│  │ ├─────────┼─────────┼─────────┼─────────┤    │ │
│  │ │ Control │ 0       │ 1       │ 2       │    │ │
│  │ │ Risky   │ 2       │ 3 ◄─────│ 4       │    │ │
│  │ │ Desprt  │ 4       │ 5       │ 6 (DIE) │    │ │
│  │ └─────────┴─────────┴─────────┴─────────┘    │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  💎 Momentum Gain: +2 (auto-applied)                │
│  ⚡ Teammates can [Protect] you                      │
└──────────────────────────────────────────────────────┘
```

**Interaction:**
- Clicking consequence button applies it immediately
- Momentum auto-added to crew
- Chat message posted with outcome
- Turn advances

---

### 2. Crew Status Widget

**Trigger:** Always visible when in a scene with active crew
**Position:** Top-left, 280px wide, auto height
**Collapsible:** Yes (minimize to icon)
**Draggable:** Yes

```
┌─────────────────────────────────────┐
│  ⚡ CREW: Strike Team Alpha          │
├─────────────────────────────────────┤
│  MOMENTUM: 7/10                     │
│  ███████░░░                         │
│  [+1] [+2] [+4] [-1] (GM only)      │
│                                     │
│  Recent:                            │
│  +2 Marcus accepted Risky harm      │
│  -1 Sofia pushed herself            │
├─────────────────────────────────────┤
│  🔴 THREAT CLOCKS:                  │
│  Cult Alerted: ████░░ 4/6           │
│  Reinforcements: ██░░░░░░ 2/8       │
│                                     │
│  [+ Add Clock] (GM only)            │
├─────────────────────────────────────┤
│  💊 CONSUMABLES:                    │
│  Frag Grenades: ███░░░░░ 3/8 ✓      │
│  Krak Grenades: █████░ 5/6 ⚠️       │
│  Stims: ██░░░░░░ 2/8 ✓              │
│                                     │
│  ⚠️ = Close to depletion            │
└─────────────────────────────────────┘
```

**Features:**
- **Momentum bar:** Clickable segments (GM can adjust)
- **Recent transactions:** Last 3 Momentum changes, scrolling
- **Threat clocks:** Clickable segments (GM can advance)
- **Consumables:** Shows highest clock per consumable type
- **Color coding:**
  - Green: 0-3 segments (safe)
  - Yellow: 4-5 segments (caution)
  - Red: 6+ segments (danger)

---

### 3. Character Portrait Overlays (Token/Canvas)

**Trigger:** Always visible for characters in scene
**Position:** Over character tokens on canvas

```
   Marcus Token
┌──────────────┐
│   🟡 RISKY   │  ← Position glow (green/yellow/red)
│  ┌────────┐  │
│  │ Avatar │  │
│  └────────┘  │
│              │
│  🩹 4/6      │  ← Harm status (if wounded)
│  ⚡ Rally    │  ← Rally available badge
│  ☠️ DYING    │  ← If at 6/6 harm (pulsing red)
└──────────────┘
```

**Status Indicators:**
- **Position glow:** Border color
  - Green = Controlled
  - Yellow = Risky
  - Red = Desperate
- **Harm status:** Shows highest harm clock
  - Hidden if no harm
  - Red text if 6/6 (dying)
- **Rally badge:** Green checkmark if available
- **Dying indicator:** Red pulsing skull if any 6/6 harm clock

**Interactions:**
- **Right-click token (GM):** Context menu
  - Set Position (Controlled/Risky/Desperate)
  - Apply Quick Harm (1/2/3 segments)
  - Advance Clock
  - Stabilize (if dying)

---

### 4. Reactive Teammate Buttons

**Trigger:** Appears based on active player's state

#### Assist Button (during teammate's DECISION)

```
┌──────────────────────────────────────┐
│  Sofia is preparing Shoot action     │
│  [Assist Sofia] ← Visible to Marcus  │
└──────────────────────────────────────┘
```

**On click:**
- Opens mini action dialog for assisting player
- Assisting player selects action, Position, Effect
- Rolls dice
- If 4-6: Sofia gets +1d
- Assisting player faces own consequences

#### Protect Button (during teammate's CONSEQUENCE_RESOLUTION)

```
┌──────────────────────────────────────┐
│  ⚠️ Sofia will take 3 Physical Harm   │
│  [Protect Sofia] ← Visible to all    │
└──────────────────────────────────────┘
```

**On click:**
- Consequence transfers to protecting player
- Apply harm to protector instead
- Chat message: "Marcus protected Sofia!"

---

## Dialog Specifications

### 1. Equipment Dialog

**Trigger:** Click [Equipment] button in Player Action Widget
**Size:** 700px wide, 500px tall
**Modal:** Yes (blocks other interactions)

```
┌────────────────── EQUIPMENT MANAGEMENT ─────────────────┐
│  Marcus                                   [Close × ]     │
├──────────────────────────────────────────────────────────┤
│  EQUIPPED (2/5 slots):                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [✓] Lasgun (Accessible)                           │ │
│  │     └─ Shoot: Standard → Great Effect             │ │
│  │ [✓] Flak Armor (Accessible)                       │ │
│  │     └─ Position: Better vs ranged harm            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  OWNED (not equipped):                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [ ] Knife (Accessible)                            │ │
│  │ [ ] Dataslate (Accessible)                        │ │
│  │ [ ] Krak Grenades (Inaccessible) 🔒               │ │
│  │     └─ Requires: 1M Flashback + Trait to equip   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ACTIONS:                                                │
│  [Equip Selected] [Unequip Selected]                    │
│  [Flashback for Equipment] (1M)                         │
│                                                          │
│  [Done] [Cancel]                                         │
└──────────────────────────────────────────────────────────┘
```

**Interactions:**
- **Checkbox:** Select equipment
- **Equip:** Move to equipped, use slot
- **Unequip:** Move to owned, free slot
- **Flashback:** Opens sub-dialog (see below)
- **Done:** Closes dialog, applies changes to current action plan

### 2. Equipment Flashback Sub-Dialog

**Trigger:** Click [Flashback for Equipment]
**Size:** 600px wide, 450px tall

```
┌─────────────── FLASHBACK: ACQUIRE EQUIPMENT ────────────┐
│  Cost: 1 Momentum (Current: 7 → 6)          [Close × ]  │
├──────────────────────────────────────────────────────────┤
│  EQUIPMENT DETAILS:                                      │
│  Name: [___________________________________]             │
│  Tier: ○ Accessible  ● Inaccessible  ○ Epic (N/A)      │
│  Category: [Weapon ▾]                                   │
│  Description: [_________________________________]         │
│               [_________________________________]         │
│                                                          │
│  Game Effect (how it improves Position/Effect):         │
│  [______________________________________________]         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  TRAIT JUSTIFICATION:                                    │
│  This flashback creates a permanent trait.              │
│                                                          │
│  ○ Use existing trait:                                  │
│     [Astra Militarum Veteran ▾]                         │
│                                                          │
│  ● Create new trait:                                    │
│     Trait Name: [_______________________________]        │
│     Category: [Flashback ▾]                             │
│     Description: [_______________________________]       │
│                  [_______________________________]       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  RESULT:                                                 │
│  • Costs 1 Momentum                                     │
│  • Creates/uses trait (permanent)                       │
│  • Adds equipment to inventory (permanent)              │
│  • Auto-equips if slot available                        │
│                                                          │
│  [Confirm Flashback] [Cancel]                           │
└──────────────────────────────────────────────────────────┘
```

**Validation:**
- Must have ≥1 Momentum
- Must provide equipment name
- Must either select existing trait or create new one
- If creating new trait, must provide trait name

**On Confirm:**
- Dispatch Redux commands:
  - `crew/spendMomentum` (-1M)
  - `character/addTrait` (if new trait)
  - `character/addEquipment` (new equipment)
  - `character/equipItem` (if slot available)
- Close dialog
- Return to Equipment Dialog with new item visible

### 3. Traits Dialog

**Trigger:** Click [Traits] button in Player Action Widget OR character sheet Traits tab
**Size:** 650px wide, 500px tall

```
┌──────────────────── TRAITS ──────────────────────────────┐
│  Marcus                                      [Close × ]   │
├──────────────────────────────────────────────────────────┤
│  ACTIVE TRAITS (3 total):                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ✓ Astra Militarum Veteran (Role)                  │ │
│  │   "Served with Elite Infantry Regiment"           │ │
│  │                                                    │ │
│  │ ✓ Survived Hive Gangs (Background)                │ │
│  │   "Grew up in Underhive, knows gang tactics"      │ │
│  │                                                    │ │
│  │ ✗ Shaken by Warp (Scar) [DISABLED]                │ │
│  │   "Leaned into, Rally or Reset to re-enable"      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  CREW TRAIT COUNTS:                                      │
│  Marcus: 3  |  Sofia: 5  |  Kai: 4  |  Elena: 3        │
│  ✓ You have lowest/equal count - can add trait!         │
│                                                          │
│  ACTIONS:                                                │
│  [Add Trait via Flashback] (1M)                         │
│  [Add Trait] (Free - lowest count rule)                 │
│  [Group 3 Traits] (Between sessions/Reset only)         │
│  [Lean Into Selected] (+2M, disables trait)             │
│                                                          │
│  [Done] [Cancel]                                         │
└──────────────────────────────────────────────────────────┘
```

**Button States:**
- **Add via Flashback:** Enabled if Momentum ≥1
- **Add Trait (Free):** Enabled if player has lowest/equal trait count in crew
- **Group 3 Traits:** Enabled only between sessions or after Momentum Reset (GM setting)
- **Lean Into:** Enabled if trait selected and not already disabled

### 4. Add Trait (Free) Sub-Dialog

**Trigger:** Click [Add Trait] when lowest count rule applies
**Size:** 500px wide, 350px tall

```
┌───────────────── ADD TRAIT (Catch-Up Rule) ──────────────┐
│  You have the lowest trait count in crew (3)            │
│  Free trait addition!                       [Close × ]   │
├──────────────────────────────────────────────────────────┤
│  TRAIT DETAILS:                                          │
│  Name: [_________________________________________]        │
│  Category: [Scar ▾]                                     │
│           (Role/Background locked to char creation)      │
│  Description: [_____________________________________]     │
│               [_____________________________________]     │
│               [_____________________________________]     │
│                                                          │
│  [Add Trait] [Cancel]                                    │
└──────────────────────────────────────────────────────────┘
```

**Note:** Role and Background categories locked after character creation. Only Scar, Flashback, Grouped available.

### 5. Rally Dialog

**Trigger:** Click [Rally] button in Player Action Widget (when Momentum ≤3)
**Size:** 500px wide, 400px tall

```
┌──────────────────────── RALLY ───────────────────────────┐
│  Inspire your team in desperate times!     [Close × ]    │
│  Current Momentum: 2/10                                  │
├──────────────────────────────────────────────────────────┤
│  REFERENCE TEAMMATE'S TRAIT:                             │
│  Select teammate: [Sofia ▾]                             │
│  Select their trait: [Survivor of Hive Bottom ▾]        │
│                                                          │
│  Describe how this inspires you:                         │
│  [__________________________________________________]     │
│  [__________________________________________________]     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  YOUR ROLL:                                              │
│  Action to use: [Consort ▾]                             │
│  Position: CONTROLLED (always)                           │
│  Effect: N/A (Momentum gain based on roll)              │
│                                                          │
│  [🎲 ROLL RALLY]                                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  MOMENTUM GAIN TABLE:                                    │
│  • 1-3: +1 Momentum                                     │
│  • 4-5: +2 Momentum                                     │
│  • 6:   +3 Momentum                                     │
│  • Critical (two 6s): +4 Momentum + improve Position    │
│           for one or all teammates' next roll           │
│                                                          │
│  RE-ENABLE TRAIT:                                        │
│  [ ] Re-enable disabled trait (optional)                │
│      [Your disabled trait ▾]                            │
│                                                          │
│  [Cancel]                                                │
└──────────────────────────────────────────────────────────┘
```

**After Roll:**
```
┌──────────────────────── RALLY RESULT ────────────────────┐
│  Roll: 6, 5 = SUCCESS (6)                                │
│  Momentum Gained: +3 (2 → 5)                            │
│                                                          │
│  ✓ Re-enabled trait: "Shaken by Warp"                    │
│                                                          │
│  [Close]                                                 │
└──────────────────────────────────────────────────────────┘
```

**On Critical:**
```
┌──────────────────── RALLY CRITICAL! ─────────────────────┐
│  Roll: 6, 6 = CRITICAL SUCCESS                           │
│  Momentum Gained: +4 (2 → 6)                            │
│                                                          │
│  BONUS: Improve Position for teammates' next roll        │
│  ○ One teammate: [Sofia ▾]                              │
│  ● All teammates                                         │
│                                                          │
│  Position improvement: [+1 level ▾]                     │
│  (Desperate → Risky, Risky → Controlled)                │
│                                                          │
│  [Apply] [Cancel]                                        │
└──────────────────────────────────────────────────────────┘
```

---

## Game Settings Panel

**Location:** Foundry VTT → Game Settings → FitGD System Settings

```
┌────────────── FORGED IN THE GRIMDARK SETTINGS ──────────┐
│                                                          │
│  EQUIPMENT SYSTEM:                                       │
│  Equipment slots per character: [5 ▾]                   │
│  Auto-unequip on Momentum Reset: [✓]                    │
│  Consumables use equipment slots: [ ]                   │
│  Max consumables per character: [2 ▾]                   │
│                                                          │
│  DISPLAY OPTIONS:                                        │
│  Show harm clocks in player widget: [✓]                 │
│  Show last roll in widget: [✓]                          │
│  Color-code Position on tokens: [✓]                     │
│  Show Momentum in crew widget: [✓]                      │
│  Show threat clocks in crew widget: [✓]                 │
│  Show consumable clocks in crew widget: [✓]             │
│                                                          │
│  MOMENTUM:                                               │
│  Reset Momentum on encounter start: [✓]                 │
│  Starting Momentum value: [5 ▾]                         │
│  Maximum Momentum: [10 ▾]                               │
│                                                          │
│  TRAITS:                                                 │
│  Enable "lowest trait count" catch-up: [✓]              │
│  Max traits per character: [No Limit ▾]                 │
│  Allow trait grouping: [✓]                              │
│  Trait grouping available: [Between sessions/Reset ▾]   │
│                                                          │
│  COMBAT:                                                 │
│  Use Foundry combat tracker: [✓]                        │
│  Auto-detect dying status (6/6 harm): [✓]               │
│  Clockwise turn order for stabilization: [✓]            │
│                                                          │
│  [Save Settings] [Reset to Defaults]                    │
└──────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### Character Entity Updates

```typescript
interface Character {
  // ... existing fields

  // NEW: Equipment management
  equipment: Equipment[];
  equippedItems: string[];  // Equipment IDs currently equipped
  maxEquipmentSlots: number;  // From game settings, default 5

  // NEW: Consumable tracking
  consumableClocks: {
    [consumableType: string]: {
      clockId: string;  // Reference to Clock entity
      frozen: boolean;   // If clock filled
    }
  };
  maxConsumables: number;  // From game settings, default 2

  // NEW: Rally tracking
  rallyUsed: boolean;  // Reset on Momentum Reset

  // NEW: Combat status
  fightingWounded: boolean;  // Computed: any harm clock at 6/6
  dying: boolean;  // Computed: any harm clock at 6/6 unstabilized
  stabilized: boolean;  // If dying but stabilized
}

interface Equipment {
  id: string;
  name: string;
  tier: 'accessible' | 'inaccessible' | 'epic';
  category: string;
  description: string;
  gameEffect: string;  // How it improves Position/Effect
  equipped: boolean;   // DEPRECATED - use Character.equippedItems
}
```

### New: PlayerRoundState Entity

```typescript
interface PlayerRoundState {
  characterId: string;
  state: 'IDLE_WAITING' | 'DECISION_PHASE' | 'ROLL_CONFIRM' |
         'ROLLING' | 'SUCCESS_COMPLETE' | 'CONSEQUENCE_CHOICE' |
         'CONSEQUENCE_RESOLUTION' | 'APPLYING_EFFECTS' | 'TURN_COMPLETE' |
         'RALLY_ROLLING' | 'ASSIST_ROLLING' | 'PROTECT_ACCEPTING' |
         'STIMS_ROLLING' | 'STIMS_LOCKED';

  // State data
  selectedAction?: keyof ActionDots;
  position?: 'controlled' | 'risky' | 'desperate';
  effect?: 'limited' | 'standard' | 'great';

  // Improvements
  selectedTrait?: string;  // Trait ID
  equippedForAction?: string[];  // Equipment IDs used for this action
  pushed?: boolean;  // Push Yourself flag
  flashbackApplied?: boolean;

  // Roll data
  dicePool?: number;
  rollResult?: number[];
  outcome?: 'critical' | 'success' | 'partial' | 'failure';

  // Consequence data
  consequenceType?: 'harm' | 'clock' | 'position' | 'effect';
  consequenceValue?: number;
  momentumGain?: number;

  // Timestamps
  stateEnteredAt: number;

  // Undo support
  previousState?: PlayerRoundState;
}
```

### Scene Flags (Foundry)

```typescript
scene.flags.fitgd = {
  encounterActive: boolean;
  turnOrder: string[];  // Character IDs
  activePlayer: string;  // Character ID

  // Player states
  playerStates: {
    [characterId: string]: PlayerRoundState;
  };

  // GM overrides
  gmPositionOverrides: {
    [characterId: string]: {
      position?: 'controlled' | 'risky' | 'desperate';
      effect?: 'limited' | 'standard' | 'great';
    }
  };

  // Rally critical bonuses
  rallyPositionBonus?: {
    targets: string[];  // 'all' or specific character IDs
    improvement: number;  // +1 level
    expiresAfterRoll: boolean;
  };
};
```

---

## Redux Commands (New/Modified)

### Equipment Commands

```typescript
// New commands
'character/equipItem' - Add item ID to equippedItems array
'character/unequipItem' - Remove item ID from equippedItems
'character/addEquipment' - Add equipment to inventory
'character/removeEquipment' - Remove from inventory
'character/flashbackEquipment' - Combo: add trait + equipment + equip

// Validators
- equipItem: Check slot availability
- flashbackEquipment: Check Momentum ≥1, validate trait
```

### Consumable Commands

```typescript
'character/useConsumable' - Record consumable use
'character/rollConsumableDepletion' - Advance clock by d6
'character/freezeConsumable' - Mark consumable as depleted
'crew/downgradeTier' - When consumable clock fills
```

### State Machine Commands

```typescript
'playerState/transition' - Change player round state
'playerState/setActionPlan' - Store action, Position, Effect, improvements
'playerState/rollDice' - Record roll result
'playerState/applyConsequence' - Apply harm/clock + Momentum
'playerState/reset' - Clear state, return to IDLE
```

### Rally Commands

```typescript
'character/useRally' - Mark Rally as used
'character/resetRally' - Re-enable Rally (on Reset)
'character/rollRally' - Rally roll with Momentum gain
'character/applyRallyBonus' - Position improvement for teammates
```

### Combat Status Commands

```typescript
'character/setDying' - Mark as dying (auto when harm reaches 6/6)
'character/stabilize' - Mark as stabilized
'character/setFightingWounded' - Auto-computed flag
```

---

## Implementation Phases (Revised)

### Phase 1: Core State Machine + Player Widget (Week 1-2)
**Goal:** Basic action flow works

**Tasks:**
1. Create PlayerRoundState entity and Redux slice
2. Implement state machine transitions
3. Build Player Action Widget (all states)
4. Connect to Foundry combat tracker hooks
5. Basic roll flow: DECISION → ROLL → CONSEQUENCE
6. Test with manual state transitions

**Deliverable:** Player can select action, roll, face consequences, end turn

---

### Phase 2: Equipment System (Week 3)
**Goal:** Equipment management works

**Tasks:**
1. Extend Character entity with equipment fields
2. Build Equipment Dialog
3. Implement equip/unequip logic with slot validation
4. Build Equipment Flashback Dialog
5. Integrate equipment improvements into action plan preview
6. Auto-unequip on Momentum Reset

**Deliverable:** Players can manage equipment, use in actions, flashback for new gear

---

### Phase 3: Traits System (Week 4)
**Goal:** Trait management and usage

**Tasks:**
1. Build Traits Dialog
2. Implement "lowest trait count" rule
3. Build Add Trait (Free) Sub-Dialog
4. Integrate trait selection into action plan
5. Trait grouping UI (between sessions)
6. Lean Into Trait from sheet

**Deliverable:** Full trait lifecycle works

---

### Phase 4: Rally & Recovery (Week 5)
**Goal:** Low-Momentum recovery mechanics

**Tasks:**
1. Build Rally Dialog
2. Implement Rally roll and Momentum gain
3. Rally critical Position bonus
4. Re-enable disabled traits
5. Downtime recovery actions
6. Scar trait conversion

**Deliverable:** Rally and recovery systems functional

---

### Phase 5: Teamwork (Week 6)
**Goal:** Assist and Protect

**Tasks:**
1. Reactive teammate buttons (Assist/Protect)
2. Assist roll flow (own roll, +1d to teammate)
3. Protect consequence transfer
4. State machine integration

**Deliverable:** Teamwork actions work

---

### Phase 6: Crew Status Widget (Week 7)
**Goal:** Always-visible crew state

**Tasks:**
1. Build Crew Status Widget
2. Momentum tracker with GM controls
3. Threat clocks display and interaction
4. Consumable clocks warnings
5. Real-time updates on Redux changes

**Deliverable:** Crew widget always shows current state

---

### Phase 7: Token Overlays & Visual Polish (Week 8)
**Goal:** Board-based indicators

**Tasks:**
1. Position color glow on tokens
2. Harm status badges
3. Rally available indicator
4. Dying indicator (pulsing)
5. Right-click GM context menu

**Deliverable:** Visual feedback on canvas

---

### Phase 8: Game Settings & Configurability (Week 9)
**Goal:** Make system configurable

**Tasks:**
1. Game Settings panel
2. All configurable options (slots, display, etc.)
3. Load settings on game start
4. Apply settings to widgets/logic

**Deliverable:** Fully configurable system

---

### Phase 9: Testing & Bug Fixes (Week 10)
**Goal:** Polish and stability

**Tasks:**
1. End-to-end playtest scenarios
2. Bug fixes
3. Performance optimization
4. Documentation for players/GMs

**Deliverable:** Production-ready system

---

## Undo/Time-Travel Support

**User mentioned:** "We have the history to time travel, we can undo commands"

### Undo Strategy

**Undo Button Location:** Player Action Widget (DECISION state)

```
[Undo Last Action] - Visible in DECISION state
```

**What it does:**
- Dispatch Redux `history/undo` command
- Revert to previous PlayerRoundState
- Re-load previous action plan
- Show notification: "Undone: [command description]"

**Undo Limits:**
- Can undo back to start of current player's turn
- Cannot undo other players' actions
- Cannot undo across Momentum Reset

**Cancel vs Undo:**
- **Cancel:** Clear current decision, stay in same turn
- **Undo:** Revert entire state to previous command

---

## Success Metrics

**Phase 1-3 Complete When:**
1. ✅ Player can prepare action with equipment/trait improvements
2. ✅ Roll happens with correct dice pool
3. ✅ Consequences apply with auto-Momentum
4. ✅ Equipment management (equip/unequip/flashback) works
5. ✅ Trait management (add/use/group) works
6. ✅ State machine enforces valid transitions
7. ✅ Undo back to previous state works

**Full System Complete When:**
8. ✅ Rally works with critical bonuses
9. ✅ Assist and Protect work reactively
10. ✅ Crew Status Widget always shows accurate state
11. ✅ Token overlays show Position/harm/Rally status
12. ✅ Game settings panel controls all configuration
13. ✅ End-to-end playtest matches rules primer examples
14. ✅ No manual sheet diving required during play

---

## Open Questions / Decisions Needed

None! All design questions answered. Ready to implement.

---

## Next Steps

1. **Review this spec** - Confirm alignment with vision
2. **Phase 1 kickoff** - Start building state machine + widget
3. **Iterative development** - One phase at a time, test thoroughly

**Ready to code!** 🚀
