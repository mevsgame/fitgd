// vite.config.ts (The one and only config file)

import { defineConfig } from 'vite';
import path from 'path';

// export default defineConfig({
export default defineConfig(({ mode }) => ({
  // Keep this for Redux Toolkit
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'test' ? 'test' : 'production'),
  },

  // We are not using any special plugins for this simple bundle
  plugins: [],

  build: {
    // The final output directory where Foundry will look for the file
    outDir: 'foundry/dist',

    // Clear the directory before building
    emptyOutDir: true,

    // Sourcemaps are essential for debugging your TS code in the browser
    sourcemap: true,

    // Do not minify, as requested
    minify: false,

    rollupOptions: {
      // THIS IS THE MOST IMPORTANT CHANGE.
      // We are telling Vite that our application STARTS at fitgd.ts.
      // Vite will read this file and bundle everything it imports.
      input: {
        'fitgd': path.resolve(__dirname, 'foundry/module/fitgd.ts'),
      },

      output: {
        // We will output a single .mjs file that Foundry can use.
        // The name will be 'fitgd.mjs' because the input key is 'fitgd'.
        entryFileNames: '[name].mjs',
        format: 'es',

        // Keep code readable
        compact: false,
      },
    },
  },

  // This is crucial so your imports work correctly
  resolve: {
    alias: {
      // Allows you to use `import ... from '@/...'` in your foundry code
      '@': path.resolve(__dirname, './src'),

      // Allows you to use `import ... from '@foundry/...'`
      '@foundry': path.resolve(__dirname, './foundry/module'),
    },
  },

  // Vitest Configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    reporters: ['dot', 'junit'],
    outputFile: 'test-results.xml',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
}));