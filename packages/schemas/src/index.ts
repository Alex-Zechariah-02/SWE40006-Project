import { z } from 'zod';
import {
  CLAIM_STATUSES,
  DOCUMENT_STATUSES,
  REVIEW_STATUSES,
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

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const documentUploadMetadataSchema = z.object({
  label: optionalNullableTrimmedString,
  notes: optionalNullableTrimmedString
});

export const documentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional()
});

export const correctionPayloadSchema = z.object({
  fields: z
    .array(
      z.object({
        name: z.enum(['merchantName', 'documentDate', 'amountMinor', 'currency']),
        correctedValue: z.string().nullable()
      })
    )
    .min(1)
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
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type DocumentUploadMetadata = z.infer<typeof documentUploadMetadataSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema> & { status?: DocumentStatus };
export type CorrectionPayload = z.infer<typeof correctionPayloadSchema>;
export type ClaimSubmissionPayload = z.infer<typeof claimSubmissionPayloadSchema>;
export type ClaimListQuery = z.infer<typeof claimListQuerySchema> & { status?: ClaimStatus };
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema> & { status?: ReviewStatus };
export type ReviewApprovePayload = z.infer<typeof reviewApprovePayloadSchema>;
export type ReviewRejectPayload = z.infer<typeof reviewRejectPayloadSchema>;
export type AuditQuery = z.infer<typeof auditQuerySchema>;
