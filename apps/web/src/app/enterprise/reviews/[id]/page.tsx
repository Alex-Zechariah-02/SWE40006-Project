'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../../components/route-guard';
import { EnterpriseLayout } from '../../../../components/enterprise-layout';
import { StatusBadge } from '../../../../components/status-badge';
import { claimReview, approveReview, rejectReview, getReviewDetail } from '../../../../lib/api/reviews';
import type { ReviewDetail } from '../../../../lib/api/reviews';
import { BalanceApiError } from '../../../../lib/api/client';
import { useAuth } from '../../../../context/auth-context';

export default function ReviewDetailPage() {
  return (
    <RouteGuard allowedRoles={['reviewer', 'admin']}>
      <EnterpriseLayout>
        <ReviewDetailContent />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

function ReviewDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const router = useRouter();

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [claiming, setClaiming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  function loadReview() {
    setLoading(true);
    getReviewDetail(id)
      .then((res) => { setReview(res.review); setLoading(false); })
      .catch((err) => {
        if (err instanceof BalanceApiError && err.status === 404) setError('Review not found.');
        else if (err instanceof BalanceApiError && err.status === 403) setError('Access denied. Another reviewer may have claimed this item.');
        else setError('Failed to load review.');
        setLoading(false);
      });
  }

  useEffect(() => { loadReview(); }, [id]);

  async function handleClaim() {
    setActionError(null);
    setClaiming(true);
    try {
      await claimReview(id);
      loadReview();
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) setActionError('Review is no longer pending or has already been claimed.');
      else if (err instanceof BalanceApiError && err.status === 403) setActionError('Access denied.');
      else setActionError('Failed to claim review. Please try again.');
    } finally {
      setClaiming(false);
    }
  }

  async function handleApprove() {
    setActionError(null);
    setApproving(true);
    try {
      await approveReview(id);
      router.push('/enterprise/reviews');
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) setActionError('Review cannot be approved at this stage.');
      else if (err instanceof BalanceApiError && err.status === 403) setActionError('You are not assigned to this review.');
      else setActionError('Failed to approve. Please try again.');
      setApproving(false);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    if (!rejectNote.trim()) { setActionError('Rejection reason is required.'); return; }

    setRejecting(true);
    try {
      await rejectReview(id, rejectNote.trim());
      router.push('/enterprise/reviews');
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 409) setActionError('Review cannot be rejected at this stage.');
      else if (err instanceof BalanceApiError && err.status === 403) setActionError('You are not assigned to this review.');
      else setActionError('Failed to reject. Please try again.');
      setRejecting(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading review…</p>;
  if (error) return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>
      <Link href="/enterprise/reviews" className="text-sm text-slate-400 hover:text-slate-200">← Back to queue</Link>
    </div>
  );
  if (!review) return null;

  const isAssignedToMe = review.reviewerId === user?.id || user?.role === 'admin';
  const canClaim = review.status === 'pending';
  const canDecide = review.status === 'in_review' && isAssignedToMe;
  const isFinal = review.status === 'approved' || review.status === 'rejected';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/enterprise/reviews" className="text-xs text-slate-500 hover:text-slate-300 mb-2 inline-block">← Review queue</Link>
          <h1 className="text-xl font-semibold tracking-tight">{review.document.originalFilename}</h1>
          <p className="mt-1 text-xs text-slate-500">Claim: {review.claim.purpose}</p>
        </div>
        <StatusBadge status={review.status} />
      </div>

      {/* Document info */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Document</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-slate-500">Merchant</p><p className="text-slate-100">{review.document.merchantName ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Amount</p><p className="text-slate-100">{review.document.amountMinor != null ? `${(review.document.amountMinor / 100).toFixed(2)} ${review.document.currency ?? ''}` : '—'}</p></div>
          <div><p className="text-xs text-slate-500">Date</p><p className="text-slate-100">{review.document.documentDate ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Document status</p><StatusBadge status={review.document.status} /></div>
        </div>
      </div>

      {/* Extracted fields */}
      {review.document.fields.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Extracted fields</p>
          <div className="flex flex-col gap-2">
            {review.document.fields.map((field) => (
              <div key={field.id} className="flex items-center gap-4 text-sm">
                <span className="text-slate-400 w-32 shrink-0">{field.label}</span>
                <span className="text-slate-100">
                  {field.correctedValue ?? field.value}
                  {field.correctedValue && (
                    <span className="ml-2 text-xs text-slate-500 line-through">{field.value}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim info */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Claim</p>
        <p className="text-sm text-slate-100">{review.claim.purpose}</p>
        {review.claim.note && <p className="text-sm text-slate-400">{review.claim.note}</p>}
        <p className="text-xs text-slate-600">Submitted {new Date(review.claim.submittedAt).toLocaleString()}</p>
        <StatusBadge status={review.claim.status} />
      </div>

      {/* Audit timeline */}
      {review.auditEvents.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Audit timeline</p>
          <div className="flex flex-col gap-2">
            {review.auditEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 text-xs">
                <span className="text-slate-600 w-36 shrink-0">{new Date(event.createdAt).toLocaleString()}</span>
                <span className="text-slate-400">{event.message}</span>
                <span className="text-slate-600 ml-auto">{event.actorRole}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision controls */}
      {!isFinal && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Actions</p>

          {actionError && (
            <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
              {actionError}
            </p>
          )}

          {canClaim && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-fit rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-400/20 transition disabled:opacity-50"
            >
              {claiming ? 'Claiming…' : 'Start review'}
            </button>
          )}

          {canDecide && !showRejectForm && (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving || rejecting}
                className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-400/20 transition disabled:opacity-50"
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={approving || rejecting}
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-400/20 transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {canDecide && showRejectForm && (
            <form onSubmit={handleReject} className="flex flex-col gap-3 max-w-lg">
              <div>
                <label htmlFor="reject-note" className="block text-xs font-medium text-slate-400 mb-1">
                  Rejection reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="reject-note"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  disabled={rejecting}
                  rows={3}
                  placeholder="Explain the reason for rejection…"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-400/50 focus:outline-none disabled:opacity-50 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={rejecting}
                  className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-400/20 transition disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting…' : 'Confirm rejection'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRejectForm(false); setRejectNote(''); setActionError(null); }}
                  disabled={rejecting}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {review.status === 'in_review' && !isAssignedToMe && (
            <p className="text-sm text-slate-400">This review is assigned to another reviewer.</p>
          )}
        </div>
      )}

      {/* Final state */}
      {isFinal && (
        <div className={`rounded-2xl border p-5 ${review.status === 'approved' ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
          <p className={`text-sm font-medium ${review.status === 'approved' ? 'text-emerald-300' : 'text-red-300'}`}>
            Review {review.status}
          </p>
          {review.decisionNote && <p className="mt-1 text-sm text-slate-300">{review.decisionNote}</p>}
        </div>
      )}
    </div>
  );
}
