import type { DocumentStatus, ExtractionJobStatus } from '@balance/types';
import { apiRequest, apiUpload } from './client';

export interface DocumentField {
  id: string;
  name: string;
  label: string;
  value: string;
  correctedValue: string | null;
  confidence: number | null;
  source: 'ocr' | 'manual' | 'system';
}

export interface ExtractionJob {
  id: string;
  documentId?: string;
  status: ExtractionJobStatus;
  provider: string;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface DocumentSummary {
  id: string;
  ownerId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  status: DocumentStatus;
  merchantName: string | null;
  documentDate: string | null;
  amountMinor: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  fields: DocumentField[];
  extractionJob: ExtractionJob | null;
  claim: { id: string; status: string } | null;
  review: { id: string; status: string } | null;
}

export interface PageInfo {
  limit: number;
  offset: number;
  total: number;
}

export interface UploadDocumentResponse {
  document: DocumentSummary;
  extractionJob: ExtractionJob;
}

export interface CorrectionField {
  name: string;
  correctedValue: string;
}

export async function uploadDocument(
  file: File,
  label?: string,
  notes?: string,
): Promise<UploadDocumentResponse> {
  const form = new FormData();
  form.append('file', file);
  if (label) form.append('label', label);
  if (notes) form.append('notes', notes);
  return apiUpload<UploadDocumentResponse>('/documents', form);
}

export async function listDocuments(params?: {
  limit?: number;
  offset?: number;
  status?: DocumentStatus;
}): Promise<{ documents: DocumentSummary[]; page: PageInfo }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.status) query.set('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/documents${qs}`);
}

export async function getDocument(id: string): Promise<{ document: DocumentDetail }> {
  return apiRequest(`/documents/${id}`);
}

export async function saveDocumentCorrections(
  id: string,
  fields: CorrectionField[],
): Promise<{ document: DocumentDetail }> {
  return apiRequest(`/documents/${id}/corrections`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
}
