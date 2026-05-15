import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { StorageDriverAdapter, StoragePutObjectInput } from './storage.types';

export class FilesystemStorageAdapter implements StorageDriverAdapter {
  constructor(private readonly rootDir: string) {}

  async putObject(input: StoragePutObjectInput): Promise<void> {
    const normalizedKey = input.key.replace(/^\/+/, '');

    // Prevent path traversal by enforcing that the resolved path stays inside rootDir.
    const targetPath = path.resolve(this.rootDir, normalizedKey);
    const resolvedRoot = path.resolve(this.rootDir);
    if (!targetPath.startsWith(resolvedRoot + path.sep) && targetPath !== resolvedRoot) {
      throw new Error('Invalid storage key');
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, input.body);
  }
}

