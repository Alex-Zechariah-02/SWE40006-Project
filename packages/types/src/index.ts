export type AppEnvironment = 'local' | 'staging' | 'production';

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
