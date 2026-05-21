import type { ClaimStatus } from '@balance/types';
import { apiRequest } from './client';
import type { PageInfo } from './documents';

export interface Claim {
  id: string;
  documentId: string;
  consumerId?: string;
  status: ClaimStatus;
  purpose: string;
  note: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  consumer?: {
    id: string;
    displayName: string;
    email: string;
  };
  document?: {
    id: string;
    originalFilename: string;
    contentType?: string;
    merchantName: string | null;
    documentDate?: string | null;
    amountMinor: number | null;
    currency: string | null;
    status: string;
    fields?: Array<{
      id: string;
      name: string;
      value: string;
      correctedValue: string | null;
      confidence: number | null;
      source: string;
    }>;
  };
  review?: {
    id: string;
    status: string;
    reviewerId?: string | null;
    decisionNote: string | null;
    decidedAt?: string | null;
  } | null;
  auditEvents?: Array<{
    id: string;
    action: string;
    entityType: string;
    actorRole: string;
    message: string;
    createdAt: string;
  }>;
}

export interface Review {
  id: string;
  claimId: string;
  documentId: string;
  status: string;
  reviewerId: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function submitClaim(params: {
  documentId: string;
  purpose: string;
  note?: string;
}): Promise<{ claim: Claim; review: Review }> {
  return apiRequest('/claims', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function listClaims(params?: {
  limit?: number;
  offset?: number;
  status?: ClaimStatus;
}): Promise<{ claims: Claim[]; page: PageInfo }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.status) query.set('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/claims${qs}`);
}

export async function getClaim(id: string): Promise<{ claim: Claim }> {
  return apiRequest(`/claims/${id}`);
}

export async function recallClaim(id: string): Promise<{ claim: { id: string; status: ClaimStatus; updatedAt: string }; document: { id: string; status: string } }> {
  return apiRequest(`/claims/${id}/recall`, { method: 'POST' });
}

export interface ClaimInsights {
  totalClaims: number;
  statusCounts: Record<string, number>;
  approvedAmountMinor: number;
  pendingAmountMinor: number;
  rejectedAmountMinor: number;
  recentClaims: Claim[];
}

export async function getClaimInsights(): Promise<{ insights: ClaimInsights }> {
  return apiRequest('/claims/insights');
}
