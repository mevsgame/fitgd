/**
 * Player Action Widget
 *
 * A persistent widget that appears when it's a player's turn in an encounter.
 * Drives the action resolution flow through the state machine.
 */

import type { Character, Trait } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';
import type { PlayerRoundState, Position, Effect } from '@/types/playerRoundState';
import type { TraitTransaction, ConsequenceTransaction } from '@/types/playerRoundState';

import { selectCanUseRally } from '@/selectors/characterSelectors';
import { selectStimsAvailable } from '@/selectors/clockSelectors';

import { selectDicePool, selectConsequenceSeverity, selectMomentumGain, selectMomentumCost, selectHarmClocksWithStatus, selectIsDying, selectEffectivePosition, selectEffectiveEffect } from '@/selectors/playerRoundStateSelectors';

import { DEFAULT_CONFIG } from '@/config/gameConfig';

import { calculateOutcome } from '@/utils/diceRules';

import { FlashbackTraitsDialog } from '../dialogs/FlashbackTraitsDialog';
import { ClockSelectionDialog, CharacterSelectionDialog, ClockCreationDialog, LeanIntoTraitDialog, RallyDialog } from '../dialogs/index';
import { asReduxId } from '../types/ids';

/* -------------------------------------------- */
/*  Types                                       */
/* -------------------------------------------- */

interface PlayerActionWidgetData {
  character: Character;
  crew: Crew | null;
  crewId: string | null;
  playerState: PlayerRoundState | null;

  // State flags
  isDecisionPhase: boolean;
  isRolling: boolean;
  isStimsRolling: boolean;
  isStimsLocked: boolean;
  isSuccess: boolean;
  isConsequenceChoice: boolean;
  isGMResolvingConsequence: boolean;

  // Available actions
  actions: string[];

  // Harm clocks (for display)
  harmClocks: Array<Clock & { status?: string }>;
  isDying: boolean;

  // Current momentum
  momentum: number;
  maxMomentum: number;

  // Rally availability
  canRally: boolean;

  // Computed dice pool
  dicePool: number;

  // Momentum cost
  momentumCost: number;

  // Computed improvements preview
  improvements: string[];

  // Improved position (if trait improves it)
  improvedPosition: Position;

  // Improved effect (if Push Effect is active)
  improvedEffect: Effect;

  // GM controls
  isGM: boolean;

  // Stims availability
  stimsLocked: boolean;

  // Consequence transaction data (for GM_RESOLVING_CONSEQUENCE state)
  consequenceTransaction?: ConsequenceTransaction | null;
  harmTargetCharacter?: Character | null;
  selectedHarmClock?: Clock | null;
  selectedCrewClock?: Clock | null;
  calculatedHarmSegments?: number | null;
  calculatedMomentumGain?: number | null;
  effectivePosition?: Position;
  effectiveEffect?: Effect;
  consequenceConfigured?: boolean;
}

interface ClockData {
  name: string;
  segments: number;
  description?: string;
  category?: string;
  isCountdown?: boolean;
}

/* -------------------------------------------- */
/*  Player Action Widget Application            */
/* -------------------------------------------- */

/**
 * Player Action Widget
 *
 * A persistent UI widget that appears during combat encounters to guide a player
 * through their action resolution. Implements a state machine with the following phases:
 *
 * **DECISION_PHASE**: Player chooses action, position, effect, and any improvements
 * - Select action (based on character's action dots)
 * - Set position (Controlled/Risky/Desperate)
 * - Set effect (Limited/Standard/Great)
 * - Optional: Push yourself (extra die, improve position/effect)
 * - Optional: Use traits via flashback
 * - Optional: Equip consumables/items
 *
 * **ROLLING**: Dice are being rolled (async operation)
 * - Calculates dice pool from action dots + bonuses
 * - Handles 0-dot actions (roll 2d6 keep lowest)
 * - Evaluates outcome (critical/success/partial/failure)
 *
 * **AWAITING_APPROVAL**: GM must approve the roll before proceeding
 * - Shows roll result and improvements to GM
 * - GM can approve or modify outcome
 *
 * **GM_RESOLVING_CONSEQUENCE**: GM determines consequences
 * - Success: No consequences, turn ends
 * - Failure: GM applies harm based on position
 * - Player can interrupt with stims
 *
 * **COMPLETE**: Turn finished, widget closes
 *
 * The widget subscribes to Redux store changes for real-time updates across all clients
 * (GM sees player's decisions immediately, player sees GM's approval).
 *
 * @extends Application
 */
export class PlayerActionWidget extends Application {
  private characterId: string;
  private character: Character | null = null;
  private crew: Crew | null = null;
  private crewId: string | null = null;
  private playerState: PlayerRoundState | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  /**
   * Create a new Player Action Widget
   *
   * @param characterId - Redux ID of the character taking their turn
   * @param options - Additional options passed to Application constructor
   */
  constructor(characterId: string, options: any = {}) {
    super(options);

    this.characterId = characterId;
  }

  override async _render(force: boolean, options: any): Promise<void> {
    await super._render(force, options);

    // Null safety check
    if (!game.fitgd) {
      console.error('FitGD | FitGD not initialized');
      return;
    }

    // Subscribe to Redux store changes for real-time updates
    if (!this.storeUnsubscribe) {
      let previousState = game.fitgd.store.getState();

      this.storeUnsubscribe = game.fitgd.store.subscribe(() => {
        const currentState = game.fitgd.store.getState();

        // Get current crew ID (character might have changed crews)
        const currentCrewId = Object.values(currentState.crews.byId)
          .find(crew => crew.characters.includes(this.characterId))?.id;

        // Check if any relevant state changed
        const playerStateChanged = currentState.playerRoundState.byCharacterId[this.characterId]
          !== previousState.playerRoundState.byCharacterId[this.characterId];

        const characterChanged = currentState.characters.byId[this.characterId]
          !== previousState.characters.byId[this.characterId];

        const crewChanged = currentCrewId && (
          currentState.crews.byId[currentCrewId] !== previousState.crews.byId[currentCrewId]
        );

        const clocksChanged = currentState.clocks !== previousState.clocks;

        // Re-render if any relevant state changed
        if (playerStateChanged || characterChanged || crewChanged || clocksChanged) {
          this.render(true); // Force full re-render to update template
        }

        previousState = currentState;
      });
    }
  }

