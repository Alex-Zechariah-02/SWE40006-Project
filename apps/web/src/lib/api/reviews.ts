import type { ReviewStatus } from '@balance/types';
import { apiRequest } from './client';
import type { PageInfo } from './documents';

export interface ReviewQueueItem {
  id: string;
  claimId: string;
  documentId: string;
  status: ReviewStatus;
  consumerName: string;
  originalFilename: string;
  merchantName: string | null;
  amountMinor: number | null;
  currency: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface ReviewDetail {
  id: string;
  claimId: string;
  documentId: string;
  status: ReviewStatus;
  reviewerId: string | null;
  decisionNote: string | null;
  decidedAt?: string | null;
  document: {
    id: string;
    originalFilename: string;
    status: string;
    merchantName: string | null;
    documentDate: string | null;
    amountMinor: number | null;
    currency: string | null;
    fields: Array<{
      id: string;
      name: string;
      label: string;
      value: string;
      correctedValue: string | null;
      confidence: number | null;
      source: string;
    }>;
  };
  claim: {
    id: string;
    status: string;
    purpose: string;
    note: string | null;
    submittedAt: string;
  };
  auditEvents: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    actorRole: string;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

export async function listReviewQueue(params?: {
  limit?: number;
  offset?: number;
  status?: ReviewStatus;
}): Promise<{ reviews: ReviewQueueItem[]; page: PageInfo }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.status) query.set('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/reviews/queue${qs}`);
}

export async function getReviewDetail(id: string): Promise<{ review: ReviewDetail }> {
  return apiRequest(`/reviews/${id}`);
}

export async function claimReview(id: string): Promise<{
  review: { id: string; status: string; reviewerId: string; updatedAt: string };
  claim: { id: string; status: string; updatedAt: string };
}> {
  return apiRequest(`/reviews/${id}/claim`, { method: 'POST' });
}

export async function approveReview(
  id: string,
  note?: string,
): Promise<{
  review: { id: string; status: string; decisionNote: string | null; decidedAt: string };
  claim: { id: string; status: string; decidedAt: string };
  document: { id: string; status: string };
}> {
  return apiRequest(`/reviews/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? '' }),
  });
}

export async function rejectReview(
  id: string,
  note: string,
): Promise<{
  review: { id: string; status: string; decisionNote: string; decidedAt: string };
  claim: { id: string; status: string; decidedAt: string };
  document: { id: string; status: string };
}> {
  return apiRequest(`/reviews/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}
