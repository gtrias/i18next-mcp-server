import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: true,
    testTimeout: 30000, // 30 seconds should be enough
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: './coverage'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
}); 