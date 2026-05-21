import { z } from 'zod';
import {
  CLAIM_STATUSES,
  DOCUMENT_STATUSES,
  REVIEW_STATUSES,
  EXTRACTION_PROVIDERS,
  FIELD_NAMES,
  type ClaimStatus,
  type DocumentStatus,
  type ReviewStatus
} from '@balance/types';

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
  z.string().trim().optional()
);

const optionalNullableTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim().length === 0 ? null : value),
  z.string().trim().nullable().optional()
);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine((val) => /[A-Z]/.test(val), 'Must contain an uppercase letter')
  .refine((val) => /[a-z]/.test(val), 'Must contain a lowercase letter')
  .refine((val) => /[0-9]/.test(val), 'Must contain a digit')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Must contain a special character');

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Display name is required').max(100, 'Display name must not exceed 100 characters'),
  orgName: z.string().trim().min(1, 'Organization name is required').max(100).optional(),
});

export const documentUploadMetadataSchema = z.object({
  label: optionalNullableTrimmedString,
  notes: optionalNullableTrimmedString,
  category: optionalNullableTrimmedString,
  tags: optionalNullableTrimmedString,
  claimIntent: optionalNullableTrimmedString
});

export const documentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  search: optionalTrimmedString,
  category: optionalTrimmedString,
  from: optionalTrimmedString,
  to: optionalTrimmedString,
  minAmount: z.coerce.number().int().min(0).optional(),
  maxAmount: z.coerce.number().int().min(0).optional()
});

export const correctionPayloadSchema = z.object({
  fields: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.enum(FIELD_NAMES),
        correctedValue: z.string().nullable()
      })
    )
    .min(1)
});

export const extractionRetrySchema = z.object({
  provider: z.enum(EXTRACTION_PROVIDERS).optional()
});

export const documentMetadataPatchSchema = z.object({
  label: optionalNullableTrimmedString,
  notes: optionalNullableTrimmedString,
  category: optionalNullableTrimmedString,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  retentionUntil: z.string().datetime().nullable().optional()
});

export const claimSubmissionPayloadSchema = z.object({
  documentId: z.string().uuid(),
  purpose: z.string().min(1),
  note: optionalTrimmedString
});

export const claimListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(CLAIM_STATUSES).optional()
});

export const reviewQueueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(REVIEW_STATUSES).optional()
});

export const reviewApprovePayloadSchema = z.object({
  note: optionalTrimmedString
});

export const reviewRejectPayloadSchema = z.object({
  note: z.string().trim().min(1)
});

export const auditQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  action: optionalTrimmedString,
  entityType: optionalTrimmedString,
  actorRole: optionalTrimmedString,
  search: optionalTrimmedString,
  from: optionalTrimmedString,
  to: optionalTrimmedString,
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type DocumentUploadMetadata = z.infer<typeof documentUploadMetadataSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema> & { status?: DocumentStatus };
export type CorrectionPayload = z.infer<typeof correctionPayloadSchema>;
export type ExtractionRetryPayload = z.infer<typeof extractionRetrySchema>;
export type DocumentMetadataPatch = z.infer<typeof documentMetadataPatchSchema>;
export type ClaimSubmissionPayload = z.infer<typeof claimSubmissionPayloadSchema>;
export type ClaimListQuery = z.infer<typeof claimListQuerySchema> & { status?: ClaimStatus };
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema> & { status?: ReviewStatus };
export type ReviewApprovePayload = z.infer<typeof reviewApprovePayloadSchema>;
export type ReviewRejectPayload = z.infer<typeof reviewRejectPayloadSchema>;
export const createMemberRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'Display name is required').max(100, 'Display name must not exceed 100 characters'),
  role: z.enum(['staff', 'reviewer', 'admin']).optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
export type CreateMemberRequest = z.infer<typeof createMemberRequestSchema>;

export const updateMemberRoleRequestSchema = z.object({
  role: z.enum(['staff', 'reviewer', 'admin']),
});

export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;
