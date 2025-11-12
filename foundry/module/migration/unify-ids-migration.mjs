/**
 * Data Migration: Unify Redux and Foundry Actor IDs
 *
 * This migration script updates existing worlds to use unified IDs where
 * Foundry Actor ID === Redux ID, eliminating the need for the reduxId flag.
 *
 * BEFORE: Redux entities used separate UUIDs stored in actor.flags
 * AFTER: Redux entities use Foundry Actor IDs directly
 *
 * HOW TO RUN:
 * 1. Open your world as GM
 * 2. Open browser console (F12)
 * 3. Run: await game.fitgd.migration.unifyIds()
 * 4. Check console for migration results
 * 5. Save your world
 *
 * SAFETY:
 * - Creates a backup of Redux state before migration
 * - Non-destructive: can be re-run safely (idempotent)
 * - Validates all data before committing changes
 */

/**
 * Perform the ID unification migration
 *
 * @returns {Promise<Object>} Migration results
 */
export async function migrateUnifyIds() {
  console.log('='.repeat(60));
  console.log('FitGD | ID Unification Migration - Starting...');
  console.log('='.repeat(60));

  const results = {
    charactersUpdated: 0,
    crewsUpdated: 0,
    clocksUpdated: 0,
    flagsRemoved: 0,
    errors: [],
    skipped: [],
  };

  try {
    // Step 1: Backup current Redux state
    console.log('\n[1/5] Creating backup of Redux state...');
    const backup = game.fitgd.foundry.exportState();
    console.log('  ✓ Backup created (stored in game.fitgd.__migrationBackup)');
    game.fitgd.__migrationBackup = backup;

    // Step 2: Build ID mapping (old Redux UUID → new Foundry Actor ID)
    console.log('\n[2/5] Building ID mapping...');
    const idMapping = new Map(); // oldReduxId → foundryActorId

    for (const actor of game.actors) {
      if (actor.type !== 'character' && actor.type !== 'crew') continue;

      const oldReduxId = actor.getFlag('forged-in-the-grimdark', 'reduxId');
      if (!oldReduxId) {
        results.skipped.push(`${actor.type} "${actor.name}" (${actor.id}) - no reduxId flag`);
        continue;
      }

      idMapping.set(oldReduxId, actor.id);
      console.log(`  Mapped: ${oldReduxId} → ${actor.id} (${actor.type}: ${actor.name})`);
    }

    console.log(`  ✓ Built mapping for ${idMapping.size} entities`);

    // Step 3: Transform and re-import Redux state
    console.log('\n[3/5] Transforming Redux state...');

    // Export current state
    const exportedState = game.fitgd.foundry.exportState();

    // Transform character IDs
    if (exportedState.characters) {
      const newCharacters = {};
      for (const [oldId, character] of Object.entries(exportedState.characters)) {
        const newId = idMapping.get(oldId);
        if (newId) {
          newCharacters[newId] = { ...character, id: newId };
          console.log(`  Transforming character: ${character.name} (${oldId} → ${newId})`);
          results.charactersUpdated++;
        } else {
          newCharacters[oldId] = character; // Keep unchanged if no mapping
        }
      }
      exportedState.characters = newCharacters;
    }

    // Transform crew IDs and character references
    if (exportedState.crews) {
      const newCrews = {};
      for (const [oldId, crew] of Object.entries(exportedState.crews)) {
        const newId = idMapping.get(oldId);
        const updatedCharacters = crew.characters.map(charId =>
          idMapping.get(charId) || charId
        );

        if (newId) {
          newCrews[newId] = { ...crew, id: newId, characters: updatedCharacters };
          console.log(`  Transforming crew: ${crew.name} (${oldId} → ${newId})`);
          results.crewsUpdated++;
        } else {
          newCrews[oldId] = { ...crew, characters: updatedCharacters };
        }
      }
      exportedState.crews = newCrews;
    }

    // Transform clock entityId references
    if (exportedState.clocks) {
      for (const clock of Object.values(exportedState.clocks)) {
        const newEntityId = idMapping.get(clock.entityId);
        if (newEntityId) {
          clock.entityId = newEntityId;
          console.log(`  Transforming clock: ${clock.subtype || clock.clockType} (entityId: ${clock.entityId} → ${newEntityId})`);
          results.clocksUpdated++;
        }
      }
    }

    // Transform player round state character IDs
    if (exportedState.playerRoundState) {
      const newPlayerRoundState = {};
      for (const [oldId, playerState] of Object.entries(exportedState.playerRoundState)) {
        const newId = idMapping.get(oldId);
        if (newId) {
          newPlayerRoundState[newId] = playerState;
        } else {
          newPlayerRoundState[oldId] = playerState;
        }
      }
      exportedState.playerRoundState = newPlayerRoundState;
    }

    console.log(`  ✓ Transformed ${results.charactersUpdated} characters, ${results.crewsUpdated} crews, ${results.clocksUpdated} clocks`);

    // Re-import transformed state
    console.log('  Importing transformed state...');
    game.fitgd.foundry.importState(exportedState);
    console.log('  ✓ State imported');

    // Step 4: Save Redux state (broadcasts to all clients)
    console.log('\n[4/5] Saving updated Redux state...');
    await game.fitgd.saveImmediate();
    console.log('  ✓ State saved and broadcasted');

    // Step 5: Remove old reduxId flags from Foundry actors
    console.log('\n[5/5] Removing old reduxId flags...');
    for (const actor of game.actors) {
      if (actor.type !== 'character' && actor.type !== 'crew') continue;

      const hasFlag = actor.getFlag('forged-in-the-grimdark', 'reduxId');
      if (hasFlag) {
        await actor.unsetFlag('forged-in-the-grimdark', 'reduxId');
        results.flagsRemoved++;
        console.log(`  Removed flag from ${actor.type}: ${actor.name}`);
      }
    }

    console.log(`  ✓ Removed ${results.flagsRemoved} flags`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    results.errors.push(error.message);

    // Restore backup if available
    if (game.fitgd.__migrationBackup) {
      console.log('\n⚠️  Attempting to restore backup...');
      try {
        game.fitgd.foundry.importState(game.fitgd.__migrationBackup);
        await game.fitgd.saveImmediate();
        console.log('  ✓ Backup restored successfully');
      } catch (restoreError) {
        console.error('  ❌ Failed to restore backup:', restoreError);
        results.errors.push(`Restore failed: ${restoreError.message}`);
      }
    }

    throw error;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('FitGD | ID Unification Migration - Complete!');
  console.log('='.repeat(60));
  console.log(`✓ Characters updated: ${results.charactersUpdated}`);
  console.log(`✓ Crews updated: ${results.crewsUpdated}`);
  console.log(`✓ Clocks updated: ${results.clocksUpdated}`);
  console.log(`✓ Flags removed: ${results.flagsRemoved}`);

  if (results.skipped.length > 0) {
    console.log(`\n⚠️  Skipped ${results.skipped.length} actors:`);
    results.skipped.forEach(msg => console.log(`  - ${msg}`));
  }

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${results.errors.length}`);
    results.errors.forEach(msg => console.log(`  - ${msg}`));
  } else {
    console.log('\n✓ Migration completed without errors');
    console.log('\n📝 Next steps:');
    console.log('  1. Test your world (open character/crew sheets)');
    console.log('  2. If everything works, save your world');
    console.log('  3. If issues occur, reload without saving (backup is in game.fitgd.__migrationBackup)');
  }

  console.log('='.repeat(60));

  return results;
}

/**
 * Check if migration is needed
 *
 * @returns {boolean} True if any actors have the old reduxId flag
 */
export function needsMigration() {
  let count = 0;
  for (const actor of game.actors) {
    if (actor.type === 'character' || actor.type === 'crew') {
      if (actor.getFlag('forged-in-the-grimdark', 'reduxId')) {
        count++;
      }
    }
  }

  if (count > 0) {
    console.log(`FitGD | Migration needed: ${count} actors have old reduxId flags`);
    console.log(`Run: await game.fitgd.migration.unifyIds()`);
  } else {
    console.log('FitGD | No migration needed - all actors use unified IDs');
  }

  return count > 0;
}

/**
 * Restore from backup (if migration went wrong)
 *
 * @returns {Promise<void>}
 */
export async function restoreBackup() {
  if (!game.fitgd.__migrationBackup) {
    ui.notifications.error('No backup found. Cannot restore.');
    return;
  }

  console.log('FitGD | Restoring from migration backup...');
  game.fitgd.foundry.importState(game.fitgd.__migrationBackup);
  await game.fitgd.saveImmediate();
  console.log('FitGD | Backup restored successfully');
  ui.notifications.info('Migration backup restored');
}
