'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../components/route-guard';
import { ConsumerLayout } from '../../../components/consumer-layout';
import { StatusBadge } from '../../../components/status-badge';
import { listClaims } from '../../../lib/api/claims';
import type { Claim } from '../../../lib/api/claims';
import { BalanceApiError } from '../../../lib/api/client';

export default function ClaimsPage() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <ClaimsContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function ClaimsContent() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClaims()
      .then((res) => { setClaims(res.claims); setLoading(false); })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load claims.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
        <p className="mt-1 text-sm text-slate-400">Your submitted claims and their current status.</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading claims…</p>}

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && claims.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-slate-400">No claims submitted yet.</p>
          <Link
            href="/app/documents"
            className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
          >
            Upload a document to get started →
          </Link>
        </div>
      )}

      {!loading && claims.length > 0 && (
        <div className="flex flex-col gap-3">
          {claims.map((claim) => (
            <Link
              key={claim.id}
              href={`/app/claims/${claim.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition flex items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{claim.purpose}</p>
                <p className="text-xs text-slate-500">
                  {claim.document?.originalFilename ?? claim.documentId}
                  {claim.document?.merchantName ? ` · ${claim.document.merchantName}` : ''}
                  {claim.document?.amountMinor != null
                    ? ` · ${(claim.document.amountMinor / 100).toFixed(2)} ${claim.document.currency ?? ''}`
                    : ''}
                </p>
                <p className="text-xs text-slate-600">{new Date(claim.submittedAt).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={claim.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
