/**
 * Command Schema
 *
 * Immutable command for event sourcing.
 * Each command represents a state change with full metadata for replay and audit.
 */
export interface Command<T = unknown> {
  /** Command type (e.g., "character/addTrait") */
  type: string;

  /** Command-specific payload */
  payload: T;

  /** Unix timestamp (ms) when command was created */
  timestamp: number;

  /** Schema version for migration support */
  version: number;

  /** Optional: tracking who made the change */
  userId?: string;

  /** UUID for idempotency */
  commandId: string;
}
