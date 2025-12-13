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
    // Using 'as any' for hook name since Foundry types don't include all hooks
    Hooks.on('getSceneControlButtons' as any, (controls: any[]) => {
        // Add to token controls group (first control group in the sidebar)
        const tokenControls = controls.find((c: any) => c.name === 'token');
        if (tokenControls) {
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
