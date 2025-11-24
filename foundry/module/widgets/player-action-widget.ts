/**
 * Player Action Widget
 *
 * A persistent widget that appears when it's a player's turn in an encounter.
 * Drives the action resolution flow through the state machine.
 */

import type { Character } from '@/types/character';
import type { Equipment } from '@/types/equipment';
import type { Crew } from '@/types/crew';
import type { Clock } from '@/types/clock';
import type { RootState } from '@/store';
import type { PlayerRoundState, Position, Effect } from '@/types/playerRoundState';
import type { TraitTransaction, ConsequenceTransaction } from '@/types/playerRoundState';

import { selectCanUseRally } from '@/selectors/characterSelectors';
import { selectStimsAvailable } from '@/selectors/clockSelectors';

import { selectActiveEquipment, selectPassiveEquipment, selectCurrentLoad, isEquipmentConsumable, selectConsumableEquipment, selectFirstLockCost } from '@/selectors/equipmentSelectors';
import { selectDicePool, selectMomentumCost, selectHarmClocksWithStatus, selectIsDying, selectEffectivePosition, selectEffectiveEffect, selectEquipmentEffects, selectEquipmentModifiedPosition, selectEquipmentModifiedEffect } from '@/selectors/playerRoundStateSelectors';

import { DEFAULT_CONFIG } from '@/config/gameConfig';

