# FORGED IN THE GRIMDARK - UX OVERHAUL PLAN

## Executive Summary

This document outlines a comprehensive UX overhaul to align our Foundry VTT implementation with the game's core flow as described in the rules primer and examples. The focus is on **streamlining the GM-to-Player interaction loop** and creating an **encounter mode** that supports the natural rhythm of the game.

**Key Insight:** The game is conversational and consequence-driven. The UX should support rapid Position/Effect negotiation, clear consequence application, and visible Momentum economy.

---

## Current State Analysis

### What's Working Well ✅

1. **Character Sheets** - Clean tabbed interface with Actions, Traits, Harm, Equipment
2. **Crew Sheets** - Visual Momentum tracker (0-10) with +/- controls
3. **Clock Visualization** - Circular segments with click-to-fill interaction
4. **Multi-Client Sync** - Real-time command broadcasting via socketlib
5. **Redux Architecture** - Event sourcing with command history
6. **Trait System** - Display, categorization, disable/enable (Lean Into)
7. **Rally Dialog** - Functional implementation of low-Momentum recovery
8. **Foundry Integration** - Drag-to-hotbar macros, chat messages, proper Actor/Item structure

### Critical UX Gaps 🚨

#### 1. **Position/Effect Setting Authority**
- **Current:** Player sets Position/Effect in ActionRollDialog
- **Problem:** Rules say this is a GM-Player conversation, but UI gives player full control
- **Impact:** Breaks the negotiation loop that's core to the game

#### 2. **Consequence Flow**
- **Current:** TakeHarmDialog auto-opens only on failures
- **Problem:** Consequences happen on BOTH failures AND partial successes (4-5)
- **Problem:** Momentum generation is tied to consequence acceptance, not automatic
- **Impact:** Players miss Momentum gains, consequences feel disconnected

#### 3. **Encounter/Turn Management**
- **Current:** NO encounter mode exists
- **Problem:** User says "we will probably be in encounter mode non stop to cycle through players"
- **Impact:** No turn order, no active player indicator, no structured flow

#### 4. **Flashback Integration**
- **Current:** Simple dialog creates trait, costs 1 Momentum
- **Problem:** Doesn't integrate with action rolls or Position/Effect modification
- **Impact:** Mechanical advantage from flashbacks is manual/forgotten

#### 5. **GM Tools Missing**
- No way to set Position for players
- No quick consequence application
- No threat clock dashboard
- No NPC harm tracking
- No "set effect" for players

#### 6. **Player Quick Actions**
- Push Yourself requires opening dialog
- Using traits for Position/Effect is manual conversation
- No clear "what can I do with current Momentum?" indicator
- Rally availability buried in character sheet

#### 7. **Clock Display Strategy**
- Harm clocks: On character sheet only (what about during rolls?)
- Progress/Threat clocks: On crew sheet, but need GM dashboard
- Consumable clocks: Hidden until crew sheet opened
- Addiction clock: Visible on crew sheet, but what about during stim prompts?

---

## Core UX Philosophy

### Design Principles

1. **Conversation First, Automation Second**
   - Don't automate Position/Effect determination
   - DO automate consequence math (segments based on Position/Effect table)
   - Support negotiation, don't replace it

2. **Visibility of Momentum Economy**
   - Momentum should be always visible to all players
   - Cost of actions should be clear before committing
   - Generation opportunities should be obvious

3. **GM as Flow Controller**
   - GM sets Position/Effect after conversation
   - GM triggers consequence acceptance
   - GM advances threat clocks
   - Players see their options, GM approves/modifies

4. **Encounter Mode as Default**
   - Turn order always visible
   - Active player highlighted
   - Quick actions accessible
   - Clock states visible

5. **Progressive Disclosure**
   - Show what's relevant now
   - Hide complexity until needed
   - Context-aware action availability

---

## Critical Questions to Answer

### GM Perspective 🎲

#### Core Workflow
1. **How does the GM set Position for a player's action?**
   - Option A: GM sees player's declared action, sets Position/Effect in dialog before player rolls
   - Option B: GM has a "Set Position/Effect" button on player character portraits
   - Option C: Integrated chat command like `/position @character risky standard`
   - **Recommendation:** Hybrid - GM interface on player portraits + override in action dialog

