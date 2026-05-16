export type AppEnvironment = 'local' | 'staging' | 'production';
export type StorageDriver = 'filesystem' | 's3';

export const USER_ROLES = ['consumer', 'reviewer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DOCUMENT_STATUSES = [
  'uploaded',
  'queued',
  'processing',
  'extracted',
  'correction_required',
  'corrected',
  'submitted',
  'reviewed',
  'rejected',
  'failed'
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXTRACTION_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type ExtractionJobStatus = (typeof EXTRACTION_JOB_STATUSES)[number];

export const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'rejected'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'in_review', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const ENTITY_TYPES = ['document', 'extraction_job', 'claim', 'review'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  'document.uploaded',
  'extraction.queued',
  'extraction.started',
  'extraction.completed',
  'extraction.failed',
  'document.corrected',
  'claim.submitted',
  'review.started',
  'review.approved',
  'review.rejected'
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

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
