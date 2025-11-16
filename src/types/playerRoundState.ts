/**
 * Player Round State Types
 *
 * Tracks the current state of a player during their turn in an encounter.
 * Used to drive the Player Action Widget UI and enforce valid state transitions.
 */

import type { ActionDots } from './character';
import type { Position, Effect } from './resolution';

// Re-export for convenience
export type { Position, Effect };

/**
 * All possible states a player can be in during their round
 */
export type PlayerRoundStateType =
  | 'IDLE_WAITING'              // Not your turn, watching others
  | 'DECISION_PHASE'             // Your turn - preparing action
  | 'ROLLING'                    // Dice rolling
  | 'SUCCESS_COMPLETE'           // Success, no consequences (manual close by GM)
  | 'GM_RESOLVING_CONSEQUENCE'   // GM configures consequence, player sees preview
  | 'APPLYING_EFFECTS'           // Writing to Redux state
  | 'TURN_COMPLETE'              // Done, advancing turn
  | 'RALLY_ROLLING'              // Rolling Rally action
  | 'ASSIST_ROLLING'             // Assisting teammate
  | 'PROTECT_ACCEPTING'          // Taking consequence for teammate
  | 'STIMS_ROLLING'              // Using stims, rolling addiction
  | 'STIMS_LOCKED';              // Stims locked due to addiction

/**
 * Roll outcome types
 */
export type RollOutcome = 'critical' | 'success' | 'partial' | 'failure';

/**
 * Consequence types (simplified for new GM-driven resolution)
 */
export type ConsequenceType = 'harm' | 'crew-clock';

/**
 * Trait transaction modes
 */
export type TraitTransactionMode = 'existing' | 'new' | 'consolidate';

/**
 * Push types for player round state
 */
export type PlayerPushType = 'extra-die' | 'improved-effect';

/**
 * Trait transaction (pending changes that happen on roll commit)
 */
export interface TraitTransaction {
  /** Mode: use existing, create new, or consolidate 3 into 1 */
  mode: TraitTransactionMode;

  /** Selected trait ID (for 'existing' mode) */
  selectedTraitId?: string;

  /** New trait to create (for 'new' mode) */
  newTrait?: {
    name: string;
    description?: string;
    category: 'flashback';
  };

  /** Consolidation data (for 'consolidate' mode) */
  consolidation?: {
    /** IDs of 3 traits being consolidated */
    traitIdsToRemove: string[];
    /** New consolidated trait to create */
    newTrait: {
      name: string;
      description?: string;
      category: 'grouped';
    };
  };

  /** Whether this transaction improves position */
  positionImprovement: boolean;

  /** Momentum cost (always 1 for position improvement) */
  momentumCost: number;
}

/**
 * Consequence transaction (GM's consequence selections during resolution)
 */
export interface ConsequenceTransaction {
  /** Which consequence type? (harm or crew-clock) */
  consequenceType: ConsequenceType;

  // ===== HARM OPTIONS =====

  /** Target character ID (default: acting character) */
  harmTargetCharacterId?: string;

  /** Selected existing harm clock ID (undefined = creating new) */
  harmClockId?: string;

  /** New harm clock type (if creating new) */
  newHarmClockType?: string;

  /** Clock ID to replace (if 4th harm clock) */
  replaceClockId?: string;

  // ===== CREW CLOCK OPTIONS =====

  /** Selected crew clock ID (segments calculated automatically from position) */
  crewClockId?: string;

  // ===== CALCULATED VALUES (read-only) =====

  /** Auto-calculated harm segments from Position × Effect table */
  calculatedHarmSegments?: number;

  /** Auto-calculated momentum gain from Position */
  calculatedMomentumGain?: number;
}

/**
 * State data for a player's current round
 */
export interface PlayerRoundState {
  /** Character ID this state belongs to */
  characterId: string;

  /** Current state in the round */
  state: PlayerRoundStateType;

  /** Selected action (e.g., 'shoot', 'skirmish') */
  selectedAction?: keyof ActionDots;

