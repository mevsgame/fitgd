/**
 * Actor Lifecycle Hooks
 *
 * Handles Actor creation and lifecycle events
 */

/**
 * Register all actor-related hooks
 */
export function registerActorHooks(): void {
  /* -------------------------------------------- */
  /*  Actor Lifecycle Hooks                       */
  /* -------------------------------------------- */

  /**
   * When a Foundry actor is created, create the corresponding Redux entity
   *
   * IMPORTANT: This hook fires on ALL clients, but only the creating user
   * (or GM) should execute the logic. Other clients will receive the Redux
   * commands via socket broadcast.
   */
  Hooks.on('createActor', async function (actor: Actor, _options: object, userId: string) {
    // Only execute on the client that created the actor, or on GM's client
    // Other clients will receive updates via socket broadcast
    const isCreatingUser = userId === game.user!.id;
    const isGM = game.user!.isGM;

    if (!isCreatingUser && !isGM) {
      console.log(`FitGD | Skipping createActor hook (not creator, not GM) for ${actor.type}: ${actor.name}`);
      return;
    }

    console.log(`FitGD | Creating ${actor.type}: ${actor.name} (${actor.id}) [user: ${userId}]`);

    if ((actor.type as string) === 'character') {
      // Create character in Redux with Foundry Actor ID (unified IDs!)
      try {
        const characterId = game.fitgd!.api.character.create({
          id: actor.id ?? undefined, // Use Foundry Actor ID directly!
          name: actor.name,
          traits: [
            { name: 'Role Trait (edit me)', category: 'role', disabled: false },
            { name: 'Background Trait (edit me)', category: 'background', disabled: false }
          ],
          approaches: {
            force: 0,
            guile: 0,
            focus: 0,
            spirit: 0
          }
        });

        console.log(`FitGD | Character created in Redux with unified ID: ${characterId}`);

        // Save immediately (will broadcast to other clients)
        await game.fitgd!.saveImmediate();

        // Force re-render the sheet if it's already open
        if ((actor.sheet as any)?.rendered) {
          console.log('FitGD | Re-rendering character sheet with Redux data');
          (actor.sheet as any).render(false);
        }
      } catch (error) {
        console.error('FitGD | Failed to create character in Redux:', error);
        ui.notifications!.error(`Failed to create character: ${(error as Error).message}`);
      }

    } else if ((actor.type as string) === 'crew') {
      // Create crew in Redux with Foundry Actor ID (unified IDs!)
      try {
        const crewId = game.fitgd!.api.crew.create({ id: actor.id ?? undefined, name: actor.name });

        console.log(`FitGD | Crew created in Redux with unified ID: ${crewId}`);

        // Save immediately (will broadcast to other clients)
        await game.fitgd!.saveImmediate();

        // Force re-render the sheet if it's already open
        if ((actor.sheet as any)?.rendered) {
          console.log('FitGD | Re-rendering crew sheet with Redux data');
          (actor.sheet as any).render(false);
        }
      } catch (error) {
        console.error('FitGD | Failed to create crew in Redux:', error);
        ui.notifications!.error(`Failed to create crew: ${(error as Error).message}`);
      }
    }
  });

  /**
   * When a Foundry actor is updated, sync name changes to HUD and Redux
   *
   * This hook handles:
   * 1. Character name changes: re-render HUD if visible
   * 2. Crew name changes: sync to Redux and re-render HUD
   */
  Hooks.on('updateActor', async function (actor: Actor, changes: Record<string, unknown>, _options: object, _userId: string) {
    // Only process if name changed
    if (!('name' in changes)) return;

    const newName = changes.name as string;
    console.log(`FitGD | Actor name changed: ${actor.type} "${actor.name}" -> "${newName}"`);

    // For crew actors, sync name to Redux
    if ((actor.type as string) === 'crew' && actor.id) {
      try {
        game.fitgd?.api.crew.updateName({ crewId: actor.id, name: newName });
        await game.fitgd?.saveImmediate();
        console.log(`FitGD | Crew name synced to Redux: ${newName}`);
      } catch (error) {
        console.error('FitGD | Failed to sync crew name to Redux:', error);
      }
    }

    // Re-render HUD if visible and actor is relevant (character in crew or crew itself)
    if (game.fitgd?.hud?.isVisible()) {
      const state = game.fitgd?.store.getState();
      const primaryCrewId = game.settings.get('forged-in-the-grimdark', 'primaryCrewId') as string | undefined;

      if (!primaryCrewId) return;

      const crew = state?.crews.byId[primaryCrewId];

      // Check if this actor is the primary crew or a character in it
      const isRelevant = actor.id === primaryCrewId || crew?.characters.includes(actor.id!);

      if (isRelevant) {
        console.log(`FitGD | Re-rendering HUD due to relevant actor name change`);
        game.fitgd.hud.show(); // Force re-render
      }
    }
  });
}