2. **How does the GM apply consequences quickly?**
   - Current: TakeHarmDialog requires 3+ inputs (harm type, position, effect)
   - Problem: GM already knows what consequence should apply
   - Options:
     - A: Pre-set consequence in action dialog (before roll)
     - B: Quick consequence buttons (1 harm, 2 harm, 3 harm, etc.)
     - C: Auto-calculate from Position/Effect, GM just clicks "Apply"
   - **Recommendation:** Option C - GM clicks "Apply Consequence" with pre-filled values, can override

3. **Which clocks should be on the GM's main view?**
   - Threat clocks? (Red, countdown to disaster)
   - Progress clocks? (Blue, player objectives)
   - Harm clocks? (Per character, already on sheets)
   - Consumable clocks? (Crew-level, already on crew sheet)
   - **Recommendation:** Dashboard widget with Threat + Progress clocks, filterable by type

4. **How does the GM manage turn order?**
   - Foundry has combat tracker - use it? (Overkill for this system?)
   - Custom widget with character portraits?
   - Chat-based turn announcements?
   - **Recommendation:** Lightweight custom widget - no initiative rolls, just order + active indicator

5. **How does the GM advance clocks during play?**
   - Click on clock widgets? (Already works on sheets)
   - Quick +1/+2/+3 buttons?
   - Context menu on character portraits?
   - **Recommendation:** Clocks in dashboard widget are clickable, plus quick buttons

6. **Does the GM need to track NPC harm?**
   - Create NPC Actors? (Heavy, lots of sheets)
   - Ephemeral clocks in dashboard? (Lightweight, disposable)
   - Simple token-attached clocks? (Foundry-native)
   - **Recommendation:** Ephemeral clocks in GM dashboard, optionally saved as Actors

7. **How does the GM see who has Rally available?**
   - Check each character sheet manually? (Current, tedious)
   - Indicator on character portrait?
   - Rally availability widget?
   - **Recommendation:** Status indicator on character portrait in encounter widget

#### Position/Effect Negotiation
8. **Should Position/Effect be visible to players before rolling?**
   - Yes - they need to know stakes
   - Hidden until GM sets it - prevents metagaming
   - **Recommendation:** Visible after GM sets it, before player commits to roll

9. **Can players propose Position/Effect changes?**
   - Yes, via chat/voice (manual)
   - Yes, via "Request Better Position" button (notification to GM)
   - No, GM decides unilaterally
   - **Recommendation:** Manual conversation, but UI shows current Position/Effect prominently

10. **How are traits used to improve Position/Effect?**
    - Player says in chat, GM manually adjusts
    - Player selects trait from dropdown, GM approves
    - Automatic if trait category matches action
    - **Recommendation:** Player selects trait → GM sees notification with justification → approves/denies

#### Consequence Management
11. **Should consequences be pre-declared before rolls?**
    - Yes - "If you fail at Risky, you take 3 Physical harm"
    - No - GM decides after seeing result
    - **Recommendation:** Optional pre-declaration, GM can always override

12. **How does the GM offer Devil's Bargains?**
    - Chat message with verbal offer
    - Button in action dialog that GM can enable/describe
    - Pre-set bargains attached to situations
    - **Recommendation:** GM enables "Devil's Bargain Available" on action dialog with text field

13. **When does the team gain Momentum from consequences?**
    - Automatic on failure/partial success
    - GM manually adds after describing consequence
    - Player clicks "Accept Consequence" button
    - **Recommendation:** Automatic when harm applied, but GM can override amount

### Player Perspective 👤

#### Action Declaration
14. **How do players declare actions?**
    - Chat message → GM responds with roll prompt
    - Click action on sheet → GM sees notification
    - Hotbar macro → GM approves/sets Position
    - **Recommendation:** All of the above - flexible entry points

15. **What does the player see when it's their turn?**
    - Full screen takeover? (Too aggressive)
    - Highlighted character sheet?
    - Notification + quick action menu?
    - **Recommendation:** Border glow + notification + quick action bar appears

16. **How do players know what Momentum actions are available?**
    - Always visible status bar showing:
      - Current Momentum
      - "Push (1M)" button
      - "Flashback (1M)" button
      - "Rally (0-3M)" button (if available)
    - Hidden until needed
    - **Recommendation:** Always visible Momentum action bar