  /** Position level (controlled/risky/desperate) */
  position?: Position;

  /** Effect level (limited/standard/great) */
  effect?: Effect;

  // ===== IMPROVEMENTS =====

  /** Selected trait ID to use for this action */
  selectedTraitId?: string;

  /** Equipment IDs being used for this action */
  equippedForAction?: string[];

  /** Push Yourself flag (costs 1M) */
  pushed?: boolean;

  /** Type of push: 'extra-die' (+1d) or 'improved-effect' (Effect +1) */
  pushType?: PlayerPushType;

  /** Flashback applied flag */
  flashbackApplied?: boolean;

  /** Trait transaction (pending changes to apply on roll commit) */
  traitTransaction?: TraitTransaction;

  // ===== GM APPROVAL =====

  /** GM has approved the roll (enables player's Commit Roll button) */
  gmApproved?: boolean;

  // ===== CONSEQUENCE TRANSACTION =====

  /** Consequence transaction (GM's selections during consequence resolution) */
  consequenceTransaction?: ConsequenceTransaction;

  // ===== STIMS TRACKING =====

  /** Stims used this action (prevent multiple use) */
  stimsUsedThisAction?: boolean;

  // ===== ROLL DATA =====

  /** Total dice pool (action dots + modifiers) */
  dicePool?: number;

  /** Actual dice roll results */
  rollResult?: number[];

  /** Calculated outcome */
  outcome?: RollOutcome;

  // ===== CONSEQUENCE DATA =====

  /** Type of consequence being applied */
  consequenceType?: ConsequenceType;

  /** Numeric value (harm segments, clock segments, etc.) */
  consequenceValue?: number;

  /** Momentum gained from accepting consequence */
  momentumGain?: number;

  // ===== METADATA =====

  /** When this state was entered (timestamp) */
  stateEnteredAt: number;

  /** Previous state (for undo support) */
  previousState?: PlayerRoundState;
}

/**
 * Valid state transitions
 * Maps from current state to allowed next states
 *
 * Consequence flow (GM-driven):
 * ROLLING → GM_RESOLVING_CONSEQUENCE → APPLYING_EFFECTS → TURN_COMPLETE
 * Player can interrupt with stims: GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → ROLLING (reroll same plan)
 */
export const STATE_TRANSITIONS: Record<PlayerRoundStateType, PlayerRoundStateType[]> = {
  IDLE_WAITING: ['DECISION_PHASE', 'ASSIST_ROLLING', 'PROTECT_ACCEPTING'],
  DECISION_PHASE: ['ROLLING', 'RALLY_ROLLING', 'IDLE_WAITING'],
  ROLLING: ['SUCCESS_COMPLETE', 'GM_RESOLVING_CONSEQUENCE'],
  SUCCESS_COMPLETE: ['TURN_COMPLETE'],  // Manual close only (GM clicks "End Turn")
  GM_RESOLVING_CONSEQUENCE: [
    'APPLYING_EFFECTS',           // GM applies consequence
    'STIMS_ROLLING'               // Player interrupts with stims
  ],
  APPLYING_EFFECTS: ['TURN_COMPLETE'],
  TURN_COMPLETE: ['IDLE_WAITING'],
  RALLY_ROLLING: ['DECISION_PHASE'],
  ASSIST_ROLLING: ['IDLE_WAITING'],
  PROTECT_ACCEPTING: ['IDLE_WAITING'],
  STIMS_ROLLING: ['ROLLING', 'STIMS_LOCKED'],  // Re-roll with same plan
  STIMS_LOCKED: ['GM_RESOLVING_CONSEQUENCE'],  // Return to consequence state
};

/**
 * Initial state for a new player round
 */
export function createInitialPlayerRoundState(characterId: string): PlayerRoundState {
  return {
    characterId,
    state: 'IDLE_WAITING',
    stateEnteredAt: Date.now(),
  };
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  currentState: PlayerRoundStateType,
  nextState: PlayerRoundStateType
): boolean {
  return STATE_TRANSITIONS[currentState]?.includes(nextState) ?? false;
}
