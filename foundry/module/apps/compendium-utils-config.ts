/**
 * Compendium Utilities Configuration Menu
 */

import { CompendiumSyncService } from '../services/compendium-sync';

export class CompendiumUtilsConfig extends FormApplication {
    static get defaultOptions(): any {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'compendium-utils-config',
            classes: ['fitgd', 'compendium-utils'],
            title: 'Compendium Utilities',
            template: 'systems/forged-in-the-grimdark/templates/apps/compendium-utils.html',
            width: 400,
            height: 'auto',
            resizable: true
        });
    }

    getData(): object {
        return {
            // Pass data to template if needed
        };
    }

    activateListeners(html: JQuery): void {
        super.activateListeners(html);

        html.find('#sync-equipment-btn').on('click', async (e) => {
            e.preventDefault();
            await CompendiumSyncService.syncAll();
        });
    }

    async _updateObject(_event: Event, _formData: object): Promise<void> {
        // No settings to save, just buttons
    }
}
