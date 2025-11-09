# Player-GM Conversation Flow & Player Verbs

## Overview

This document describes the **conversation-based action resolution flow** and all the **player verbs** available during the planning phase before a roll. This is the heart of the game's collaborative storytelling.

---

## The Complete Action Flow

```
1. FICTION FIRST
   Player: "I want to [describe action in narrative]"
   GM: "That sounds like a [Action] roll"

2. CONVERSATION & NEGOTIATION
   Player & GM discuss:
   - Which Action applies
   - Current Position (Controlled/Risky/Desperate)
   - Current Effect (Limited/Standard/Great)
   - How traits/equipment might help

3. PLAYER DECLARES IMPROVEMENTS
   Player can invoke any of these verbs:
   - "I push myself" (+1d or improve Effect, costs 1M pending)
   - "I use my [trait]" (improve Position/Effect, GM decides)
   - "I have a flashback" (establish prep, costs 1M pending)
   - "I use [equipment]" (justify better Position/Effect)
   - "I lean into [trait]" (create complication, earn 2M, disable trait)

4. GM SETS FINAL POSITION/EFFECT
   GM reviews all improvements and sets final values

5. GM APPROVES PLAN
   GM clicks "Accept Roll" in widget

6. PLAYER COMMITS
   Player sees final plan with:
   - Total dice pool
   - Final Position/Effect
   - Pending Momentum cost

7. MOMENTUM VALIDATION & SPEND
   System validates sufficient Momentum
   Spends Momentum NOW (before roll)

8. ROLL & RESOLVE
   Dice roll happens
   Consequences applied based on outcome
```

---

## Player Verbs Reference

### During Planning Phase (DECISION_PHASE)

#### 🔥 Push Yourself (Costs 1 Momentum - Pending)

**Player says:** "I push myself!"

**Effect:** Choose ONE:
- Add +1d to the roll
- Improve Effect by one level (Limited→Standard or Standard→Great)

**When to use:**
- When you REALLY need to succeed
- When current dice pool or Effect isn't enough
- Before the roll is committed

**Momentum:** Cost is **pending** until commit. If you change your mind, no cost.

**UI:** Click "Push" button in widget → button highlights → shows "Pending: -1M"

---

#### 💡 Flashback (Costs 1 Momentum - Pending)

**Player says:** "I have a flashback! Earlier, I [describe preparation]"

**Effect:**
- Establish prior preparation that grants mechanical advantage
- Can improve Position or Effect
- Can enable new approaches
- Can justify equipment access
- Requires a relevant Trait (can create new Trait via flashback)

**Rules:**
- Cannot contradict established fiction
- Must respond to immediate challenge
- Mechanical flashbacks cost 1M
- Narrative-only flashbacks cost 0M

**When to use:**
- When you need better Position/Effect
- When you need to justify having something
- When you want to create a new Trait

**Momentum:** Cost is **pending** until commit.

**UI:** Click "Flashback" button → opens dialog to describe flashback → creates new trait if needed

---

#### 🎯 Use Trait (Free - GM Approval)

**Player says:** "I use my '[Trait Name]' trait because [explanation]"

**Effect:**
- May improve Position by one level
- May improve Effect by one level
- GM decides final benefit based on narrative

**Example:**
- "I use my 'Served with Elite Infantry' trait because I know standard breaching tactics" → GM improves Position from Risky to Controlled

**When to use:**
- When trait is relevant to current action
- When you need better Position/Effect
- One trait per roll

**UI:** Click "Traits" button → select trait from list → add justification text → GM sees proposal

---

#### ⚙️ Use Equipment (Free - GM Approval)

**Player says:** "I'm using my [equipment] for this"

**Effect:**
- May improve Position or Effect
- GM considers equipment tier (Accessible/Inaccessible/Epic)
- Higher tier equipment = better bonuses

**Equipment Tiers:**
- **Accessible:** Standard gear, declare freely
- **Inaccessible:** Requires 1M flashback + trait to justify
- **Epic:** Story rewards only

**When to use:**
- When you have relevant equipment
- When better gear would make a difference

**UI:** Click "Equipment" button → select equipment → GM sees selection

---

#### ⚡ Lean into Trait (Earns 2 Momentum - Disables Trait)

**Player says:** "I lean into my '[Trait Name]' - it causes [complication]"

**Effect:**
- Team gains **+2 Momentum** immediately
- That trait is **disabled** (checked off on sheet)
- Cannot use it again until Momentum Reset
- Player-driven complication

**Example:**
- "I lean into my 'Hot-Headed' trait - I lose my temper and escalate the situation" → +2M, trait disabled

