'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { RouteGuard } from '@/components/route-guard';
import { ConsumerLayout } from '@/components/consumer-layout';
import { StatusBadge } from '@/components/status-badge';
import { StepTimeline, type StepTimelineStep } from '@/components/step-timeline';
import { DocumentPreview } from '@/components/document/document-preview';
import { getClaim, type Claim } from '@/lib/api/claims';
import { BalanceApiError } from '@/lib/api/client';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, formatMoney } from '@/lib/format';
import { PageTransition } from '@/components/workspace/page-transition';

/* ── Helpers ──────────────────────────────────── */

function getClaimNumber(id: string): string {
  return `#${id.slice(0, 8)}`;
}

function getConsumerTimelineSteps(claim: Claim): StepTimelineStep[] {
  const submitted = !!claim.submittedAt;
  const isUnderReview =
    claim.status === 'under_review' ||
    claim.status === 'approved' ||
    claim.status === 'rejected';

  return [
    {
      label: 'You submitted the claim',
      timestamp: claim.submittedAt,
      description: null,
      status: submitted ? 'completed' : 'pending',
    },
    {
      label: 'Under review',
      timestamp: isUnderReview ? claim.submittedAt : null,
      description: "We're reviewing your claim — this usually takes 1–2 business days.",
      status: !submitted
        ? 'pending'
        : isUnderReview
          ? claim.status === 'under_review'
            ? 'current'
            : 'completed'
          : 'pending',
    },
    {
      label: claim.status === 'rejected' ? 'Rejected' : 'Approved',
      timestamp: claim.decidedAt,
      description:
        claim.status === 'rejected'
          ? 'Your claim has been rejected.'
          : claim.status === 'approved'
            ? 'Your claim has been approved.'
            : null,
      status:
        claim.status === 'approved'
          ? 'completed'
          : claim.status === 'rejected'
            ? 'failed'
            : 'pending',
    },
  ];
}

/* ── Page ──────────────────────────────────────── */

export default function ClaimDetailPage() {
  return (
    <RouteGuard allowedRoles={['consumer', 'staff', 'admin']}>
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
      .then((res) => {
        setClaim(res.claim);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof BalanceApiError && err.status === 404) setError('Claim not found.');
        else if (err instanceof BalanceApiError && err.status === 403) setError('Access denied.');
        else setError('Failed to load claim.');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading claim…</p>;

  if (error)
    return (
      <Alert role="alert" variant="destructive">
        {error}
      </Alert>
    );

  if (!claim) return null;

  const timelineSteps = getConsumerTimelineSteps(claim);
  const hasDocument = Boolean(claim.document);

  return (
    <PageTransition>
      <div className="grid gap-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-muted-foreground">Claim details</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{getClaimNumber(claim.id)}</h1>
            {claim.submittedAt && (
              <p className="mt-1 text-xs text-muted-foreground">Submitted {formatDateTime(claim.submittedAt)}</p>
            )}
          </div>
          <StatusBadge status={claim.status} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
          <div className="self-start xl:sticky xl:top-6">
            {hasDocument ? (
              <DocumentPreview
                documentId={claim.document!.id}
                filename={claim.document!.originalFilename}
                contentType={claim.document!.contentType ?? null}
              />
            ) : (
              <Card variant="surface">
                <CardHeader>
                  <CardTitle>Evidence</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">No document is attached to this claim.</CardContent>
              </Card>
            )}
          </div>

          <div className="grid content-start gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Claim summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Merchant</p>
                  <p>{claim.document?.merchantName ?? 'Not captured'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-mono tabular-nums">{formatMoney(claim.document?.amountMinor, claim.document?.currency ?? 'MYR')}</p>
                </div>
                {claim.document?.documentDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-mono text-xs tabular-nums">{claim.document.documentDate}</p>
                  </div>
                )}
                {claim.document && (
                  <div>
                    <p className="text-xs text-muted-foreground">Document</p>
                    <Link href={`/app/documents/${claim.document.id}`} className="text-sm font-medium text-primary hover:underline">
                      {claim.document.originalFilename}
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <StepTimeline steps={timelineSteps} variant="default" />
              </CardContent>
            </Card>

            <Card variant="surface">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {claim.note && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Note</p>
                    <p className="mt-0.5 text-sm">{claim.note}</p>
                  </div>
                )}

                {claim.note && (claim.review || claim.decidedAt) && <Separator />}

                {claim.review && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Review status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={claim.review.status} />
                      {claim.review.decisionNote && <span className="text-sm text-muted-foreground">{claim.review.decisionNote}</span>}
                    </div>
                  </div>
                )}

                {claim.review && claim.decidedAt && <Separator />}

                {claim.decidedAt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Decided</p>
                    <p className="mt-0.5 text-sm">{formatDateTime(claim.decidedAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="surface">
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm text-muted-foreground">
                {claim.status === 'submitted' && (
                  <p>Your claim is queued for review. You'll see updates here as it moves through the review steps.</p>
                )}
                {claim.status === 'under_review' && (
                  <p>Your claim is currently being reviewed. If we need more information, we'll add a note in this page.</p>
                )}
                {claim.status === 'approved' && (
                  <p>Your claim is approved. Keep this page for your records.</p>
                )}
                {claim.status === 'rejected' && (
                  <p>Your claim was rejected. Check the review note (if provided) for the reason.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Link href="/app/claims" className="inline-block text-sm text-muted-foreground hover:text-foreground">
          ← Back to my claims
        </Link>
      </div>
    </PageTransition>
  );
}
