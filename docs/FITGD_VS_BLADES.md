# FitGD vs. Blades in the Dark - Mechanics Comparison

## Critical Distinction

**Forged in the Grimdark (FitGD)** is a **Forged in the Dark** variant, NOT standard **Blades in the Dark**.

While we borrow visual assets and UI patterns from the Blades Foundry VTT implementation, the core mechanics are significantly different.

---

## Core Mechanics Comparison

### Resource Management

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Primary Resource** | Stress (0-9, individual) | **Momentum** (0-10, shared crew) |
| **Starting Value** | 0 stress | **5 Momentum** |
| **How Gained** | Taking Devil's Bargain, resisting | **Consequences**, leaning into traits |
| **How Spent** | Pushing yourself, resisting | **Push, flashback, Rally** |
| **Overflow** | Trauma when >9 | **Lost** (capped at 10) |
| **Reset** | Downtime, vice indulgence | **Reset event** (back to 5) |

### Harm & Injury

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Harm System** | 4 levels (Lesser/Moderate/Severe/Fatal) | **Harm Clocks** (6 segments each) |
| **Max Harm** | Can take 1 of each level | **Max 3 active clocks** |
| **4th Harm** | Killed/Trauma | **Replaces lowest clock** |
| **Tracking** | Named injuries with level | **Clock segments + type** (Physical/Morale) |
| **Dying State** | Fatal harm = dying | **6/6 clock = dying** |
| **Types** | Physical only | **Physical Harm, Morale Harm** (2 types) |

### Recovery & Healing

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Recovery Method** | Downtime healing activity | **Rally action** (at 0-3 Momentum) |
| **Cost** | 1 downtime action | **Momentum (0-3) + trait** |
| **What Recovers** | Harm level reduced | **Clock cleared OR trait re-enabled** |
| **Frequency** | Per downtime | **Once per Reset** |
| **Requirements** | Downtime phase | **Low Momentum (0-3)** |

### Permanent Effects

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Mechanism** | Trauma (4 types, max 4) | **Scar Traits** (no cap) |
| **When Gained** | Stress overflow (>9) | **Filled harm clock → scar** |
| **Effect** | Mechanical penalty | **Trait** (can be leaned into) |
| **Retirement** | 4 Trauma = retire | **No forced retirement** |
| **Types** | Cold, Haunted, Obsessed, etc. | **Custom** (player-defined) |

### Character Traits

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Starting Traits** | Playbook heritage, background | **2 traits** (role + background) |
| **Max Traits** | N/A (special abilities) | **TBD via playtesting** |
| **Trait Mechanics** | None (abilities are separate) | **Lean into trait for Momentum** |
| **Trait Disabling** | N/A | **Disabled when leaned into** |
| **Trait Groups** | N/A | **3 traits → 1 broader trait** |

### Action Dots

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Actions** | 12 actions (same list) | **12 actions (same list)** ✅ |
| **Starting Dots** | Varies by playbook | **12 dots total** |
| **Max per Action** | 4 dots | **4 dots** ✅ |
| **At Creation** | Varies | **Max 3 per action** |
| **Advancement** | XP → dots | **1 dot per milestone** |

### Push & Flashback

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Push Cost** | 2 stress | **1 Momentum** |
| **Push Effects** | +1d, +effect, +position | **Same** ✅ |
| **Flashback Cost** | 0-2 stress | **1 Momentum + trait** |
| **Flashback Effect** | Retroactive preparation | **Same + gain trait** |

### Consumables & Equipment

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Equipment System** | Load (light/normal/heavy) | **Tiered** (accessible/inaccessible/epic) |
| **Consumables** | Standard gear | **Depletion Clocks** (4/6/8 segments) |
| **Tracking** | Simple checkboxes | **Clock-based** with rarity |
| **Depletion** | Use once | **Fills clock → downgrade tier** |
| **Examples** | Standard issue | **Grenades, stims, special ammo** |

### Addiction (Unique to FitGD!)

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Mechanic** | ❌ None | ✅ **Addiction Clock** (8 segments) |
| **Scope** | N/A | **Crew-wide** (shared clock) |
| **Trigger** | N/A | **Using stims** |
| **Effect** | N/A | **Clock fills → all stims locked** |
| **Recovery** | N/A | **Reduces by 2 on Reset** |
| **Trait** | N/A | **"Addict" trait when filled** |

### Crew Management

| Aspect | Blades in the Dark | FitGD (Forged in the Grimdark) |
|--------|-------------------|--------------------------------|
| **Crew Resource** | Coin, Rep, Heat | **Momentum** (shared) |
| **Crew Type** | Multiple playbooks | **TBD** |
| **Territory** | Turf tracking | **TBD** |
| **Upgrades** | Crew abilities | **TBD** |

---

## Visual Asset Mapping

While mechanics differ, we use Blades clock visuals with FitGD meaning:

### Clock Colors

