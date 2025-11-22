/**
 * Player Action Widget
 *
 * A persistent widget that appears when it's a player's turn in an encounter.
 * Drives the action resolution flow through the state machine.
 */

import type { Character, Equipment } from '@/types/character';
import type { Crew } from '@/types/crew';
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';
import type { PlayerRoundState, Position, Effect } from '@/types/playerRoundState';
import type { TraitTransaction, ConsequenceTransaction } from '@/types/playerRoundState';

import { selectCanUseRally } from '@/selectors/characterSelectors';
import { selectStimsAvailable } from '@/selectors/clockSelectors';

import { selectActiveEquipment, selectPassiveEquipment, selectCurrentLoad, selectEquipmentEffect, isEquipmentConsumable } from '@/selectors/equipmentSelectors';
import { selectDicePool, selectMomentumCost, selectHarmClocksWithStatus, selectIsDying, selectEffectivePosition, selectEffectiveEffect, selectEquipmentEffects, selectEquipmentModifiedPosition, selectEquipmentModifiedEffect } from '@/selectors/playerRoundStateSelectors';

import { DEFAULT_CONFIG } from '@/config/gameConfig';

import { calculateOutcome } from '@/utils/diceRules';
import { improvePosition, worsenPosition, improveEffect, worsenEffect } from '@/utils/positionEffectHelpers';

