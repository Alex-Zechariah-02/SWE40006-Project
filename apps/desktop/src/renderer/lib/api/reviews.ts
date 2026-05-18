import { desktopRequest } from './client';

export interface DesktopReviewQueueItem {
  id: string;
  claimId: string;
  documentId: string;
  status: string;
  consumerName: string;
  originalFilename: string;
  merchantName: string | null;
  amountMinor: number | null;
  currency: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface DesktopReviewDetail {
  id: string;
  claimId: string;
  documentId: string;
  status: string;
  reviewerId: string | null;
  decisionNote: string | null;
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
    actorRole: string;
    message: string;
    createdAt: string;
  }>;
}

export async function desktopListQueue(): Promise<{ reviews: DesktopReviewQueueItem[] }> {
  return desktopRequest('/reviews/queue');
}

export async function desktopGetReview(id: string): Promise<{ review: DesktopReviewDetail }> {
  return desktopRequest(`/reviews/${id}`);
}

export async function desktopClaimReview(id: string) {
  return desktopRequest(`/reviews/${id}/claim`, { method: 'POST' });
}

export async function desktopApproveReview(id: string, note?: string) {
  return desktopRequest(`/reviews/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note: note ?? '' }),
  });
}

export async function desktopRejectReview(id: string, note: string) {
  return desktopRequest(`/reviews/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}
