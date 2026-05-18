'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../components/route-guard';
import { EnterpriseLayout } from '../../../components/enterprise-layout';
import { StatusBadge } from '../../../components/status-badge';
import { listReviewQueue } from '../../../lib/api/reviews';
import type { ReviewQueueItem } from '../../../lib/api/reviews';
import { BalanceApiError } from '../../../lib/api/client';

export default function ReviewQueuePage() {
  return (
    <RouteGuard allowedRoles={['reviewer', 'admin']}>
      <EnterpriseLayout>
        <ReviewQueueContent />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

function ReviewQueueContent() {
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listReviewQueue()
      .then((res) => { setReviews(res.reviews); setLoading(false); })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load review queue.');
        setLoading(false);
      });
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
          <p className="mt-1 text-sm text-slate-400">Submitted claims awaiting review.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-white/20 transition disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading queue…</p>}

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-slate-400">No items in the review queue.</p>
        </div>
      )}

      {!loading && reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/enterprise/reviews/${review.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/8 transition flex items-center justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{review.originalFilename}</p>
                <p className="text-xs text-slate-500">
                  {review.consumerName} · {review.merchantName ?? '—'}
                  {review.amountMinor != null
                    ? ` · ${(review.amountMinor / 100).toFixed(2)} ${review.currency ?? ''}`
                    : ''}
                </p>
                <p className="text-xs text-slate-600">Submitted {new Date(review.submittedAt).toLocaleDateString()}</p>
              </div>
              <StatusBadge status={review.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
