import type { DocumentSummary } from './api/documents';

export function confidenceBucket(score: number | null | undefined): 'high' | 'medium' | 'low' | 'unknown' {
  if (score == null) return 'unknown';
  if (score >= 90) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

export function documentNeedsReview(document: Pick<DocumentSummary, 'status' | 'qualityScore' | 'amountMinor' | 'merchantName' | 'documentDate'>) {
  return (
    document.status === 'correction_required' ||
    document.status === 'failed' ||
    (document.qualityScore != null && document.qualityScore < 70) ||
    document.amountMinor == null ||
    !document.merchantName ||
    !document.documentDate
  );
}

export function monthKey(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
