import type { Command } from '../types';

/**
 * Command Utility Functions
 *
 * Helpers for working with command history, particularly for
 * identifying orphaned commands (commands referencing deleted entities).
 */

/**
 * Extract entity ID from command payload
 *
 * Different command types store entity IDs in different places:
 * - Create commands: payload.id (the entity being created)
 * - Update commands: payload.characterId, payload.crewId, payload.clockId
 * - Delete commands: payload.characterId, payload.crewId, payload.clockId
 *
 * IMPORTANT: Extracts the ID of the entity being MODIFIED, not referenced.
 * For example, crews/addCharacterToCrew modifies a crew (crewId), even though
 * it references a character (characterId). We return crewId, not characterId.
 *
 * @param command - Command to extract entity ID from
 * @returns Entity ID if found, null otherwise
 */
export function extractEntityIdFromCommand(command: Command): string | null {
  const payload = command.payload as any;

  // Check command type to determine which entity is being modified
  // This prevents extracting the wrong ID (e.g., characterId from crews/addCharacterToCrew)
  if (command.type.startsWith('crews/')) {
    // Crew commands always modify the crew, even if they reference characters
    return payload?.crewId || payload?.id || null;
  }

  if (command.type.startsWith('characters/')) {
    // Character commands modify the character
    return payload?.characterId || payload?.id || null;
  }

  if (command.type.startsWith('clocks/')) {
    // Clock commands modify the clock
    return payload?.clockId || payload?.id || null;
  }

  // Fallback for unknown command types: try all common fields
  return (
    payload?.characterId ||
    payload?.crewId ||
    payload?.clockId ||
    payload?.id ||
    null
  );
}

/**
 * Check if command is a deletion command
 *
 * Deletion commands are important to preserve for audit trail purposes,
 * even if the entity no longer exists.
 *
 * @param command - Command to check
 * @returns true if command deletes an entity
 */
export function isDeletionCommand(command: Command): boolean {
  return (
    command.type.endsWith('/delete') ||
    command.type.endsWith('/deleteCharacter') ||
    command.type.endsWith('/deleteCrew') ||
    command.type.endsWith('/deleteClock') ||
    command.type.includes('delete')
  );
}

/**
 * Check if command is orphaned (references non-existent entity)
 *
 * Orphaned commands are commands that reference entities that no longer
 * exist in the current state. These can be safely pruned without losing
 * current state integrity.
 *
 * **IMPORTANT:** Deletion commands are NEVER considered orphaned, even if
 * the entity doesn't exist. This preserves audit trail: "who deleted what when".
 *
 * @param command - Command to check
 * @param currentEntityIds - Set of currently existing entity IDs
 * @returns true if command references deleted entity (excluding deletion commands)
 *
 * @example
 * ```typescript
 * const currentCharacterIds = new Set(['char-1', 'char-2']);
 * const command = {
 *   type: 'characters/addTrait',
 *   payload: { characterId: 'char-deleted', ... }
 * };
 *
 * isOrphanedCommand(command, currentCharacterIds); // true - references deleted char
 *
 * const deleteCommand = {
 *   type: 'characters/deleteCharacter',
 *   payload: { characterId: 'char-deleted' }
 * };
 *
 * isOrphanedCommand(deleteCommand, currentCharacterIds); // false - kept for audit
 * ```
 */
export function isOrphanedCommand(
  command: Command,
  currentEntityIds: Set<string>
): boolean {
  // Keep deletion commands for audit trail (even if entity is gone)
  if (isDeletionCommand(command)) {
    return false;
  }

  const entityId = extractEntityIdFromCommand(command);

  // Can't determine entity ID, keep it to be safe
  if (!entityId) {
    return false;
  }

  // Orphaned if entity no longer exists
  return !currentEntityIds.has(entityId);
}
