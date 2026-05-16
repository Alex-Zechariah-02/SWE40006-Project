import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@balance/config': resolve(repoRoot, 'packages/config/src/index.ts'),
      '@balance/db': resolve(repoRoot, 'packages/db/src/index.ts'),
      '@balance/schemas': resolve(repoRoot, 'packages/schemas/src/index.ts'),
      '@balance/types': resolve(repoRoot, 'packages/types/src/index.ts'),
      '@balance/utils': resolve(repoRoot, 'packages/utils/src/index.ts')
    }
  }
});
