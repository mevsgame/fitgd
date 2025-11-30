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

import { selectActiveEquipment, selectPassiveEquipment, selectConsumableEquipment, selectFirstLockCost } from '@/selectors/equipmentSelectors';
import { selectDicePool, selectMomentumCost, selectHarmClocksWithStatus, selectIsDying, selectEffectivePosition, selectEffectiveEffect, selectEquipmentEffects, selectEquipmentModifiedPosition, selectEquipmentModifiedEffect } from '@/selectors/playerRoundStateSelectors';

import { DEFAULT_CONFIG } from '@/config/gameConfig';

import { calculateOutcome } from '@/utils/diceRules';
// Equipment utilities will be used in coordinator handler implementations (Phase 4)
// import { getEquipmentToLock, getConsumablesToDeplete } from '@/utils/equipmentRules';

// Dialog imports removed - handlers migrated to coordinator
import { asReduxId } from '../types/ids';
import type { IPlayerActionWidgetContext } from '../types/widgetContext';
import { PlayerActionHandlerFactory } from '../services/playerActionHandlerFactory';
import { PlayerActionEventCoordinator } from '../services/playerActionEventCoordinator';
import { DiceService, FoundryDiceService } from '../services/diceService';
import { NotificationService, FoundryNotificationService } from '../services/notificationService';
import { DialogFactory, FoundryDialogFactory } from '../services/dialogFactory';
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

  // Defensive success option (for GM_RESOLVING_CONSEQUENCE state)
  defensiveSuccessValues?: any; // DefensiveSuccessValues from Redux
  useDefensiveSuccess?: boolean;
}

// ClockData moved to coordinator implementations

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
 * Implements IPlayerActionWidgetContext to provide event coordinator access to state and services.
 *
 * @extends Application
 * @implements IPlayerActionWidgetContext
 */
export class PlayerActionWidget extends Application implements IPlayerActionWidgetContext {
  private characterId: string;
  private character: Character | null = null;
  private crew: Crew | null = null;
  private crewId: string | null = null;
  private playerState: PlayerRoundState | null = null;
  private storeUnsubscribe: (() => void) | null = null;

  // Handler factory (replaces 11 individual handler properties)
  private handlerFactory: PlayerActionHandlerFactory;

  // Injectable services
  private diceService: DiceService;
  private notificationService: NotificationService;
  private dialogFactory: DialogFactory;

  // Event coordinator (delegates all 24 event handlers)
  private coordinator: PlayerActionEventCoordinator;

