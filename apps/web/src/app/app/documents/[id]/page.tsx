'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RouteGuard } from '../../../../components/route-guard';
import { ConsumerLayout } from '../../../../components/consumer-layout';
import { StatusBadge } from '../../../../components/status-badge';
import { getDocument, saveDocumentCorrections } from '../../../../lib/api/documents';
import { submitClaim } from '../../../../lib/api/claims';
import { BalanceApiError } from '../../../../lib/api/client';
import type { DocumentDetail, DocumentField } from '../../../../lib/api/documents';

const POLLING_STATUSES = new Set(['queued', 'processing']);
const CORRECTION_ALLOWED = new Set(['extracted', 'correction_required', 'corrected']);
const CLAIM_ALLOWED = new Set(['extracted', 'corrected']);

// amountMinor is stored as integer minor units (100 = 1.00)
const MINOR_UNIT_FIELDS = new Set(['amountMinor']);

function displayValue(field: DocumentField): string {
  return field.correctedValue ?? field.value;
}

export default function DocumentDetailPage() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <DocumentDetailContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function DocumentDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const res = await getDocument(id);
      setDoc(res.document);
      setError(null);
      setLoading(false);
      return res.document;
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 404) setError('Document not found.');
      else if (err instanceof BalanceApiError && err.status === 403) setError('Access denied.');
      else setError('Failed to load document.');
      setLoading(false);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const d = await fetchDoc();
      if (cancelled || !d) return;
      if (POLLING_STATUSES.has(d.status)) {
        pollRef.current = setTimeout(poll, 4000);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchDoc]);

  if (loading) return <p className="text-sm text-slate-400">Loading document…</p>;
  if (error) return (
    <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>
  );
  if (!doc) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{doc.originalFilename}</h1>
          <p className="mt-1 text-xs text-slate-500">Uploaded {new Date(doc.createdAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {/* Extraction status */}
      {doc.extractionJob && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Extraction</p>
          <div className="flex items-center gap-3">
            <StatusBadge status={doc.extractionJob.status} />
            {doc.extractionJob.status === 'failed' && doc.extractionJob.errorMessage && (
              <p className="text-sm text-red-300">{doc.extractionJob.errorMessage}</p>
            )}
            {POLLING_STATUSES.has(doc.status) && (
              <p className="text-xs text-slate-400 animate-pulse">Processing…</p>
            )}
          </div>
        </div>
      )}

      {/* Extracted fields — read only summary */}
      {doc.fields.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Extracted fields</p>
          <div className="flex flex-col gap-2">
            {doc.fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-400 w-36 shrink-0">{field.label ?? field.name}</span>
                <span className="text-slate-100 flex-1">
                  {displayValue(field)}
                  {field.correctedValue && field.correctedValue !== field.value && (
                    <span className="ml-2 text-xs text-slate-500 line-through">{field.value}</span>
                  )}
                </span>
                {field.confidence != null && (
                  <span className="text-xs text-slate-600">{Math.round(field.confidence * 100)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Correction form — always editable while in allowed statuses */}
      {CORRECTION_ALLOWED.has(doc.status) && doc.fields.length > 0 && !doc.claim && (
        <CorrectionForm doc={doc} onSaved={(updated) => setDoc(updated)} />
      )}

      {/* Claim submission */}
      {CLAIM_ALLOWED.has(doc.status) && !doc.claim && (
        <ClaimForm documentId={doc.id} onSubmitted={() => {
          void fetchDoc();
          router.push('/app/claims');
        }} />
      )}

      {/* Already submitted */}
      {doc.claim && (
        <div className="rounded-2xl border border-purple-400/20 bg-purple-400/10 p-5">
          <p className="text-sm text-purple-300">This document has been submitted as a claim.</p>
          <a href="/app/claims" className="mt-2 inline-block text-xs text-purple-400 hover:underline">View claims →</a>
        </div>
      )}
    </div>
  );
}

function CorrectionForm({ doc, onSaved }: { doc: DocumentDetail; onSaved: (d: DocumentDetail) => void }) {
  const [corrections, setCorrections] = useState<Record<string, string>>(() =>
    Object.fromEntries(doc.fields.map((f) => [f.name, f.correctedValue ?? f.value]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync form when doc updates after save
  useEffect(() => {
    setCorrections(Object.fromEntries(doc.fields.map((f) => [f.name, f.correctedValue ?? f.value])));
    setSuccess(false);
    setError(null);
  }, [doc.id, doc.status]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const changed = doc.fields
      .filter((f) => corrections[f.name] !== (f.correctedValue ?? f.value))
      .map((f) => ({ name: f.name, correctedValue: corrections[f.name] ?? '' }));

    if (changed.length === 0) { setError('No changes to save.'); return; }

    setSaving(true);
    try {
      const res = await saveDocumentCorrections(doc.id, changed);
      onSaved(res.document);
      setSuccess(true);
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) {
        setError(`Cannot correct at current status: ${doc.status}`);
      } else {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to save corrections.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">Correct fields</p>
      <p className="text-xs text-slate-500 mb-4">
        For <strong className="text-slate-400">Amount</strong>, enter the value in minor units (e.g. enter <code className="text-slate-300">444</code> to mean 4.44, or <code className="text-slate-300">4400</code> to mean 44.00).
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {doc.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {field.label ?? field.name}
              {MINOR_UNIT_FIELDS.has(field.name) && (
                <span className="ml-2 text-slate-600 font-normal">(minor units)</span>
              )}
            </label>
            <input
              type="text"
              value={corrections[field.name] ?? ''}
              onChange={(e) => setCorrections((prev) => ({ ...prev, [field.name]: e.target.value }))}
              disabled={saving}
              placeholder={field.value}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/50 focus:outline-none disabled:opacity-50"
            />
            <p className="mt-0.5 text-xs text-slate-600">
              Original: {field.value}
              {field.correctedValue && field.correctedValue !== field.value && ` · Previously corrected: ${field.correctedValue}`}
            </p>
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {success && <p className="text-sm text-emerald-300">Corrections saved successfully.</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save corrections'}
        </button>
      </form>
    </div>
  );
}

function ClaimForm({ documentId, onSubmitted }: { documentId: string; onSubmitted: () => void }) {
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!purpose.trim()) { setError('Purpose is required.'); return; }

    setSubmitting(true);
    try {
      await submitClaim({ documentId, purpose: purpose.trim(), note: note.trim() || '' });
      onSubmitted();
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) setError('Document is not eligible for claim submission.');
      else setError(err instanceof BalanceApiError ? err.error.message : 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-purple-400/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Submit claim</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="purpose" className="block text-xs font-medium text-slate-400 mb-1">Purpose</label>
          <input
            id="purpose"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            disabled={submitting}
            placeholder="e.g. Reimbursement claim"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-purple-400/50 focus:outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="claim-note" className="block text-xs font-medium text-slate-400 mb-1">Note <span className="text-slate-600">(optional)</span></label>
          <textarea
            id="claim-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            rows={2}
            placeholder="Additional context…"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-purple-400/50 focus:outline-none disabled:opacity-50 resize-none"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-xl border border-purple-400/30 bg-purple-400/10 px-4 py-2 text-sm font-medium text-purple-200 hover:bg-purple-400/20 transition disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit claim'}
        </button>
      </form>
    </div>
  );
}
