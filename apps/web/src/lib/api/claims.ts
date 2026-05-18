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
  submittedAt: string;
  decidedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  document?: {
    id: string;
    originalFilename: string;
    merchantName: string | null;
    amountMinor: number | null;
    currency: string | null;
    status: string;
  };
  review?: {
    id: string;
    status: string;
    decisionNote: string | null;
  } | null;
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