**When to use:**
- When team needs Momentum badly
- When you're okay with losing access to that trait
- When the complication fits the narrative

**UI:** Right-click trait on sheet → "Lean Into Trait" → confirm dialog → trait grayed out, crew gains 2M

---

#### 🤝 Rally (Costs 1-3 Momentum - Only at 0-3M)

**Player says:** "I rally the team by referencing [teammate's trait]"

**Effect:**
- Flashback where you inspire the group
- Always Controlled Position
- Gain 1-4 Momentum based on roll (1-3: 1M, 4-5: 2M, 6: 3M, Crit: 4M)
- Can re-enable a disabled trait
- Critical: Also improve Position for next rolls

**Rules:**
- Only available when team has 0-3 Momentum
- Each character has **one Rally per Reset** (check it off)
- Referenced teammate must be present

**When to use:**
- When team is low on Momentum
- When you have Rally available
- To recover from bad situations

**UI:** Click "Rally" button (only enabled at 0-3M) → opens Rally dialog → select teammate trait → roll

---

#### 💉 Use Stims (No Momentum Cost - Advances Addiction Clock)

**Player says:** "I use stims to reroll!"

**Effect:**
- **AFTER seeing roll result**, reroll it
- Then roll 1d6 and advance 8-segment **Addiction Clock**
- When Addiction Clock fills: gain "Addict" trait, stims become **locked for entire team**
- Addiction Clock reduces by 2 segments after Momentum Reset

**Rules:**
- Once per action
- Only on your own roll
- Last resort measure

**When to use:**
- When you failed and MUST succeed
- When team has no other options
- When Addiction Clock isn't full yet

**UI:** During CONSEQUENCE_CHOICE state → "Use Stims & Reroll" button → reroll + addiction roll

---

#### 🛡️ Protect Teammate (Free - Take Their Consequence)

**Player says:** "I step in and take that consequence for [teammate]!"

**Effect:**
- You suffer the exact consequence they would have taken
- Happens AFTER their roll
- Can be done from IDLE_WAITING state (interrupt)

**When to use:**
- When teammate would die
- When you can handle the consequence better
- Heroic sacrifice moments

**UI:** State transitions to PROTECT_ACCEPTING → harm applied to you instead

---

#### 🤝 Assist Teammate (Free - Exposed to Own Risk)

**Player says:** "I help [teammate] by [action]!"

**Effect:**
- Make your own action roll
- If you succeed (4-6), they get +1d
- You face consequences from YOUR roll (your Position)
- They face consequences from THEIR roll (their Position)

**When to use:**
- When teammate needs extra dice
- When you can contribute meaningfully
- Both of you accept risk

**UI:** State transitions to ASSIST_ROLLING → your roll → if success, teammate gets +1d

---

### During Negotiation (Position/Effect Discussion)

#### 📊 Propose Position Change (Free - GM Approval)

**Player says:** "Can I improve my Position because [reasoning]?"

**Effect:**
- GM considers your approach
- May improve Position (Desperate→Risky→Controlled)
- Based on tactics, advantages, fiction

**Example:**
- "Can I improve to Controlled because I'm using cover and have suppression fire?" → GM approves

**When to use:**
- When you see a tactical advantage
- When you want to reduce risk
- During conversation phase

**UI:** Currently voice/chat only (could add "Suggest Position" button in future)

---

#### 📈 Propose Effect Change (Free - GM Approval)

**Player says:** "Can I get Great Effect because [reasoning]?"

**Effect:**
- GM considers scale, quality, approach
- May improve Effect (Limited→Standard→Great)
- Based on gear, traits, tactics

**Example:**
- "Can I get Great Effect because I'm using a plasma cutter on a wooden door?" → GM approves

**When to use:**
- When you have superior tools/approach
- When scale is in your favor
- During conversation phase

**UI:** Currently voice/chat only (could add "Suggest Effect" button in future)

---

## Momentum Tracking: Pending vs Spent

### Key Design Principle: **Pending Costs**

When a player declares an improvement that costs Momentum:
1. The cost is marked as **PENDING**
2. UI shows "Pending: -XM" and preview of final Momentum
3. Player can change their mind (no cost)
4. When player clicks "Commit Roll":
   - System validates sufficient Momentum
   - Spends Momentum **NOW** (before dice roll)
   - If insufficient, roll is blocked with error

### Example Flow

