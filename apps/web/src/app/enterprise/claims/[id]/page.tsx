'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { RouteGuard } from '@/components/route-guard';
import { EnterpriseLayout } from '@/components/enterprise-layout';
import { StatusBadge } from '@/components/status-badge';
import { StepTimeline, type StepTimelineStep } from '@/components/step-timeline';
import { AuditTrail } from '@/components/enterprise/audit-trail';
import { ClaimReviewPanel, type FieldItem } from '@/components/enterprise/claim-review-panel';
import { ClaimDecisionControls } from '@/components/enterprise/claim-decision-controls';
import { DocumentPreview } from '@/components/document/document-preview';
import { useAuth } from '@/context/auth-context';
import { getClaim, type Claim } from '@/lib/api/claims';
import { BalanceApiError } from '@/lib/api/client';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/format';
import { PageTransition } from '@/components/workspace/page-transition';

// ── Helpers ────────────────────────────────────────────────────────

function getEnterpriseTimelineSteps(claim: Claim): StepTimelineStep[] {
  const steps: StepTimelineStep[] = [];
  steps.push({
    label: 'Claim submitted',
    timestamp: claim.submittedAt,
    description: null,
    status: claim.submittedAt ? 'completed' : 'pending',
  });
  steps.push({
    label: 'Under review',
    timestamp: null,
    description: null,
    status: claim.submittedAt && claim.status === 'submitted'
      ? 'pending'
      : claim.status === 'under_review'
        ? 'current'
        : 'completed',
  });
  steps.push({
    label: claim.status === 'rejected' ? 'Rejected' : 'Approved',
    timestamp: claim.decidedAt,
    description: null,
    status: claim.status === 'approved'
      ? 'completed'
      : claim.status === 'rejected'
        ? 'failed'
        : 'pending',
  });
  return steps;
}

function getClaimNumber(id: string): string {
  return `#${id.slice(0, 8)}`;
}

// ── Page ───────────────────────────────────────────────────────────

export default function EnterpriseClaimDetailPage() {
  return (
    <RouteGuard allowedRoles={['staff', 'admin', 'reviewer']}>
      <EnterpriseLayout>
        <EnterpriseClaimDetailContent />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

function EnterpriseClaimDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadClaim() {
    // Use skeleton only on first load; background refresh keeps current content visible
    if (!claim) {
      setLoading(true);
    }
    setError(null);
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
  }

  useEffect(() => {
    loadClaim();
  }, [id]);

  // ── Derived states ──────────────────────────────────────────────

  const isCurrentReviewer = claim?.review?.reviewerId != null && claim.review.reviewerId === user?.id;
  const fieldsEditable = isCurrentReviewer && claim?.review?.status === 'in_review';

  const hasLowConfidence =
    claim?.document?.fields?.some((f) => f.confidence != null && f.confidence < 70) ?? false;

  const hasFields = (claim?.document?.fields?.length ?? 0) > 0;

  // ── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageTransition>
        <div className="grid gap-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(400px,1.1fr)]">
            <Skeleton className="h-[400px] w-full" />
            <div className="space-y-5">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // ── Error ────────────────────────────────────────────────────────

  if (error && !claim) {
    return (
      <PageTransition>
        <div className="grid gap-4">
          <Alert role="alert" variant="destructive">{error}</Alert>
          <Link href="/enterprise/claims" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to claims
          </Link>
        </div>
      </PageTransition>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────

  if (!claim) return null;

  // ── Render ───────────────────────────────────────────────────────

  const timelineSteps = getEnterpriseTimelineSteps(claim);
  const consumer = claim.consumer;
  const displayName = consumer?.displayName ?? 'Unknown';
  const email = consumer?.email ?? '';

  return (
    <PageTransition>
      {/* ── Action error banner ────────────────────────────────── */}
      {actionError && (
        <Alert role="alert" variant="destructive" className="mb-6">
          {actionError}
        </Alert>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Claim detail</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {claim.document?.originalFilename ?? `Claim ${getClaimNumber(claim.id)}`}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Claim: {claim.purpose}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            by {displayName}{email ? ` \u00b7 ${email}` : ''}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      {/* ── Two-column layout ────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(400px,1.1fr)]">
        {/* Left: Document preview */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          {claim.document && (
            <DocumentPreview
              documentId={claim.document.id}
              contentType={claim.document.contentType ?? null}
              filename={claim.document.originalFilename}
            />
          )}
        </div>

        {/* Right: Summary + Actions */}
        <div className="flex flex-col gap-5">
          {/* Evidence Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Merchant</p>
                <p>{claim.document?.merchantName ?? 'Not captured'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-mono tabular-nums">
                  {formatMoney(claim.document?.amountMinor, claim.document?.currency ?? 'MYR')}
                </p>
              </div>
              {claim.document?.documentDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-mono text-xs tabular-nums">{claim.document.documentDate}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Document status</p>
                <StatusBadge status={claim.document?.status ?? 'uploaded'} />
              </div>
            </CardContent>
          </Card>

          {/* Confidence Alert */}
          {hasFields && (
            <Alert variant={hasLowConfidence ? 'warning' : 'success'}>
              {hasLowConfidence
                ? 'Low-confidence extracted fields require reviewer attention before a decision.'
                : 'Extraction confidence is acceptable for reviewer verification.'}
            </Alert>
          )}

          {/* Decision Controls */}
          <ClaimDecisionControls
            review={
              claim.review
                ? {
                    id: claim.review.id,
                    status: claim.review.status,
                    reviewerId: claim.review.reviewerId ?? null,
                    decisionNote: claim.review.decisionNote,
                    decidedAt: claim.review.decidedAt ?? null,
                  }
                : null
            }
            claimStatus={claim.status}
            onActionComplete={loadClaim}
            onError={setActionError}
          />
        </div>
      </div>

      {/* ── Full-width sections ──────────────────────────────────── */}

      {/* Extracted fields */}
      {hasFields && (
        <div className="mt-5">
          <ClaimReviewPanel
            fields={claim.document!.fields as FieldItem[]}
            documentId={claim.document!.id}
            editable={fieldsEditable}
            onCorrectionsSaved={loadClaim}
          />
        </div>
      )}

      {/* Timeline */}
      <div className="mt-5">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline steps={timelineSteps} variant="compact" />
          </CardContent>
        </Card>
      </div>

      {/* Audit trail */}
      {claim.auditEvents && claim.auditEvents.length > 0 && (
        <div className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrail events={claim.auditEvents} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/enterprise/claims"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to claims
        </Link>
      </div>
    </PageTransition>
  );
}
