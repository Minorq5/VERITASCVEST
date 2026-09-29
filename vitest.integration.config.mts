import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Tests against the local Supabase stack (`npm run db:start`). */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.int.test.ts'],
    // IndexedDB for Dexie in Node: must load before Dexie is imported.
    setupFiles: ['fake-indexeddb/auto'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
