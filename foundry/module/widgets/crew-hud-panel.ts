import { selectIdsWithFewestTraits } from '../../../src/selectors/traitSelectors';
/**
 * Crew HUD Panel
 *
 * A persistent overlay panel on the left side of the screen that displays
 * the primary crew's status at a glance: momentum, clocks, and character cards.
 *
 * Features:
 * - Displays crew momentum with GM controls (+/-/reset)
 * - Shows addiction clock and crew progress/threat clocks
 * - Character cards with portraits, harm clocks, and Take Action buttons
 * - Active character indicator during encounters
 * - Double-click character to open sheet
 * - Drag to reposition, session persistence
 *
 * @see docs/crew-hud-panel.md for full documentation
 */

import { takeAction } from '../helpers/sheet-helpers';
import { logger } from '../utils/logger';

/**
 * Data structure for HUD template rendering
 */
interface CrewHUDData {
    crewId: string;
    crewName: string;
    currentMomentum: number;
    isGM: boolean;
    crewClocks: Array<{
        id: string;
        name: string;
        segments: number;
        maxSegments: number;
        clockImage: string;
        category?: string;
    }>;
    characters: Array<{
        id: string;
        name: string;
        portrait: string;
        canTakeAction: boolean;
        isActive: boolean;
        harmClocks: Array<{
            id: string;
            subtype: string;
            segments: number;
            maxSegments: number;
            clockImage: string;
        }>;
        addictionClock: {
            id: string;
            segments: number;
            maxSegments: number;
            clockImage: string;
        } | null;
    }>;
    activeCharacterId: string | null;
}

/**
 * Crew HUD Panel Application
 *
 * Singleton pattern - only one HUD can be rendered at a time.
 * Use static methods show(), hide(), isVisible() to control.
 */
export class CrewHUDPanel extends Application {
    private static _instance: CrewHUDPanel | null = null;

    private crewId: string | null = null;
    private storeUnsubscribe: (() => void) | null = null;
    private currentPosition: { left: number; top: number } | null = null;

    // ===== STATIC METHODS =====

    /**
     * Show the HUD panel for a specific crew (or the primary crew)
     *
     * @param crewId - Optional crew ID. If not provided, uses primaryCrewId setting.
     */
    static show(crewId?: string): void {
        if (!this._instance) {
            this._instance = new CrewHUDPanel();
        }

        // Determine which crew to show
        const targetCrewId = crewId
            ?? (game.settings.get('forged-in-the-grimdark', 'primaryCrewId') as string)
            ?? this._getDefaultCrewId();

        if (!targetCrewId) {
            ui.notifications?.warn('No primary crew set. Open a crew sheet and click "Set Primary".');
            return;
        }

        this._instance.crewId = targetCrewId;
        this._instance.render(true);

        // Persist visibility state
        game.settings.set('forged-in-the-grimdark', 'hudVisible', true);
    }

    /**
     * Hide the HUD panel
     */
    static hide(): void {
        if (this._instance) {
            this._instance.close();
        }
        game.settings.set('forged-in-the-grimdark', 'hudVisible', false);
    }

    /**
     * Check if the HUD is currently visible
     */
    static isVisible(): boolean {
        return this._instance?.rendered ?? false;
    }

    /**
     * Get the first available crew ID as fallback
     */
    private static _getDefaultCrewId(): string | null {
        const state = game.fitgd?.store.getState();
        return state?.crews.allIds[0] ?? null;
    }

    // ===== INSTANCE METHODS =====

