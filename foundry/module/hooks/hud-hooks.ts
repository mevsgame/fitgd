/**
 * HUD Hooks
 *
 * Registers the Crew HUD Panel toggle button in Foundry's scene controls
 * and handles auto-restoration of HUD visibility on page load.
 */

import { CrewHUDPanel } from '../widgets/crew-hud-panel';
import { logger } from '../utils/logger';

/**
 * Register HUD-related hooks
 */
export function registerHUDHooks(): void {
    // Add toggle button to scene controls
    // Foundry V12 changed the hook signature - controls may be an object with categories
    Hooks.on('getSceneControlButtons' as any, (controls: any) => {
        try {
            // Handle both V11 (array) and V12 (object with categories) formats
            let tokenControls: any = null;

            if (Array.isArray(controls)) {
                // V11 format: controls is an array
                tokenControls = controls.find((c: any) => c.name === 'token');
            } else if (controls && typeof controls === 'object') {
                // V12 format: controls may be an object or have a different structure
                // Try to find the token group
                if (controls.token) {
                    tokenControls = controls.token;
                } else if (controls.controls && Array.isArray(controls.controls)) {
                    tokenControls = controls.controls.find((c: any) => c.name === 'token');
                }
            }

            if (tokenControls && tokenControls.tools) {
                // Check if we haven't already added the button
                const existingTool = tokenControls.tools.find?.((t: any) => t.name === 'crew-hud');
                if (!existingTool) {
                    tokenControls.tools.push({
                        name: 'crew-hud',
                        title: 'Toggle Crew HUD',
                        icon: 'fas fa-users',
                        toggle: true,
                        active: CrewHUDPanel.isVisible(),
                        onClick: (toggled: boolean) => {
                            if (toggled) {
                                CrewHUDPanel.show();
                            } else {
                                CrewHUDPanel.hide();
                            }
                        }
                    });
                }
            }
        } catch (error) {
            logger.warn('Could not add Crew HUD toggle to scene controls:', error);
        }
    });

    // Auto-restore HUD on game ready if it was previously open
    Hooks.once('ready', () => {
        // Delay slightly to ensure all systems are initialized
        setTimeout(() => {
            try {
                const hudVisible = game.settings.get('forged-in-the-grimdark', 'hudVisible') as boolean;
                const primaryCrewId = game.settings.get('forged-in-the-grimdark', 'primaryCrewId') as string;

                if (hudVisible && primaryCrewId) {
                    logger.info('Auto-restoring Crew HUD for crew:', primaryCrewId);
                    CrewHUDPanel.show(primaryCrewId);
                }
            } catch (error) {
                logger.warn('Could not auto-restore HUD:', error);
            }
        }, 1000);
    });
}
