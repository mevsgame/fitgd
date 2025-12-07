/**
 * Player Action Event Coordinator
 *
 * Handles all 24 event handlers for the Player Action Widget.
 *
 * This class:
 * - Depends on IPlayerActionWidgetContext interface (not concrete PlayerActionWidget)
 * - Orchestrates event handling across 4 categories (decision, modifiers, roll, consequence)
 * - Dispatches Redux actions via the Bridge API
 * - Is fully testable with a mock context (no Foundry dependency needed)
 *
 * The coordinator is the business logic layer between the Foundry UI and Redux state.
 */

import type { IPlayerActionWidgetContext } from '../types/widgetContext';
import { asReduxId } from '../types/ids';
import { DEFAULT_CONFIG } from '@/config/gameConfig';
import { selectEffectiveEffect, selectDefensiveSuccessValues } from '@/selectors/playerRoundStateSelectors';
import { calculateOutcome } from '@/utils/diceRules';

/**
 * Coordinates event handling for Player Action Widget
 *
 * Acts as an intermediary between Foundry's event system and Redux state management.
 * All event handlers follow the same pattern:
 * 1. Get necessary data from context
 * 2. Validate the action
 * 3. Create Redux action(s)
 * 4. Dispatch via Bridge API
 *
 * This design allows for:
 * - Testing without Foundry (mock context)
 * - Reusing logic with different UI frameworks
 * - Clear separation between UI and business logic
 */
export class PlayerActionEventCoordinator {
  /**
   * Create a new event coordinator
   *
   * @param context - Widget context providing state and services
   */
  constructor(private _context: IPlayerActionWidgetContext) { }

  /**
   * Get the context (exposed for testing and use by handlers)
   */
  protected get context(): IPlayerActionWidgetContext {
    return this._context;
  }

  /* ========================================
     DECISION PHASE EVENTS (8 handlers)
     ======================================== */