| Color | Blades Usage | FitGD Usage |
|-------|--------------|-------------|
| **Red** | Generic clocks | **Physical Harm** + Threat clocks |
| **Grey** | N/A (not in original) | **Morale Harm** |
| **Blue** | Progress clocks | **Progress Clocks** ✅ |
| **Yellow** | N/A | **Addiction Clock** |
| **Green** | N/A | **Consumable Clocks** |
| **White** | N/A | **Personal Goal Clocks** |
| **Black** | N/A | **Faction Clocks** |

### Clock Sizes

| Size | Blades Usage | FitGD Usage |
|------|--------------|-------------|
| **4 segments** | Project clocks | **Progress/Threat** (short) |
| **6 segments** | Project clocks | **Harm Clocks** (always 6) |
| **8 segments** | Project clocks | **Addiction**, Progress, Consumables (common) |
| **10 segments** | Faction clocks | ❌ Not used |
| **12 segments** | Faction clocks | **Progress/Threat** (long) |

---

## Character Sheet Differences

### Blades in the Dark Sheet
- Stress track (9 boxes)
- Trauma (4 types)
- Harm levels (lesser/moderate/severe/fatal)
- Load (3 levels)
- Vice/Purveyor

### FitGD Sheet
- **No stress track** (Momentum is crew-level)
- **No trauma** (Scar traits instead)
- **Harm Clocks** (max 3, 6 segments each)
- **Rally** availability indicator
- **Trait** management (lean into, disable, group)
- **Equipment tiers** (accessible/inaccessible/epic)

---

## Crew Sheet Differences

### Blades in the Dark Sheet
- Rep (12 boxes)
- Heat (9 boxes)
- Wanted level
- Coin
- Upgrades
- Claims map

### FitGD Sheet
- **Momentum** (0-10 track) - PRIMARY RESOURCE
- **Addiction Clock** (8 segments)
- **Consumable Clocks** (grenades, stims, etc.)
- **Progress Clocks** (mission objectives, threats)
- **Character roster** (linked characters)
- **TBD**: Rep, Heat equivalents

---

## Implementation Notes

### What We Borrow ✅
- Clock SVG visual assets
- Character sheet layout inspiration
- Action dot display
- Equipment organization
- Click interaction patterns

### What We DON'T Use ❌
- Stress/Trauma mechanics
- Harm level system
- Load system
- Vice/Downtime structure
- Standard Blades playbooks
- Rep/Heat/Coin tracking (yet)

### What We Add 🆕
- **Momentum** system (shared crew resource)
- **Harm Clocks** (6 segments, max 3)
- **Rally** mechanic (recover at low Momentum)
- **Addiction Clock** (crew-wide stim tracking)
- **Consumable Depletion** (clock-based)
- **Trait System** (lean into, disable, group)
- **Scar Traits** (instead of trauma)

---

## For Foundry Developers

### Critical Reminders

1. **Momentum ≠ Stress**
   - Momentum is SHARED crew resource (0-10)
   - Higher is better (NOT accumulated damage)
   - Spent on push/flashback/Rally

2. **Harm = Clocks, NOT Levels**
   - Each harm is a 6-segment clock
   - Max 3 active clocks
   - 4th harm replaces lowest
   - Different types: Physical, Morale

3. **Rally ≠ Downtime**
   - Available at 0-3 Momentum only
   - Once per Reset
   - Recovers trait OR harm

4. **No Trauma System**
   - Use Scar Traits instead
   - No 4-trauma retirement
   - Scars are custom traits

5. **Addiction is Real**
   - 8-segment crew clock
   - Using stims advances it
   - Filled = all stims locked
   - Reduces by 2 on Reset

### Data Model Mapping

```typescript
// Blades Actor
{
  system: {
    stress: { value: 3, max: 9 },
    trauma: ["Cold", "Paranoid"],
    harm: { lesser: "Bruised", moderate: "", severe: "", deadly: "" }
  }
}

// FitGD Actor (Character)
{
  system: {
    actions: { shoot: 3, ... },
    rally: { available: true },
    harm: [
      { id: "...", type: "Physical Harm", segments: 3, maxSegments: 6, color: "red" },
      { id: "...", type: "Morale Harm", segments: 5, maxSegments: 6, color: "grey" }
    ]
  }
}

// FitGD Actor (Crew)
{
  system: {
    momentum: { value: 7, max: 10 },
    characters: ["char-1", "char-2"],
    addiction: { segments: 4, maxSegments: 8, color: "yellow" },
    consumables: [
      { id: "...", type: "frag_grenades", segments: 6, maxSegments: 8, ... }
    ]
  }
}
```

---

## Credits

- **Blades in the Dark**: John Harper (Evil Hat Productions)
- **Foundry VTT Blades**: Dez384, Megastruktur (MIT License)
- **Forged in the Grimdark**: [Game Designer]
- **Redux Implementation**: This project

## License

Assets borrowed from Blades Foundry VTT under MIT License.
FitGD implementation also MIT License.
