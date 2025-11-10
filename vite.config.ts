import { defineConfig } from 'vite';
import path from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    dts({
      // Generate TypeScript declaration files
      insertTypesEntry: true,
      rollupTypes: false, // Keep individual .d.ts files
      outDir: 'foundry/dist',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      copyDtsFiles: true,
    }),
  ],
  build: {
    outDir: 'foundry/dist', // Output to foundry/dist for symlink
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'FitGD',
      fileName: (format) => `fitgd-core.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      // Bundle all dependencies (no externals for Foundry)
      output: {
        // Ensure imports/exports work in ES modules
        inlineDynamicImports: true,
        // Keep function/variable names for readability
        compact: false,
        // Preserve original names in minified output
        preserveModules: false,
      },
    },
    // Disable minification to keep code readable
    // Trade-off: larger bundle (~300kb) but human-readable
    minify: false,
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
