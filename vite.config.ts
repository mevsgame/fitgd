import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/api/index.ts'),
      name: 'FitGD',
      fileName: (format) => `fitgd-core.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@reduxjs/toolkit'],
      output: {
        globals: {
          '@reduxjs/toolkit': 'RTK',
        },
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