#### Roll Process
17. **Can players modify their roll after seeing Position/Effect?**
    - Yes - Push Yourself before rolling
    - Yes - Use trait to improve Position/Effect (with GM approval)
    - No - commit first, roll second
    - **Recommendation:** See Position/Effect → choose modifications → commit → roll

18. **Should players see the harm consequence table during rolls?**
    - Yes - always visible reference
    - Yes - shown after Position/Effect set
    - No - GM narrates consequences
    - **Recommendation:** Collapsible reference table in action dialog

19. **What happens immediately after a roll result?**
    - Auto-resolve everything (harm, Momentum, etc.)
    - Show result, wait for GM to apply consequences
    - Show result, player clicks "Accept" to apply
    - **Recommendation:** Show result + calculated consequence → GM clicks "Apply"

#### Traits & Flashbacks
20. **How do players use traits during actions?**
    - Manual: Say in chat "I use my 'Veteran' trait"
    - Semi-auto: Select trait from dropdown in action dialog
    - Auto: System suggests traits based on action
    - **Recommendation:** Dropdown in action dialog + optional justification text

21. **Should flashbacks interrupt the roll flow?**
    - Yes - "Wait, flashback!" opens dialog mid-roll
    - No - flashbacks happen before action declaration
    - Both - pre-action flashbacks or mid-action interrupts
    - **Recommendation:** Both, with "Interrupt with Flashback" button during roll dialog

22. **How do players track disabled traits?**
    - Visual indicator on character sheet (already exists)
    - Status effect icon on portrait
    - Notification when trying to use disabled trait
    - **Recommendation:** All three - redundant is good here

#### Momentum Visibility
23. **Where should Momentum be displayed?**
    - Crew sheet only (current, requires opening sheet)
    - Persistent widget/HUD element
    - Token/portrait indicator
    - All of the above
    - **Recommendation:** All - persistent widget + portrait indicator + crew sheet

24. **Should players see Momentum costs before committing?**
    - Yes - clear pricing on all actions
    - No - learn through play
    - **Recommendation:** Yes, with tooltip explanations

25. **How do players know when Rally is available?**
    - Check character sheet (current, hidden)
    - Status icon on portrait
    - Momentum widget shows "Rally Available" button
    - **Recommendation:** Both widget and portrait indicator

#### Clocks & Harm
26. **Should harm clocks be visible during rolls?**
    - No - only on character sheet
    - Yes - overlay during action resolution
    - Yes - in Momentum widget
    - **Recommendation:** Show relevant clocks in action dialog when consequences apply

27. **Do players need to see other players' harm clocks?**
    - Always visible to everyone
    - Visible on request
    - GM only
    - **Recommendation:** Always visible - promotes teamwork and Protect actions

28. **Should consumable clocks be visible before using consumables?**
    - Yes - show depletion risk
    - No - surprise depletion
    - **Recommendation:** Yes, with warning if close to full

### Encounter/Turn Management ⚔️

29. **How is turn order determined?**
    - Clockwise from GM (rules mention this for Dying)
    - Player volunteers (fiction-first)
    - Initiative rolls (too crunchy for this system)
    - **Recommendation:** GM sets order, easily reorderable, or "next volunteer" mode

30. **Is turn order strict or flexible?**
    - Strict - must go in order
    - Flexible - any player can jump in
    - Hybrid - GM can enable "strict mode"
    - **Recommendation:** Flexible by default, GM can enforce order

31. **What defines an "encounter"?**
    - Combat only
    - Any high-stakes scene
    - Entire session (user implies "encounter mode non stop")
    - **Recommendation:** Any scene where turn tracking matters, easily toggled

32. **What actions can players take out of turn?**
    - None (strict turns)
    - Protect teammate (reaction)
    - Assist teammate (on their turn)
    - All of the above
    - **Recommendation:** Reactions allowed, clearly marked as "interrupt"

### Widget/HUD Requirements 📊

33. **What persistent widgets do we need?**
    - Momentum Tracker (current value, quick +/- for GM)
    - Turn Tracker (order, active player, quick next button)
    - Clock Dashboard (threat + progress clocks)
    - Quick Actions (Push, Rally, Flashback for active player)
    - **Recommendation:** All four, collapsible/moveable

