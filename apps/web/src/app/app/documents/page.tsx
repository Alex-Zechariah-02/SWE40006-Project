'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../components/route-guard';
import { ConsumerLayout } from '../../../components/consumer-layout';
import { StatusBadge } from '../../../components/status-badge';
import { listDocuments } from '../../../lib/api/documents';
import type { DocumentSummary } from '../../../lib/api/documents';
import { BalanceApiError } from '../../../lib/api/client';

export default function DocumentsPage() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <DocumentsContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function DocumentsContent() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listDocuments()
      .then((res) => { setDocuments(res.documents); setLoading(false); })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load documents.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-slate-400">Your uploaded transaction documents.</p>
        </div>
        <Link
          href="/app/documents/upload"
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20 transition"
        >
          Upload document
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading documents…</p>}

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && documents.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-slate-400">No documents yet.</p>
          <Link
            href="/app/documents/upload"
            className="mt-4 inline-block rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20 transition"
          >
            Upload your first document
          </Link>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/app/documents/${doc.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition flex items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{doc.originalFilename}</p>
                <p className="text-xs text-slate-500">
                  {doc.merchantName ?? '—'} · {doc.amountMinor != null ? `${(doc.amountMinor / 100).toFixed(2)} ${doc.currency ?? ''}` : '—'}
                </p>
                <p className="text-xs text-slate-600">{new Date(doc.createdAt).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={doc.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
