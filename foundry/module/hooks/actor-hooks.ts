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
Hooks.on('createActor', async function(actor: Actor, _options: object, userId: string) {
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
        actionDots: {
          shoot: 0, skirmish: 0, skulk: 0, wreck: 0,
          finesse: 0, survey: 0, study: 0, tech: 0,
          attune: 0, command: 0, consort: 0, sway: 0
        }
      });

      console.log(`FitGD | Character created in Redux with unified ID: ${characterId}`);

      // Save immediately (will broadcast to other clients)
      await game.fitgd!.saveImmediate();

      // Force re-render the sheet if it's already open
      if (actor.sheet?.rendered) {
        console.log('FitGD | Re-rendering character sheet with Redux data');
        actor.sheet.render(false);
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
      if (actor.sheet?.rendered) {
        console.log('FitGD | Re-rendering crew sheet with Redux data');
        actor.sheet.render(false);
      }
    } catch (error) {
      console.error('FitGD | Failed to create crew in Redux:', error);
      ui.notifications!.error(`Failed to create crew: ${(error as Error).message}`);
    }
  }
});
}