34. **What information should be on character portraits?**
    - Harm status (dying, wounded, healthy)
    - Rally availability
    - Active turn indicator
    - Disabled traits count
    - **Recommendation:** All, with icon indicators

35. **Should there be a "GM Screen" widget?**
    - Yes - consolidated GM tools
    - No - tools where needed
    - **Recommendation:** Yes, but modular - GM chooses what to include

36. **Where should encounter mode controls live?**
    - Scene controls toolbar (Foundry standard)
    - Floating widget
    - Character sheet integration
    - **Recommendation:** Scene controls + floating widget option

---

## Proposed UX Flow: Action Resolution

### The Ideal Flow (Based on Rules & Examples)

```
1. PLAYER: Declares action in fiction
   ↓
2. GM: Determines which Action applies
   ↓
3. PLAYER: Opens action dialog (or GM opens for them)
   ↓
4. GM + PLAYER: Negotiate Position & Effect
   - Player can propose trait usage
   - Player can request flashback
   - GM sets final Position/Effect
   ↓
5. PLAYER: Chooses modifications
   - Push Yourself? (+1d or improve Effect/Position)
   - Devil's Bargain? (+1d for complication)
   - Use trait? (improve Position/Effect)
   ↓
6. PLAYER: Commits and rolls
   ↓
7. SYSTEM: Calculates result
   - Critical: 2 sixes
   - Success: 6
   - Partial: 4-5
   - Failure: 1-3
   ↓
8. SYSTEM: Shows result + calculated consequence (if any)
   - Based on Position/Effect table
   - Pre-filled harm dialog OR clock advancement
   ↓
9. GM: Applies consequence (or modifies)
   - Clicks "Apply" to confirm
   - Can override harm type/amount
   - Team gains Momentum if consequence accepted
   ↓
10. SYSTEM: Updates state
    - Advances clocks
    - Adjusts Momentum
    - Posts to chat
    - Next player turn
```

### Current Flow Problems

- **Step 4:** No GM control over Position/Effect in UI
- **Step 5:** Push/trait usage clunky
- **Step 8:** Only works for failures, not partial successes
- **Step 9:** No "apply" button, immediate state change
- **Step 10:** No turn advancement

---

## Proposed UX Changes: Priority Order

### Phase 1: Core Flow Fixes (Critical) 🔴

**Goal:** Fix the action resolution loop to match rules

1. **GM Position/Effect Control**
   - Add GM-only section to ActionRollDialog
   - GM sets Position/Effect, locks it
   - Player sees locked values, can request changes
   - Implementation: Extend ActionRollDialog, add permission checks

2. **Consequence Acceptance Flow**
   - On failure OR partial success, show ConsequenceDialog
   - Pre-calculate segments from Position/Effect table
   - Show Momentum gain alongside harm
   - GM clicks "Apply" to confirm
   - Implementation: New ConsequenceDialog, triggers from ActionRollDialog

3. **Momentum Action Costs**
   - Add "Momentum Required" indicator to Push/Flashback buttons
   - Disable if insufficient Momentum
   - Show tooltip: "Costs 1 Momentum, 7 remaining"
   - Implementation: Computed properties in dialogs

### Phase 2: Encounter Mode (High Priority) 🟠

**Goal:** Create turn-based flow for scene management

4. **Turn Tracker Widget**
   - Floating widget with character portraits in order
   - Active player highlighted with glow
   - Drag to reorder
   - "Next Turn" button for GM
   - "Skip Turn" button for players
   - Implementation: New Application class, scene flag for turn data

5. **Character Portrait Status Indicators**
   - Harm level icon (healthy/wounded/dying)
   - Rally available badge
   - Disabled traits count
   - Active turn border glow
   - Implementation: Canvas layer token overlays OR widget portraits

6. **Quick Action Bar**
   - Appears for active player
   - Buttons: Action Roll, Push, Flashback, Rally, Pass Turn
   - Shows current Momentum
   - Implementation: Conditional render in TurnTracker widget

### Phase 3: Clock Dashboard (High Priority) 🟠

**Goal:** Make clocks visible and manageable for GM