import { calculateOutcome } from '@/utils/diceRules';
import { getEquipmentToLock, getConsumablesToDeplete } from '@/utils/equipmentRules';

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
  isGMResolvingConsequence: boolean;

  // Available approaches
  approaches: string[];

  // Equipment for selection
  equippedItems: Equipment[];
  activeEquipmentItem?: Equipment;
  passiveEquipment: Equipment[];
  selectedPassiveId?: string | null;
  approvedPassiveEquipment?: Equipment;

  // Secondary approach unified dropdown options
  secondaryOptions?: Array<{ type: 'approach' | 'separator' | 'active' | 'consumable', value?: string, name?: string, bonus?: string, locked?: boolean }>;
  selectedSecondaryId?: string | null;
  selectedSecondaryName?: string | null;

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

        // Log subscription changes
        if (playerStateChanged || characterChanged || crewChanged || clocksChanged) {
          console.log('FitGD | Widget subscription detected changes:', {
            playerStateChanged,
            characterChanged,
            crewChanged,
            clocksChanged,
            currentPlayerState: currentState.playerRoundState.byCharacterId[this.characterId]?.state,
          });
        }

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
    console.log('FitGD | Widget getData() - Approved Passive ID:', this.playerState?.approvedPassiveId);
    if (this.playerState?.approvedPassiveId) {
      const passive = this.character.equipment.find(e => e.id === this.playerState!.approvedPassiveId);
      console.log('FitGD | Widget getData() - Found Passive Item:', passive);
    }

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

      // Available approaches
      approaches: Object.keys(this.character.approaches),

      // Equipment for selection (excluding consumed consumables - they cannot be used once consumed)
      equippedItems: selectActiveEquipment(this.character).filter(
        item => !item.consumed // Consumed consumables cannot be selected
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

      // Selected passive equipment ID (GM only)
      selectedPassiveId: this.playerState?.approvedPassiveId,

      // Approved passive equipment object (for display)
      approvedPassiveEquipment: this.playerState?.approvedPassiveId
        ? this.character?.equipment.find(e => e.id === this.playerState!.approvedPassiveId)
        : undefined,

      // Equipment effects from selected items (using new selectors)
      equipmentEffects: selectEquipmentEffects(state, this.characterId),

      // Equipment-modified position and effect (using new selectors)
      equipmentModifiedPosition: selectEquipmentModifiedPosition(state, this.characterId),
      equipmentModifiedEffect: selectEquipmentModifiedEffect(state, this.characterId),

      // Secondary approach unified dropdown options
      secondaryOptions: this._buildSecondaryOptions(this.playerState?.selectedApproach, this.character),
      selectedSecondaryId: this.playerState?.equippedForAction?.[0] || this.playerState?.secondaryApproach,
      selectedSecondaryName: this._getSelectedSecondaryName(this.playerState, this.character),

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

    // GM Passive Equipment selection
    html.find('.passive-equipment-radio').change(this._onPassiveEquipmentChange.bind(this));

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

    // GM consequence configuration buttons
    html.find('[data-action="select-consequence-type"]').click(this._onSelectConsequenceType.bind(this));
    html.find('[data-action="select-harm-target"]').click(this._onSelectHarmTarget.bind(this));
    html.find('[data-action="select-harm-clock"]').click(this._onSelectHarmClock.bind(this));
    html.find('[data-action="select-crew-clock"]').click(this._onSelectCrewClock.bind(this));
    html.find('[data-action="approve-consequence"]').click(this._onPlayerAcceptConsequence.bind(this));

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
   * Build secondary approach options (unified dropdown)
   *
   * Format: [Approaches] [Separator] [Active Equipment] [Consumables]
   * Each equipment shows: Name + Bonuses + Category Icon
   */
  private _buildSecondaryOptions(
    selectedApproach: string | undefined,
    character: Character
  ): Array<{ type: 'approach' | 'separator' | 'active' | 'consumable', value?: string, name?: string, bonus?: string, locked?: boolean }> {
    const options: Array<{ type: 'approach' | 'separator' | 'active' | 'consumable', value?: string, name?: string, bonus?: string, locked?: boolean }> = [];

    // Add other approaches (excluding primary)
    const otherApproaches = Object.keys(character.approaches).filter(
      a => a !== selectedApproach?.toLowerCase()
    );

    otherApproaches.forEach(approach => {
      options.push({
        type: 'approach',
        value: approach,
        name: approach.charAt(0).toUpperCase() + approach.slice(1),
        bonus: `${character.approaches[approach as keyof typeof character.approaches]}d`
      });
    });

    // Add separator if there are equipment items
    const activeItems = selectActiveEquipment(character);
    const consumableItems = selectConsumableEquipment(character);

    if (activeItems.length > 0 || consumableItems.length > 0) {
      options.push({ type: 'separator' });
    }

    // Add active equipment (sorted alphabetically)
    activeItems.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const bonuses: string[] = [];
      if (item.modifiers?.diceBonus) bonuses.push(`+${item.modifiers.diceBonus}d`);
      if (item.modifiers?.positionBonus) bonuses.push(`+${item.modifiers.positionBonus}pos`);
      if (item.modifiers?.effectBonus) bonuses.push(`+${item.modifiers.effectBonus}eff`);

      options.push({
        type: 'active',
        value: item.id,
        name: item.name,
        bonus: bonuses.join(' '),
        locked: item.locked
      });
    });

    // Add consumable equipment (sorted alphabetically)
    consumableItems.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const bonuses: string[] = [];
      if (item.modifiers?.diceBonus) bonuses.push(`+${item.modifiers.diceBonus}d`);
      if (item.modifiers?.positionBonus) bonuses.push(`+${item.modifiers.positionBonus}pos`);
      if (item.modifiers?.effectBonus) bonuses.push(`+${item.modifiers.effectBonus}eff`);

      options.push({
        type: 'consumable',
        value: item.id,
        name: item.name,
        bonus: bonuses.join(' '),
        locked: item.locked
      });
    });

    return options;
  }

  /**
   * Get the name of the selected secondary (approach or equipment)
   */
  private _getSelectedSecondaryName(playerState: PlayerRoundState | null | undefined, character: Character | null): string | null {
    if (!playerState || !character) return null;

    // Check if secondary approach is selected
    if (playerState.secondaryApproach) {
      return playerState.secondaryApproach.charAt(0).toUpperCase() + playerState.secondaryApproach.slice(1);
    }

    // Check if equipment is equipped
    if (playerState.equippedForAction?.[0]) {
      const equipment = character.equipment.find(e => e.id === playerState.equippedForAction![0]);
      return equipment?.name || null;
    }

    return null;
  }

  /**
   * Calculate total momentum cost including equipment first-lock costs
   *
   * Equipment first-lock costs: 1M per unlocked Rare/Epic item used
   * Includes: equippedForAction items + approvedPassiveId
   */
  private _calculateTotalMomentumCost(playerState: PlayerRoundState | null | undefined, character: Character | null): number {
    if (!playerState || !character) return 0;

    // Get base costs (push, trait, flashback)
    const baseCost = selectMomentumCost(playerState);

    // Get equipment items that will be locked in this roll
    const equipmentToLock: Equipment[] = [];

    // Add selected active/consumable equipment
    if (playerState.equippedForAction?.[0]) {
      const equipment = character.equipment.find(e => e.id === playerState.equippedForAction![0]);
      if (equipment) {
        equipmentToLock.push(equipment);
      }
    }

    // Add approved passive equipment
    if (playerState.approvedPassiveId) {
      const passive = character.equipment.find(e => e.id === playerState.approvedPassiveId);
      if (passive) {
        equipmentToLock.push(passive);
      }
    }

    // Calculate first-lock costs for equipment
    const equipmentCost = selectFirstLockCost(equipmentToLock);

    return baseCost + equipmentCost;
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
   * Handle secondary approach/equipment change (unified dropdown)
   * Can be either an approach name or equipment ID
   */
  private async _onSecondaryApproachChange(event: JQuery.ChangeEvent): Promise<void> {
    const selectedValue = (event.currentTarget as HTMLSelectElement).value;
    if (!selectedValue) {
      // Deselected - clear both
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.characterId,
            approach: this.playerState?.selectedApproach || 'force',
            secondaryApproach: undefined,
            equippedForAction: [],
            position: this.playerState?.position || 'risky',
            effect: this.playerState?.effect || 'standard',
          },
        },
        { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
      );
      return;
    }

    // Determine if it's an approach or equipment by checking against approaches
    const isApproach = Object.keys(this.character!.approaches).includes(selectedValue);

    if (isApproach) {
      // Selected an approach for secondary
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.characterId,
            approach: this.playerState?.selectedApproach || 'force',
            secondaryApproach: selectedValue,
            equippedForAction: [], // Clear equipment if synergy selected
            rollMode: 'synergy', // Explicitly set mode to synergy
            position: this.playerState?.position || 'risky',
            effect: this.playerState?.effect || 'standard',
          },
        },
        { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
      );
    } else {
      // Selected an equipment item
      const actions = [
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.characterId,
            approach: this.playerState?.selectedApproach || 'force',
            secondaryApproach: undefined, // Clear synergy if equipment selected
            equippedForAction: [selectedValue],
            position: this.playerState?.position || 'risky',
            effect: this.playerState?.effect || 'standard',
          },
        } as any,
      ];

      // If consumable is selected, mark it as depleted
      if (this.character) {
        const equipment = this.character.equipment.find(e => e.id === selectedValue);
        if (equipment && isEquipmentConsumable(equipment)) {
          actions.push({
            type: 'characters/markEquipmentDepleted',
            payload: {
              characterId: this.characterId,
              equipmentId: selectedValue,
            },
          } as any);
        }
      }

      await game.fitgd.bridge.executeBatch(
        actions,
        { affectedReduxIds: [asReduxId(this.characterId)] } // Broadcast to all clients
      );
    }
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
   * Handle GM Passive equipment approval
   */
  private async _onPassiveEquipmentChange(event: JQuery.ChangeEvent): Promise<void> {
    const equipmentId = (event.currentTarget as HTMLInputElement).value || null;

    // Use Bridge API to dispatch and broadcast
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setApprovedPassive',
        payload: {
          characterId: this.characterId,
          equipmentId,
        },
      },
      { affectedReduxIds: [asReduxId(this.characterId)], silent: true } // Silent: subscription handles render
    );

    // Post chat message if passive was selected
    if (equipmentId && this.character) {
      const passive = this.character.equipment.find(e => e.id === equipmentId);
      if (passive) {
        ChatMessage.create({
          content: `GM approved Passive equipment for ${this.character!.name}: <strong>${passive.name}</strong>`,
          speaker: ChatMessage.getSpeaker(),
        });
      }
    }
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
            const maxLoad = this.character!.loadLimit;
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
  /**
   * Handle Equipment button
   * Opens Equipment Management Dialog which provides access to:
   * - Equipment management (equip/unequip)
   * - Flashback Equipment Dialog (create new items)
   */
  private _onEquipment(event: JQuery.ClickEvent): void {
    event.preventDefault();

    if (!this.crewId) {
      ui.notifications?.warn('Crew not found - equipment management requires a crew');
      return;
    }

    // Import and open Equipment Management Dialog
    // This dialog provides access to both equipment management and flashback item creation
    import('../dialogs/EquipmentManagementDialog').then(({ EquipmentManagementDialog }) => {
      new EquipmentManagementDialog(this.characterId, this.crewId!).render(true);
    });
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

      // Calculate total momentum cost including equipment first-lock costs
      const totalMomentumCost = this._calculateTotalMomentumCost(playerState, this.character);

      // Validate sufficient momentum for all costs
      const availableMomentum = this.crew?.currentMomentum || 0;
      if (totalMomentumCost > availableMomentum) {
        const equippedForAction = playerState?.equippedForAction?.[0];
        const approvedPassiveId = playerState?.approvedPassiveId;
        const itemsNeedingLock: string[] = [];

        if (equippedForAction && this.character) {
          const item = this.character.equipment.find(e => e.id === equippedForAction);
          if (item && (item.tier === 'rare' || item.tier === 'epic') && !item.locked) {
            itemsNeedingLock.push(item.name);
          }
        }

        if (approvedPassiveId && this.character) {
          const item = this.character.equipment.find(e => e.id === approvedPassiveId);
          if (item && (item.tier === 'rare' || item.tier === 'epic') && !item.locked) {
            itemsNeedingLock.push(item.name);
          }
        }

        const itemsList = itemsNeedingLock.length > 0 ? ` [${itemsNeedingLock.join(', ')}]` : '';
        ui.notifications?.error(
          `Insufficient Momentum to lock equipment! Need ${totalMomentumCost}M, have ${availableMomentum}M${itemsList}`
        );
        return;
      }

      // Spend momentum NOW (before rolling)
      if (this.crewId && totalMomentumCost > 0) {
        try {
          game.fitgd.api.crew.spendMomentum({ crewId: this.crewId, amount: totalMomentumCost });
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

      // Lock equipment used in this roll (active + approved passive)
      const equipmentToLock = getEquipmentToLock(
        playerState?.equippedForAction,
        playerState?.approvedPassiveId
      );

      if (equipmentToLock.length > 0) {
        equipmentToLock.forEach((equipmentId) => {
          rollBatch.push({
            type: 'characters/markEquipmentUsed',
            payload: {
              characterId: this.characterId,
              equipmentId,
            },
          });
        });
      }

      // Mark consumables as depleted
      const consumablesToDeplete = getConsumablesToDeplete(this.character!, playerState?.equippedForAction || []);
      if (consumablesToDeplete.length > 0) {
        consumablesToDeplete.forEach((equipmentId) => {
          rollBatch.push({
            type: 'characters/markEquipmentDepleted',
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
                  console.log(`FitGD | Creating new harm clock via Bridge:`, createClockAction);

                  // Execute clock creation
                  await game.fitgd.bridge.execute(
                    createClockAction,
                    { affectedReduxIds: [asReduxId(targetCharacterId)], silent: true }
                  );

                  console.log(`FitGD | Clock creation executed, should be broadcast now`);

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
   * Handle player accepting consequences
   * Called when PLAYER clicks "Accept Consequences" button
   */
  private async _onPlayerAcceptConsequence(event: JQuery.ClickEvent): Promise<void> {
    event.preventDefault();

    if (!this.consequenceApplicationHandler) return;

    const transaction = this.playerState?.consequenceTransaction;
    console.log('FitGD | _onPlayerAcceptConsequence - Transaction:', JSON.stringify(transaction, null, 2));
    console.log('FitGD | _onPlayerAcceptConsequence - Called by user:', game.user?.name, 'isGM:', game.user?.isGM);

    // Validate transaction is complete
    const validation = this.consequenceApplicationHandler.validateConsequence(transaction);
    if (!validation.isValid) {
      ui.notifications?.warn(validation.errorMessage || 'Invalid consequence');
      return;
    }

    const state = game.fitgd.store.getState();

    // Check if clock exists in store
    if (transaction?.harmClockId) {
      const clock = state.clocks.byId[transaction.harmClockId];
      console.log('FitGD | Clock exists in store?', !!clock, 'ClockId:', transaction.harmClockId);
      if (clock) {
        console.log('FitGD | Clock details:', JSON.stringify(clock, null, 2));
      }
    }

    // Get workflow with all actions and metadata
    const workflow = this.consequenceApplicationHandler.createConsequenceApplicationWorkflow(state, transaction!);
    console.log('FitGD | Consequence action:', JSON.stringify(workflow.applyConsequenceAction, null, 2));

    // Build batch of all consequence actions
    // NOTE: Do NOT transition to TURN_COMPLETE here!
    // The valid sequence is: GM_RESOLVING_CONSEQUENCE → APPLYING_EFFECTS
    // GM and Player widgets will close when they detect APPLYING_EFFECTS state
    const actions: any[] = [
      workflow.transitionToApplyingAction,  // GM_RESOLVING_CONSEQUENCE → APPLYING_EFFECTS
      workflow.applyConsequenceAction,      // Apply harm clock advancement
      workflow.clearTransactionAction,       // Clear consequence transaction
      // REMOVED: workflow.transitionToTurnCompleteAction - causes invalid transition error!
    ];

    // Add momentum gain if applicable
    if (this.crewId && workflow.momentumGain > 0) {
      actions.push({
        type: 'crews/addMomentum',
        payload: { crewId: this.crewId, amount: workflow.momentumGain },
      });
    }

    console.log('FitGD | Executing batch of', actions.length, 'consequence actions');
    console.log('FitGD | Affected Redux IDs:', {
      characterId: this.characterId,
      characterIdToNotify: workflow.characterIdToNotify,
      crewId: this.crewId,
    });
    console.log('FitGD | Actions:', JSON.stringify(actions, null, 2));

    // Execute all actions as atomic batch (single broadcast)
    console.log('FitGD | Calling bridge.executeBatch...');
    await game.fitgd.bridge.executeBatch(actions, {
      affectedReduxIds: [
        asReduxId(this.characterId),
        ...(workflow.characterIdToNotify ? [asReduxId(workflow.characterIdToNotify)] : []),
        ...(this.crewId ? [asReduxId(this.crewId)] : []),
      ],
      silent: false, // Allow sheet refresh after entire batch
    });

    console.log('FitGD | Batch executed, consequences applied');
    console.log('FitGD | Current playerRoundState after batch:', this.playerState?.state);

    // Show notification
    ui.notifications?.info(workflow.notificationMessage);

    // Only close widget if NOT the GM
    // GM widget will close when state transition is received via socket
    if (!game.user?.isGM) {
      console.log('FitGD | Closing player widget after accepting consequences');
      setTimeout(() => this.close(), 500);
    } else {
      console.log('FitGD | NOT closing GM widget - waiting for socket state update');
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
