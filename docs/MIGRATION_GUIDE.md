# Command Schema Migration Guide

## Overview

FitGD Core uses event sourcing, meaning all state changes are recorded as immutable commands in history. When the system evolves and command schemas change, we need a migration strategy to handle old commands.

This guide explains how to:
1. Version command schemas
2. Write migration functions
3. Replay old command histories with new code
4. Maintain backward compatibility

---

## Command Versioning

Every command has a `version` field:

```typescript
interface Command<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  version: number;        // Schema version
  commandId: string;
  userId?: string;
}
```

### Current Versions

| Command Type | Current Version | Changes |
|--------------|-----------------|---------|
| `character/createCharacter` | 1 | Initial version |
| `character/addTrait` | 1 | Initial version |
| `character/disableTrait` | 1 | Initial version |
| `crew/createCrew` | 1 | Initial version |
| `crew/setMomentum` | 1 | Initial version |
| `crew/addMomentum` | 1 | Initial version |
| `clock/createClock` | 1 | Initial version |
| `clock/addSegments` | 1 | Initial version |
| `clock/deleteClock` | 1 | Initial version |

---

## Migration Strategy

### 1. Detect Version Mismatch

When replaying commands, check the version:

```typescript
function replayCommand(command: Command): void {
  const currentVersion = COMMAND_VERSIONS[command.type];

  if (command.version < currentVersion) {
    // Migrate command to current version
    command = migrateCommand(command);
  }

  // Dispatch migrated command
  store.dispatch(command);
}
```

### 2. Write Migration Functions

Create a migration function for each version bump:

```typescript
// migrations/characterCommands.ts

export function migrateCharacterCreate_v1_to_v2(command: Command): Command {
  // Example: v1 → v2 added 'tech' and 'attune' to action dots

  if (command.version !== 1) return command;

  const payload = command.payload as any;

  return {
    ...command,
    version: 2,
    payload: {
      ...payload,
      actionDots: {
        ...payload.actionDots,
        tech: 0,      // Added in v2
        attune: 0,    // Added in v2
      }
    }
  };
}
```

### 3. Chain Migrations

For commands that are multiple versions behind:

```typescript
const CHARACTER_MIGRATIONS = {
  'character/createCharacter': [
    { from: 1, to: 2, fn: migrateCharacterCreate_v1_to_v2 },
    { from: 2, to: 3, fn: migrateCharacterCreate_v2_to_v3 },
  ]
};

function migrateCommand(command: Command): Command {
  const migrations = CHARACTER_MIGRATIONS[command.type] || [];

  let migratedCommand = command;
  for (const migration of migrations) {
    if (migratedCommand.version === migration.from) {
      migratedCommand = migration.fn(migratedCommand);
    }
  }

  return migratedCommand;
}
```

---

## Example Migrations

### Example 1: Adding a New Field

**Scenario:** In v2, we added a `rallyAvailable` field to characters.

**Migration:**

```typescript
export function migrateCharacterCreate_v1_to_v2(command: Command): Command {
  return {
    ...command,
    version: 2,
    payload: {
      ...command.payload,
      rallyAvailable: true  // Default value for new field
    }
  };
}
```

### Example 2: Renaming a Field

**Scenario:** In v2, we renamed `stress` to `momentum` in crew.

**Migration:**

```typescript
export function migrateCrewCreate_v1_to_v2(command: Command): Command {
  const payload = command.payload as any;

  return {
    ...command,
    version: 2,
    payload: {
      ...payload,
      currentMomentum: payload.stress || 5,  // Renamed field
      // Remove old field
      stress: undefined
    }
  };
}
```

### Example 3: Changing Data Structure

**Scenario:** In v2, harm changed from levels to clocks.

**Migration:**

```typescript
export function migrateHarmCommand_v1_to_v2(command: Command): Command {
  const payload = command.payload as any;

  // v1: { characterId, level: 'moderate' }
  // v2: { characterId, harmType, segments }

  const levelToSegments = {
    'lesser': 1,
    'moderate': 2,
    'severe': 3,
    'fatal': 6
  };

  return {
    ...command,
    version: 2,
    payload: {
      characterId: payload.characterId,
      harmType: 'Physical Harm',  // Default
      segments: levelToSegments[payload.level] || 2
    }
  };
}
```

### Example 4: Splitting a Command

**Scenario:** In v2, `addTrait` split into `addTrait` and `addScarTrait`.

**Migration:**

```typescript
export function migrateAddTrait_v1_to_v2(command: Command): Command {
  const payload = command.payload as any;

  // If trait is a scar, convert to new command type
  if (payload.trait.category === 'scar') {
    return {
      ...command,
      type: 'character/addScarTrait',  // New command type
      version: 2,
      payload
    };
  }

  // Otherwise, keep as addTrait v2
  return {
    ...command,
    version: 2,
    payload
  };
}
```

---

## Migration Testing

Always test migrations with real command histories:

```typescript
// tests/migrations/characterMigrations.test.ts

import { describe, it, expect } from 'vitest';
import { migrateCharacterCreate_v1_to_v2 } from '../../migrations/characterCommands';

describe('Character Command Migrations', () => {
  it('should migrate v1 to v2 (add rallyAvailable)', () => {
    const v1Command = {
      type: 'character/createCharacter',
      version: 1,
      payload: {
        id: 'char-1',
        name: 'Test',
        traits: [],
        actionDots: { shoot: 2, command: 1, /* ... */ }
      },
      timestamp: Date.now(),
      commandId: 'cmd-1'
    };

    const v2Command = migrateCharacterCreate_v1_to_v2(v1Command);

    expect(v2Command.version).toBe(2);
    expect(v2Command.payload.rallyAvailable).toBe(true);
  });

  it('should replay old command history', () => {
    const oldHistory = [
      /* Load from saved history */
    ];

    const migratedHistory = oldHistory.map(migrateCommand);

    // Replay migrated commands
    const store = configureStore();
    migratedHistory.forEach(cmd => store.dispatch(cmd));

    const state = store.getState();
    // Assert state is correct
  });
});
```

