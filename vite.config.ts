import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'foundry/dist', // Output to foundry/dist for symlink
    lib: {
      entry: path.resolve(__dirname, 'src/api/index.ts'),
      name: 'FitGD',
      fileName: (format) => `fitgd-core.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      // Bundle all dependencies (no externals for Foundry)
      output: {
        // Ensure imports/exports work in ES modules
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild', // Use esbuild (included with Vite)
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
