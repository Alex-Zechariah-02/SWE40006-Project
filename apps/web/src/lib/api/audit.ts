import { apiRequest } from './client';
import type { PageInfo } from './documents';

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  actorRole: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditEvents(params: {
  documentId?: string;
  claimId?: string;
  reviewId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ auditEvents: AuditEvent[]; page: PageInfo }> {
  const query = new URLSearchParams();
  if (params.documentId) query.set('documentId', params.documentId);
  if (params.claimId) query.set('claimId', params.claimId);
  if (params.reviewId) query.set('reviewId', params.reviewId);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  return apiRequest(`/audit?${query.toString()}`);
}