---

## Best Practices

### 1. Never Change Old Versions

❌ **Bad:**
```typescript
// Don't modify existing command schemas
interface CreateCharacterPayload_v1 {
  name: string;
  actionDots: ActionDots;
  rallyAvailable: boolean;  // ❌ Added to v1 retroactively
}
```

✅ **Good:**
```typescript
// Keep v1 frozen, create v2
interface CreateCharacterPayload_v1 {
  name: string;
  actionDots: ActionDots;
}

interface CreateCharacterPayload_v2 {
  name: string;
  actionDots: ActionDots;
  rallyAvailable: boolean;  // ✅ Added in v2
}
```

### 2. Always Provide Defaults

When adding new required fields, provide sensible defaults:

```typescript
export function migrateCommand(command: Command): Command {
  return {
    ...command,
    version: 2,
    payload: {
      ...command.payload,
      newRequiredField: getDefaultValue()  // ✅ Provide default
    }
  };
}
```

### 3. Document Breaking Changes

Maintain a CHANGELOG for command schema changes:

```markdown
## v2.0.0 (Breaking)
- `character/createCharacter` v1→v2: Added `rallyAvailable` field
- `crew/createCrew` v1→v2: Renamed `stress` → `currentMomentum`
- Migration functions provided in `migrations/`
```

### 4. Test Migration Performance

For large command histories (1000+ commands), benchmark migrations:

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
const migratedHistory = oldHistory.map(migrateCommand);
const end = performance.now();

console.log(`Migrated ${oldHistory.length} commands in ${end - start}ms`);
// Target: <100ms per 1000 commands
```

---

## Migration Workflow

### When Introducing Breaking Changes

1. **Bump version number** in command type constant
2. **Write migration function** from old→new version
3. **Add to migration chain**
4. **Write tests** for migration
5. **Document in CHANGELOG**
6. **Test with real data** (if available)

### When Deploying

```bash
# 1. Backup current command history
$ node scripts/backup-history.js > history-backup.json

# 2. Run migration script (optional, can migrate on-the-fly)
$ node scripts/migrate-history.js --from=1 --to=2

# 3. Test migrated history
$ npm test

# 4. Deploy
$ npm run build
$ # Deploy to production
```

---

## Foundry VTT Integration

In Foundry VTT, command history is stored in the world data:

```typescript
// On world load
Hooks.once('ready', async () => {
  // Load command history from Foundry
  const history = game.settings.get('fitgd', 'commandHistory');

  // Migrate if needed
  const migratedHistory = history.map(cmd => {
    const currentVersion = COMMAND_VERSIONS[cmd.type];
    if (cmd.version < currentVersion) {
      return migrateCommand(cmd);
    }
    return cmd;
  });

  // Replay commands
  const store = configureStore();
  migratedHistory.forEach(cmd => store.dispatch(cmd));

  // Save migrated history
  await game.settings.set('fitgd', 'commandHistory', migratedHistory);
});
```

---

## Snapshot + Incremental History

For performance, combine snapshots with incremental history:

```typescript
interface SavedState {
  snapshot: {
    characters: Record<string, Character>;
    crews: Record<string, Crew>;
    clocks: Record<string, Clock>;
    version: number;
    timestamp: number;
  };
  incrementalHistory: Command[];  // Commands since snapshot
}

// On save
function saveState(store: Store): SavedState {
  return {
    snapshot: store.getState(),
    incrementalHistory: []
  };
}

// On load
function loadState(saved: SavedState): Store {
  const store = configureStore();

  // 1. Hydrate from snapshot
  // (Requires snapshot loading feature)

  // 2. Replay incremental history
  saved.incrementalHistory.forEach(cmd => {
    const migrated = migrateCommand(cmd);
    store.dispatch(migrated);
  });

  return store;
}
```

---

## Migration Utilities

Create helper utilities for common migrations:

```typescript
// migrations/utils.ts

export function addField<T>(
  command: Command,
  fieldPath: string,
  defaultValue: T,
  newVersion: number
): Command {
  return {
    ...command,
    version: newVersion,
    payload: {
      ...command.payload,
      [fieldPath]: defaultValue
    }
  };
}

export function renameField(
  command: Command,
  oldField: string,
  newField: string,
  newVersion: number
): Command {
  const payload = { ...command.payload };
  (payload as any)[newField] = (payload as any)[oldField];
  delete (payload as any)[oldField];

  return {
    ...command,
    version: newVersion,
    payload
  };
}

export function transformPayload<T, U>(
  command: Command,
  transform: (payload: T) => U,
  newVersion: number
): Command {
  return {
    ...command,
    version: newVersion,
    payload: transform(command.payload as T)
  };
}
```

**Usage:**

```typescript
export function migrateCrewCreate_v1_to_v2(command: Command): Command {
  return renameField(command, 'stress', 'currentMomentum', 2);
}
```

---

## Summary

| Task | Action |
|------|--------|
| **Add new field** | Provide default value in migration |
| **Rename field** | Map old→new, remove old |
| **Change structure** | Transform payload with conversion logic |
| **Split command** | Convert to new command type |
| **Always** | Test with real command histories |
| **Always** | Document in CHANGELOG |
| **Always** | Bump version number |

For questions or issues with migrations, refer to the [test fixtures](../tests/fixtures/) for examples of command structures.