```
Start: 7 Momentum

Player: "I push myself!"
→ UI shows: "Pending: -1M (7→6)"
→ Push button highlights

Player: "Actually, I also use a flashback!"
→ UI shows: "Pending: -2M (7→5)"
→ Both buttons highlighted

Player: Clicks "Commit Roll"
→ System validates: 7 >= 2 ✓
→ Spends 2M immediately
→ Now at 5 Momentum
→ Dice roll happens

If player had 1 Momentum:
→ System validates: 1 >= 2 ✗
→ Error: "Insufficient Momentum! Need 2, have 1"
→ Roll blocked, no state change
```

---

## UI States & Flows

### DECISION_PHASE (Planning)

**Player sees:**
- Action dropdown
- Position/Effect display (set by GM)
- Improvement buttons: Rally, Flashback, Equipment, Traits, Push
- Current plan preview with pending costs
- "Waiting for GM Approval" commit button (disabled)

**GM sees:**
- Player's proposed plan
- Position/Effect controls (dropdowns)
- Improvements player selected
- Total dice pool preview
- Pending momentum cost
- "Accept Roll" button

### ROLL_CONFIRM (Final Check)

**Player sees:**
- Summary: Action, Dice Pool, Position, Effect
- Pending Momentum cost clearly displayed
- "Back" button (return to DECISION_PHASE)
- "Commit & Roll" button (spends Momentum, rolls)

### ROLLING (Executing)

- Momentum already spent
- Dice rolling animation
- No changes allowed

---

## Summary of Momentum Economy

| Verb | Cost | When Paid | Can Cancel? |
|------|------|-----------|-------------|
| Push Yourself | 1M | On Commit | Yes (before commit) |
| Flashback | 1M | On Commit | Yes (before commit) |
| Use Trait | Free | N/A | Yes |
| Use Equipment | Free* | On Commit | Yes |
| Lean Into Trait | **EARN 2M** | Immediate | No |
| Rally | 0M (earns 1-4M) | N/A | No (separate roll) |
| Stims | Free (advances addiction) | After roll | No (already rolled) |
| Protect | Free | Immediate | No (teammate rolled) |
| Assist | Free (own risk) | Immediate | No (own roll) |

*Inaccessible equipment requires 1M flashback

---

## Best Practices

### For Players

1. **Describe fiction first** - Say what you DO, not what you ROLL
2. **Negotiate honestly** - Explain your reasoning for Position/Effect requests
3. **Track pending costs** - Know how much Momentum you're committing
4. **Use traits liberally** - One per roll, they're meant to be used
5. **Lean into traits when low** - Generate Momentum when team needs it
6. **Protect teammates** - Better to take a consequence than lose a teammate

### For GMs

1. **Conversation first** - Don't rush to the roll
2. **Fair Position/Effect** - Base it on fiction, not punishment
3. **Reward clever use of traits** - If it fits, approve it
4. **Make consequences interesting** - Not just damage
5. **Broadcast position changes** - Let players see the final values
6. **Trust pending cost system** - Let players experiment before committing

---

## Future Enhancements

### Potential UI Improvements

- [ ] "Suggest Position/Effect" buttons with reasoning text field
- [ ] Trait auto-suggestions based on selected Action
- [ ] Equipment tier badges showing cost (Accessible/Inaccessible/Epic)
- [ ] Visual Momentum preview bar showing before/after
- [ ] Chat integration for conversations
- [ ] Undo button in ROLL_CONFIRM phase
- [ ] "Negotiate" phase between DECISION_PHASE and ROLL_CONFIRM

### Potential Automation

- [ ] Auto-suggest relevant traits based on Action
- [ ] Auto-calculate Position/Effect modifiers
- [ ] Quick templates: "Push + Trait", "Flashback + Equipment", etc.
- [ ] Group action mode
- [ ] Devil's bargain workflow

---

## Testing Checklist

- [x] Push Yourself validation (blocks if insufficient Momentum)
- [x] Flashback validation (blocks if insufficient Momentum)
- [x] Pending cost display (shows correct total)
- [x] Momentum spend timing (happens on commit, not on selection)
- [ ] Rally availability (only at 0-3M)
- [ ] Stim lock (when addiction clock fills)
- [ ] Protect flow (teammate consequence transfer)
- [ ] Assist flow (+1d if helper succeeds)
- [ ] Lean into trait (immediately grants 2M)
- [ ] Trait usage (GM approval required)

---

## References

- See `/vault/rules_primer.md` for complete game rules
- See `/UX_OVERHAUL_PLAN.md` for UI design philosophy
- See `/src/types/playerRoundState.ts` for state machine definition
- See `/foundry/module/widgets/player-action-widget.mjs` for implementation
