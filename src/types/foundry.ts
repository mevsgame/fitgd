/**
 * Foundry-specific types
 *
 * Types for Foundry VTT integration and Redux state management.
 */

/**
 * Redux ID - A branded type for string IDs used in Redux state
 *
 * In our architecture, Redux IDs are unified with Foundry Actor IDs.
 * This branded type helps TypeScript distinguish Redux IDs from plain strings.
 */
export type ReduxId = string & { readonly __brand: 'redux' };

/**
 * Create a ReduxId from a string
 *
 * Used when converting Foundry Actor IDs to Redux IDs (in this architecture, they're the same).
 * The function exists for type safety and clarity of intent.
 */
export function createReduxId(id: string): ReduxId {
  return id as ReduxId;
}
