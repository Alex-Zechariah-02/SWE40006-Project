export type StorageDriver = 'filesystem' | 's3';

export type StoragePutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export interface StorageDriverAdapter {
  putObject(input: StoragePutObjectInput): Promise<void>;
}

