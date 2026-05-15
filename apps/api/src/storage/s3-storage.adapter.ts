import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { StorageDriverAdapter, StoragePutObjectInput } from './storage.types';

export class S3StorageAdapter implements StorageDriverAdapter {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string
  ) {
    this.client = new S3Client({ region });
  }

  async putObject(input: StoragePutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType
      })
    );
  }
}

