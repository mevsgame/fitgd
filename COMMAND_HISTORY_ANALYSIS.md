# Command History Policy Analysis

## Current Implementation

**Status:** Currently saving **ALL** commands to history (26 command types across 3 slices)

**Storage:**
- Saved to Foundry's world settings as JSON
- Auto-save every 30 seconds (debounced)
- Immediate save on entity creation
- Full save on browser close

**Current Command Count:** 26 unique command types

---

## Command Categories by Frequency

### High-Frequency Commands (During Active Gameplay)
Commands that could be dispatched multiple times per minute:

| Command | Use Case | Frequency |
|---------|----------|-----------|
| `clocks/addSegments` | Taking harm, using consumables, addiction | Very high |
| `clocks/clearSegments` | Recovery, resetting consumables | High |
| `characters/setActionDots` | **During character creation/editing** | High (burst) |
| `crews/spendMomentum` | Push yourself, flashback | High |
| `crews/addMomentum` | Consequences, leaning into traits | Moderate |

**Concern:** In a 4-hour session with 4 players, you could easily generate:
- 50+ harm clock updates
- 30+ Momentum changes
- 20+ consumable/addiction updates
- **100+ commands per session**

### Moderate-Frequency Commands
Commands dispatched a few times per session:

| Command | Use Case | Frequency |
|---------|----------|-----------|
| `characters/disableTrait` | Lean into trait | Moderate |
| `characters/enableTrait` | Rally/Reset | Moderate |
| `characters/useRally` | Rally action | Low-Moderate |
| `characters/resetRally` | Reset event | Low-Moderate |
| `crews/setMomentum` | GM adjustment, session start | Low |
| `clocks/createClock` | New harm, new consumable | Moderate |
| `clocks/deleteClock` | Convert to scar, remove consumable | Low |

### Low-Frequency Commands
Commands dispatched rarely (character creation, advancement):

| Command | Use Case | Frequency |
|---------|----------|-----------|
| `characters/createCharacter` | Character creation | Very low |
| `characters/addTrait` | New trait | Very low |
| `characters/groupTraits` | Trait consolidation | Very low |
| `characters/createTraitFromFlashback` | Flashback | Very low |
| `characters/advanceActionDots` | Milestone advancement | Very low |
| `characters/addUnallocatedDots` | GM rewards | Very low |
| `characters/addEquipment` | Loot, purchase | Low |
| `characters/removeEquipment` | Loss, sale | Low |
| `crews/createCrew` | Campaign start | Very low |
| `crews/addCharacterToCrew` | Roster change | Very low |
| `crews/removeCharacterFromCrew` | Character leaves | Very low |
| `crews/resetMomentum` | Reset event | Very low |
| `clocks/updateMetadata` | Tier change | Very low |
| `clocks/changeSubtype` | 4th harm clock | Very low |

---

## Questions to Answer

### 1. **What is the primary purpose of command history?**

**Option A: Audit Trail & Debugging**
- Need to see who did what, when
- Trace bugs and state inconsistencies
- Compliance/logging for online play
- **Verdict:** Keep all commands

**Option B: Time-Travel / Undo**
- Players want to undo mistakes
- GM wants to rewind bad decisions
- Replay game sessions
- **Verdict:** Keep all commands OR use snapshots + recent commands

**Option C: Data Reconstruction**
- Rebuild state from scratch using commands
- Foundry world corruption recovery
- Export/import for different platforms
- **Verdict:** Could use periodic snapshots + delta commands

**Option D: Historical Record**
- Show "character progression story"
- Display "combat log" of harm taken
- Generate session summaries
- **Verdict:** Could collapse or summarize commands

### 2. **What shouldn't we save?**

**Candidates for Omission:**

❌ **Never omit:**
- CREATE operations (`createCharacter`, `createCrew`, `createClock`)
- DELETE operations (`deleteClock`, `removeCharacterFromCrew`)
- Structural changes (`addCharacterToCrew`, `groupTraits`)
- One-time events (`useRally`, `resetMomentum`)
- Advancement/rewards (`advanceActionDots`, `addUnallocatedDots`)

✅ **Could potentially omit/collapse:**
- Intermediate `setActionDots` during character creation (save only final)
- Consecutive `addSegments`/`clearSegments` on same clock within short timeframe
- `setMomentum` if followed immediately by another momentum command

**My Recommendation:** **Don't omit any commands** for now. The current implementation is correct for an event-sourced system.

### 3. **When should we collapse/compress history?**

**Option A: Snapshot-Based Approach**
```
Save full state every N commands or M minutes
Keep only recent commands (last 100-500)
Discard old commands after snapshot created
```

**Pros:**
- Bounded memory usage
- Fast replay (start from snapshot)
- Prevents indefinite growth

**Cons:**
- Lose perfect audit trail
- Can't time-travel before last snapshot
- More complex implementation

**Option B: Command Compression**
```
Collapse consecutive operations on same entity:
- setActionDots(shoot, 2) → setActionDots(shoot, 3)
  Becomes: setActionDots(shoot, 3)

- addSegments(clock1, 1) → addSegments(clock1, 2)
  Becomes: addSegments(clock1, 3)
```

**Pros:**
- Reduces command count significantly
- Preserves intent (final state)
- Simpler than snapshots

**Cons:**
- Lose granular history
- Can't undo individual steps
- Complex merge logic

**Option C: Tiered History**
```
Last 100 commands: Full history (for undo)
101-1000: Compressed (collapsed consecutive ops)
1000+: Snapshot only
```

**Pros:**
- Best of both worlds
- Recent history is perfect
- Old history is summarized

