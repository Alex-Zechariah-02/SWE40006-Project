export type AppEnvironment = 'local' | 'staging' | 'production';
export type StorageDriver = 'filesystem' | 's3';

export interface AppConfig {
  appName: string;
  appEnv: AppEnvironment;
  projectSlug: string;
  deploymentNamespace: string;
  appVersion: string;
  gitCommit: string;
  buildId: string;
  webPort: number;
  publicHttpPort: number;
  apiPort: number;
  apiBaseUrl: string;
  apiProxyTarget: string;
  desktopApiBaseUrl: string;
  apiBasePath: string;
  apiHealthPath: string;
  apiVersionPath: string;

  databaseUrl: string;
  redisUrl: string;

  storageDriver: StorageDriver;
  storageFilesystemRoot: string;
  s3Bucket: string;
  s3Region: string;

  jwtSecret: string;
  jwtExpiresIn: string;
  passwordPepper: string;
}

export interface ApiStatusPayload {
  status: 'ok' | 'ready';
  service: 'balance-api';
  app: string;
  environment: AppEnvironment;
  version: string;
}

export interface ApiVersionPayload {
  service: 'balance-api';
  app: string;
  environment: AppEnvironment;
  version: string;
  commit: string;
  build: string;
}