  /**
   * Handle primary approach selection change
   * @param approach - Selected approach name (force, guile, focus, spirit)
   */
  async handleApproachChange(approach: string): Promise<void> {
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.context.getCharacterId(),
          approach,
          position: playerState.position || 'risky',
          effect: playerState.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
    );
  }

  /**
   * Handle roll mode change between synergy and equipment
   * @param mode - Roll mode ('synergy' | 'equipment')
   */
  async handleRollModeChange(mode: 'synergy' | 'equipment'): Promise<void> {
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    // Toggle mode: click to activate, click again to deactivate
    const newMode = playerState.rollMode === mode ? undefined : mode;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.context.getCharacterId(),
          approach: playerState.selectedApproach || 'force',
          rollMode: newMode,
          position: playerState.position || 'risky',
          effect: playerState.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
    );
  }

  /**
   * Handle secondary approach or equipment selection
   * Behavior depends on current roll mode (synergy vs equipment)
   * @param value - Selected approach name or equipment ID (or empty string to clear)
   */
  async handleSecondaryApproachChange(value: string): Promise<void> {
    const playerState = this.context.getPlayerState();
    const character = this.context.getCharacter();
    if (!playerState || !character) return;

    if (!value) {
      // Deselected - clear both
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.context.getCharacterId(),
            approach: playerState.selectedApproach || 'force',
            secondaryApproach: undefined,
            equippedForAction: [],
            position: playerState.position || 'risky',
            effect: playerState.effect || 'standard',
          },
        },
        { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
      );
      return;
    }

    // Determine if it's an approach or equipment by checking against approaches
    const isApproach = Object.keys(character.approaches).includes(value);

    if (isApproach) {
      // Selected an approach for secondary
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.context.getCharacterId(),
            approach: playerState.selectedApproach || 'force',
            secondaryApproach: value,
            equippedForAction: [],
            rollMode: 'synergy',
            position: playerState.position || 'risky',
            effect: playerState.effect || 'standard',
          },
        },
        { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
      );
    } else {
      // Selected an equipment item
      await game.fitgd.bridge.execute(
        {
          type: 'playerRoundState/setActionPlan',
          payload: {
            characterId: this.context.getCharacterId(),
            approach: playerState.selectedApproach || 'force',
            secondaryApproach: undefined,
            equippedForAction: [value],
            position: playerState.position || 'risky',
            effect: playerState.effect || 'standard',
          },
        },
        { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
      );
    }
  }

  /**
   * Handle active equipment selection
   * @param itemId - Foundry Item ID of selected equipment
   */
  async handleActiveEquipmentChange(itemId: string): Promise<void> {
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setActionPlan',
        payload: {
          characterId: this.context.getCharacterId(),
          approach: playerState.selectedApproach || 'force',
          equippedForAction: itemId ? [itemId] : [],
          rollMode: 'equipment',
          position: playerState.position || 'risky',
          effect: playerState.effect || 'standard',
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())] }
    );
  }

  /**
   * Handle passive equipment selection
   * @param itemId - Foundry Item ID or null to clear
   */
  async handlePassiveEquipmentChange(itemId: string | null): Promise<void> {
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setApprovedPassive',
        payload: {
          characterId: this.context.getCharacterId(),
          equipmentId: itemId,
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())], silent: true }
    );
  }

  /**
   * Handle position change (controlled, risky, desperate)
   * @param position - Selected position
   */
  async handlePositionChange(position: string): Promise<void> {
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setPosition',
        payload: {
          characterId: this.context.getCharacterId(),
          position: position as any,
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())], silent: true }
    );
  }

  /**
   * Handle effect change (limited, standard, great)
   * @param effect - Selected effect
   */
  async handleEffectChange(effect: string): Promise<void> {
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setEffect',
        payload: {
          characterId: this.context.getCharacterId(),
          effect: effect as any,
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())], silent: true }
    );
  }

  /**
   * Handle GM approval of player's prepared roll
   */
  async handleApproveRoll(): Promise<void> {
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    // Toggle approval state
    const currentlyApproved = playerState.gmApproved || false;
    const newApprovalState = !currentlyApproved;

    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/setGmApproved',
        payload: {
          characterId: this.context.getCharacterId(),
          approved: newApprovalState,
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())], silent: true }
    );
  }

  /* ========================================
     ACTION MODIFIER EVENTS (7 handlers)
     ======================================== */

  /**
   * Handle toggle of push die modifier (spend momentum for +1d6)
   */
  async handleTogglePushDie(): Promise<void> {
    const pushHandler = this.context.getHandlerFactory().getPushHandler();
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    const action = pushHandler.createTogglePushDieAction(playerState);

    await game.fitgd.bridge.execute(action, {
      affectedReduxIds: [asReduxId(this.context.getCharacterId())],
      silent: true,
    });
  }

  /**
   * Handle toggle of push effect modifier (spend momentum for +1 effect)
   */
  async handleTogglePushEffect(): Promise<void> {
    const pushHandler = this.context.getHandlerFactory().getPushHandler();
    const playerState = this.context.getPlayerState();
    if (!playerState) return;

    const action = pushHandler.createTogglePushEffectAction(playerState);

    await game.fitgd.bridge.execute(action, {
      affectedReduxIds: [asReduxId(this.context.getCharacterId())],
      silent: true,
    });
  }

  /**
   * Handle rally action (spend momentum to clear stress/harm)
   */
  async handleRally(): Promise<void> {
    const rallyHandler = this.context.getHandlerFactory().getRallyHandler();
    const crew = this.context.getCrew();

    // Validate rally eligibility
    const validation = rallyHandler.validateRally(crew);
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to rally',
        'no-teammates': 'No other teammates in crew to rally',
      };
      this.context.getNotificationService().warn(messages[validation.reason!]);
      return;
    }

    // Open rally dialog
    const dialog = this.context
      .getDialogFactory()
      .createRallyDialog(this.context.getCharacterId(), rallyHandler.getCrewId()!);
    dialog.render(true);
  }

  /**
   * Handle lean into trait action (resist consequence)
   */
  async handleLeanIntoTrait(): Promise<void> {
    const leanIntoTraitHandler = this.context.getHandlerFactory().getLeanIntoTraitHandler();

    // Validate lean into trait eligibility
    const validation = leanIntoTraitHandler.validateLeanIntoTrait();
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to lean into trait',
        'no-available-traits': 'No available traits - all traits are currently disabled',
      };
      this.context.getNotificationService().warn(messages[validation.reason!]);
      return;
    }

    // Open lean into trait dialog
    const { LeanIntoTraitDialog } = await import('../dialogs/index');
    const dialog = new LeanIntoTraitDialog(
      this.context.getCharacterId(),
      leanIntoTraitHandler.getCrewId()!
    );
    dialog.render(true);
  }

  /**
   * Handle use trait action (improve trait)
   */
  async handleUseTrait(): Promise<void> {
    const useTraitHandler = this.context.getHandlerFactory().getUseTraitHandler();
    const playerState = this.context.getPlayerState();

    // Validate use trait eligibility
    const validation = useTraitHandler.validateUseTrait(playerState);
    if (!validation.isValid) {
      const messages: { [key: string]: string } = {
        'no-crew': 'Character must be in a crew to use trait',
        'position-controlled': 'Position is already Controlled - cannot improve further',
      };
      this.context.getNotificationService().warn(messages[validation.reason!]);
      return;
    }

    // If trait transaction already exists, cancel it (toggle off)
    if (useTraitHandler.hasActiveTraitTransaction(playerState)) {
      await game.fitgd.bridge.execute(
        useTraitHandler.createClearTraitTransactionAction(),
        { affectedReduxIds: [asReduxId(useTraitHandler.getAffectedReduxId())], force: false }
      );

      this.context.getNotificationService().info('Trait flashback canceled');
      return;
    }

    // Open flashback traits dialog
    const dialog = this.context
      .getDialogFactory()
      .createFlashbackTraitsDialog(this.context.getCharacterId(), useTraitHandler.getCrewId()!);
    dialog.render(true);
  }

  /**
   * Handle add flashback item action
   * NOTE: Large method (120 lines) - candidate for Phase 6 extraction to FlashbackItemDialog
   */
  async handleAddFlashbackItem(): Promise<void> {
    const character = this.context.getCharacter();
    const crew = this.context.getCrew();
    if (!character || !crew) {
      this.context.getNotificationService().warn('Character and crew required for flashback');
      return;
    }

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
      title: 'Flashback Item',
      content: content,
      buttons: {
        add: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Add Item',
          callback: async (html: JQuery | HTMLElement | undefined) => {
            if (!html) return;
            const $html = $(html as HTMLElement);
            const name = ($html.find('[name="name"]').val() as string) || '';
            const tagsStr = ($html.find('[name="tags"]').val() as string) || '';
            const cost = parseInt(($html.find('[name="cost"]').val() as string) || '0') || 0;
            const tags = tagsStr
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t);

            if (!name) return;

            // Build actions
            const actions = [];

            // Spend Momentum
            const crewId = this.context.getCrewId();
            if (cost > 0 && crewId) {
              actions.push({
                type: 'crews/spendMomentum',
                payload: {
                  crewId,
                  amount: cost,
                },
              });
            }

            // Add item
            const itemId = foundry.utils.randomID();
            actions.push({
              type: 'characters/addEquipment',
              payload: {
                characterId: this.context.getCharacterId(),
                item: {
                  id: itemId,
                  name: name,
                  load: 1,
                  tags: tags,
                },
              },
            });

            // Equip item
            actions.push({
              type: 'characters/toggleEquipped',
              payload: {
                characterId: this.context.getCharacterId(),
                itemId: itemId,
              },
            });

            // Set as active for this action
            actions.push({
              type: 'playerRoundState/setActionPlan',
              payload: {
                characterId: this.context.getCharacterId(),
                equippedForAction: [itemId],
              },
            });

            // Execute batch
            await game.fitgd.bridge.executeBatch(
              actions,
              {
                affectedReduxIds: [
                  asReduxId(this.context.getCharacterId()),
                  ...(crewId ? [asReduxId(crewId)] : []),
                ],
              }
            );

            this.context.getNotificationService().info(`Added and equipped ${name} (-${cost}M)`);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel',
        },
      },
      default: 'add',
    }).render(true);
  }

  /* ========================================
     ROLL EXECUTION EVENTS (2 handlers)
     ======================================== */

  /**
   * Execute primary roll action
   * NOTE: Large method (122 lines) - candidate for Phase 5 extraction to DiceRollingHandler.executeRoll()
   * @param _event - jQuery click event from the roll button
   */
  async handleRoll(_event: JQuery.ClickEvent): Promise<void> {
    const diceRollingHandler = this.context.getHandlerFactory().getDiceRollingHandler();
    const character = this.context.getCharacter();
    const crew = this.context.getCrew();
    const playerState = this.context.getPlayerState();

    if (!character || !playerState) {
      this.context.getNotificationService().error('Character and player state required for roll');
      return;
    }

    try {
      const state = game.fitgd.store.getState();

      // Collect equipment to lock (Active from equippedForAction + Passive from approvedPassiveId)
      const equipmentToLock: string[] = [];
      if (playerState.equippedForAction && playerState.equippedForAction.length > 0) {
        equipmentToLock.push(...playerState.equippedForAction);
      }
      if (playerState.approvedPassiveId) {
        equipmentToLock.push(playerState.approvedPassiveId);
      }

      // Calculate first-lock momentum cost (1M per unlocked Rare/Epic item)
      let firstLockMomentumCost = 0;
      for (const eqId of equipmentToLock) {
        const eq = character.equipment.find(e => e.id === eqId);
        if (eq && !eq.locked && (eq.tier === 'rare' || eq.tier === 'epic')) {
          firstLockMomentumCost += DEFAULT_CONFIG.equipment.momentumCostByTier[eq.tier] || 0;
        }
      }

      // Calculate total momentum cost (existing push/trait costs + equipment lock cost)
      const baseMomentumCost = diceRollingHandler.calculateMomentumCost(playerState);
      const totalMomentumCost = baseMomentumCost + firstLockMomentumCost;

      // Validate roll can proceed (including equipment lock cost)
      const validation = diceRollingHandler.validateRoll(state, playerState, crew);
      if (!validation.isValid) {
        if (validation.reason === 'no-action-selected') {
          this.context.getNotificationService().warn('Please select an action first');
        } else if (validation.reason === 'insufficient-momentum') {
          this.context.getNotificationService().error(
            `Insufficient Momentum! Need ${validation.momentumNeeded}, have ${validation.momentumAvailable}`
          );
        }
        return;
      }

      // Additional check for equipment first-lock cost
      if (crew && firstLockMomentumCost > 0 && crew.currentMomentum < totalMomentumCost) {
        this.context.getNotificationService().error(
          `Insufficient Momentum for equipment! Need ${totalMomentumCost}M (includes ${firstLockMomentumCost}M for first-lock), have ${crew.currentMomentum}M`
        );
        return;
      }

      // Transition to ROLLING
      await game.fitgd.bridge.execute(
        diceRollingHandler.createTransitionToRollingAction(),
        { affectedReduxIds: [asReduxId(diceRollingHandler.getAffectedReduxId())], silent: true }
      );

      // Roll dice
      const dicePool = diceRollingHandler.calculateDicePool(state);
      const rollResult = await this.context.getDiceService().roll(dicePool);

      // Post the roll to chat with approach flavor
      const approach = playerState.selectedApproach || 'unknown';
      const characterName = character.name || 'Character';
      await this.context.getDiceService().postRollToChat(
        rollResult,
        this.context.getCharacterId(),
        `${characterName} - ${approach} approach`
      );

      const outcome = calculateOutcome(rollResult);

      // Build roll outcome batch (state transition + equipment locking)
      const rollBatch: Array<{ type: string; payload: any }> = [
        ...diceRollingHandler.createRollOutcomeBatch(dicePool, rollResult, outcome),
      ];

      // Add equipment lock actions
      for (const eqId of equipmentToLock) {
        const eq = character.equipment.find(e => e.id === eqId);
        if (eq && !eq.locked) {
          rollBatch.push({
            type: 'characters/markEquipmentUsed',
            payload: { characterId: this.context.getCharacterId(), equipmentId: eqId },
          });

          // If consumable, also mark as consumed
          if (eq.category === 'consumable') {
            rollBatch.push({
              type: 'characters/markEquipmentDepleted',
              payload: { characterId: this.context.getCharacterId(), equipmentId: eqId },
            });
          }
        }
      }

      // Spend first-lock momentum (in addition to any existing momentum costs)
      if (crew && firstLockMomentumCost > 0) {
        rollBatch.push({
          type: 'crews/spendMomentum',
          payload: { crewId: crew.id, amount: firstLockMomentumCost },
        });
      }

      await game.fitgd.bridge.executeBatch(
        rollBatch,
        {
          affectedReduxIds: [
            asReduxId(diceRollingHandler.getAffectedReduxId()),
            ...(crew ? [asReduxId(crew.id)] : []),
          ],
          force: false,
        }
      );

      // Post success to chat if applicable
      if (outcome === 'critical' || outcome === 'success') {
        await this.context.postSuccessToChat(outcome, rollResult);
      }
    } catch (error) {
      console.error('FitGD | Error in handleRoll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.context.getNotificationService().error(`Roll failed: ${errorMessage}`);
    }
  }


  /**
   * Cancel current action and return to decision phase
   */
  async handleCancel(): Promise<void> {
    await game.fitgd.bridge.execute(
      {
        type: 'playerRoundState/resetState',
        payload: {
          characterId: this.context.getCharacterId(),
        },
      },
      { affectedReduxIds: [asReduxId(this.context.getCharacterId())], silent: false }
    );
  }

  /* ========================================
     CONSEQUENCE CONFIGURATION EVENTS (5 handlers)
     ======================================== */

  /**
   * Handle consequence type selection (harm vs crew-clock)
   * @param type - Consequence type ('harm' | 'crew-clock')
   */
  async handleConsequenceTypeChange(type: 'harm' | 'crew-clock'): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();

    const action = consequenceHandler.createSetConsequenceTypeAction(type);

    await game.fitgd.bridge.execute(action, {
      affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
      silent: true,
    });
  }

  /**
   * Handle harm target selection (self vs other character)
   */
  async handleHarmTargetSelect(): Promise<void> {
    const crewId = this.context.getCrewId();
    if (!crewId) {
      this.context.getNotificationService().warn('Character must be in a crew');
      return;
    }

    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();
    if (!consequenceHandler) return;

    // Open CharacterSelectionDialog
    const { CharacterSelectionDialog } = await import('../dialogs/index');
    const dialog = new CharacterSelectionDialog(crewId, this.context.getCharacterId(), async (selectedCharacterId: string) => {
      const action = consequenceHandler.createSetHarmTargetAction(selectedCharacterId);

      await game.fitgd.bridge.execute(action, {
        affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
        silent: true,
      });
    });

    dialog.render(true);
  }

  /**
   * Handle harm clock selection
   */
  async handleHarmClockSelect(): Promise<void> {
    const playerState = this.context.getPlayerState();
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();

    const transaction = playerState?.consequenceTransaction;
    const targetCharacterId = transaction?.harmTargetCharacterId;

    if (!targetCharacterId || !consequenceHandler) {
      this.context.getNotificationService().warn('Select target character first');
      return;
    }

    // Open ClockSelectionDialog for harm clocks
    const { ClockSelectionDialog, ClockCreationDialog } = await import('../dialogs/index');
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
              async (clockData: any) => {
                try {
                  const createClockAction = consequenceHandler.createNewHarmClockAction(clockData);

                  await game.fitgd.bridge.execute(
                    createClockAction,
                    { affectedReduxIds: [asReduxId(targetCharacterId)], silent: true }
                  );

                  const updateAction = consequenceHandler.createUpdateHarmClockInTransactionAction(
                    createClockAction.payload.id,
                    clockData.name
                  );

                  await game.fitgd.bridge.execute(updateAction, {
                    affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
                    silent: true,
                  });
                } catch (error) {
                  console.error('FitGD | Error creating harm clock:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  this.context.getNotificationService().error(`Error creating clock: ${errorMessage}`);
                }
              }
            );

            creationDialog.render(true);
          } else {
            const action = consequenceHandler.createSetHarmClockAction(clockId);
            await game.fitgd.bridge.execute(action, {
              affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in harm clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.context.getNotificationService().error(`Error selecting clock: ${errorMessage}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle crew clock selection
   */
  async handleCrewClockSelect(): Promise<void> {
    const crewId = this.context.getCrewId();
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();

    if (!crewId || !consequenceHandler) {
      this.context.getNotificationService().warn('Character must be in a crew');
      return;
    }

    // Open ClockSelectionDialog for crew clocks (non-harm)
    const { ClockSelectionDialog, ClockCreationDialog } = await import('../dialogs/index');
    const dialog = new ClockSelectionDialog(
      crewId,
      'threat',
      async (clockId: string) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new crew clock
            // Pre-select and lock to 'threat' category for consequence creation
            const creationDialog = new ClockCreationDialog(
              crewId,
              'progress',
              async (clockData: any) => {
                try {
                  const createClockAction = consequenceHandler.createNewCrewClockAction(clockData);

                  await game.fitgd.bridge.execute(
                    createClockAction,
                    { affectedReduxIds: [asReduxId(crewId)], silent: true }
                  );

                  const updateAction = consequenceHandler.createUpdateCrewClockInTransactionAction(
                    createClockAction.payload.id
                  );

                  await game.fitgd.bridge.execute(updateAction, {
                    affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
                    silent: true,
                  });
                } catch (error) {
                  console.error('FitGD | Error creating crew clock:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  this.context.getNotificationService().error(`Error creating clock: ${errorMessage}`);
                }
              },
              {},
              'threat'
            );

            creationDialog.render(true);
          } else {
            const action = consequenceHandler.createSetCrewClockAction(clockId);
            await game.fitgd.bridge.execute(action, {
              affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in crew clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.context.getNotificationService().error(`Error selecting clock: ${errorMessage}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Accept consequence and apply it
   */
  async handleAcceptConsequence(): Promise<void> {
    const consequenceApplicationHandler = this.context.getHandlerFactory().getConsequenceApplicationHandler();
    const playerState = this.context.getPlayerState();
    const transaction = playerState?.consequenceTransaction;

    if (!transaction) return;

    const state = game.fitgd.store.getState();
    const workflow = consequenceApplicationHandler.createConsequenceApplicationWorkflow(state, transaction);

    // For Partial Success: transition to SUCCESS_COMPLETE instead of APPLYING_EFFECTS
    // This allows GM to select success clocks in a separate phase
    const isPartialSuccess = playerState?.outcome === 'partial';
    const nextState = isPartialSuccess ? 'SUCCESS_COMPLETE' : workflow.transitionToApplyingAction.payload.newState;

    const actions: any[] = [
      {
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.context.getCharacterId(),
          newState: nextState,
        },
      },
      workflow.applyConsequenceAction,
    ];

    // For Partial Success: DON'T clear transaction yet
    // It contains useDefensiveSuccess flag needed for calculating success clock segments
    // It will be cleared in handleAcceptSuccessClock instead
    if (!isPartialSuccess) {
      actions.push(workflow.clearTransactionAction);
    }

    const crewId = this.context.getCrewId();
    if (crewId && workflow.momentumGain > 0) {
      actions.push({
        type: 'crews/addMomentum',
        payload: { crewId, amount: workflow.momentumGain },
      });
    }

    await game.fitgd.bridge.executeBatch(actions, {
      affectedReduxIds: [
        asReduxId(this.context.getCharacterId()),
        ...(workflow.characterIdToNotify ? [asReduxId(workflow.characterIdToNotify)] : []),
        ...(crewId ? [asReduxId(crewId)] : []),
      ],
      silent: false,
    });
  }

  /* ========================================
     STIMS HANDLERS (2 handlers)
     ======================================== */

  /**
   * Use stims during player's action (addiction check)
   * 
   * State Machine Flow (per docs/player-action-widget.md):
   *   GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → STIMS_LOCKED → GM_RESOLVING_CONSEQUENCE (if filled)
   *   GM_RESOLVING_CONSEQUENCE → STIMS_ROLLING → ROLLING (if not filled, reroll)
   */
  async handleUseStims(): Promise<void> {
    const stimsWorkflowHandler = this.context.getHandlerFactory().getStimsWorkflowHandler();
    const playerState = this.context.getPlayerState();

    const state = game.fitgd.store.getState();

    // Validate stims can be used
    const validation = stimsWorkflowHandler.validateStimsUsage(state, playerState);
    if (!validation.isValid) {
      this.context
        .getNotificationService()
        .error(stimsWorkflowHandler.getErrorMessage(validation.reason));
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
      this.context.getNotificationService().info('Addiction clock created');
    }

    // ✅ FIX: Transition to STIMS_ROLLING FIRST (per state machine)
    // This is required before any lockout check - you can't go directly to STIMS_LOCKED
    const transitionToStimsAction = stimsWorkflowHandler.createTransitionToStimsRollingAction();
    await game.fitgd.bridge.execute(transitionToStimsAction as any, {
      affectedReduxIds: [asReduxId(this.context.getCharacterId())],
      silent: true,
    });

    // Roll d6 to determine addiction advance
    const addictionRoll = await Roll.create('1d6').evaluate({ async: true });
    const addictionAmount = stimsWorkflowHandler.validateAddictionRoll(addictionRoll.total);

    // Post addiction roll to chat
    await addictionRoll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: `${this.context.getCharacter()?.name || 'Character'} - Addiction Roll (Stims)`,
    });

    // Advance addiction clock
    const advanceAction = stimsWorkflowHandler.createAdvanceAddictionClockAction(
      addictionClockId!,
      addictionAmount
    );
    await game.fitgd.bridge.execute(advanceAction as any, {
      affectedReduxIds: [stimsWorkflowHandler.getAffectedReduxId()],
      silent: true,
    });

    // Mark stims as used this action (prevents using again)
    const stimsHandler = this.context.getHandlerFactory().getStimsHandler();
    const markStimsUsedAction = stimsHandler.createMarkStimsUsedAction();
    await game.fitgd.bridge.execute(markStimsUsedAction as any, {
      affectedReduxIds: [asReduxId(this.context.getCharacterId())],
      silent: true,
    });

    // Check if addiction clock filled (Lockout)
    const updatedState = game.fitgd.store.getState();
    const updatedClock = updatedState.clocks.byId[addictionClockId!];

    if (updatedClock.segments >= updatedClock.maxSegments) {
      // Lockout! STIMS_ROLLING → STIMS_LOCKED (valid transition per state machine)
      this.context.getNotificationService().error('Addiction clock filled! Stims locked.');

      const lockoutAction = stimsWorkflowHandler.createStimsLockoutAction();
      await game.fitgd.bridge.execute(lockoutAction as any, {
        affectedReduxIds: [asReduxId(this.context.getCharacterId())],
        force: true,
      });

      // Brief wait for UI update
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Return to GM_RESOLVING_CONSEQUENCE (STIMS_LOCKED → GM_RESOLVING_CONSEQUENCE per state machine)
      // Player still needs to accept the original consequence
      await game.fitgd.bridge.execute({
        type: 'playerRoundState/transitionState',
        payload: {
          characterId: this.context.getCharacterId(),
          newState: 'GM_RESOLVING_CONSEQUENCE',
        },
      } as any, {
        affectedReduxIds: [asReduxId(this.context.getCharacterId())],
        force: true,
      });

      return;
    }

    // If not locked out, proceed to reroll
    this.context.getNotificationService().info('Stims used! Rerolling...');

    // Wait briefly for animation/state update
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Transition from STIMS_ROLLING to ROLLING (valid transition per state machine)
    const diceRollingHandler = this.context.getHandlerFactory().getDiceRollingHandler();
    const rollingAction = diceRollingHandler.createTransitionToRollingAction();
    await game.fitgd.bridge.execute(rollingAction as any, {
      affectedReduxIds: [asReduxId(this.context.getCharacterId())],
      silent: true,
    });

    // Wait for Redux state transition to propagate before calculating dice
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Fetch fresh state for dice pool calculation
    const freshState = game.fitgd.store.getState();
    const dicePool = diceRollingHandler.calculateDicePool(freshState);
    const rollResult = await this.context.getDiceService().roll(dicePool);

    // Post the reroll to chat
    const character = this.context.getCharacter();
    const characterName = character?.name || 'Character';
    const approach = this.context.getPlayerState()?.selectedApproach || 'unknown';
    await this.context.getDiceService().postRollToChat(
      rollResult,
      this.context.getCharacterId(),
      `${characterName} - ${approach} approach (Stims Reroll)`
    );

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
      await this.context.postSuccessToChat(outcome, rollResult);
    }
  }

  /**
   * Use stims during GM's consequence resolution phase
   */
  async handleUseStimsGMPhase(): Promise<void> {
    // Delegate to standard stims handling - same logic applies
    await this.handleUseStims();
  }

  /**
   * Handle defensive success toggle
   *
   * @param enabled - Whether to enable defensive success option
   */
  async handleToggleDefensiveSuccess(enabled: boolean): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();
    const action = consequenceHandler.createToggleDefensiveSuccessAction(enabled);

    await game.fitgd.bridge.execute(action as any, {
      affectedReduxIds: [consequenceHandler.getAffectedReduxId() as any],
      silent: true,
    });
  }

  /**
   * Handle success clock operation selection (advance or reduce)
   */
  async handleSuccessClockOperationChange(operation: 'add' | 'reduce'): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();
    const action = consequenceHandler.createSetSuccessClockOperationAction(operation);

    await game.fitgd.bridge.execute(action as any, {
      affectedReduxIds: [consequenceHandler.getAffectedReduxId() as any],
      silent: true,
    });
  }

  /**
   * Handle success clock selection dialog
   */
  async handleSuccessClockSelect(): Promise<void> {
    const playerState = this.context.getPlayerState();
    const crewId = this.context.getCrewId();
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();

    if (!playerState?.consequenceTransaction || !crewId) return;

    const operation = playerState.consequenceTransaction.successClockOperation;
    if (!operation) {
      this.context.getNotificationService().warn('Select clock operation (Advance/Reduce) first');
      return;
    }

    // Open ClockSelectionDialog (use crew-type for both operations)
    const { ClockSelectionDialog, ClockCreationDialog } = await import('../dialogs/index');
    const dialog = new ClockSelectionDialog(
      crewId,
      operation === 'add' ? 'progress' : 'threat',
      async (clockId: string) => {
        try {
          if (clockId === '_new') {
            // Open ClockCreationDialog for new clock
            const preSelectedCategory = operation === 'reduce' ? 'threat' : undefined;
            const creationDialog = new ClockCreationDialog(
              crewId,
              'progress',
              async (clockData: any) => {
                try {
                  // Create the new clock
                  const createClockAction = consequenceHandler.createNewSuccessClockAction(clockData);
                  const newClockId = createClockAction.payload.id;

                  await game.fitgd.bridge.execute(createClockAction as any, {
                    affectedReduxIds: [asReduxId(crewId)],
                    silent: true,
                  });

                  // Calculate segments based on effect (use defensive effect if active)
                  const state = game.fitgd.store.getState();

                  // Check if defensive success is active - use reduced effect
                  let effectToUse = selectEffectiveEffect(state, this.context.getCharacterId());
                  if (playerState?.consequenceTransaction?.useDefensiveSuccess) {
                    const defensiveValues = selectDefensiveSuccessValues(state, this.context.getCharacterId());
                    effectToUse = defensiveValues.defensiveEffect || 'limited';
                  }

                  const segments = DEFAULT_CONFIG.resolution.successSegments[effectToUse];

                  // Update the transaction with the new clock and calculated segments
                  const updateClockAction = consequenceHandler.createSetSuccessClockAction(newClockId);
                  const setSegmentsAction = {
                    type: 'playerRoundState/updateConsequenceTransaction',
                    payload: {
                      characterId: this.context.getCharacterId(),
                      updates: { calculatedSuccessClockSegments: segments },
                    },
                  };

                  await game.fitgd.bridge.executeBatch([updateClockAction, setSegmentsAction] as any[], {
                    affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
                    silent: true,
                  });
                } catch (error) {
                  console.error('FitGD | Error creating success clock:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  this.context.getNotificationService().error(`Error creating clock: ${errorMessage}`);
                }
              },
              {},
              preSelectedCategory
            );

            creationDialog.render(true);
          } else {
            // Set the clock ID and calculate segments based on effect (use defensive effect if active)
            const state = game.fitgd.store.getState();

            // Check if defensive success is active - use reduced effect
            let effectToUse = selectEffectiveEffect(state, this.context.getCharacterId());
            if (playerState?.consequenceTransaction?.useDefensiveSuccess) {
              const defensiveValues = selectDefensiveSuccessValues(state, this.context.getCharacterId());
              effectToUse = defensiveValues.defensiveEffect || 'limited';
            }

            const segments = DEFAULT_CONFIG.resolution.successSegments[effectToUse];

            // Batch: set clock ID and calculated segments
            const setClockAction = consequenceHandler.createSetSuccessClockAction(clockId);
            const setSegmentsAction = {
              type: 'playerRoundState/updateConsequenceTransaction',
              payload: {
                characterId: this.context.getCharacterId(),
                updates: { calculatedSuccessClockSegments: segments },
              },
            };

            await game.fitgd.bridge.executeBatch([setClockAction, setSegmentsAction] as any[], {
              affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
              silent: true,
            });
          }
        } catch (error) {
          console.error('FitGD | Error in success clock selection:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.context.getNotificationService().error(`Error selecting clock: ${errorMessage}`);
        }
      }
    );

    dialog.render(true);
  }

  /**
   * Handle skip success clock button (clear success clock selections)
   */
  async handleSkipSuccessClock(): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();
    const action = consequenceHandler.createSetSuccessClockAction(''); // Empty string clears selection

    await game.fitgd.bridge.execute(action as any, {
      affectedReduxIds: [consequenceHandler.getAffectedReduxId() as any],
      silent: true,
    });
  }

  /**
   * Handle accept success clock button (apply clock advancement and close widget)
   */
  async handleAcceptSuccessClock(): Promise<void> {
    const playerState = this.context.getPlayerState();
    const transaction = playerState?.consequenceTransaction;
    const characterId = this.context.getCharacterId();
    const crewId = this.context.getCrewId();

    // If success clock is configured, apply it
    if (transaction) {
      const state = game.fitgd.store.getState();
      const successClockAction = this._createSuccessClockAction(state, transaction);

      const actions: any[] = [];

      if (successClockAction) {
        actions.push(successClockAction);

        // Post message to chat
        const clock = state.clocks.byId[transaction.successClockId!];
        if (clock) {
          const segments = transaction.calculatedSuccessClockSegments || 1;
          const operation = transaction.successClockOperation;
          const actionType = operation === 'add' ? 'advanced' : 'reduced';
          this.context.getNotificationService().info(
            `${clock.subtype} ${actionType} by ${segments} segment(s)`
          );
        }
      }

      // Always clear transaction (whether clock was selected or skipped)
      const clearTransactionAction = {
        type: 'playerRoundState/clearConsequenceTransaction',
        payload: { characterId },
      };
      actions.push(clearTransactionAction);

      if (actions.length > 0) {
        await game.fitgd.bridge.executeBatch(
          actions,
          {
            affectedReduxIds: [
              asReduxId(characterId),
              ...(crewId ? [asReduxId(crewId)] : []),
            ],
            silent: false,
          }
        );
      }
    }

    // Close the widget
    const app = this.context as any;
    if (app.close) {
      await app.close();
    }
  }

  /**
   * Create action to update success clock based on transaction
   */
  private _createSuccessClockAction(state: any, transaction: any): any | null {
    if (!transaction?.successClockId || !transaction?.successClockOperation) {
      return null;
    }

    const clock = state.clocks.byId[transaction.successClockId];
    if (!clock) return null;

    const segments = transaction.calculatedSuccessClockSegments || 1;
    const operation = transaction.successClockOperation;

    if (operation === 'add') {
      return {
        type: 'clocks/addSegments',
        payload: {
          clockId: clock.id,
          amount: segments,
        },
      };
    } else {
      return {
        type: 'clocks/clearSegments',
        payload: {
          clockId: clock.id,
          amount: segments,
        },
      };
    }
  }

  /* ========================================
     SIDE PANEL CLOCK HANDLERS
     ======================================== */

  /**
   * Handle clock selection from side panel
   * Routes to appropriate handler based on panel type
   * 
   * @param panelType - Type of panel ('harm' | 'crew' | 'success')
   * @param clockId - Selected clock ID
   */
  async handleSidePanelClockSelect(panelType: 'harm' | 'crew' | 'success', clockId: string): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();

    switch (panelType) {
      case 'harm':
        const harmAction = consequenceHandler.createSetHarmClockAction(clockId);
        await game.fitgd.bridge.execute(harmAction, {
          affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
          silent: true,
        });
        break;

      case 'crew':
        const crewAction = consequenceHandler.createSetCrewClockAction(clockId);
        await game.fitgd.bridge.execute(crewAction, {
          affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
          silent: true,
        });
        break;

      case 'success':
        // Set success clock in transaction
        await game.fitgd.bridge.execute({
          type: 'playerRoundState/setSuccessClockTransaction',
          payload: {
            characterId: this.context.getCharacterId(),
            successClockId: clockId,
          },
        }, {
          affectedReduxIds: [asReduxId(this.context.getCharacterId())],
          silent: true,
        });
        break;
    }
  }

  /**
   * Handle clock creation from side panel
   * Creates clock and selects it in one flow
   * 
   * @param panelType - Type of panel ('harm' | 'crew' | 'success')
   * @param clockData - Clock data with name, category, maxSegments
   */
  async handleSidePanelClockCreate(
    panelType: 'harm' | 'crew' | 'success',
    clockData: { name: string; category: string; maxSegments: number }
  ): Promise<void> {
    const consequenceHandler = this.context.getHandlerFactory().getConsequenceHandler();
    const crewId = this.context.getCrewId();

    switch (panelType) {
      case 'harm': {
        const targetId = this.context.getPlayerState()?.consequenceTransaction?.harmTargetCharacterId;
        if (!targetId) {
          this.context.getNotificationService().warn('Select target character first');
          return;
        }

        // Create harm clock
        const createAction = consequenceHandler.createNewHarmClockAction({
          name: clockData.name,
          segments: clockData.maxSegments,
        });

        await game.fitgd.bridge.execute(createAction, {
          affectedReduxIds: [asReduxId(targetId)],
          silent: true,
        });

        // Select the new clock
        const updateAction = consequenceHandler.createUpdateHarmClockInTransactionAction(
          createAction.payload.id,
          clockData.name
        );

        await game.fitgd.bridge.execute(updateAction, {
          affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
          silent: true,
        });
        break;
      }

      case 'crew': {
        if (!crewId) {
          this.context.getNotificationService().warn('Character must be in a crew');
          return;
        }

        // Create crew clock (category locked to threat for consequences)
        const createAction = consequenceHandler.createNewCrewClockAction({
          name: clockData.name,
          category: 'threat',
          segments: clockData.maxSegments,
        });

        await game.fitgd.bridge.execute(createAction, {
          affectedReduxIds: [asReduxId(crewId)],
          silent: true,
        });

        // Select the new clock
        const updateAction = consequenceHandler.createUpdateCrewClockInTransactionAction(
          createAction.payload.id
        );

        await game.fitgd.bridge.execute(updateAction, {
          affectedReduxIds: [asReduxId(consequenceHandler.getAffectedReduxId())],
          silent: true,
        });
        break;
      }

      case 'success': {
        if (!crewId) {
          this.context.getNotificationService().warn('Character must be in a crew');
          return;
        }

        const clockId = foundry.utils.randomID();

        // Create progress clock
        await game.fitgd.bridge.execute({
          type: 'clocks/addClock',
          payload: {
            id: clockId,
            entityId: crewId,
            clockType: 'progress',
            subtype: clockData.name,
            segments: 0,
            maxSegments: clockData.maxSegments,
            metadata: {
              category: clockData.category || 'long-term-project',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        }, {
          affectedReduxIds: [asReduxId(crewId)],
          silent: true,
        });

        // Select the new clock
        await game.fitgd.bridge.execute({
          type: 'playerRoundState/setSuccessClockTransaction',
          payload: {
            characterId: this.context.getCharacterId(),
            successClockId: clockId,
          },
        }, {
          affectedReduxIds: [asReduxId(this.context.getCharacterId())],
          silent: true,
        });
        break;
      }
    }
  }
}