7. **GM Clock Dashboard Widget**
   - Tabbed view: Threat Clocks | Progress Clocks | Character Harm | Consumables
   - Quick add clock button
   - Click segments to fill/empty
   - Drag to reorder
   - Filter/search
   - Implementation: New Application class, pulls from Redux state

8. **Clock Visibility in Dialogs**
   - Show relevant harm clocks in ConsequenceDialog
   - Show consumable clocks when using consumables
   - Show addiction clock when using stims
   - Implementation: Selectors + conditional rendering

### Phase 4: Streamlined Traits & Flashbacks (Medium Priority) 🟡

**Goal:** Make trait usage and flashback flow smoother

9. **Trait Selection in Action Dialog**
   - Dropdown of available (non-disabled) traits
   - Text field for justification
   - "Propose Better Position/Effect" button
   - Sends notification to GM
   - Implementation: Extend ActionRollDialog

10. **Flashback Integration**
    - "Flashback" button in action dialog
    - Opens mini-dialog: Trait name, description, mechanical advantage
    - Costs 1 Momentum
    - Automatically improves Position/Effect based on GM selection
    - Implementation: Embed FlashbackDialog in action flow

11. **Trait Status Visibility**
    - Character portrait shows disabled trait count as badge
    - Tooltip lists disabled traits
    - Notification when trying to use disabled trait
    - Implementation: Canvas overlays + dialog validation

### Phase 5: Momentum Economy Visibility (Medium Priority) 🟡

**Goal:** Make Momentum costs and gains obvious

12. **Persistent Momentum Widget**
    - Always visible in corner
    - Shows current Momentum (X/10)
    - Visual bar with segments
    - Quick action buttons for active player
    - GM quick +/- adjustment
    - Implementation: New Application class, pinned to canvas

13. **Momentum Transaction Log**
    - Mini-feed showing recent changes
    - "+2 Momentum (Sofia accepted Risky consequence)"
    - "-1 Momentum (Marcus Pushed Himself)"
    - Appears in Momentum widget or chat
    - Implementation: Chat messages or widget feed

### Phase 6: Polish & Quality of Life (Low Priority) 🟢

**Goal:** Refinements and small improvements

14. **Position/Effect Reference Table**
    - Collapsible table in action dialog
    - Shows segments for each Position/Effect combo
    - Highlight current cell based on settings
    - Implementation: Static HTML in dialog

15. **Devil's Bargain Workflow**
    - GM can enable "Devil's Bargain Available" in action dialog
    - Text field for GM to describe bargain
    - Player can accept/decline before rolling
    - Implementation: GM controls in ActionRollDialog

16. **Quick Consequence Buttons**
    - GM shortcut: Right-click character portrait
    - Context menu: Apply 1 harm, 2 harm, 3 harm, etc.
    - Quick clock advancement
    - Implementation: Canvas context menu

17. **Rally Indicators**
    - Badge on character portrait if Rally available
    - "Rally Available" button in Momentum widget
    - Grayed out if Momentum > 3
    - Implementation: Computed property + visual indicator

18. **Consumable Depletion Warnings**
    - When using consumable, show clock status
    - Warning if 6+ segments filled
    - "This might deplete!" message
    - Implementation: Dialog check before use

---

## Widget Specifications

### 1. Turn Tracker Widget

