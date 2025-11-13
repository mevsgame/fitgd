import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite configuration for building Foundry VTT integration modules
 *
 * This config transpiles TypeScript files in foundry/module/ to .mjs files
 * that Foundry can load. Key features:
 * - Preserves module structure (no bundling)
 * - Adds .mjs extensions to all imports (required by Foundry)
 * - Resolves path aliases (@/ → ../dist/)
 * - Generates source maps for debugging
 */
export default defineConfig({
  build: {
    // Output directory for transpiled .mjs files
    outDir: 'foundry/module-dist',

    // Clear output directory before build
    emptyOutDir: true,

    // Library mode for proper ES module output
    lib: {
      entry: {
        // Main entry point
        'fitgd': path.resolve(__dirname, 'foundry/module/fitgd.ts'),

        // Core infrastructure
        'foundry-redux-bridge': path.resolve(__dirname, 'foundry/module/foundry-redux-bridge.ts'),
        'history-management': path.resolve(__dirname, 'foundry/module/history-management.ts'),

        // Hooks
        'hooks/actor-hooks': path.resolve(__dirname, 'foundry/module/hooks/actor-hooks.ts'),
        'hooks/combat-hooks': path.resolve(__dirname, 'foundry/module/hooks/combat-hooks.ts'),
        'hooks/hotbar-hooks': path.resolve(__dirname, 'foundry/module/hooks/hotbar-hooks.ts'),

        // Helpers
        'helpers/handlebars-helpers': path.resolve(__dirname, 'foundry/module/helpers/handlebars-helpers.ts'),
        'helpers/sheet-helpers': path.resolve(__dirname, 'foundry/module/helpers/sheet-helpers.ts'),
        'helpers/sheet-registration': path.resolve(__dirname, 'foundry/module/helpers/sheet-registration.ts'),

        // Utilities
        'socket/socket-handler': path.resolve(__dirname, 'foundry/module/socket/socket-handler.ts'),
        'settings/system-settings': path.resolve(__dirname, 'foundry/module/settings/system-settings.ts'),
        'autosave/autosave-manager': path.resolve(__dirname, 'foundry/module/autosave/autosave-manager.ts'),
        'console/dev-commands': path.resolve(__dirname, 'foundry/module/console/dev-commands.ts'),

        // Dialogs - Base
        'dialogs/base/dialogHelpers': path.resolve(__dirname, 'foundry/module/dialogs/base/dialogHelpers.ts'),
        'dialogs/base/BaseSelectionDialog': path.resolve(__dirname, 'foundry/module/dialogs/base/BaseSelectionDialog.ts'),

        // Dialogs - Simple
        'dialogs/index': path.resolve(__dirname, 'foundry/module/dialogs/index.ts'),
        'dialogs/AddClockDialog': path.resolve(__dirname, 'foundry/module/dialogs/AddClockDialog.ts'),
        'dialogs/AddTraitDialog': path.resolve(__dirname, 'foundry/module/dialogs/AddTraitDialog.ts'),
        'dialogs/ClockSelectionDialog': path.resolve(__dirname, 'foundry/module/dialogs/ClockSelectionDialog.ts'),
        'dialogs/CharacterSelectionDialog': path.resolve(__dirname, 'foundry/module/dialogs/CharacterSelectionDialog.ts'),

        // Dialogs - Medium
        'dialogs/ClockCreationDialog': path.resolve(__dirname, 'foundry/module/dialogs/ClockCreationDialog.ts'),
        'dialogs/FlashbackDialog': path.resolve(__dirname, 'foundry/module/dialogs/FlashbackDialog.ts'),
        'dialogs/LeanIntoTraitDialog': path.resolve(__dirname, 'foundry/module/dialogs/LeanIntoTraitDialog.ts'),
        'dialogs/PushDialog': path.resolve(__dirname, 'foundry/module/dialogs/PushDialog.ts'),
        'dialogs/TakeHarmDialog': path.resolve(__dirname, 'foundry/module/dialogs/TakeHarmDialog.ts'),
        'dialogs/equipment-edit-dialog': path.resolve(__dirname, 'foundry/module/dialogs/equipment-edit-dialog.ts'),

        // Dialogs - Complex
        'dialogs/ActionRollDialog': path.resolve(__dirname, 'foundry/module/dialogs/ActionRollDialog.ts'),
        'dialogs/FlashbackTraitsDialog': path.resolve(__dirname, 'foundry/module/dialogs/FlashbackTraitsDialog.ts'),
        'dialogs/RallyDialog': path.resolve(__dirname, 'foundry/module/dialogs/RallyDialog.ts'),
        'dialogs/equipment-browser-dialog': path.resolve(__dirname, 'foundry/module/dialogs/equipment-browser-dialog.ts'),

        // Sheets
        'sheets/item-sheets': path.resolve(__dirname, 'foundry/module/sheets/item-sheets.ts'),
        'sheets/crew-sheet': path.resolve(__dirname, 'foundry/module/sheets/crew-sheet.ts'),
        'sheets/character-sheet': path.resolve(__dirname, 'foundry/module/sheets/character-sheet.ts'),

        // Widgets
        'widgets/player-action-widget': path.resolve(__dirname, 'foundry/module/widgets/player-action-widget.ts'),
      },
      formats: ['es'],
    },

    rollupOptions: {
      // Preserve module structure - don't bundle
      output: {
        // Generate .mjs files
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name].mjs',

        // Keep code readable
        compact: false,

        // Preserve original module structure
        preserveModules: true,
        preserveModulesRoot: 'foundry/module',

        // Custom path resolution for imports
        paths: (id: string) => {
          // Rewrite @/ imports to point to dist
          if (id.startsWith('@/')) {
            return '../dist/' + id.slice(2);
          }

          // Handle absolute paths from the project (convert back to relative)
          // This happens when external .mjs modules are resolved
          if (id.startsWith('/home/user/fitgd/foundry/module/')) {
            // Extract the relative path from foundry/module/
            const relativePath = './' + id.replace('/home/user/fitgd/foundry/module/', '');
            return relativePath;
          }

          // Handle core library imports (../dist/fitgd-core.es.js)
          if (id.startsWith('/home/user/fitgd/foundry/dist/')) {
            const fileName = id.replace('/home/user/fitgd/foundry/dist/', '');
            return '../dist/' + fileName;
          }

          // Keep other paths as-is
          return id;
        },
      },

      // Don't bundle these - they're external to the module build
      external: [
        /^\.\.\/dist\//,  // Core library
        '@reduxjs/toolkit',
        'immer',
        // During migration: .mjs files that haven't been converted to .ts yet
        /\.mjs$/,  // Any .mjs import (sheets, widgets, dialogs not yet converted)
      ],

      plugins: [
        // Plugin to add .mjs extensions to imports in the output
        {
          name: 'add-mjs-extension',
          renderChunk(code, chunk) {
            // Rewrite imports to add .mjs extension
            // This runs AFTER bundling, so we're modifying the final output

            // Regex to match import statements with relative paths
            const importRegex = /from\s+['"](\.\.[\/\w\-\/]+|\.\/[\/\w\-\/]+)['"]/g;

            const modifiedCode = code.replace(importRegex, (match, importPath) => {
              // Skip if already has an extension
              if (importPath.match(/\.(mjs|js|json)$/)) {
                return match;
              }

              // Add .mjs extension
              return match.replace(importPath, importPath + '.mjs');
            });

            return {
              code: modifiedCode,
              map: null,  // Sourcemap would need to be regenerated
            };
          },
        },
      ],
    },

    // No minification - keep code readable
    minify: false,

    // Generate source maps for debugging
    sourcemap: true,

    // Target modern browsers (Foundry uses Chromium)
    target: 'es2020',
  },

  resolve: {
    alias: {
      // Resolve @/ to src directory
      '@': path.resolve(__dirname, './src'),
      '@foundry': path.resolve(__dirname, './foundry/module'),
    },
  },
});