    static override get defaultOptions(): any {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'crew-hud-panel',
            template: 'systems/forged-in-the-grimdark/templates/widgets/crew-hud-panel.html',
            popOut: false, // Renders as fixed overlay, not a popup window
            classes: ['crew-hud-panel-app']
        });
    }

    /**
     * Render hook - subscribe to Redux store for real-time updates
     */
    async _render(force: boolean, options: any): Promise<void> {
        // @ts-ignore - Foundry's Application class has _render but it's not in the type definitions
        await super._render(force, options);
        this._subscribeToStore();
        this._restorePosition();
        this._enableDragging();
    }

    /**
     * Close hook - clean up store subscription
     */
    async close(options?: Application.CloseOptions): Promise<void> {
        if (this.storeUnsubscribe) {
            this.storeUnsubscribe();
            this.storeUnsubscribe = null;
        }
        await super.close(options);
    }

    /**
     * Subscribe to Redux store for live updates
     */
    private _subscribeToStore(): void {
        if (this.storeUnsubscribe) return; // Already subscribed

        const store = game.fitgd?.store;
        if (!store) return;

        let previousState = store.getState();

        this.storeUnsubscribe = store.subscribe(() => {
            const currentState = store.getState();

            // Only re-render if relevant state changed
            if (this.rendered && this._hasRelevantStateChanged(previousState, currentState)) {
                this.render(false);
            }

            previousState = currentState;
        });
    }

    /**
     * Check if state changes affect the HUD display
     */
    private _hasRelevantStateChanged(prev: any, current: any): boolean {
        if (!this.crewId) return false;

        // Check crew momentum and active player action
        const prevCrew = prev.crews.byId[this.crewId];
        const currentCrew = current.crews.byId[this.crewId];
        if (prevCrew?.currentMomentum !== currentCrew?.currentMomentum) return true;
        if (prevCrew?.characters?.length !== currentCrew?.characters?.length) return true;
        if (prevCrew?.activePlayerAction?.characterId !== currentCrew?.activePlayerAction?.characterId) return true;

        // Check clocks (simple reference check)
        if (prev.clocks !== current.clocks) return true;

        // Check characters (for harm clocks)
        if (prev.characters !== current.characters) return true;

        return false;
    }

    /**
     * Enable drag-to-reposition functionality
     */
    private _enableDragging(): void {
        // The Application renders inside a wrapper; we need to find our panel
        const panel = this.element;
        if (!panel || !panel.length) return;

        // Find the actual panel content (might be directly .crew-hud-panel or inside)
        const hudPanel = panel.hasClass('crew-hud-panel') ? panel : panel.find('.crew-hud-panel');
        if (!hudPanel.length) return;

        // Make the header draggable
        const header = hudPanel.find('.hud-crew-header');
        if (!header.length) return;

        header.css('cursor', 'move');

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        header.on('mousedown.crewHudDrag', (e: JQuery.MouseDownEvent) => {
            // Don't drag if clicking on buttons
            if ($(e.target).closest('button').length) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = hudPanel[0].getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            e.preventDefault();
        });

        $(document).on('mousemove.crewHud', (e: JQuery.MouseMoveEvent) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            hudPanel.css({
                left: startLeft + deltaX + 'px',
                top: startTop + deltaY + 'px',
                right: 'auto',
                bottom: 'auto'
            });
        });

        $(document).on('mouseup.crewHud', () => {
            if (isDragging) {
                isDragging = false;
                this._savePosition();
            }
        });
    }

    /**
     * Save current position to instance and client settings
     */
    private _savePosition(): void {
        const hudPanel = this.element?.hasClass('crew-hud-panel')
            ? this.element
            : this.element?.find('.crew-hud-panel');
        if (!hudPanel?.length) return;

        const rect = hudPanel[0].getBoundingClientRect();
        this.currentPosition = { left: rect.left, top: rect.top };

        try {
            game.settings.set('forged-in-the-grimdark', 'hudPosition', JSON.stringify(this.currentPosition));
        } catch (error) {
            logger.warn('Could not save HUD position:', error);
        }
    }

    /**
     * Restore position from instance variable or client settings
     */
    private _restorePosition(): void {
        const hudPanel = this.element?.hasClass('crew-hud-panel')
            ? this.element
            : this.element?.find('.crew-hud-panel');
        if (!hudPanel?.length) return;

        // First try instance variable (for re-renders)
        let position = this.currentPosition;

        // If no instance position, try loading from settings (initial load)
        if (!position) {
            try {
                const positionStr = game.settings.get('forged-in-the-grimdark', 'hudPosition') as string;
                if (positionStr) {
                    position = JSON.parse(positionStr);
                    this.currentPosition = position;
                }
            } catch (error) {
                logger.warn('Could not load HUD position from settings:', error);
            }
        }

        // Apply position if available
        if (position && position.left !== undefined && position.top !== undefined) {
            hudPanel.css({
                left: position.left + 'px',
                top: position.top + 'px',
                right: 'auto',
                bottom: 'auto'
            });
        }
    }

    /**
     * Prepare data for template rendering
     */
    getData(): CrewHUDData {
        const state = game.fitgd?.store.getState();
        const crew = this.crewId ? state?.crews.byId[this.crewId] : null;

        if (!crew) {
            return {
                crewId: '',
                crewName: 'No Crew',
                currentMomentum: 0,
                isGM: game.user?.isGM ?? false,
                crewClocks: [],
                characters: [],
                activeCharacterId: null
            };
        }

        // Get active character from crew's active player action
        const activeCharacterId = crew.activePlayerAction?.characterId ?? null;

        // Get crew clocks (progress type only)
        const crewClockIds = state?.clocks.byEntityId[this.crewId!] ?? [];
        const crewClocks = crewClockIds
            .map((id: string) => state?.clocks.byId[id])
            .filter((c: any) => c?.clockType === 'progress')
            .map((c: any) => ({
                id: c.id as string,
                name: (c.subtype || c.metadata?.name || 'Clock') as string,
                segments: c.segments as number,
                maxSegments: c.maxSegments as number,
                clockImage: this._getClockImage(c, 'progress'),
                category: c.metadata?.category as string | undefined
            }));

        // Identify characters with fewest traits
        const characterObjects = crew.characters
            .map((id: string) => state?.characters.byId[id])
            .filter((c: any) => !!c);
        const idsWithFewestTraits = selectIdsWithFewestTraits(characterObjects);

        // Get character data with harm clocks and addiction clocks
        const characters = crew.characters.map((charId: string) => {
            const char = state?.characters.byId[charId];
            const actor = game.actors?.get(charId);

            // Get harm clocks for this character
            const harmClockKey = `harm:${charId}`;
            const harmClockIds = state?.clocks.byTypeAndEntity[harmClockKey] ?? [];
            const harmClocks = harmClockIds.map((clockId: string) => {
                const clock = state?.clocks.byId[clockId];
                return {
                    id: clock.id as string,
                    subtype: (clock.subtype || 'Harm') as string,
                    segments: clock.segments as number,
                    maxSegments: clock.maxSegments as number,
                    clockImage: this._getClockImage(clock, 'harm')
                };
            });

            // Get addiction clock for this character (per-character, not per-crew)
            const addictionClockKey = `addiction:${charId}`;
            const addictionClockIds = state?.clocks.byTypeAndEntity[addictionClockKey] ?? [];
            let addictionClock = null;
            if (addictionClockIds.length > 0) {
                const clock = state?.clocks.byId[addictionClockIds[0]];
                if (clock) {
                    addictionClock = {
                        id: clock.id as string,
                        segments: clock.segments as number,
                        maxSegments: clock.maxSegments as number,
                        clockImage: this._getClockImage(clock, 'addiction')
                    };
                }
            }

            // Can take action if user is GM or owns the character
            const canTakeAction: boolean = game.user?.isGM === true || actor?.isOwner === true;

            const hasFewestTraits = idsWithFewestTraits.includes(charId);

            return {
                id: charId,
                name: (actor?.name || char?.name || 'Unknown') as string,
                portrait: (actor?.img || 'icons/svg/mystery-man.svg') as string,
                canTakeAction,
                isActive: charId === activeCharacterId,
                harmClocks,
                addictionClock,
                hasFewestTraits
            };
        });

        return {
            crewId: this.crewId!,
            crewName: crew.name,
            currentMomentum: crew.currentMomentum,
            isGM: game.user?.isGM ?? false,
            crewClocks,
            characters,
            activeCharacterId
        };
    }

    /**
     * Activate event listeners on rendered HTML
     */
    activateListeners(html: JQuery): void {
        super.activateListeners(html);

        // Momentum controls (GM only)
        html.find('.momentum-btn.add').on('click', this._onMomentumAdd.bind(this));
        html.find('.momentum-btn.spend').on('click', this._onMomentumSpend.bind(this));
        html.find('.momentum-btn.reset').on('click', this._onMomentumReset.bind(this));

        // Character cards - use 'on' for proper event binding
        html.find('.character-card').on('dblclick', this._onCharacterDoubleClick.bind(this));
        html.find('.take-action-btn').on('click', this._onTakeAction.bind(this));

        // Close button (currently hidden via CSS)
        html.find('.hud-close-btn').on('click', () => CrewHUDPanel.hide());
    }

    /**
     * Add 1 momentum (GM only)
     */
    private async _onMomentumAdd(event: JQuery.ClickEvent): Promise<void> {
        event.preventDefault();
        if (!this.crewId || !game.user?.isGM) return;

        try {
            game.fitgd?.api.crew.addMomentum({ crewId: this.crewId, amount: 1 });
            await game.fitgd?.saveImmediate();
        } catch (error) {
            logger.error('HUD momentum add failed:', error);
        }
    }

    /**
     * Spend 1 momentum (GM only)
     */
    private async _onMomentumSpend(event: JQuery.ClickEvent): Promise<void> {
        event.preventDefault();
        if (!this.crewId || !game.user?.isGM) return;

        try {
            game.fitgd?.api.crew.spendMomentum({ crewId: this.crewId, amount: 1 });
            await game.fitgd?.saveImmediate();
        } catch (error) {
            logger.error('HUD momentum spend failed:', error);
        }
    }

    /**
     * Reset momentum (GM only) - with confirmation
     */
    private async _onMomentumReset(event: JQuery.ClickEvent): Promise<void> {
        event.preventDefault();
        if (!this.crewId || !game.user?.isGM) return;

        // Confirm before reset
        const confirmed = await Dialog.confirm({
            title: 'Reset Momentum',
            content: '<p>Perform full momentum reset? This will reset momentum to starting value, recover harm/addiction clocks, and reset rally for all characters.</p>',
            defaultYes: false
        });

        if (!confirmed) return;

        try {
            game.fitgd?.api.crew.performReset(this.crewId);
            await game.fitgd?.saveImmediate();
            ui.notifications?.info('Momentum reset complete');
        } catch (error) {
            logger.error('HUD momentum reset failed:', error);
        }
    }

    /**
     * Double-click character card to open sheet
     */
    private _onCharacterDoubleClick(event: JQuery.TriggeredEvent): void {
        const characterId = $(event.currentTarget as HTMLElement).data('character-id');
        if (!characterId) return;

        const actor = game.actors?.get(characterId) as any;
        if (actor?.sheet) {
            actor.sheet.render(true);
        }
    }

    /**
     * Click Take Action button to open Player Action Widget
     */
    private async _onTakeAction(event: JQuery.ClickEvent): Promise<void> {
        event.preventDefault();
        event.stopPropagation(); // Don't trigger double-click on card

        const characterId = $(event.currentTarget as HTMLElement).data('character-id');
        if (characterId) {
            await takeAction(characterId);
        }
    }

    /**
     * Get SVG clock image path based on clock state
     *
     * @param clock - Clock object with segments, maxSegments
     * @param type - 'harm' | 'progress' | 'threat' | 'addiction'
     */
    private _getClockImage(clock: any, type: string): string {
        // Determine color theme
        let color = 'blue'; // Default for progress
        if (type === 'harm') {
            color = 'red';
        } else if (type === 'addiction') {
            color = 'yellow';
        } else if (clock.metadata?.category === 'threat') {
            color = 'red';
        }

        const segments = Math.min(clock.segments, clock.maxSegments);
        return `systems/forged-in-the-grimdark/assets/clocks/themes/${color}/${clock.maxSegments}clock_${segments}.svg`;
    }
}