import { FlashbackTraitsDialog } from '../dialogs/FlashbackTraitsDialog';
import { ClockSelectionDialog, CharacterSelectionDialog, ClockCreationDialog, LeanIntoTraitDialog, RallyDialog } from '../dialogs/index';
import { asReduxId } from '../types/ids';
import { ConsequenceResolutionHandler } from '../handlers/consequenceResolutionHandler';
import { StimsHandler } from '../handlers/stimsHandler';
import { DiceRollingHandler } from '../handlers/diceRollingHandler';
import { TraitHandler } from '../handlers/traitHandler';
import { RallyHandler } from '../handlers/rallyHandler';
import { TraitImprovementHandler } from '../handlers/traitImprovementHandler';
import { ConsequenceDataResolver } from '../handlers/consequenceDataResolver';
import { LeanIntoTraitHandler } from '../handlers/leanIntoTraitHandler';
import { UseTraitHandler } from '../handlers/useTraitHandler';
import { PushHandler } from '../handlers/pushHandler';
import { ConsequenceApplicationHandler } from '../handlers/consequenceApplicationHandler';
import { StimsWorkflowHandler } from '../handlers/stimsWorkflowHandler';

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

  // Available approaches
  approaches: string[];

  // Equipment for selection
  equippedItems: Equipment[];
  activeEquipmentItem?: Equipment;
  passiveEquipment: Equipment[];

  // Equipment effects from selected items
  equipmentEffects?: {
    diceBonus?: number;
    dicePenalty?: number;
    positionBonus?: number;
    positionPenalty?: number;
    effectBonus?: number;
    effectPenalty?: number;
  };

  // Equipment-modified position and effect
  equipmentModifiedPosition?: Position;
  equipmentModifiedEffect?: Effect;

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
  private consequenceHandler: ConsequenceResolutionHandler | null = null;
  private stimsHandler: StimsHandler | null = null;
  private diceRollingHandler: DiceRollingHandler | null = null;
  private traitHandler: TraitHandler | null = null;
  private rallyHandler: RallyHandler | null = null;
  private traitImprovementHandler: TraitImprovementHandler | null = null;
  private consequenceDataResolver: ConsequenceDataResolver | null = null;
  private leanIntoTraitHandler: LeanIntoTraitHandler | null = null;
  private useTraitHandler: UseTraitHandler | null = null;
  private pushHandler: PushHandler | null = null;
  private consequenceApplicationHandler: ConsequenceApplicationHandler | null = null;
  private stimsWorkflowHandler: StimsWorkflowHandler | null = null;

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

  async _render(force: boolean, options: any): Promise<void> {
    // @ts-ignore - Foundry's Application class has _render but it's not in the type definitions
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

    console.log('FitGD | Widget getData() - Current state:', this.playerState?.state, 'isGM:', game.user?.isGM);

    // Initialize handlers
    this.consequenceHandler = new ConsequenceResolutionHandler({
      characterId: this.characterId,
      crewId: this.crewId,
      playerState: this.playerState,
    });

    this.stimsHandler = new StimsHandler({
      characterId: this.characterId,
      crewId: this.crewId,
      characterName: this.character?.name,
    });

    this.diceRollingHandler = new DiceRollingHandler({
      characterId: this.characterId,
      crewId: this.crewId,
    });

    this.traitHandler = new TraitHandler({
      characterId: this.characterId,
      characterName: this.character?.name,
    });

    this.rallyHandler = new RallyHandler({
      characterId: this.characterId,
      crewId: this.crewId,
    });

    this.traitImprovementHandler = new TraitImprovementHandler({
      character: this.character,
    });

    this.consequenceDataResolver = new ConsequenceDataResolver({
      characterId: this.characterId,
    });

    this.leanIntoTraitHandler = new LeanIntoTraitHandler({
      character: this.character,
      crewId: this.crewId,
    });

    this.useTraitHandler = new UseTraitHandler({
      characterId: this.characterId,
      crewId: this.crewId,
    });

    this.pushHandler = new PushHandler({
      characterId: this.characterId,
    });

    this.consequenceApplicationHandler = new ConsequenceApplicationHandler({
      characterId: this.characterId,
      crewId: this.crewId,
    });

    this.stimsWorkflowHandler = new StimsWorkflowHandler({
      characterId: this.characterId,
      characterName: this.character?.name,
      crewId: this.crewId,
    });

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
      isConsequenceChoice: this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE',

      // Available approaches
      approaches: Object.keys(this.character.approaches),

      // Equipment for selection (excluding depleted consumables - they cannot be used once consumed)
      equippedItems: selectActiveEquipment(this.character).filter(
        item => !item.depleted // Depleted consumables cannot be selected
      ),
      activeEquipmentItem: this.playerState?.equippedForAction?.[0]
        ? this.character.equipment.find(e => e.id === this.playerState!.equippedForAction![0])
        : undefined,

      // Harm clocks (for display) - using selector
      harmClocks: selectHarmClocksWithStatus(state, this.characterId),
      isDying: selectIsDying(state, this.characterId),

      // Current momentum
      momentum: this.crew?.currentMomentum || 0,
      maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,

      // Rally availability - using selector
      canRally: this.crewId ? selectCanUseRally(state, this.characterId) : false,

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
      isGM: game.user?.isGM || false,

      // Stims availability (inverted: selector returns "available", template needs "locked")
      stimsLocked: !selectStimsAvailable(state),

      // Passive equipment for display
      passiveEquipment: selectPassiveEquipment(this.character),

      // Equipment effects from selected items (using new selectors)
      equipmentEffects: selectEquipmentEffects(state, this.characterId),

      // Equipment-modified position and effect (using new selectors)
      equipmentModifiedPosition: selectEquipmentModifiedPosition(state, this.characterId),
      equipmentModifiedEffect: selectEquipmentModifiedEffect(state, this.characterId),

      // Consequence transaction data (for GM_RESOLVING_CONSEQUENCE state)
      ...(this.playerState?.state === 'GM_RESOLVING_CONSEQUENCE' ? this._getConsequenceData(state) : {}),
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Approach selection
    html.find('.approach-select').change(this._onApproachChange.bind(this));

    // Roll Mode selection
    html.find('[data-action="set-mode"]').click(this._onRollModeChange.bind(this));

    // Secondary Approach selection
    html.find('.secondary-approach-select').change(this._onSecondaryApproachChange.bind(this));

    // Active Equipment selection
    html.find('.active-equipment-select').change(this._onActiveEquipmentChange.bind(this));
    html.find('[data-action="add-flashback-item"]').click(this._onAddFlashbackItem.bind(this));

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
    if (!this.traitHandler) return;

    // Create trait actions based on transaction mode
    const actions = this.traitHandler.createTraitActions(transaction);

    // Execute all trait changes as a batch (single broadcast, prevents render race)
    if (actions.length > 0) {
      await game.fitgd.bridge.executeBatch(actions, {
        affectedReduxIds: [asReduxId(this.traitHandler.getAffectedReduxId())],
        force: true, // Force full re-render to show new traits
      });
    }
  }

  /**
   * Compute improvements preview text
   */
  private _computeImprovements(): string[] {
    if (!this.traitImprovementHandler) return [];
    return this.traitImprovementHandler.computeImprovements(this.playerState);
  }


  /**
   * Get consequence transaction data for template
   * Resolves IDs to objects and computes derived values
   *
   * @param state - Redux state
   * @returns Consequence data for template
   */
  private _getConsequenceData(state: RootState) {
    if (!this.consequenceDataResolver) {
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
    return this.consequenceDataResolver.resolveConsequenceData(state, this.playerState);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle approach selection change
   */
  private async _onApproachChange(event: JQuery.ChangeEvent): Promise<void> {
    const approach = (event.currentTarget as HTMLSelectElement).value;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          approach,
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients including GM
    );

    // Post chat message
    const approachName = approach.charAt(0).toUpperCase() + approach.slice(1);
    ChatMessage.create({
      content: `<strong>${this.character!.name}</strong> selected approach: <strong>${approachName}</strong>`,
      speaker: ChatMessage.getSpeaker(),
    });
  }

  /**
   * Handle roll mode change
   */
  private async _onRollModeChange(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    const mode = event.currentTarget.dataset.mode as 'synergy' | 'equipment';

    // Toggle mode: click to activate, click again to deactivate
    const newMode = this.playerState?.rollMode === mode ? undefined : mode;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          approach: this.playerState?.selectedApproach || 'force',
          rollMode: newMode,
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
    );
  }

  /**
   * Handle secondary approach change
   */
  private async _onSecondaryApproachChange(event: JQuery.ChangeEvent): Promise<void> {
    const secondaryApproach = (event.currentTarget as HTMLSelectElement).value;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          approach: this.playerState?.selectedApproach || 'force',
          secondaryApproach: secondaryApproach || undefined,
          rollMode: 'synergy', // Ensure synergy mode stays active
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
    );
  }

  /**
   * Handle active equipment change
   *
   * When equipment is selected for an action:
   * 1. Update the action plan with selected equipment
   * 2. If it's a consumable, mark it as depleted (single-use items are consumed immediately)
   *
   * Note: Equipment locking happens when equipped, not when selected for an action
   */
  private async _onActiveEquipmentChange(event: JQuery.ChangeEvent): Promise<void> {
    const equipmentId = (event.currentTarget as HTMLSelectElement).value;

    const actions = [
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.characterId,
          approach: this.playerState?.selectedApproach || 'force',
          equippedForAction: equipmentId ? [equipmentId] : [],
          rollMode: 'equipment', // Ensure mode stays equipment
          position: this.playerState?.position || 'risky',
          effect: this.playerState?.effect || 'standard',
        },
      } as any,
    ];

    // If a consumable is selected, mark it as depleted
    // (consumables are single-use and consumed immediately when selected)
    if (equipmentId && this.character) {
      const equipment = this.character.equipment.find(e => e.id === equipmentId);
      if (equipment && isEquipmentConsumable(equipment)) {
        actions.push({
          type: 'characters/markEquipmentDepleted',
          payload: {
            characterId: this.characterId,
            equipmentId,
          },
        } as any);
      }
    }

    await game.fitgd.bridge.executeBatch(
      actions,
      { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
    );
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

    if (!this.rallyHandler) return;

    // Validate rally eligibility
    const validation = this.rallyHandler.validateRally(this.crew);
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to rally',
        'no-teammates': 'No other teammates in crew to rally',
      };
      ui.notifications?.warn(messages[validation.reason!]);
      return;
    }

    // Open rally dialog
    const dialog = new RallyDialog(this.characterId, this.rallyHandler.getCrewId()!);
    dialog.render(true);
  }

  /**
   * Handle Lean Into Trait button
   */
  private async _onLeanIntoTrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.leanIntoTraitHandler) return;

    // Validate lean into trait eligibility
    const validation = this.leanIntoTraitHandler.validateLeanIntoTrait();
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to lean into trait',
        'no-available-traits': 'No available traits - all traits are currently disabled',
      };
      ui.notifications?.warn(messages[validation.reason!]);
      return;
    }

    // Open lean into trait dialog
    const dialog = new LeanIntoTraitDialog(this.characterId, this.leanIntoTraitHandler.getCrewId()!);
    dialog.render(true);
  }

  /**
   * Handle Use Trait button (merged flashback + traits)
   */
  private async _onUseTrait(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.useTraitHandler) return;

    // Validate use trait eligibility
    const validation = this.useTraitHandler.validateUseTrait(this.playerState);
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to use trait',
        'position-controlled': 'Position is already Controlled - cannot improve further',
      };
      ui.notifications?.warn(messages[validation.reason!]);
      return;
    }

    // If trait transaction already exists, cancel it (toggle off)
    if (this.useTraitHandler.hasActiveTraitTransaction(this.playerState)) {
      await game.fitgd.bridge.execute(
        this.useTraitHandler.createClearTraitTransactionAction(),
        { affectedReduxIds: [asReduxId(this.useTraitHandler.getAffectedReduxId())], force: false }
      );

      ui.notifications?.info('Trait flashback canceled');
      return;
    }

    // Open flashback traits dialog
    const dialog = new FlashbackTraitsDialog(this.characterId, this.useTraitHandler.getCrewId()!);
    dialog.render(true);
  }

  /**
   * Handle Add Flashback Item button
   */
  private async _onAddFlashbackItem(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    const content = `
      <form>
        <div class="form-group">
          <label>Item Name</label>
          <input type="text" name="name" placeholder="e.g. Heavy Blaster" autofocus style="width: 100%; margin-bottom: 10px;">
        </div>
        <div class="form-group">
          <label>Tags</label>
          <input type="text" name="tags" value="bonus" placeholder="comma separated" style="width: 100%; margin-bottom: 10px;">
          <p class="notes" style="font-size: 0.8em; color: #666;">Default "bonus" tag grants +1d.</p>
        </div>
        <div class="form-group">
          <label>Momentum Cost</label>
          <input type="number" name="cost" value="1" min="0" max="10" style="width: 100%;">
          <p class="notes" style="font-size: 0.8em; color: #666;">Usually 0 for Standard, 1 for Fine/Special.</p>
        </div>
      </form>
    `;

    new Dialog({
      title: "Flashback Item",
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: "Add Item",
          callback: async (html: JQuery | HTMLElement | undefined) => {
            if (!html) return;
            const $html = $(html as HTMLElement);
            const name = $html.find('[name="name"]').val() as string;
            const tagsStr = $html.find('[name="tags"]').val() as string;
            const cost = parseInt($html.find('[name="cost"]').val() as string) || 0;
            const tags = tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t);

            if (!name) return;

            // Check Load Limit
            const currentLoad = selectCurrentLoad(this.character!);
            const maxLoad = DEFAULT_CONFIG.character.maxLoad;
            if (currentLoad >= maxLoad) {
              ui.notifications?.error(`Cannot equip item: Load limit reached (${currentLoad}/${maxLoad})`);
              return;
            }

            // Check Momentum
            const currentMomentum = this.crew?.currentMomentum || 0;
            if (cost > 0 && currentMomentum < cost) {
              ui.notifications?.error(`Insufficient Momentum: Need ${cost}, have ${currentMomentum}`);
              return;
            }

            // Create ID for new item
            const itemId = foundry.utils.randomID();

            // Build actions
            const actions = [];

            // Spend Momentum
            if (cost > 0 && this.crewId) {
              actions.push({
                type: 'crews/spendMomentum',
                payload: {
                  crewId: this.crewId,
                  amount: cost
                }
              });
            }

            // Add item
            actions.push({
              type: 'characters/addEquipment',
              payload: {
                characterId: this.characterId,
                item: {
                  id: itemId,
                  name: name,
                  load: 1,
                  tags: tags
                }
              }
            });

            // Equip item
            actions.push({
              type: 'characters/toggleEquipped',
              payload: {
                characterId: this.characterId,
                itemId: itemId
              }
            });

            // Set as active for this action
            actions.push({
              type: 'playerRoundState/setActionPlan',
              payload: {
                characterId: this.characterId,
                equippedForAction: [itemId]
              }
            });

            // Execute batch
            await game.fitgd.bridge.executeBatch(
              actions,
              { affectedReduxIds: [asReduxId(this.characterId), this.crewId ? asReduxId(this.crewId) : asReduxId(this.characterId)] }
            );

            ui.notifications?.info(`Added and equipped ${name} (-${cost}M)`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "add"
    }).render(true);
  }

  /**
   * Handle Equipment button
   */
  private _onEquipment(event: JQuery.ClickEvent): void {
    event.preventDefault();

    const equipment = this.character?.equipment || [];
    // character.equipped is not a set of IDs, we must derive it from equipment list
    const equippedIds = new Set(equipment.filter(e => e.equipped).map(e => e.id));

    // Calculate load based on count (1 item = 1 load for now, as per slice logic)
    const currentLoad = selectCurrentLoad(this.character!);
    const maxLoad = DEFAULT_CONFIG.character.maxLoad;

    const content = `
      <div class="equipment-manager">
        <p><strong>Load:</strong> ${currentLoad}/${maxLoad}</p>
        <form>
          <ul style="list-style: none; padding: 0;">
            ${equipment.map(item => {
      const isEquipped = equippedIds.has(item.id);
      const loadCost = 1; // Default to 1 load per item
      // Disable if not equipped and at max load
      const disabled = !isEquipped && currentLoad + loadCost > maxLoad;

      const isBonus = item.tags?.includes('bonus');
      return `
                <li style="margin-bottom: 5px; display: flex; align-items: center;">
                  <input type="checkbox" name="equipped" value="${item.id}" 
                    ${isEquipped ? 'checked' : ''} 
                    ${disabled ? 'disabled' : ''}
                    style="margin-right: 8px;">
                  <span style="${disabled ? 'opacity: 0.5' : ''}">
                    ${item.name} (${loadCost} load) ${isBonus ? '<span class="tag" style="font-size:0.8em; background:#333; color:#fff; padding:1px 4px; border-radius:3px;">Bonus</span>' : ''}
                  </span>
                </li>
              `;
    }).join('')}
          </ul>
        </form>
        ${equipment.length === 0 ? '<p>No equipment available.</p>' : ''}
      </div>
    `;

    new Dialog({
      title: "Manage Loadout",
      content: content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Loadout",
          callback: async (html: JQuery | HTMLElement | undefined) => {
            if (!html) return;
            const $html = $(html as HTMLElement);
            const checkboxes = $html.find('input[name="equipped"]');
            const newEquippedIds = new Set<string>();

            checkboxes.each((_, el) => {
              if ((el as HTMLInputElement).checked) {
                newEquippedIds.add((el as HTMLInputElement).value);
              }
            });

            // Calculate changes
            const toEquip = [...newEquippedIds].filter(id => !equippedIds.has(id));
            const toUnequip = [...equippedIds].filter(id => !newEquippedIds.has(id));

            const actions: any[] = [];

            // Unequip first to free up load
            toUnequip.forEach(itemId => {
              actions.push({
                type: 'characters/toggleEquipped',
                payload: {
                  characterId: this.characterId,
                  equipmentId: itemId,
                  equipped: false
                }
              });
            });

            // Then equip
            toEquip.forEach(itemId => {
              actions.push({
                type: 'characters/toggleEquipped',
                payload: {
                  characterId: this.characterId,
                  equipmentId: itemId,
                  equipped: true
                }
              });
            });

            if (actions.length > 0) {
              await game.fitgd.bridge.executeBatch(
                actions,
                { affectedReduxIds: [asReduxId(this.characterId)] }
              );
              ui.notifications?.info(`Updated loadout`);
            }

            // After equipping items, set roll mode to "equipment" and select first equipped item
            if (newEquippedIds.size > 0) {
              const firstEquippedId = [...newEquippedIds][0];
              await game.fitgd.bridge.execute(
                {
                  type: 'playerRoundState/setActionPlan',
                  payload: {
                    characterId: this.characterId,
                    approach: this.playerState?.selectedApproach || 'force',
                    rollMode: 'equipment',
                    equippedForAction: [firstEquippedId],
                    position: this.playerState?.position || 'risky',
                    effect: this.playerState?.effect || 'standard',
                  },
                },
                { affectedReduxIds: [asReduxId(this.characterId)] }
              );
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }).render(true);
  }
  private async _onTogglePushDie(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.pushHandler) return;

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      this.pushHandler.createTogglePushDieAction(this.playerState),
      { affectedReduxIds: [asReduxId(this.pushHandler.getAffectedReduxId())], force: false }
    );
  }

  /**
   * Handle Push (Effect) toggle
   */
  private async _onTogglePushEffect(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.pushHandler) return;

    // Use Bridge API to dispatch, broadcast, and refresh
    await game.fitgd.bridge.execute(
      this.pushHandler.createTogglePushEffectAction(this.playerState),
      { affectedReduxIds: [asReduxId(this.pushHandler.getAffectedReduxId())], force: false }
    );
  }

  /**
   * Handle Roll Action button (DECISION -> ROLLING)
   * Simplified: removed ROLL_CONFIRM intermediate state
   */
  private async _onRoll(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.diceRollingHandler) return;

    try {
      const state = game.fitgd.store.getState();
      const playerState = state.playerRoundState.byCharacterId[this.characterId];
      const crew = this.crew;

      console.log('FitGD | _onRoll - playerState:', playerState);

      // Validate roll can proceed
      const validation = this.diceRollingHandler.validateRoll(state, playerState, crew);
      if (!validation.isValid) {
        if (validation.reason === 'no-action-selected') {
          ui.notifications?.warn('Please select an action first');
        } else if (validation.reason === 'insufficient-momentum') {
          ui.notifications?.error(
            `Insufficient Momentum! Need ${validation.momentumNeeded}, have ${validation.momentumAvailable}`
          );
        }
        return;
      }

      // Spend momentum NOW (before rolling)
      const momentumCost = this.diceRollingHandler.calculateMomentumCost(playerState);
      if (this.crewId && momentumCost > 0) {
        try {
          game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: momentumCost });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Failed to spend Momentum: ${errorMessage} `);
          return;
        }
      }

      // Apply trait transaction (if exists)
      if (playerState?.traitTransaction) {
        try {
          await this._applyTraitTransaction(playerState.traitTransaction);
          // NOTE: Position improvement is NOT applied to playerState
          // It's ephemeral and only affects this roll's consequence calculation
        } catch (error) {
          console.error('FitGD | Error applying trait transaction:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Failed to apply trait changes: ${errorMessage} `);
          return;
        }
      }

      // Transition to ROLLING
      console.log('FitGD | Transitioning to ROLLING state');
      await game.fitgd.bridge.execute(
        this.diceRollingHandler.createTransitionToRollingAction(),
        { affectedReduxIds: [asReduxId(this.diceRollingHandler.getAffectedReduxId())], silent: true }
      );

      // Roll dice
      const dicePool = this.diceRollingHandler.calculateDicePool(state);
      console.log('FitGD | Rolling with dicePool:', dicePool);
      const rollResult = await this._rollDice(dicePool);
      console.log('FitGD | Roll result:', rollResult);
      const outcome = calculateOutcome(rollResult);
      console.log('FitGD | Roll outcome:', outcome);

      // Execute all roll outcome actions as batch
      const rollBatch = this.diceRollingHandler.createRollOutcomeBatch(dicePool, rollResult, outcome);

      // Lock equipment used in this roll
      if (playerState?.equippedForAction?.length) {
        playerState.equippedForAction.forEach((equipmentId) => {
          rollBatch.push({
            type: 'characters/markEquipmentUsed',
            payload: {
              characterId: this.characterId,
              equipmentId,
            },
          });
        });
      }

      console.log('FitGD | Roll outcome batch actions:', rollBatch);

      await game.fitgd.bridge.executeBatch(
        rollBatch,
        {
          affectedReduxIds: [asReduxId(this.diceRollingHandler.getAffectedReduxId())],
          force: false,
        }
      );

      console.log('FitGD | Roll outcome batch executed');

      // Post success to chat if applicable
      if (outcome === 'critical' || outcome === 'success') {
        this._postSuccessToChat(outcome, rollResult);
      }
    } catch (error) {
      console.error('FitGD | Error in _onRoll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Roll failed: ${errorMessage}`);
    }
  }

  /**
   * Roll dice and return results using Foundry's Roll class
   */
  private async _rollDice(dicePool: number): Promise<number[]> {
    let roll: Roll;
    let results: number[];

    try {
      console.log(`FitGD | _rollDice - Creating roll with dicePool: ${dicePool}`);

      if (dicePool === 0) {
        // Roll 2d6, take lowest (desperate roll)
        console.log('FitGD | _rollDice - Rolling 2d6kl (desperate)');
        roll = await Roll.create('2d6kl').evaluate({ async: true });
        results = [roll.total];
        console.log('FitGD | _rollDice - Desperate roll result:', results);
      } else {
        // Roll Nd6
        console.log(`FitGD | _rollDice - Rolling ${dicePool}d6`);
        roll = await Roll.create(`${dicePool}d6`).evaluate({ async: true });
        console.log('FitGD | _rollDice - Roll created, extracting results');
        // Extract numeric values from result objects and sort descending
        results = (roll.dice[0].results as any[]).map((r: any) => r.result).sort((a, b) => b - a);
        console.log('FitGD | _rollDice - Extracted results:', results);
      }

      // Get fresh player state for flavor text
      const currentState = game.fitgd.store.getState();
      const currentPlayerState = currentState.playerRoundState.byCharacterId[this.characterId];
      const approach = currentPlayerState?.selectedApproach || 'unknown';

      console.log('FitGD | _rollDice - Posting roll to chat');
      // Post roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: game.actors.get(this.characterId) }),
        flavor: `${this.character!.name} - ${approach} approach`,
      });

      console.log('FitGD | _rollDice - Chat message posted, returning results');
      return results;
    } catch (error) {
      console.error('FitGD | Error in _rollDice:', error);
      throw error;
    }
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

    console.log('FitGD | Player accepted consequences, transitioning to APPLYING_EFFECTS');

    // Transition to APPLYING_EFFECTS state (next step after accepting consequences)
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.characterId,
          newState: 'APPLYING_EFFECTS',
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], force: true } // Force re-render
    );

    console.log('FitGD | Transitioned to APPLYING_EFFECTS');
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

    if (!this.consequenceHandler) return;

    // Use handler to create action
    const action = this.consequenceHandler.createSetConsequenceTypeAction(consequenceType);

    // Execute via Bridge API
    await game.fitgd.bridge.execute(action, {
      affectedReduxIds: [asReduxId(this.consequenceHandler.getAffectedReduxId())],
      silent: true,
    });
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

    if (!this.consequenceHandler) return;

    // Open CharacterSelectionDialog
    const dialog = new CharacterSelectionDialog(
      this.crewId,
      this.characterId,
      async (selectedCharacterId: string) => {
        // Use handler to create action
        const action = this.consequenceHandler!.createSetHarmTargetAction(selectedCharacterId);

        // Execute via Bridge API
        await game.fitgd.bridge.execute(action, {
          affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
          silent: true,
        });
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

    if (!targetCharacterId || !this.consequenceHandler) {
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
                try {
                  // Use handler to create clock action
                  const createClockAction = this.consequenceHandler!.createNewHarmClockAction(clockData);

                  // Execute clock creation
                  await game.fitgd.bridge.execute(
                    createClockAction,
                    { affectedReduxIds: [asReduxId(targetCharacterId)], silent: true }
                  );

                  // Update transaction with new clock
                  const updateAction = this.consequenceHandler!.createUpdateHarmClockInTransactionAction(
                    createClockAction.payload.id,
                    clockData.name
                  );

                  await game.fitgd.bridge.execute(updateAction, {
                    affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
                    silent: true,
                  });
                } catch (error) {
                  console.error('FitGD | Error creating harm clock:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  ui.notifications?.error(`Error creating clock: ${errorMessage} `);
                }
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected - use handler
            const action = this.consequenceHandler!.createSetHarmClockAction(clockId);
            await game.fitgd.bridge.execute(action, {
              affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in harm clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Error selecting clock: ${errorMessage} `);
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

    if (!crewId || !this.consequenceHandler) {
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
                try {
                  // Use handler to create clock action
                  const createClockAction = this.consequenceHandler!.createNewCrewClockAction(clockData);

                  // Execute clock creation
                  await game.fitgd.bridge.execute(
                    createClockAction,
                    { affectedReduxIds: [asReduxId(crewId)], silent: true }
                  );

                  // Update transaction with new clock
                  const updateAction = this.consequenceHandler!.createUpdateCrewClockInTransactionAction(
                    createClockAction.payload.id
                  );

                  await game.fitgd.bridge.execute(updateAction, {
                    affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
                    silent: true,
                  });
                } catch (error) {
                  console.error('FitGD | Error creating crew clock:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  ui.notifications?.error(`Error creating clock: ${errorMessage} `);
                }
              }
            );

            creationDialog.render(true);
            return;
          } else {
            // Existing clock selected - use handler
            const action = this.consequenceHandler!.createSetCrewClockAction(clockId);
            await game.fitgd.bridge.execute(action, {
              affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in crew clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          ui.notifications?.error(`Error selecting clock: ${errorMessage} `);
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

    if (!this.consequenceApplicationHandler) return;

    const transaction = this.playerState?.consequenceTransaction;

    // Validate transaction is complete
    const validation = this.consequenceApplicationHandler.validateConsequence(transaction);
    if (!validation.isValid) {
      ui.notifications?.warn(validation.errorMessage || 'Invalid consequence');
      return;
    }

    const state = game.fitgd.store.getState();

    // Get workflow with all actions and metadata
    const workflow = this.consequenceApplicationHandler.createConsequenceApplicationWorkflow(state, transaction!);

    // Transition to APPLYING_EFFECTS
    await game.fitgd.bridge.execute(workflow.transitionToApplyingAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Apply the consequence (harm or clock)
    await game.fitgd.bridge.execute(workflow.applyConsequenceAction as any, {
      affectedReduxIds: [workflow.characterIdToNotify ? asReduxId(workflow.characterIdToNotify) : asReduxId(this.characterId)],
      silent: true,
    });

    // Show notification
    ui.notifications?.info(workflow.notificationMessage);

    // Add momentum gain
    if (this.crewId && workflow.momentumGain > 0) {
      game.fitgd.api.crew.addMomentum({ crewId: this.crewId, amount: workflow.momentumGain });
      await game.fitgd.saveImmediate();
    }

    // Clear transaction
    await game.fitgd.bridge.execute(workflow.clearTransactionAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Transition to IDLE_WAITING (complete the turn)
    await game.fitgd.bridge.execute(workflow.transitionToIdleAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Close widget after brief delay
    setTimeout(() => this.close(), 500);
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
    if (!this.stimsWorkflowHandler || !this.stimsHandler || !this.diceRollingHandler) return;

    const state = game.fitgd.store.getState();

    // Validate stims can be used
    const validation = this.stimsWorkflowHandler.validateStimsUsage(state, this.playerState);
    if (!validation.isValid) {
      ui.notifications?.error(this.stimsWorkflowHandler.getErrorMessage(validation.reason));
      return;
    }

    // Find or create addiction clock
    let addictionClock = this.stimsWorkflowHandler.findAddictionClock(state);
    let addictionClockId = addictionClock?.id;

    if (!addictionClock) {
      const createAction = this.stimsWorkflowHandler.createAddictionClockAction();
      await game.fitgd.bridge.execute(createAction as any, {
        affectedReduxIds: [this.stimsWorkflowHandler.getAffectedReduxId()],
        silent: true,
      });
      addictionClockId = createAction.payload.id;
      ui.notifications?.info('Addiction clock created');
    }

    // Roll d6 to determine addiction advance
    const addictionRoll = await Roll.create('1d6').evaluate({ async: true });
    const addictionAmount = this.stimsWorkflowHandler.validateAddictionRoll(addictionRoll.total);

    // Post addiction roll to chat
    await addictionRoll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `${this.character!.name} - Addiction Roll(Stims)`,
    });

    // Advance addiction clock
    const advanceAction = this.stimsWorkflowHandler.createAdvanceAddictionClockAction(addictionClockId!, addictionAmount);
    await game.fitgd.bridge.execute(advanceAction as any, {
      affectedReduxIds: [this.stimsWorkflowHandler.getAffectedReduxId()],
      silent: true,
    });

    // Mark stims as used this action (prevents using again)
    const markStimsUsedAction = this.stimsHandler.createMarkStimsUsedAction();
    await game.fitgd.bridge.execute(markStimsUsedAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Check if addiction clock filled (Lockout)
    const updatedState = game.fitgd.store.getState();
    const updatedClock = updatedState.clocks.byId[addictionClockId!];

    if (updatedClock.segments >= updatedClock.maxSegments) {
      // Lockout!
      ui.notifications?.error('Addiction clock filled! Stims locked.');

      const lockoutAction = this.stimsWorkflowHandler.createStimsLockoutAction();
      await game.fitgd.bridge.execute(lockoutAction as any, {
        affectedReduxIds: [asReduxId(this.characterId)],
        force: true,
      });
      return;
    }

    // If not locked out, proceed to reroll
    ui.notifications?.info('Stims used! Rerolling...');

    // Transition to STIMS_ROLLING
    const transitionAction = this.stimsWorkflowHandler.createTransitionToStimsRollingAction();
    await game.fitgd.bridge.execute(transitionAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Wait briefly for animation/state update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Transition back to ROLLING
    const returnToRollingAction = this.stimsWorkflowHandler.createReturnToRollingAction();
    await game.fitgd.bridge.execute(returnToRollingAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      force: true,
    });

    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 300));

    // Auto-reroll immediately
    console.log('FitGD | Auto-rerolling after stims usage');
    try {
      const freshState = game.fitgd.store.getState();
      const freshPlayerState = freshState.playerRoundState.byCharacterId[this.characterId];
      const freshCrew = this.crew;

      // Validate roll can proceed
      const validation = this.diceRollingHandler.validateRoll(freshState, freshPlayerState, freshCrew);
      if (!validation.isValid) {
        console.error('FitGD | Auto-reroll validation failed:', validation.reason);
        ui.notifications?.error('Reroll validation failed');
        return;
      }

      // Roll dice
      const dicePool = this.diceRollingHandler.calculateDicePool(freshState);
      console.log('FitGD | Auto-rerolling with dicePool:', dicePool);
      const rollResult = await this._rollDice(dicePool);
      console.log('FitGD | Auto-reroll result:', rollResult);
      const outcome = calculateOutcome(rollResult);
      console.log('FitGD | Auto-reroll outcome:', outcome);

      // Execute all roll outcome actions as batch
      const rollBatch = this.diceRollingHandler.createRollOutcomeBatch(dicePool, rollResult, outcome);
      console.log('FitGD | Auto-reroll outcome batch actions:', rollBatch);

      await game.fitgd.bridge.executeBatch(
        rollBatch,
        {
          affectedReduxIds: [asReduxId(this.diceRollingHandler.getAffectedReduxId())],
          force: false,
        }
      );

      console.log('FitGD | Auto-reroll outcome batch executed');

      // Post success to chat if applicable
      if (outcome === 'critical' || outcome === 'success') {
        this._postSuccessToChat(outcome, rollResult);
      }
    } catch (error) {
      console.error('FitGD | Error in auto-reroll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ui.notifications?.error(`Reroll failed: ${errorMessage}`);
    }
  }

  /**
   * Post success message to chat
   */
  private _postSuccessToChat(outcome: string, rollResult: number[]): void {
    const highestDie = Math.max(...rollResult);
    const isCritical = outcome === 'critical';

    const content = `
      < div class="fitgd-chat-message success" >
        <h3>${isCritical ? '✨ CRITICAL SUCCESS! ✨' : '✅ FULL SUCCESS'} </h3>
          < div class="dice-result" > Highest: ${highestDie} </div>
            < div class="message" >
              ${this.character!.name} succeeds without consequences!
                </div>
                </div>
                  `;

    ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: game.actors.get(this.characterId) }),
    });
  }

  /**
   * Handle Cancel button
   */
  private async _onCancel(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();
    // Just close the widget
    this.close();
  }
}
