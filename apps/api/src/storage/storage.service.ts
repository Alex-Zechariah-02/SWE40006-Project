import { Injectable } from '@nestjs/common';

import { throwContractHttpError } from '../common/contract-errors';

import { FilesystemStorageAdapter } from './filesystem-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import type { StorageDriver, StorageDriverAdapter } from './storage.types';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();
  throw new Error(`${name} is required`);
}

function requiredEnvOneOf(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  throw new Error(`${names.join(' or ')} is required`);
}

function parseStorageDriver(value: string | undefined): StorageDriver {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 's3') return 's3';
  return 'filesystem';
}

function extensionForContentType(contentType: string): string | null {
  const normalized = contentType.trim().toLowerCase();
  if (normalized === 'application/pdf') return 'pdf';
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  return null;
}

@Injectable()
export class StorageService {
  private readonly driver: StorageDriver;
  private readonly adapter: StorageDriverAdapter;

  constructor() {
    this.driver = parseStorageDriver(process.env.STORAGE_DRIVER);

    if (this.driver === 's3') {
      const bucket = requiredEnv('S3_BUCKET');
      const region = requiredEnvOneOf(['S3_REGION', 'AWS_REGION']);
      this.adapter = new S3StorageAdapter(bucket, region);
      return;
    }

    const rootDir = (process.env.STORAGE_FILESYSTEM_ROOT || '/data/balance-storage').trim();
    this.adapter = new FilesystemStorageAdapter(rootDir);
  }

  buildDocumentStorageKey(documentId: string, contentType: string): string {
    const ext = extensionForContentType(contentType);
    if (!ext) {
      throwContractHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', []);
    }
    return `documents/${documentId}/original.${ext}`;
  }

  async saveUploadedDocumentFile(input: {
    documentId: string;
    contentType: string;
    body: Buffer;
  }): Promise<{ storageKey: string }> {
    const storageKey = this.buildDocumentStorageKey(input.documentId, input.contentType);

    try {
      await this.adapter.putObject({
        key: storageKey,
        body: input.body,
        contentType: input.contentType
      });
    } catch {
      throwContractHttpError(503, 'SERVICE_UNAVAILABLE', 'Storage unavailable', []);
    }

    return { storageKey };
  }
}