**Cons:**
- Most complex to implement
- Need background compression job

---

## Recommendations

### Short Term (Current System is Good)

**Keep saving all commands** because:

1. **Storage is cheap** - JSON compresses well, 10,000 commands ≈ 1-2MB
2. **Event sourcing principle** - Complete history is the design goal
3. **Debugging value** - Being able to see every state change is invaluable during development
4. **No performance issues yet** - Foundry settings can handle this size
5. **Simple implementation** - No complex logic needed

**When to revisit:**
- Campaign reaches 1000+ commands (approximately 10-20 sessions)
- Foundry performance degradation
- Users request undo/time-travel features
- Storage becomes a concern

### Medium Term (If History Grows Large)

**Implement Snapshot System:**

```typescript
interface HistoryPolicy {
  maxCommands: number;          // Default: 1000
  snapshotInterval: number;     // Default: 500 commands
  keepRecentCommands: number;   // Default: 100
}

// When history exceeds maxCommands:
// 1. Create full state snapshot
// 2. Keep last 100 commands
// 3. Discard everything else
// 4. Store snapshot timestamp
```

**Benefits:**
- Automatic cleanup
- Bounded growth
- Fast replay from snapshot
- Still have recent undo capability

### Long Term (If Undo/Time-Travel Requested)

**Implement Transaction Grouping:**

```typescript
interface CommandTransaction {
  id: string;
  label: string;              // "Roll for Shoot", "Take Harm", "Rally"
  commands: Command[];        // All commands in this transaction
  timestamp: number;
  userId: string;
}

// Group related commands into transactions
// Example: "Take Harm from Shoot action"
// - clocks/addSegments (harm +3)
// - crews/addMomentum (resistance +2)
// - characters/addTrait (scar from dying)
```

**Benefits:**
- Undo at meaningful boundaries
- Better audit trail
- Session summary generation
- Cleaner replay UI

---

## Storage Size Estimation

**Average command size:** ~200 bytes JSON
**Commands per session:** ~100-200
**Sessions in campaign:** ~20-50

**Total storage:**
- 10 sessions: ~200KB
- 50 sessions: ~1MB
- 100 sessions: ~2MB

**Foundry VTT limits:**
- World database has no hard limit
- Browser localStorage: 5-10MB
- JSON compression: ~70% reduction

**Verdict:** Storage is NOT a concern for typical campaigns

---

## Specific Cases to Consider

### Case 1: Action Dots During Character Creation

**Current:** Every click on a dot = 1 command saved
**Alternative:** Save only when exiting edit mode

**Analysis:**
- User might click 20+ times while figuring out build
- These are "exploration clicks" not final decisions
- History pollution with intermediate states

**Recommendation:**
- **Option A (Simplest):** Keep current behavior, it's fine
- **Option B (Cleaner):** Batch all `setActionDots` commands while in edit mode, save only on "Save" button
- **My Pick:** **Option B** - This is a legitimate optimization

### Case 2: Incremental Harm/Clock Segments

**Current:** Each segment add = 1 command
**Alternative:** Batch segment changes within same "action"

**Analysis:**
- GM might add harm incrementally: +1, +1, +1 instead of +3
- Each click is intentional but could be batched
- Undo granularity: Do we need to undo individual segments?

**Recommendation:**
- **Keep current behavior** - Each segment change is meaningful
- If user wants to add 3 segments, they should do it in one command
- Don't try to guess their intent

### Case 3: Momentum Changes During Combat

**Current:** Every spend/add = 1 command
**Alternative:** None - these must all be saved

**Analysis:**
- Each Momentum change has a specific cause (push, consequence, etc.)
- Essential for audit trail
- Can't merge without losing information

**Recommendation:** **Keep all Momentum commands**

---

## Implementation Priority

### ✅ Already Implemented (Keep As-Is)
- All commands saved to history
- Auto-save with debouncing
- Immediate save on entity creation
- Export/import command history

### 🟡 Consider for Next Iteration
1. **Batch action dots during edit mode** (Option B from Case 1)
   - Save all `setActionDots` commands on edit mode exit
   - Don't save intermediate clicks
   - Estimated effort: 2 hours
   - Value: Cleaner history, better UX

2. **Add command metadata**
   - `userId`: Who made the change
   - `sessionId`: Which game session
   - `label`: Human-readable description ("Took 3 harm from shoot action")
   - Estimated effort: 4 hours
   - Value: Better audit trail, enables future features

### 🔵 Future Enhancements
3. **Snapshot system** (when history > 1000 commands)
   - Periodic snapshots every 500 commands
   - Keep last 100 commands
   - Estimated effort: 8 hours
   - Trigger: After 20+ game sessions

4. **Transaction grouping** (if undo requested)
   - Group related commands
   - Undo at transaction level
   - Estimated effort: 16 hours
   - Trigger: User feature request

5. **Command compression** (if storage becomes issue)
   - Background job to compress old history
   - Collapse consecutive operations
   - Estimated effort: 8 hours
   - Trigger: Performance issues

---

## Conclusion

**Current system is excellent for an event-sourced architecture.**

**The only optimization I recommend now:**
- **Batch `setActionDots` commands during edit mode** to avoid saving every exploratory click

**Everything else:**
- Keep saving all commands
- Revisit when history reaches 1000+ commands
- Consider snapshots only if storage/performance becomes an issue

**Why this is the right approach:**
- Storage is cheap
- Complete history = core design principle
- Premature optimization is the root of all evil
- Current system is simple and debuggable
- No user complaints about performance