  override async close(options?: FormApplication.CloseOptions): Promise<void> {
    // Unsubscribe from store updates
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    return super.close(options);
  }

  static override get defaultOptions(): any {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['fitgd', 'player-action-widget'],
      template: 'systems/forged-in-the-grimdark/templates/widgets/player-action-widget.html',
      width: 600,
      height: 'auto',
      minimizable: false,
      resizable: false,
      title: 'Your Turn',
      popOut: true,
    });
  }

  override get id(): string {
    return `player-action-widget-${this.characterId}`;
  }

  /**
   * Get template data for rendering the widget
   *
   * Fetches character, crew, and player round state from Redux store,
   * calculates derived values (dice pool, improvements, state flags),
   * and prepares all data needed by the Handlebars template.
   *
   * @param options - Render options
   * @returns Template data with character, crew, playerState, and UI flags
   */
  override async getData(options: any = {}): Promise<PlayerActionWidgetData> {
    const data = await super.getData(options) as Partial<PlayerActionWidgetData>;

    // Null safety checks
    if (!game.fitgd) {
      console.error('FitGD | FitGD not initialized');
      return data as PlayerActionWidgetData;
    }

    // Get character from Redux store
    this.character = game.fitgd.api.character.getCharacter(this.characterId);
    if (!this.character) {
      ui.notifications?.error('Character not found');
      return data as PlayerActionWidgetData;
    }

    // Get crew (assuming character is in a crew)
    const state = game.fitgd.store.getState();
    const crewId = Object.values(state.crews.byId)
      .find(crew => crew.characters.includes(this.characterId))?.id;

    if (crewId) {
      this.crew = game.fitgd.api.crew.getCrew(crewId);
      this.crewId = crewId; // Store crewId separately for easy access
    } else {
      this.crew = null;
      this.crewId = null;
    }

    // Get player round state
    this.playerState = state.playerRoundState.byCharacterId[this.characterId];

    console.log('FitGD | Widget getData() - Current state:', this.playerState?.state, 'isGM:', game.user.isGM);

    // Build data for template
    return {
      ...data,
      character: this.character,
      crew: this.crew,
      crewId: this.crewId,
      playerState: this.playerState,

      // State flags (ROLL_CONFIRM state removed)
      isDecisionPhase: this.playerState?.state === 'DECISION_PHASE',
      isRolling: this.playerState?.state === 'ROLLING',
      isStimsRolling: this.playerState?.state === 'STIMS_ROLLING',
      isStimsLocked: this.playerState?.state === 'STIMS_LOCKED',
      isSuccess: this.playerState?.state === 'SUCCESS_COMPLETE',
      isGMResolvingConsequence: this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE',

      // Available actions
      actions: Object.keys(this.character.actionDots),

      // Harm clocks (for display) - using selector
      harmClocks: selectHarmClocksWithStatus(state, this.characterId),
      isDying: selectIsDying(state, this.characterId),

      // Current momentum
      momentum: this.crew?.currentMomentum || 0,
      maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,

      // Rally availability - using selector
      canRally: this.crewId ? selectCanUseRally(state, this.characterId, this.crewId) : false,

      // Computed dice pool - using selector
      dicePool: selectDicePool(state, this.characterId),

      // Momentum cost - using selector
      momentumCost: selectMomentumCost(this.playerState),

      // Computed improvements preview
      improvements: this._computeImprovements(),

      // Improved position (if trait improves it) - using selector
      improvedPosition: selectEffectivePosition(state, this.characterId),

      // Improved effect (if Push Effect is active) - using selector
      improvedEffect: selectEffectiveEffect(state, this.characterId),

      // GM controls
      isGM: game.user.isGM,

      // Stims availability (inverted: selector returns "available", template needs "locked")
      stimsLocked: !selectStimsAvailable(state, this.crewId || ''),

      // Consequence transaction data (for GM_RESOLVING_CONSEQUENCE state)
      ...(this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE' ? this._getConsequenceData(state) : {}),
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Action selection
    html.find('.action-select').change(this._onActionChange.bind(this));

    // GM position/effect controls
    html.find('.position-select').change(this._onPositionChange.bind(this));
    html.find('.effect-select').change(this._onEffectChange.bind(this));

    // GM approve roll button
    html.find('[data-action="approve-roll"]').click(this._onApproveRoll.bind(this));

    // Prepare action buttons
    html.find('[data-action="rally"]').click(this._onRally.bind(this));
    html.find('[data-action="lean-into-trait"]').click(this._onLeanIntoTrait.bind(this));
    html.find('[data-action="use-trait"]').click(this._onUseTrait.bind(this));
    html.find('[data-action="equipment"]').click(this._onEquipment.bind(this));
    html.find('[data-action="push-die"]').click(this._onTogglePushDie.bind(this));
    html.find('[data-action="push-effect"]').click(this._onTogglePushEffect.bind(this));

    // Roll button (simplified: no more commit-roll button)
    html.find('[data-action="roll"]').click(this._onRoll.bind(this));

    // Consequence buttons
    html.find('[data-action="use-stims"]').click(this._onUseStims.bind(this));
    html.find('[data-action="accept-consequences"]').click(this._onAcceptConsequences.bind(this));

    // GM consequence configuration buttons
    html.find('[data-action="select-consequence-type"]').click(this._onSelectConsequenceType.bind(this));
    html.find('[data-action="select-harm-target"]').click(this._onSelectHarmTarget.bind(this));
    html.find('[data-action="select-harm-clock"]').click(this._onSelectHarmClock.bind(this));
    html.find('[data-action="select-crew-clock"]').click(this._onSelectCrewClock.bind(this));
    html.find('[data-action="approve-consequence"]').click(this._onApproveConsequence.bind(this));

    // Player stims button (from GM phase)
    html.find('[data-action="use-stims-gm-phase"]').click(this._onUseStimsGMPhase.bind(this));

    // Cancel button (back button removed - no more ROLL_CONFIRM state)
    html.find('[data-action="cancel"]').click(this._onCancel.bind(this));
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply trait transaction to character
   * @param transaction - The transaction to apply
   */
  private async _applyTraitTransaction(transaction: TraitTransaction): Promise<void> {
    const actions: Array<{ type: string; payload: any }> = [];

    if (transaction.mode === 'existing') {
      // No character changes needed for using existing trait
      console.log(`FitGD | Using existing trait: ${transaction.selectedTraitId}`);

    } else if (transaction.mode === 'new') {
      // Create new flashback trait
      const newTrait: Trait = {
        id: foundry.utils.randomID(),
        name: transaction.newTrait!.name,
        description: transaction.newTrait!.description,
        category: 'flashback',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: newTrait,
        },
      });

      console.log(`FitGD | Will create new trait: ${newTrait.name}`);

    } else if (transaction.mode === 'consolidate') {
      // Remove 3 traits and create consolidated trait
      const consolidation = transaction.consolidation!;

      // Queue removal of the 3 traits
      for (const traitId of consolidation.traitIdsToRemove) {
        actions.push({
          type: 'characters/removeTrait',
          payload: {
            characterId: this.characterId,
            traitId,
          },
        });
      }

      // Queue creation of consolidated trait
      const consolidatedTrait: Trait = {
        id: foundry.utils.randomID(),
        name: consolidation.newTrait.name,
        description: consolidation.newTrait.description,
        category: 'grouped',
        disabled: false,
        acquiredAt: Date.now(),
      };

      actions.push({
        type: 'characters/addTrait',
        payload: {
          characterId: this.characterId,
          trait: consolidatedTrait,
        },
      });

      console.log(`FitGD | Will consolidate traits into: ${consolidatedTrait.name}`);
    }

    // Execute all trait changes as a batch (single broadcast, prevents render race)
    if (actions.length > 0) {
      await game.fitgd.bridge.executeBatch(actions, {
        affectedReduxIds: [asReduxId(this.characterId)],
        force: true, // Force full re-render to show new traits
      });
    }
  }

  /**
   * Compute improvements preview text
   */
  private _computeImprovements(): string[] {
    if (!this.playerState) return [];

    const improvements: string[] = [];

    // Trait transaction (new system)
    if (this.playerState.traitTransaction) {
      const transaction = this.playerState.traitTransaction;

      if (transaction.mode === 'existing') {
        const trait = this.character!.traits.find(t => t.id === transaction.selectedTraitId);
        if (trait) {
          improvements.push(`Using trait: '${trait.name}' (Position +1) [1M]`);
        }
      } else if (transaction.mode === 'new') {
        improvements.push(`Creating new trait: '${transaction.newTrait!.name}' (Position +1) [1M]`);
      } else if (transaction.mode === 'consolidate') {
        const traitNames = transaction.consolidation!.traitIdsToRemove
          .map(id => this.character!.traits.find(t => t.id === id)?.name)
          .filter(Boolean);
        improvements.push(`Consolidating: ${traitNames.join(', ')} → '${transaction.consolidation!.newTrait.name}' (Position +1) [1M]`);
      }
    }

    // Legacy trait improvement (fallback)
    if (this.playerState.selectedTraitId && !this.playerState.traitTransaction) {
      const trait = this.character!.traits.find(t => t.id === this.playerState!.selectedTraitId);
      if (trait) {
        improvements.push(`Using '${trait.name}' trait`);
      }
    }

    // Equipment improvements
    if (this.playerState.equippedForAction?.length > 0) {
      const equipment = this.character!.equipment.filter(e =>
        this.playerState!.equippedForAction!.includes(e.id)
      );
      equipment.forEach(eq => {
        improvements.push(`Using ${eq.name}`);
      });
    }

    // Push improvement
    if (this.playerState.pushed) {
      const pushLabel = this.playerState.pushType === 'extra-die' ? '+1d' : 'Effect +1';
      improvements.push(`Push Yourself (${pushLabel}) [1M]`);
    }

    // Flashback (legacy)
    if (this.playerState.flashbackApplied) {
      improvements.push('Flashback applied');
    }

    return improvements;
  }


  /**
   * Get consequence transaction data for template
   * Resolves IDs to objects and computes derived values
   *
   * @param state - Redux state
   * @returns Consequence data for template
   */
  private _getConsequenceData(state: RootState): {
    consequenceTransaction: ConsequenceTransaction | null;
    harmTargetCharacter: Character | null;
    selectedHarmClock: Clock | null;
    selectedCrewClock: Clock | null;
    calculatedHarmSegments: number;
    calculatedMomentumGain: number;
    effectivePosition: Position;
    effectiveEffect: Effect;
    consequenceConfigured: boolean;
  } {
    const transaction = this.playerState?.consequenceTransaction;

    if (!transaction) {
      return {
        consequenceTransaction: null,
        harmTargetCharacter: null,
        selectedHarmClock: null,
        selectedCrewClock: null,
        calculatedHarmSegments: 0,
        calculatedMomentumGain: 0,
        effectivePosition: selectEffectivePosition(state, this.characterId),
        effectiveEffect: selectEffectiveEffect(state, this.characterId),
        consequenceConfigured: false,
      };
    }

    // Resolve harm target character
    let harmTargetCharacter: Character | null = null;
    if (transaction.harmTargetCharacterId) {
      harmTargetCharacter = state.characters.byId[transaction.harmTargetCharacterId] || null;
    }

    // Resolve selected harm clock
    let selectedHarmClock: Clock | null = null;
    if (transaction.harmClockId) {
      selectedHarmClock = state.clocks.byId[transaction.harmClockId] || null;
    }

    // Resolve selected crew clock
    let selectedCrewClock: Clock | null = null;
    if (transaction.crewClockId) {
      selectedCrewClock = state.clocks.byId[transaction.crewClockId] || null;
    }

    // Calculate harm segments and momentum gain using effective position
    // Note: Effect does NOT apply to consequences - only to success clocks
    const effectivePosition = selectEffectivePosition(state, this.characterId);
    const effectiveEffect = selectEffectiveEffect(state, this.characterId);
    const calculatedHarmSegments = selectConsequenceSeverity(effectivePosition);
    const calculatedMomentumGain = selectMomentumGain(effectivePosition);

    // Determine if consequence is fully configured
    let consequenceConfigured = false;
    if (transaction.consequenceType === 'harm') {
      // Harm is configured if: target selected AND clock selected
      consequenceConfigured = Boolean(transaction.harmTargetCharacterId && transaction.harmClockId);
    } else if (transaction.consequenceType === 'crew-clock') {
      // Crew clock is configured if: clock selected (segments calculated automatically from position)
      consequenceConfigured = Boolean(transaction.crewClockId);
    }

    return {
      consequenceTransaction: transaction,
      harmTargetCharacter,
      selectedHarmClock,
      selectedCrewClock,
      calculatedHarmSegments,
      calculatedMomentumGain,
      effectivePosition,
      effectiveEffect,
      consequenceConfigured,
    };
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle action selection change
   */
  private async _onActionChange(event: JQuery.ChangeEvent): Promise<void> {
    const action = (event.currentTarget as HTMLSelectElement).value;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          action,
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    const actionName = action.charAt(0).toUpperCase() + action.slice(1);
    ChatMessage.create({
      content: `<strong>${this.character!.name}</strong> selected action: <strong>${actionName}</strong>`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM position change
   */
  private async _onPositionChange(event: JQuery.ChangeEvent): Promise<void> {
    const position = (event.currentTarget as HTMLSelectElement).value as Position;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setPosition',
        payload: {
          characterId: this.characterId,
          position,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    ChatMessage.create({
      content: `GM set position to <strong>${position.charAt(0).toUpperCase() + position.slice(1)}</strong> for ${this.character!.name}`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM effect change
   */
  private async _onEffectChange(event: JQuery.ChangeEvent): Promise<void> {
    const effect = (event.currentTarget as HTMLSelectElement).value as Effect;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setEffect',
        payload: {
          characterId: this.characterId,
          effect,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    ChatMessage.create({
      content: `GM set effect to <strong>${effect.charAt(0).toUpperCase() + effect.slice(1)}</strong> for ${this.character!.name}`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle GM approve roll button
   */
  private async _onApproveRoll(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    // Toggle approval state
    const currentlyApproved = this.playerState?.gmApproved || false;
    const newApprovalState = !currentlyApproved;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setGmApproved',
        payload: {
          characterId: this.characterId,
          approved: newApprovalState,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // Post chat message
    if (newApprovalState) {
      ChatMessage.create({
        content: `<strong>GM approved ${this.character!.name}'s action plan!</strong> ✅<br>Player may now roll.`,
        speaker: ChatMessage.getSpeaker(),
      });
    } else {
      ChatMessage.create({
        content: `GM revoked approval for ${this.character!.name}'s action plan.`,
        speaker: ChatMessage.getSpeaker(),
      });
    }
  }

  /**
   * Handle Rally button
   */
  private async _onRally(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Character must be in a crew to rally');
      return;
    }

    // Check if crew has other members
    const state = game.fitgd.store.getState();
    const teammates = this.crew!.characters.filter(id => id !== this.characterId);
    if (teammates.length === 0) {
      ui.notifications?.warn('No other teammates in crew to rally');
      return;
    }

    // Open rally dialog
    const dialog = new RallyDialog(this.characterId, this.crewId);
    dialog.render(true);
  }

  /**
   * Handle Lean Into Trait button
   */
  private async _onLeanIntoTrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Character must be in a crew to lean into trait');
      return;
    }

    // Check if character has any available (non-disabled) traits
    const availableTraits = this.character!.traits.filter(t => !t.disabled);
    if (availableTraits.length === 0) {
      ui.notifications?.warn('No available traits - all traits are currently disabled');
      return;
    }

    // Open lean into trait dialog
    const dialog = new LeanIntoTraitDialog(this.characterId, this.crewId);
    dialog.render(true);
  }

  /**
   * Handle Use Trait button (merged flashback + traits)
   */
  private async _onUseTrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Character must be in a crew to use trait');
      return;
    }

    // If trait transaction already exists, cancel it (toggle off)
    if (this.playerState?.traitTransaction) {
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/clearTraitTransaction',
          payload: { characterId: this.characterId }
        },
        { affectedReduxIds: [asReduxId(this.characterId)], force: false }
      );

      ui.notifications?.info('Trait flashback canceled');
      return;
    }

    // Check if position is already controlled (can't improve further)
    if (this.playerState?.position === 'controlled') {
      ui.notifications?.warn('Position is already Controlled - cannot improve further');
      return;
    }

    // Open flashback traits dialog
    const dialog = new FlashbackTraitsDialog(this.characterId, this.crewId);
    dialog.render(true);
  }

  /**
   * Handle Equipment button
   */
  private _onEquipment(event: JQuery.ClickEvent): void {
    event.preventDefault();
    // TODO: Open Equipment dialog
    ui.notifications?.info('Equipment dialog - to be implemented');
  }

  /**
   * Handle Push (+1d) toggle
   */
  private async _onTogglePushDie(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const currentlyPushedDie = this.playerState?.pushed && this.playerState?.pushType === 'extra-die';

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setImprovements',
        payload: {
          characterId: this.characterId,
          pushed: !currentlyPushedDie,
          pushType: !currentlyPushedDie ? 'extra-die' : undefined,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], force: false }
    );
  }

  /**
   * Handle Push (Effect) toggle
   */
  private async _onTogglePushEffect(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const currentlyPushedEffect = this.playerState?.pushed && this.playerState?.pushType === 'improved-effect';

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setImprovements',
        payload: {
          characterId: this.characterId,
          pushed: !currentlyPushedEffect,
          pushType: !currentlyPushedEffect ? 'improved-effect' : undefined,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], force: false }
    );
  }

  /**
   * Handle Roll Action button (DECISION -> ROLLING)
   * Simplified: removed ROLL_CONFIRM intermediate state
   */
  private async _onRoll(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    // Validate action is selected
    if (!this.playerState?.selectedAction) {
      ui.notifications?.warn('Please select an action first');
      return;
    }

    // Get current state BEFORE any mutations
    const state = game.fitgd.store.getState();
    const playerState = state.playerRoundState.byCharacterId[this.characterId];

    // Calculate pending momentum cost (using selector)
    const momentumCost = selectMomentumCost(playerState);

    // Validate sufficient momentum BEFORE committing
    if (this.crewId && momentumCost > 0) {
      const crew = game.fitgd.api.crew.getCrew(this.crewId);
      if (crew.currentMomentum < momentumCost) {
        ui.notifications?.error(`Insufficient Momentum! Need ${momentumCost}, have ${crew.currentMomentum}`);
        return;
      }

      // Spend momentum NOW (before rolling)
      try {
        game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: momentumCost });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ui.notifications?.error(`Failed to spend Momentum: ${errorMessage}`);
        return;
      }
    }

    // Apply trait transaction (if exists)
    if (playerState?.traitTransaction) {
      try {
        // Apply trait changes (create/consolidate traits)
        // _applyTraitTransaction uses Bridge API and broadcasts internally
        await this._applyTraitTransaction(playerState.traitTransaction);

        // NOTE: Position improvement is NOT applied to playerState
        // It's ephemeral and only affects this roll's consequence calculation
        // The GM's original position setting remains unchanged
      } catch (error) {
        console.error('FitGD | Error applying trait transaction:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        ui.notifications?.error(`Failed to apply trait changes: ${errorMessage}`);
        return;
      }
    }

    // Transition to ROLLING using Bridge API
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'ROLLING',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // NOTE: Bridge API handles broadcast automatically
    // Redux subscription will handle rendering (no manual this.render() call)

    // Calculate dice pool (state declared at top of function)
    const dicePool = selectDicePool(state, this.characterId);

    // Roll dice using Foundry dice roller
    const rollResult = await this._rollDice(dicePool);
    const outcome = calculateOutcome(rollResult);

    // CRITICAL: Batch all roll outcome state changes together
    // This prevents render race conditions by ensuring single broadcast
    const rollOutcomeActions: Array<{ type: string; payload: any }> = [
      {
        type: 'playerRoundState/setRollResult',
        payload: {
          characterId: this.characterId,
          dicePool,
          rollResult,
          outcome,
        },
      },
      {
        type: 'playerRoundState/setGmApproved',
        payload: {
          characterId: this.characterId,
          approved: false, // Clear GM approval (consumed by roll)
        },
      },
    ];

    // Add state transition based on outcome
    if (outcome === 'critical' || outcome === 'success') {
      rollOutcomeActions.push({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'SUCCESS_COMPLETE',
        },
      });
    } else {
      // Partial or failure - go directly to GM_RESOLVING_CONSEQUENCE
      rollOutcomeActions.push({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'GM_RESOLVING_CONSEQUENCE',
        },
      });
    }

    // Execute all roll outcome actions as a batch (single broadcast)
    await game.fitgd.bridge.executeBatch(rollOutcomeActions, {
      affectedReduxIds: [asReduxId(this.characterId)],
      force: false,
    });

    // Post success to chat if applicable
    if (outcome === 'critical' || outcome === 'success') {
      this._postSuccessToChat(outcome, rollResult);

      // Don't auto-close - let widget linger so player can see success
      // Player can manually close the widget when ready
    }
  }

  /**
   * Roll dice and return results using Foundry's Roll class
   */
  private async _rollDice(dicePool: number): Promise<number[]> {
    let roll: Roll;
    let results: number[];

    if (dicePool === 0) {
      // Roll 2d6, take lowest (desperate roll)
      roll = await new Roll('2d6kl').evaluate();
      results = [roll.total];
    } else {
      // Roll Nd6
      roll = await new Roll(`${dicePool}d6`).evaluate();
      results = roll.dice[0].results.map(r => r.result).sort((a, b) => b - a);
    }

    // Post roll to chat
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: game.actors.get(this.characterId) }),
      flavor: `${this.character!.name} - ${this.playerState!.selectedAction} action`,
    });

    return results;
  }

  /**
   * Handle Use Stims button (from GM_RESOLVING_CONSEQUENCE state)
   */
  private async _onUseStims(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    await this._useStims();
  }

  /**
   * Handle Accept Consequences button (GM_RESOLVING_CONSEQUENCE flow)
   */
  private async _onAcceptConsequences(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    console.log('FitGD | Player accepted consequences, transitioning to GM_RESOLVING_CONSEQUENCE');

    // Transition to GM_RESOLVING_CONSEQUENCE state
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'GM_RESOLVING_CONSEQUENCE',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], force: true } // Force re-render
    );

    console.log('FitGD | Transitioned to GM_RESOLVING_CONSEQUENCE');
  }

  /* -------------------------------------------- */
  /*  GM Consequence Configuration Handlers       */
  /* -------------------------------------------- */

  /**
   * Handle consequence type selection (harm vs crew-clock)
   */
  private async _onSelectConsequenceType(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const consequenceType = (event.currentTarget as HTMLElement).dataset.type as 'harm' | 'crew-clock';

    // Build transaction with defaults
    const transaction: Partial<ConsequenceTransaction> = {
      consequenceType,
    };

    // Default harm target to acting character
    if (consequenceType === 'harm') {
      transaction.harmTargetCharacterId = this.characterId;
    }

    // Set consequence type (creates or updates transaction)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setConsequenceTransaction',
        payload: {
          characterId: this.characterId,
          transaction,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );
  }

  /**
   * Handle harm target selection button
   */
  private async _onSelectHarmTarget(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Character must be in a crew');
      return;
    }

    // Open CharacterSelectionDialog
    const dialog = new CharacterSelectionDialog(
      this.crewId,
      this.characterId,
      async (selectedCharacterId: string) => {
        // Update transaction with selected target
        await game.fitgd.bridge.execute(
          {
            type: 'playerRoundState/updateConsequenceTransaction',
            payload: {
              characterId: this.characterId,
              updates: {
                harmTargetCharacterId: selectedCharacterId,
                // Clear clock selection when target changes
                harmClockId: undefined,
              },
            },
          },
          { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
        );
      }
    );

    dialog.render(true);
  }

  /**
   * Handle harm clock selection button
   */
  private async _onSelectHarmClock(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const transaction = this.playerState?.consequenceTransaction;
    const targetCharacterId = transaction?.harmTargetCharacterId;

    if (!targetCharacterId) {
      ui.notifications?.warn('Select target character first');
      return;
    }

    // Open ClockSelectionDialog for harm clocks
    const dialog = new ClockSelectionDialog(
      targetCharacterId,
      'harm',
      async (clockId: string) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new harm clock
            const creationDialog = new ClockCreationDialog(
              targetCharacterId,
              'harm',
              async (clockData: ClockData) => {
                // Create clock via Bridge API
                const newClockId = foundry.utils.randomID();

                // Validate IDs before passing to Bridge API
                if (!targetCharacterId) {
                  console.error('FitGD | Cannot create clock: targetCharacterId is null/undefined');
                  ui.notifications?.error('Internal error: target character ID is missing');
                  return;
                }

                await game.fitgd.bridge.execute(
                  {
                    type: 'clocks/createClock',
                    payload: {
                      id: newClockId,
                      entityId: targetCharacterId,
                      clockType: 'harm',
                      subtype: clockData.name,
                      maxSegments: clockData.segments,
                      segments: 0,
                      metadata: clockData.description ? { description: clockData.description } : undefined,
                    },
                  },
                  { affectedReduxIds: [asReduxId(targetCharacterId)], silent: true }
                );

                // Update transaction with new clock
                await game.fitgd.bridge.execute(
                  {
                    type: 'playerRoundState/updateConsequenceTransaction',
                    payload: {
                      characterId: this.characterId,
                      updates: {
                        harmClockId: newClockId,
                        newHarmClockType: clockData.name,
                      },
                    },
                  },
                  { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
                );
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected
            await game.fitgd.bridge.execute(
              {
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                  characterId: this.characterId,
                  updates: {
                    harmClockId: clockId,
                  },
                },
              },
              { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
            );
          }
        } catch (error) {
          console.error('FitGD | Error in harm clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Error creating clock: ${errorMessage}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle crew clock selection button
   */
  private async _onSelectCrewClock(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const crewId = this.crewId;

    if (!crewId) {
      ui.notifications?.warn('Character must be in a crew');
      return;
    }

    // Open ClockSelectionDialog for crew clocks (non-harm)
    const dialog = new ClockSelectionDialog(
      crewId,
      'crew',
      async (clockId: string) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new crew clock
            const creationDialog = new ClockCreationDialog(
              crewId,
              'progress',
              async (clockData: ClockData) => {
                // Create clock via Bridge API
                const newClockId = foundry.utils.randomID();

                // Validate IDs before passing to Bridge API
                if (!crewId) {
                  console.error('FitGD | Cannot create clock: crewId is null/undefined');
                  ui.notifications?.error('Internal error: crew ID is missing');
                  return;
                }

                await game.fitgd.bridge.execute(
                  {
                    type: 'clocks/createClock',
                    payload: {
                      id: newClockId,
                      entityId: crewId,
                      clockType: 'progress', // Generic crew clock
                      subtype: clockData.name,
                      maxSegments: clockData.segments,
                      segments: 0,
                      metadata: {
                        category: clockData.category,
                        isCountdown: clockData.isCountdown,
                        description: clockData.description,
                      },
                    },
                  },
                  { affectedReduxIds: [asReduxId(crewId)], silent: true }
                );

                // Update transaction with new clock
                await game.fitgd.bridge.execute(
                  {
                    type: 'playerRoundState/updateConsequenceTransaction',
                    payload: {
                      characterId: this.characterId,
                      updates: {
                        crewClockId: newClockId,
                      },
                    },
                  },
                  { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
                );
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected
            await game.fitgd.bridge.execute(
              {
                type: 'playerRoundState/updateConsequenceTransaction',
                payload: {
                  characterId: this.characterId,
                  updates: {
                    crewClockId: clockId,
                  },
                },
              },
              { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
            );
          }
        } catch (error) {
          console.error('FitGD | Error in crew clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Error creating clock: ${errorMessage}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle GM approve consequence button
   */
  private async _onApproveConsequence(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const transaction = this.playerState?.consequenceTransaction;
    if (!transaction) {
      ui.notifications?.error('No consequence configured');
      return;
    }

    // Validate transaction is complete
    if (transaction.consequenceType === 'harm') {
      if (!transaction.harmTargetCharacterId || !transaction.harmClockId) {
        ui.notifications?.warn('Please select target character and harm clock');
        return;
      }
    } else if (transaction.consequenceType === 'crew-clock') {
      if (!transaction.crewClockId) {
        ui.notifications?.warn('Please select a crew clock');
        return;
      }
    }

    // Transition to APPLYING_EFFECTS to apply the consequence
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'APPLYING_EFFECTS',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );

    // Apply the consequence (harm or clock)
    await this._applyConsequenceTransaction(transaction);

    // Add momentum gain
    const state = game.fitgd.store.getState();
    const effectivePosition = selectEffectivePosition(state, this.characterId);
    const momentumGain = selectMomentumGain(effectivePosition);
    if (this.crewId && momentumGain > 0) {
      game.fitgd.api.crew.addMomentum({ crewId: this.crewId, amount: momentumGain });
      await game.fitgd.saveImmediate(); // TODO: Refactor to Bridge API
    }

    // Clear transaction and transition through proper state machine
    // APPLYING_EFFECTS → TURN_COMPLETE → IDLE_WAITING
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/clearConsequenceTransaction',
        payload: { characterId: this.characterId },
      },
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      },
    ], {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Transition to IDLE_WAITING (complete the turn)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'IDLE_WAITING',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );

    // Close widget after brief delay
    setTimeout(() => this.close(), 500);
  }

  /**
   * Apply consequence transaction (harm or crew clock)
   * @param transaction
   */
  private async _applyConsequenceTransaction(transaction: ConsequenceTransaction): Promise<void> {
    const state = game.fitgd.store.getState();

    if (transaction.consequenceType === 'harm') {
      // Apply harm to selected clock
      // Note: Effect does NOT apply to consequences - only position matters
      const effectivePosition = selectEffectivePosition(state, this.characterId);
      const segments = selectConsequenceSeverity(effectivePosition);

      await game.fitgd.bridge.execute(
        {
          type: 'clocks/addSegments',
          payload: {
            clockId: transaction.harmClockId,
            amount: segments,
          },
        },
        { affectedReduxIds: [transaction.harmTargetCharacterId!], silent: true }
      );

      ui.notifications?.info(`Applied ${segments} harm`);

    } else if (transaction.consequenceType === 'crew-clock') {
      // Advance crew clock using standardized position-based values
      const effectivePosition = selectEffectivePosition(state, this.characterId);
      const segments = selectConsequenceSeverity(effectivePosition);

      await game.fitgd.bridge.execute(
        {
          type: 'clocks/addSegments',
          payload: {
            clockId: transaction.crewClockId,
            amount: segments,
          },
        },
        { affectedReduxIds: [this.crewId!], silent: true }
      );

      ui.notifications?.info(`Advanced crew clock by ${segments} segments (${effectivePosition})`);
    }
  }

  /**
   * Handle player using stims from GM phase
   */
  private async _onUseStimsGMPhase(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    await this._useStims();
  }

  /**
   * Shared stims logic (called from GM_RESOLVING_CONSEQUENCE state)
   * Validates addiction status, advances addiction clock, and sets up reroll
   */
  private async _useStims(): Promise<void> {
    if (!this.crewId) {
      ui.notifications?.error('Character must be in a crew to use stims');
      return;
    }

    // Check if already used stims this action
    if (this.playerState?.stimsUsedThisAction) {
      ui.notifications?.warn('Stims already used this action - cannot use again!');
      return;
    }

    const state = game.fitgd.store.getState();
    const crew = state.crews.byId[this.crewId];

    // Check if ANY character in crew has filled addiction clock (team-wide lock)
    let teamAddictionLocked = false;
    for (const characterId of crew.characters) {
      const characterAddictionClock = Object.values(state.clocks.byId).find(
        clock => clock.entityId === characterId && clock.clockType === 'addiction'
      );
      if (characterAddictionClock && characterAddictionClock.segments >= characterAddictionClock.maxSegments) {
        teamAddictionLocked = true;
        break;
      }
    }

    if (teamAddictionLocked) {
      ui.notifications?.error('Stims are LOCKED due to crew addiction! Cannot use stims.');
      // UI should prevent this from being clicked, but catching it here as a safety check
      return;
    }

    // Find this character's addiction clock
    const addictionClock = Object.values(state.clocks.byId).find(
      clock => clock.entityId === this.characterId && clock.clockType === 'addiction'
    );

    // Create addiction clock if it doesn't exist
    let addictionClockId = addictionClock?.id;
    if (!addictionClock) {
      addictionClockId = foundry.utils.randomID();
      await game.fitgd.bridge.execute(
        {
          type: 'clocks/createClock',
          payload: {
            id: addictionClockId,
            entityId: this.characterId, // Per-character, not per-crew
            clockType: 'addiction',
            subtype: 'Addiction',
            maxSegments: DEFAULT_CONFIG.clocks.addiction.segments,
            segments: 0,
          },
        },
        { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
      );

      ui.notifications?.info('Addiction clock created');
    }

    // Roll d6 to determine addiction advance
    const addictionRoll = await new Roll('1d6').evaluate();
    const addictionAmount = addictionRoll.total;

    // Post addiction roll to chat
    await addictionRoll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `${this.character!.name} - Addiction Roll (Stims)`,
    });

    // Advance addiction clock by roll result
    await game.fitgd.bridge.execute(
      {
        type: 'clocks/addSegments',
        payload: {
          clockId: addictionClockId!,
          amount: addictionAmount,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );

    // Get updated clock state
    const updatedState = game.fitgd.store.getState();
    const updatedClock = updatedState.clocks.byId[addictionClockId!];
    const newSegments = updatedClock.segments;

    ui.notifications?.warn(`Addiction clock: ${newSegments}/${updatedClock.maxSegments} (+${addictionAmount})`);

    // Check if addiction clock just filled
    if (newSegments >= updatedClock.maxSegments) {
      // Add "Addict" trait to character
      const addictTrait: Trait = {
        id: foundry.utils.randomID(),
        name: 'Addict',
        description: 'Addicted to combat stims. Stims are now locked for the entire crew.',
        category: 'scar',
        disabled: false,
        acquiredAt: Date.now(),
      };

      await game.fitgd.bridge.execute(
        {
          type: 'characters/addTrait',
          payload: {
            characterId: this.characterId,
            trait: addictTrait,
          },
        },
        { affectedReduxIds: [asReduxId(this.characterId)], force: true }
      );

      ui.notifications?.error(`${this.character!.name} is now an ADDICT! Stims are LOCKED for the crew.`);

      // Post to chat
      ChatMessage.create({
        content: `<div class="fitgd-addiction-warning">
          <h3>⚠️ ADDICTION FILLS!</h3>
          <p><strong>${this.character!.name}</strong> has become addicted to combat stims!</p>
          <p>Trait Added: <strong>Addict</strong></p>
          <p><em>Stims are now locked for the entire crew.</em></p>
        </div>`,
        speaker: ChatMessage.getSpeaker(),
      });
    }

    // Mark stims used this action
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setStimsUsed',
        payload: {
          characterId: this.characterId,
          used: true,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );

    // Clear consequence transaction (if any)
    if (this.playerState?.consequenceTransaction) {
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/clearConsequenceTransaction',
          payload: { characterId: this.characterId },
        },
        { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
      );
    }

    // Transition to STIMS_ROLLING state (brief visual state)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'STIMS_ROLLING',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
    );

    ui.notifications?.info('Stims used! Re-rolling with same plan...');

    // Post to chat
    ChatMessage.create({
      content: `<div class="fitgd-stims-use">
        <h3>💉 STIMS USED!</h3>
        <p><strong>${this.character!.name}</strong> used combat stims!</p>
        <p><em>Addiction clock advanced. Re-rolling...</em></p>
      </div>`,
      speaker: ChatMessage.getSpeaker(),
    });

    // Brief delay to show STIMS_ROLLING state, then re-roll
    setTimeout(async () => {
      // Transition to ROLLING
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'ROLLING',
          },
        },
        { affectedReduxIds: [asReduxId(this.characterId)], silent: true }
      );

      // Get current state to preserve dice pool and plan
      const currentState = game.fitgd.store.getState();
      const playerState = currentState.playerRoundState.byCharacterId[this.characterId];
      const dicePool = selectDicePool(currentState, this.characterId);

      console.log('FitGD | Stims reroll - dice pool:', dicePool, 'action:', playerState.selectedAction);

      // Roll dice using Foundry dice roller (same as original roll)
      const rollResult = await this._rollDice(dicePool);
      const outcome = calculateOutcome(rollResult);

      // Batch roll outcome state changes
      const rollOutcomeActions: Array<{ type: string; payload: any }> = [
        {
          type: 'playerRoundState/setRollResult',
          payload: {
            characterId: this.characterId,
            dicePool,
            rollResult,
            outcome,
          },
        },
      ];

      // Add state transition based on outcome
      if (outcome === 'critical' || outcome === 'success') {
        rollOutcomeActions.push({
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'SUCCESS_COMPLETE',
          },
        });
      } else {
        // Partial or failure - go back to GM_RESOLVING_CONSEQUENCE
        rollOutcomeActions.push({
          type: 'playerRoundState/transitionState',
          payload: {
            characterId: this.characterId,
            newState: 'GM_RESOLVING_CONSEQUENCE',
          },
        });
      }

      // Execute all roll outcome actions as a batch
      await game.fitgd.bridge.executeBatch(rollOutcomeActions, {
        affectedReduxIds: [asReduxId(this.characterId)],
        force: false,
      });

      // Post success to chat if applicable
      if (outcome === 'critical' || outcome === 'success') {
        this._postSuccessToChat(outcome, rollResult);

        // Don't auto-close - let widget linger so player can see success
        // Player can manually close the widget when ready
      }
    }, 500);
  }

  /* Legacy handlers removed - consequence resolution now handled through GM_RESOLVING_CONSEQUENCE flow */

  /**
   * Handle Cancel button
   */
  private async _onCancel(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    // Batch reset and transition to DECISION state
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/resetPlayerState',
        payload: { characterId: this.characterId },
      },
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'DECISION_PHASE',
        },
      }
    ], {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true, // Silent: subscription handles render
    });
  }

  /**
   * Post success message to chat
   */
  private _postSuccessToChat(outcome: 'critical' | 'success', rollResult: number[]): void {
    const outcomeText = outcome === 'critical' ? 'Critical Success!' : 'Success!';
    const diceText = rollResult.join(', ');

    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: this.character!.name }),
      content: `
        <div class="fitgd-roll-result">
          <h3>${outcomeText}</h3>
          <p>Rolled: ${diceText}</p>
          <p>Action: ${this.playerState!.selectedAction}</p>
        </div>
      `,
    });
  }

  /**
   * End turn and close widget
   */
  private async _endTurn(): Promise<void> {
    // Batch transition to TURN_COMPLETE and reset player state
    await game.fitgd.bridge.executeBatch([
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'TURN_COMPLETE',
        },
      },
      {
        type: 'playerRoundState/resetPlayerState',
        payload: {
          characterId: this.characterId,
        },
      }
    ], {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true, // Silent: subscription handles render
    });

    // Close widget
    this.close();

    // TODO: Advance combat turn order
  }
}