  /**
   * Create a new Player Action Widget
   *
   * @param characterId - Redux ID of the character taking their turn
   * @param options - Additional options passed to Application constructor
   * @param diceService - Optional injectable dice service (defaults to Foundry implementation)
   * @param notificationService - Optional injectable notification service (defaults to Foundry implementation)
   * @param dialogFactory - Optional injectable dialog factory (defaults to Foundry implementation)
   */
  constructor(
    characterId: string,
    options: any = {},
    diceService: DiceService = new FoundryDiceService(),
    notificationService: NotificationService = new FoundryNotificationService(),
    dialogFactory: DialogFactory = new FoundryDialogFactory()
  ) {
    super(options);

    this.characterId = characterId;
    this.diceService = diceService;
    this.notificationService = notificationService;
    this.dialogFactory = dialogFactory;

    // Initialize handler factory
    this.handlerFactory = new PlayerActionHandlerFactory(characterId, null);

    // Initialize event coordinator (passes this widget as the context)
    this.coordinator = new PlayerActionEventCoordinator(this);
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

    // Reset handler factory
    this.handlerFactory.reset();

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

  /* ========================================
     IPlayerActionWidgetContext Implementation
     ======================================== */

  /**
   * Get the character ID this widget is for
   * @implements IPlayerActionWidgetContext
   */
  getCharacterId(): string {
    return this.characterId;
  }

  /**
   * Get the character entity
   * @implements IPlayerActionWidgetContext
   */
  getCharacter(): Character | null {
    return this.character;
  }

  /**
   * Get the crew entity
   * @implements IPlayerActionWidgetContext
   */
  getCrew(): Crew | null {
    return this.crew;
  }

  /**
   * Get the crew ID (if character is in a crew)
   * @implements IPlayerActionWidgetContext
   */
  getCrewId(): string | null {
    return this.crewId;
  }

  /**
   * Get the current player round state
   * @implements IPlayerActionWidgetContext
   */
  getPlayerState(): PlayerRoundState | null {
    return this.playerState;
  }

  /**
   * Get the dice service for rolling
   * @implements IPlayerActionWidgetContext
   */
  getDiceService(): DiceService {
    return this.diceService;
  }

  /**
   * Get the notification service
   * @implements IPlayerActionWidgetContext
   */
  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  /**
   * Get the dialog factory for creating dialogs
   * @implements IPlayerActionWidgetContext
   */
  getDialogFactory(): DialogFactory {
    return this.dialogFactory;
  }

  /**
   * Get the handler factory for creating game handlers
   * @implements IPlayerActionWidgetContext
   */
  getHandlerFactory(): PlayerActionHandlerFactory {
    return this.handlerFactory;
  }

  /**
   * Post a success message to the game chat
   * @implements IPlayerActionWidgetContext
   */
  async postSuccessToChat(outcome: string, rollResult: number[]): Promise<void> {
    return this._postSuccessToChat(outcome, rollResult);
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

    // Null safety check
    if (!game.fitgd) {
      console.error('FitGD | FitGD not initialized');
      return data as PlayerActionWidgetData;
    }

    // Load entities from Redux store
    const entities = await this._loadEntities();
    if (!entities || !entities.character) return data as PlayerActionWidgetData;

    // Build UI state flags - character is guaranteed non-null from above null check
    const uiState = this._buildUIState(entities as any);

    // Compute derived values from selectors
    const derivedData = this._computeDerivedData(entities as any);

    // Prepare template-specific data
    const templateData = this._prepareTemplateData(entities, uiState, derivedData);

    // Get state-specific data (consequence config, etc.)
    const stateSpecificData = this._getStateSpecificData(entities);

    // Combine all data for template
    return {
      ...data,
      ...templateData,
      ...stateSpecificData,
    } as PlayerActionWidgetData;
  }

  /**
   * Load character, crew, and state entities
   */
  private async _loadEntities(): Promise<{
    character: Character | null;
    crew: Crew | null;
    crewId: string | null;
    state: RootState;
    playerState: PlayerRoundState | null;
  }> {
    const state = game.fitgd.store.getState();
    const character = state.characters.byId[this.characterId];

    if (!character) {
      return { character: null, crew: null, crewId: null, state, playerState: null };
    }

    // Update local references
    this.character = character;

    // Find crew ID from crews that contain this character
    const crewId = Object.values(state.crews.byId)
      .find(crew => crew.characters.includes(this.characterId))?.id;

    this.crewId = crewId || null;
    this.crew = this.crewId ? state.crews.byId[this.crewId] : null;
    this.playerState = state.playerRoundState.byCharacterId[this.characterId];

    // Update factory context
    if (this.crewId && this.crewId !== this.handlerFactory['crewId']) {
      // Re-initialize factory if crew ID changes (rare but possible)
      this.handlerFactory = new PlayerActionHandlerFactory(
        this.characterId,
        this.crewId,
        this.character
      );
    } else {
      this.handlerFactory.setCharacter(this.character);
    }

    return {
      character: this.character,
      crew: this.crew,
      crewId: this.crewId,
      state,
      playerState: this.playerState
    };
  }

  /**
   * Build UI state flags based on current playerRoundState
   *
   * These flags determine which sections of the template are rendered.
   * Each flag corresponds to a phase in the action resolution state machine.
   */
  private _buildUIState(entities: {
    state: RootState;
    character: Character;
    playerState: PlayerRoundState | null;
  }): {
    isDecisionPhase: boolean;
    isRolling: boolean;
    isStimsRolling: boolean;
    isStimsLocked: boolean;
    isSuccess: boolean;
    isGMResolvingConsequence: boolean;
    isGM: boolean;
    isDying: boolean;
    stimsLocked: boolean;
  } {
    const { state, playerState } = entities;

    return {
      isDecisionPhase: playerState?.state === 'DECISION_PHASE',
      isRolling: playerState?.state === 'ROLLING',
      isStimsRolling: playerState?.state === 'STIMS_ROLLING',
      isStimsLocked: playerState?.state === 'STIMS_LOCKED',
      isSuccess: playerState?.state === 'SUCCESS_COMPLETE',
      isGMResolvingConsequence: playerState?.state === 'GM_RESOLVING_CONSEQUENCE',
      isGM: game.user?.isGM || false,
      isDying: selectIsDying(state, this.characterId),
      stimsLocked: !selectStimsAvailable(state),
    };
  }

  /**
   * Compute derived game values using Redux selectors
   *
   * This includes all selector evaluations, equipment data, harm clocks,
   * momentum values, and computed bonuses.
   */
  private _computeDerivedData(entities: {
    state: RootState;
    character: Character;
    crew: Crew | null;
    crewId: string | null;
    playerState: PlayerRoundState | null;
  }): Record<string, any> {
    const { state, character, crew, crewId, playerState } = entities;

    return {
      dicePool: selectDicePool(state, this.characterId),
      momentumCost: selectMomentumCost(playerState || undefined),
      momentum: crew?.currentMomentum || 0,
      maxMomentum: DEFAULT_CONFIG.crew.maxMomentum,
      canRally: crewId ? selectCanUseRally(state, this.characterId) : false,
      improvedPosition: selectEffectivePosition(state, this.characterId),
      improvedEffect: selectEffectiveEffect(state, this.characterId),
      equipmentEffects: selectEquipmentEffects(state, this.characterId),
      equipmentModifiedPosition: selectEquipmentModifiedPosition(state, this.characterId),
      equipmentModifiedEffect: selectEquipmentModifiedEffect(state, this.characterId),
      harmClocks: selectHarmClocksWithStatus(state, this.characterId),
      activeEquipmentItem: playerState?.equippedForAction?.[0]
        ? character.equipment.find(e => e.id === playerState!.equippedForAction![0])
        : undefined,
      equippedItems: selectActiveEquipment(character).filter(item => !item.consumed),
      passiveEquipment: selectPassiveEquipment(character),
      approvedPassiveEquipment: playerState?.approvedPassiveId
        ? character.equipment.find(e => e.id === playerState!.approvedPassiveId)
        : undefined,
      selectedPassiveId: playerState?.approvedPassiveId,
      secondaryOptions: this._buildSecondaryOptions(playerState?.selectedApproach, character),
      selectedSecondaryId: playerState?.equippedForAction?.[0] || playerState?.secondaryApproach,
      selectedSecondaryName: this._getSelectedSecondaryName(playerState, character),
      improvements: this._computeImprovements(),
    };
  }

  /**
   * Prepare data specifically for Handlebars template rendering
   *
   * This method organizes all entity and derived data into the shape
   * expected by the template. Serves as the "contract" between TypeScript
   * and Handlebars.
   */
  private _prepareTemplateData(
    entities: any,
    uiState: any,
    derivedData: any
  ): Partial<PlayerActionWidgetData> {
    const { character, crew, crewId, playerState } = entities;

    return {
      character,
      crew,
      crewId,
      playerState,
      ...uiState,
      approaches: Object.keys(character.approaches),
      ...derivedData,
    };
  }

  /**
   * Get state-specific data that's only needed in certain phases
   *
   * For example, consequence configuration data is only needed when
   * playerState.state === 'GM_RESOLVING_CONSEQUENCE'.
   */
  private _getStateSpecificData(entities: {
    state: RootState;
    playerState: PlayerRoundState | null;
  }): Partial<PlayerActionWidgetData> {
    const { state, playerState } = entities;

    // Only load consequence data if in GM_RESOLVING_CONSEQUENCE state
    if (playerState?.state === 'GM_RESOLVING_CONSEQUENCE') {
      return this._getConsequenceData(state);
    }

    return {};
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Approach selection
    html.find('.approach-select').change((e) => {
      const approach = (e.currentTarget as HTMLSelectElement).value;
      void this.coordinator.handleApproachChange(approach);
    });

    // Roll Mode selection
    html.find('[data-action="set-mode"]').click((e) => {
      const mode = (e.currentTarget as HTMLElement).dataset.mode as 'synergy' | 'equipment';
      void this.coordinator.handleRollModeChange(mode);
    });

    // Secondary Approach selection
    html.find('.secondary-approach-select').change((e) => {
      const value = (e.currentTarget as HTMLSelectElement).value;
      void this.coordinator.handleSecondaryApproachChange(value);
    });

    // Active Equipment selection
    html.find('.active-equipment-select').change((e) => {
      const itemId = (e.currentTarget as HTMLSelectElement).value;
      void this.coordinator.handleActiveEquipmentChange(itemId);
    });
    html.find('[data-action="add-flashback-item"]').click((_e) => {
      void this.coordinator.handleAddFlashbackItem();
    });

    // GM Passive Equipment selection
    html.find('.passive-equipment-radio').change((e) => {
      const itemId = (e.currentTarget as HTMLInputElement).value || null;
      void this.coordinator.handlePassiveEquipmentChange(itemId);
    });

    // GM position/effect controls
    html.find('.position-select').change((e) => {
      const position = (e.currentTarget as HTMLSelectElement).value;
      void this.coordinator.handlePositionChange(position);
    });
    html.find('.effect-select').change((e) => {
      const effect = (e.currentTarget as HTMLSelectElement).value;
      void this.coordinator.handleEffectChange(effect);
    });

    // GM approve roll button
    html.find('[data-action="approve-roll"]').click((_e) => {
      void this.coordinator.handleApproveRoll();
    });

    // Prepare action buttons
    html.find('[data-action="rally"]').click((_e) => {
      void this.coordinator.handleRally();
    });
    html.find('[data-action="lean-into-trait"]').click((_e) => {
      void this.coordinator.handleLeanIntoTrait();
    });
    html.find('[data-action="use-trait"]').click((_e) => {
      void this.coordinator.handleUseTrait();
    });
    html.find('[data-action="equipment"]').click((_e) => {
      void this.coordinator.handleEquipment();
    });
    html.find('[data-action="push-die"]').click((_e) => {
      void this.coordinator.handleTogglePushDie();
    });
    html.find('[data-action="push-effect"]').click((_e) => {
      void this.coordinator.handleTogglePushEffect();
    });

    // Roll button (simplified: no more commit-roll button)
    html.find('[data-action="roll"]').click((e: JQuery.ClickEvent) => {
      void this.coordinator.handleRoll(e);
    });

    // Consequence buttons
    html.find('[data-action="use-stims"]').click((_e) => {
      void this.coordinator.handleUseStims();
    });

    // Defensive success toggle
    html.find('[data-action="toggle-defensive-success"]').click((e) => {
      const enabled = (e.currentTarget as HTMLElement).dataset.enabled === 'true';
      void this.coordinator.handleToggleDefensiveSuccess(enabled);
    });

    // GM consequence configuration buttons
    html.find('[data-action="select-consequence-type"]').click((e) => {
      const type = (e.currentTarget as HTMLElement).dataset.type as 'harm' | 'crew-clock';
      void this.coordinator.handleConsequenceTypeChange(type);
    });
    html.find('[data-action="select-harm-target"]').click((_e) => {
      void this.coordinator.handleHarmTargetSelect();
    });
    html.find('[data-action="select-harm-clock"]').click((_e) => {
      void this.coordinator.handleHarmClockSelect();
    });
    html.find('[data-action="select-crew-clock"]').click((_e) => {
      void this.coordinator.handleCrewClockSelect();
    });
    html.find('[data-action="approve-consequence"]').click((_e) => {
      void this.coordinator.handleAcceptConsequence();
    });

    // Player stims button (from GM phase)
    html.find('[data-action="use-stims-gm-phase"]').click((_e) => {
      void this.coordinator.handleUseStimsGMPhase();
    });

    // Cancel button (back button removed - no more ROLL_CONFIRM state)
    html.find('[data-action="cancel"]').click((_e) => {
      void this.coordinator.handleCancel();
    });
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Apply trait transaction to character
   * NOTE: Will be called from coordinator handleRoll() in Phase 4
   * @param transaction - The transaction to apply
   */
  // @ts-expect-error - Will be used in coordinator.handleRoll() Phase 4
  private async _applyTraitTransaction(transaction: TraitTransaction): Promise<void> {
    const traitHandler = this.handlerFactory.getTraitHandler();

    // Create trait actions based on transaction mode
    const actions = traitHandler.createTraitActions(transaction);

    // Execute all trait changes as a batch (single broadcast, prevents render race)
    if (actions.length > 0) {
      await game.fitgd.bridge.executeBatch(actions, {
        affectedReduxIds: [asReduxId(traitHandler.getAffectedReduxId())],
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
  // @ts-expect-error - Will be used in coordinator.handleRoll() Phase 4
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
    const traitImprovementHandler = this.handlerFactory.getTraitImprovementHandler();
    return traitImprovementHandler.computeImprovements(this.playerState);
  }


  /**
   * Get consequence transaction data for template
   * Resolves IDs to objects and computes derived values
   *
   * @param state - Redux state
   * @returns Consequence data for template
   */
  private _getConsequenceData(state: RootState) {
    const consequenceDataResolver = this.handlerFactory.getConsequenceDataResolver();
    return consequenceDataResolver.resolveConsequenceData(state, this.playerState);
  }

  /**
   * Roll dice and return results using Foundry's Roll class
   */
  private async _rollDice(dicePool: number): Promise<number[]> {
    try {
      const results = await this.diceService.roll(dicePool);

      // Get fresh player state for flavor text
      const currentState = game.fitgd.store.getState();
      const currentPlayerState = currentState.playerRoundState.byCharacterId[this.characterId];
      const approach = currentPlayerState?.selectedApproach || 'unknown';

      await this.diceService.postRollToChat(results, this.characterId, `${this.character!.name} - ${approach} approach`);

      return results;
    } catch (error) {
      console.error('FitGD | Error in _rollDice:', error);
      throw error;
    }
  }

  /* -------------------------------------------- */
  /*  GM Consequence Configuration Handlers       */
  /* -------------------------------------------- */

  /**
   * Handle consequence type selection (harm vs crew-clock)
            const action = this.consequenceHandler!.createSetCrewClockAction(clockId);
            await game.fitgd.bridge.execute(action, {
              affectedReduxIds: [asReduxId(this.consequenceHandler!.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in crew clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.notificationService.error(`Error selecting clock: ${errorMessage} `);
        }
      }
    );

    dialog.render(true);
  }

  /* -------------------------------------------- */
  /*  GM Consequence Configuration Handlers       */
  /* -------------------------------------------- */

  /**
   * Shared stims logic (called from GM_RESOLVING_CONSEQUENCE state)
   * NOTE: Will be called from coordinator.handleUseStims() and handleUseStimsGMPhase() in Phase 4
   * Validates addiction status, advances addiction clock, and sets up reroll
   */
  // @ts-expect-error - Will be used in coordinator stims handlers Phase 4
  private async _useStims(): Promise<void> {
    const stimsWorkflowHandler = this.handlerFactory.getStimsWorkflowHandler();
    const stimsHandler = this.handlerFactory.getStimsHandler();
    const diceRollingHandler = this.handlerFactory.getDiceRollingHandler();

    const state = game.fitgd.store.getState();

    // Validate stims can be used
    const validation = stimsWorkflowHandler.validateStimsUsage(state, this.playerState);
    if (!validation.isValid) {
      this.notificationService.error(stimsWorkflowHandler.getErrorMessage(validation.reason));
      return;
    }

    // Find or create addiction clock
    let addictionClock = stimsWorkflowHandler.findAddictionClock(state);
    let addictionClockId = addictionClock?.id;

    if (!addictionClock) {
      const createAction = stimsWorkflowHandler.createAddictionClockAction();
      await game.fitgd.bridge.execute(createAction as any, {
        affectedReduxIds: [stimsWorkflowHandler.getAffectedReduxId()],
        silent: true,
      });
      addictionClockId = createAction.payload.id;
      this.notificationService.info('Addiction clock created');
    }

    // Roll d6 to determine addiction advance
    const addictionRoll = await Roll.create('1d6').evaluate({ async: true });
    const addictionAmount = stimsWorkflowHandler.validateAddictionRoll(addictionRoll.total);

    // Post addiction roll to chat
    await addictionRoll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `${this.character!.name} - Addiction Roll(Stims)`,
    });

    // Advance addiction clock
    const advanceAction = stimsWorkflowHandler.createAdvanceAddictionClockAction(addictionClockId!, addictionAmount);
    await game.fitgd.bridge.execute(advanceAction as any, {
      affectedReduxIds: [stimsWorkflowHandler.getAffectedReduxId()],
      silent: true,
    });

    // Mark stims as used this action (prevents using again)
    const markStimsUsedAction = stimsHandler.createMarkStimsUsedAction();
    await game.fitgd.bridge.execute(markStimsUsedAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Check if addiction clock filled (Lockout)
    const updatedState = game.fitgd.store.getState();
    const updatedClock = updatedState.clocks.byId[addictionClockId!];

    if (updatedClock.segments >= updatedClock.maxSegments) {
      // Lockout!
      this.notificationService.error('Addiction clock filled! Stims locked.');

      const lockoutAction = stimsWorkflowHandler.createStimsLockoutAction();
      await game.fitgd.bridge.execute(lockoutAction as any, {
        affectedReduxIds: [asReduxId(this.characterId)],
        force: true,
      });
      return;
    }

    // If not locked out, proceed to reroll
    this.notificationService.info('Stims used! Rerolling...');

    // Transition to STIMS_ROLLING
    const transitionAction = stimsWorkflowHandler.createTransitionToStimsRollingAction();
    await game.fitgd.bridge.execute(transitionAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Wait briefly for animation/state update
    await new Promise(resolve => setTimeout(resolve, 500));

    // Transition back to ROLLING
    const rollingAction = diceRollingHandler.createTransitionToRollingAction();
    await game.fitgd.bridge.execute(rollingAction as any, {
      affectedReduxIds: [asReduxId(this.characterId)],
      silent: true,
    });

    // Reroll!
    const dicePool = diceRollingHandler.calculateDicePool(updatedState);
    const rollResult = await this._rollDice(dicePool);
    const outcome = calculateOutcome(rollResult);

    // Execute outcome actions
    const rollBatch = diceRollingHandler.createRollOutcomeBatch(dicePool, rollResult, outcome);
    await game.fitgd.bridge.executeBatch(
      rollBatch,
      {
        affectedReduxIds: [asReduxId(diceRollingHandler.getAffectedReduxId())],
        force: false,
      }
    );

    // Post success
    if (outcome === 'critical' || outcome === 'success') {
      this._postSuccessToChat(outcome, rollResult);
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

}