**Position:** Top-right, draggable
**Size:** 200px wide, auto height (based on # of characters)
**Collapsible:** Yes

**Contents:**
- Title: "Turn Order"
- List of character portraits (50px circles)
- Character name below portrait
- Active player: Gold border glow (3px)
- Wounded: Red overlay (semi-transparent)
- Dying: Red border + skull icon
- Rally available: Green checkmark badge
- Disabled traits: Orange number badge (count)

**Controls:**
- GM: Drag portraits to reorder
- GM: "Next Turn" button (advances to next player)
- GM: "End Encounter" button (hides widget)
- Players: "Pass Turn" button (visible on own portrait)

**Data Source:** Scene flag `scene.flags.fitgd.turnOrder`

---

### 2. Momentum Tracker Widget

**Position:** Top-left, draggable
**Size:** 250px wide, 120px tall
**Always Visible:** Yes (unless manually closed)

**Contents:**
- Title: "Momentum"
- Large number: Current/Max (e.g., "7/10")
- Visual bar: 10 segments, filled to current value
- Color gradient: Red (0-3), Yellow (4-6), Green (7-10)

**Active Player Actions (only shown for active player):**
- "Push Yourself (1M)" button
- "Flashback (1M)" button
- "Rally (1-3M)" button (only if Momentum ≤ 3 and Rally available)

**GM Controls:**
- Quick +1, +2, +4 buttons (for GM only)
- Quick -1 button (for GM only)
- "Reset to 5" button (for Momentum Reset)

**Recent Transactions Feed:**
- Last 3 Momentum changes, scrolling list
- Format: "[+2] Sofia accepted Risky consequence"
- Format: "[-1] Marcus Pushed Himself"

**Data Source:** Redux `crews.byId[activeCrewId].currentMomentum`

---

### 3. Clock Dashboard Widget (GM Only)

**Position:** Right sidebar, docked
**Size:** 300px wide, full height
**Tabbed:** Yes

**Tabs:**
1. **Threat Clocks** (red icon)
2. **Progress Clocks** (blue icon)
3. **Character Harm** (orange icon)
4. **Consumables** (green icon)

**Each Clock Display:**
- Clock name (editable)
- Segment visualization (clickable)
- Current/Max (e.g., "4/8")
- Category badge (if applicable)
- Delete button (X icon)

**Controls:**
- "+ Add Clock" button (opens dialog for new clock)
- Search/filter input
- Sort by: Name, Progress, Type

**Threat Clocks Tab:**
- Shows all progress clocks with category "threat"
- Color: Red borders
- Quick +1, +2, +3 buttons for each clock

**Progress Clocks Tab:**
- Shows all progress clocks with other categories
- Color: Blue borders
- Quick +1 button for each clock

**Character Harm Tab:**
- Groups by character
- Shows all harm clocks for each character
- Character name header
- Quick "Clear Clock" button

**Consumables Tab:**
- Shows all consumable clocks for active crew
- Rarity badge (common/uncommon/rare)
- "Depleted" indicator if frozen
- Quick +1d6 button (simulates depletion roll)

**Data Source:** Redux `clocks.byId`, filtered by `clockType` and `entityId`

---

### 4. Quick Action Bar (Active Player)

**Position:** Bottom-center, appears only for active player
**Size:** Auto width, 80px tall
**Appears:** When it's player's turn in encounter mode

**Contents:**
- Large "ROLL ACTION" button (primary)
- "Push (+1d or Effect)" button with cost indicator
- "Flashback" button with cost indicator
- "Rally" button (if available)
- "Pass Turn" button (secondary)

**Visual Style:**
- Animated slide-up entrance
- Gold glow border
- Semi-transparent dark background
- Large, finger-friendly buttons

**Data Source:** Active player from Turn Tracker

---

## Technical Implementation Notes

### New Files Needed

```
foundry/module/widgets/
├── turn-tracker.mjs          # Turn order widget
├── momentum-widget.mjs        # Momentum tracker
├── clock-dashboard.mjs        # GM clock dashboard
└── quick-actions.mjs          # Active player quick bar

foundry/templates/widgets/
├── turn-tracker.html
├── momentum-widget.html
├── clock-dashboard.html
└── quick-actions.html

foundry/templates/styles/
└── widgets.css               # Widget-specific styles
```

### Modified Files

```
foundry/module/dialogs.mjs
- Extend ActionRollDialog with GM Position/Effect controls
- Extend ActionRollDialog with trait selection
- Create ConsequenceDialog (new)
- Modify TakeHarmDialog to work as ConsequenceDialog

foundry/module/fitgd.mjs
- Register widgets on ready hook
- Add scene control buttons for encounter mode
- Add canvas layer for portrait overlays

foundry/templates/character-sheet.html
- Add trait selection UI improvements
- Add disabled trait indicators

foundry/templates/crew-sheet.html
- Potentially simplify now that Momentum widget exists
```

### State Management

**New Scene Flags:**
```javascript
scene.flags.fitgd = {
  encounterMode: true,
  turnOrder: [characterId1, characterId2, ...],
  activePlayer: characterId,
  gmPositionSettings: {
    [characterId]: { position: 'risky', effect: 'standard' }
  }
}
```

**New Redux Selectors:**
```javascript
selectActiveTurn(state) → characterId
selectTurnOrder(state) → characterId[]
selectRallyAvailability(state, characterId) → boolean
selectDisabledTraits(state, characterId) → Trait[]
selectRelevantClocks(state, entityId, type) → Clock[]
```

---

## Open Design Questions (Require User Input)

### Critical Path Questions

1. **GM Position/Effect Control: Authority Model**
   - Option A: GM sets Position/Effect BEFORE player opens dialog (locks it in)
   - Option B: Player proposes, GM approves/modifies in real-time
   - Option C: GM and Player negotiate in dialog chat
   - **Your preference?**

2. **Turn Order: Strict vs Flexible**
   - Option A: Strict clockwise order, must go in sequence
   - Option B: Flexible, anyone can volunteer, GM tracks manually
   - Option C: Hybrid - GM can toggle strict mode on/off per encounter
   - **Your preference?**

3. **Clock Dashboard: Separate Window vs Docked Sidebar**
   - Option A: Separate draggable window (like Turn Tracker)
   - Option B: Docked to right sidebar (like Foundry's default sidebars)
   - Option C: Integrated into Scene Controls (collapses into toolbar)
   - **Your preference?**

4. **Consequence Application: Auto vs Manual**
   - Option A: Fully automatic - failure/partial = immediate harm/Momentum
   - Option B: Semi-auto - shows calculated consequence, GM clicks "Apply"
   - Option C: Fully manual - GM narrates, then manually applies harm
   - **Your preference?**

5. **Flashback Timing: Pre-Action vs Mid-Action**
   - Option A: Flashbacks only allowed before declaring action
   - Option B: Flashbacks allowed as interrupt during Position/Effect negotiation
   - Option C: Flashbacks allowed even after roll (retroactive justification)
   - **Your preference?**

### Secondary Questions

6. **Should NPC actions use the same roll dialog?**
   - Yes - GM rolls for NPCs using same UI
   - No - GM uses simplified quick-roll
   - Hybrid - GM can choose

7. **Should players see threat clocks?**
   - Always visible to everyone (clock dashboard visible to all)
   - GM reveals selectively (clock dashboard GM-only, GM shares specific clocks)
   - Never - GM tracks privately

8. **Should there be a "group action" special mode?**
   - Yes - dedicated group action dialog with multi-roll handling
   - No - GM handles group actions manually with multiple dialogs
   - Maybe later - not priority for Phase 1-2

9. **Should Rally be accessible outside encounter mode?**
   - Yes - Rally button always visible (in Momentum widget)
   - No - Rally only during encounters (in Quick Action Bar)
   - Contextual - available when Momentum ≤ 3 regardless of mode

10. **Should the system track "Devil's Bargain" debt?**
    - Yes - create temporary clocks or flags for bargain complications
    - No - purely narrative, GM tracks manually
    - Optional - GM can choose to track or not per bargain

---

## Next Steps

1. **Review this document** - discuss critical questions
2. **Prioritize phases** - which phase do we tackle first?
3. **Wireframe widgets** - sketch out widget layouts
4. **Prototype Turn Tracker** - simplest widget, test canvas integration
5. **Iterate on Action Roll Dialog** - add GM controls
6. **Test with real play scenario** - validate flow with example from rules

---

## Success Metrics

**When is the UX overhaul complete?**

1. ✅ GM can set Position/Effect for player actions through UI
2. ✅ Consequences (harm + Momentum) apply correctly on failures AND partial successes
3. ✅ Turn order is visible and manageable in encounter mode
4. ✅ Momentum economy is always visible to all players
5. ✅ Players can use traits and flashbacks without leaving action dialog
6. ✅ GM can manage threat/progress clocks from dashboard widget
7. ✅ Rally availability is obvious to players
8. ✅ Clock states are visible during relevant actions (stims, consumables, harm)
9. ✅ The flow from action declaration → roll → consequence → next turn is smooth
10. ✅ A new player can understand available actions by looking at the UI

**Playtest validation:**
- Run through examples.md scenarios using new UI
- Measure time from action declaration to resolution (target: <60 seconds)
- Count number of sheet/dialog opens per action (target: ≤2)
- GM subjective rating of "flow interruption" (target: minimal)
