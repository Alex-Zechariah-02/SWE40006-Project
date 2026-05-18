'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../../components/route-guard';
import { ConsumerLayout } from '../../../../components/consumer-layout';
import { StatusBadge } from '../../../../components/status-badge';
import { getClaim } from '../../../../lib/api/claims';
import type { Claim } from '../../../../lib/api/claims';
import { BalanceApiError } from '../../../../lib/api/client';

export default function ClaimDetailPage() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <ClaimDetailContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function ClaimDetailContent() {
  const params = useParams();
  const id = params?.id as string;

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClaim(id)
      .then((res) => { setClaim(res.claim); setLoading(false); })
      .catch((err) => {
        if (err instanceof BalanceApiError && err.status === 404) setError('Claim not found.');
        else if (err instanceof BalanceApiError && err.status === 403) setError('Access denied.');
        else setError('Failed to load claim.');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="text-sm text-slate-400">Loading claim…</p>;
  if (error) return (
    <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>
  );
  if (!claim) return null;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{claim.purpose}</h1>
          <p className="mt-1 text-xs text-slate-500">Submitted {new Date(claim.submittedAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
        {claim.note && (
          <div>
            <p className="text-xs font-medium text-slate-500">Note</p>
            <p className="text-sm text-slate-200 mt-0.5">{claim.note}</p>
          </div>
        )}
        {claim.document && (
          <div>
            <p className="text-xs font-medium text-slate-500">Document</p>
            <Link href={`/app/documents/${claim.document.id}`} className="text-sm text-emerald-400 hover:underline">
              {claim.document.originalFilename}
            </Link>
          </div>
        )}
        {claim.review && (
          <div>
            <p className="text-xs font-medium text-slate-500">Review status</p>
            <StatusBadge status={claim.review.status} />
            {claim.review.decisionNote && (
              <p className="mt-1 text-sm text-slate-300">{claim.review.decisionNote}</p>
            )}
          </div>
        )}
        {claim.decidedAt && (
          <div>
            <p className="text-xs font-medium text-slate-500">Decided</p>
            <p className="text-sm text-slate-300">{new Date(claim.decidedAt).toLocaleString()}</p>
          </div>
        )}
      </div>

      <Link href="/app/claims" className="text-sm text-slate-400 hover:text-slate-200">← Back to claims</Link>
    </div>
  );
}
