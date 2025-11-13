/**
 * Branded Types for ID Safety
 *
 * These branded types prevent mixing up Redux entity IDs (UUIDs from the Redux store)
 * with Foundry Actor IDs (IDs from Foundry's database). Since the unified ID system
 * was implemented, Redux IDs ARE Foundry Actor IDs, but these types provide
 * compile-time documentation and validation.
 *
 * See CLAUDE.md "Unified IDs" section for architectural details.
 */

/**
 * Redux entity ID - Represents an ID for entities in the Redux store.
 * After the unified ID migration, this is the same as a Foundry Actor ID,
 * but the type distinction helps document intent and catches misuse.
 */
export type ReduxId = string & { readonly __brand: 'redux' };

/**
 * Foundry Actor ID - Represents a Foundry VTT Actor database ID.
 * After the unified ID migration, this is the same as a Redux ID.
 */
export type FoundryActorId = string & { readonly __brand: 'foundry' };

/**
 * Cast a string to a ReduxId.
 * Use this when you have a raw string ID that you know represents a Redux entity.
 *
 * @param id - The string ID to cast
 * @returns The same string, branded as a ReduxId
 *
 * @example
 * const reduxId = asReduxId(actor.id);
 * await game.fitgd.bridge.execute(action, { affectedReduxIds: [reduxId] });
 */
export function asReduxId(id: string): ReduxId {
  return id as ReduxId;
}

/**
 * Cast a string to a FoundryActorId.
 * Use this when you have a raw string ID that you know represents a Foundry Actor.
 *
 * @param id - The string ID to cast
 * @returns The same string, branded as a FoundryActorId
 *
 * @example
 * const actorId = asFoundryActorId(actor.id);
 */
export function asFoundryActorId(id: string): FoundryActorId {
  return id as FoundryActorId;
}

/**
 * Convert a FoundryActorId to a ReduxId.
 * After the unified ID migration, this is a no-op at runtime but provides type safety.
 *
 * @param foundryId - The Foundry Actor ID
 * @returns The same ID as a ReduxId
 *
 * @example
 * const reduxId = foundryIdToReduxId(actor.id as FoundryActorId);
 */
export function foundryIdToReduxId(foundryId: FoundryActorId): ReduxId {
  return foundryId as unknown as ReduxId;
}

/**
 * Convert a ReduxId to a FoundryActorId.
 * After the unified ID migration, this is a no-op at runtime but provides type safety.
 *
 * @param reduxId - The Redux entity ID
 * @returns The same ID as a FoundryActorId
 *
 * @example
 * const actorId = reduxIdToFoundryId(character.id as ReduxId);
 */
export function reduxIdToFoundryId(reduxId: ReduxId): FoundryActorId {
  return reduxId as unknown as FoundryActorId;
}

/**
 * Check if a string is a valid ID format (basic validation).
 * This doesn't check if the ID exists, just if it's non-empty.
 *
 * @param id - The ID to validate
 * @returns True if the ID is a non-empty string
 */
export function isValidId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.length > 0;
}

/**
 * Type guard to check if a value is a ReduxId.
 * Note: This is a runtime check that only validates string type,
 * it cannot verify the brand at runtime.
 *
 * @param value - The value to check
 * @returns True if the value is a valid ReduxId format
 */
export function isReduxId(value: unknown): value is ReduxId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a value is a FoundryActorId.
 * Note: This is a runtime check that only validates string type,
 * it cannot verify the brand at runtime.
 *
 * @param value - The value to check
 * @returns True if the value is a valid FoundryActorId format
 */
export function isFoundryActorId(value: unknown): value is FoundryActorId {
  return typeof value === 'string' && value.length > 0;
}
