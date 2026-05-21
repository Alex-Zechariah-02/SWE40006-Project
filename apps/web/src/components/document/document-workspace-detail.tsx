'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Keyboard, RefreshCcw, ShieldAlert, X } from 'lucide-react';

import { StatusBadge } from '../status-badge';
import { getDocument, retryDocumentExtraction, saveDocumentCorrections, deleteDocument } from '../../lib/api/documents';
import { submitClaim } from '../../lib/api/claims';
import { getEnterpriseDocumentOwner } from '../../lib/api/enterprise';
import { BalanceApiError } from '../../lib/api/client';
import type { DocumentDetail, DocumentField } from '../../lib/api/documents';
import { useAuth } from '../../context/auth-context';
import { DocumentPreview } from '@/components/document/document-preview';
import { CitationMetadata, CitationProvider, useCitation } from '@/components/document/interactive-citation';
import { Alert } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, alertDialogActionClassName, alertDialogCancelClassName } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatMoney } from '@/lib/format';
import { PageTransition } from '@/components/workspace/page-transition';

const POLLING_STATUSES = new Set(['queued', 'processing']);
const CORRECTION_ALLOWED = new Set(['extracted', 'correction_required', 'corrected']);
const CLAIM_ALLOWED = new Set(['extracted', 'corrected']);

// amountMinor is stored as integer minor units (100 = 1.00)
const MINOR_UNIT_FIELDS = new Set(['amountMinor']);

function displayValue(field: DocumentField): string {
  return field.correctedValue ?? field.value;
}

type FieldCategory = 'vendor' | 'receiver' | 'dates' | 'financial' | 'address' | 'other';

function categorizeField(name: string): FieldCategory {
  if (['merchantName', 'merchantLegalName', 'vendorAddress', 'vendorPhone', 'vendorTaxId', 'merchantUrl', 'supplierName', 'supplierEmail', 'supplierPhone', 'supplierTaxId'].includes(name)) return 'vendor';
  if (['receiverName', 'receiverAddress', 'customerName', 'customerAddress', 'customerEmail', 'customerPhone', 'customerTaxId'].includes(name)) return 'receiver';
  if (['documentDate', 'dueDate', 'orderDate', 'invoiceDate', 'deliveryDate', 'transactionTime'].includes(name)) return 'dates';
  if (
    name === 'amountMinor' || name === 'subtotal' || name === 'tax' || name === 'amountDue' ||
    name === 'discount' || name === 'shippingCharge' || name === 'serviceCharge' ||
    name === 'gratuity' || name === 'voucher' || name === 'roundingAdjustment' || name === 'paymentType' || name === 'paymentTerms' ||
    name === 'poNumber' || name === 'currency'
  ) return 'financial';
  if (
    name.endsWith('Street') || name.endsWith('City') || name.endsWith('State') ||
    name.endsWith('Country') || name.endsWith('PostalCode') || name.endsWith('Address')
  ) return 'address';
  return 'other';
}

const categoryLabels: Record<FieldCategory, string> = {
  vendor: 'Vendor Details',
  receiver: 'Receiver Details',
  dates: 'Dates',
  financial: 'Financial Summary',
  address: 'Address',
  other: 'Other Fields',
};

export function DocumentWorkspaceDetail({ backHref, documentsHref }: { backHref: string; documentsHref: string }) {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [owner, setOwner] = useState<{ displayName: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Correction workflow
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Delete workflow
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  const isOwner = Boolean(doc && user && doc.ownerId === user.id);
  const hasActiveClaim = Boolean(doc?.claim && doc.claim.status !== 'draft');
  const canRetry = isOwner && Boolean(doc) && POLLING_STATUSES.has(doc!.status) === false && !hasActiveClaim;
  const canCorrect = isOwner && Boolean(doc) && CORRECTION_ALLOWED.has(doc!.status);
  const canClaim = isOwner && Boolean(doc) && CLAIM_ALLOWED.has(doc!.status) && (!doc!.claim || doc!.claim.status === 'draft');

  // Shared doc fetcher — does NOT touch `loading` so polling doesn't flash the page.
  const fetchDoc = useCallback(async () => {
    try {
      const res = await getDocument(id);
      setError(null);
      setDoc(res.document);
      setCorrections(Object.fromEntries(res.document.fields.map((f) => [f.id, f.correctedValue ?? ''])));
      return res.document;
    } catch (err) {
      if (err instanceof BalanceApiError && err.status === 404) setError('Document not found.');
      else if (err instanceof BalanceApiError && err.status === 403) setError('Access denied.');
      else setError('Failed to load document.');
      return null;
    }
  }, [id]);

  // Initial load — sets loading true for first render
  const load = useCallback(async () => {
    setLoading(true);
    await fetchDoc();
    setLoading(false);
  }, [fetchDoc]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    setOwner(null);

    if (!doc || !user) return;
    if (user.role !== 'admin' && user.role !== 'system_admin') return;
    if (doc.ownerId === user.id) return;

    getEnterpriseDocumentOwner(doc.id)
      .then((res) => {
        if (cancelled) return;
        setOwner(res.document.owner ? { displayName: res.document.owner.displayName, email: res.document.owner.email } : null);
      })
      .catch(() => {
        // Best-effort only; owner info is not required to use the workspace.
      });

    return () => {
      cancelled = true;
    };
  }, [doc, user]);

  // Polling — uses fetchDoc which does NOT reset loading, so no flash
  useEffect(() => {
    if (!doc) return;
    if (!POLLING_STATUSES.has(doc.status)) return;
    const timer = setTimeout(() => { void fetchDoc(); }, 2500);
    return () => clearTimeout(timer);
  }, [doc, fetchDoc]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if focus is inside an input/textarea so keyboard shortcuts
      // don't fire while typing in form fields (e.g. typing "Refund").
      const tag = (e.target as Element | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key;
      if (key == null) return;
      const mod = e.ctrlKey || e.metaKey;

      if (key === '?') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
      if (key === 'Escape') {
        e.preventDefault();
        router.push(backHref);
      }
      if (mod && e.altKey && key.toLowerCase() === 'r' && !e.repeat) {
        e.preventDefault();
        if (canRetry && !retrying) handleRetry();
      }
      if (mod && key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('correction-form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, backHref, canRetry, retrying]);

  async function handleRetry() {
    if (!doc) return;
    setRetrying(true);
    setError(null);
    try {
      await retryDocumentExtraction(doc.id, 'textract');
      await load();
    } catch (err) {
      setError(err instanceof BalanceApiError ? err.error.message : 'Failed to retry extraction.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const fields = doc.fields.map((field) => ({
        id: field.id,
        name: field.name,
        correctedValue: (corrections[field.id] ?? '').trim() === '' ? null : (corrections[field.id] ?? '').trim(),
      }));

      await saveDocumentCorrections(doc.id, fields);
      setSuccess(true);
      await load();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof BalanceApiError ? err.error.message : 'Failed to save corrections.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDocument(doc.id);
      router.push(documentsHref);
    } catch (err) {
      setDeleteError(err instanceof BalanceApiError ? err.error.message : 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading document…</p>;
  if (error) return (
    <div className="flex flex-col gap-4">
      <Alert role="alert" variant="destructive">{error}</Alert>
      <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">Back</Link>
    </div>
  );
  if (!doc) return null;

  const grouped = doc.fields.reduce<Record<FieldCategory, DocumentField[]>>((acc, field) => {
    const cat = categorizeField(field.name);
    acc[cat].push(field);
    return acc;
  }, { vendor: [], receiver: [], dates: [], financial: [], address: [], other: [] });

  const categories = (Object.keys(grouped) as FieldCategory[]).filter((category) => grouped[category].length > 0);
  const isPolling = POLLING_STATUSES.has(doc.status);
  const claimHrefBase = documentsHref.startsWith('/enterprise') ? '/enterprise/claims' : '/app/claims';
  const showExtractionFailure = doc.status === 'failed' || doc.extractionJob?.status === 'failed';
  const extractionError = doc.extractionJob?.errorMessage || (doc.status === 'failed' ? 'Extraction failed.' : null);
  const extractionErrorLower = (extractionError || '').toLowerCase();
  const looksLikeExpiredAwsToken = extractionErrorLower.includes('expiredtoken');

  return (
    <CitationProvider>
      <PageTransition>
        <div className="grid gap-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm text-muted-foreground">Document workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{doc.originalFilename}</h1>
              <p className="mt-1 text-xs text-muted-foreground">Uploaded {formatDateTime(doc.createdAt)}</p>
              {owner && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted by <span className="text-foreground">{owner.displayName}</span> · {owner.email}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              {isPolling && <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />}
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowShortcuts((v) => !v)}>
                <Keyboard className="size-4" />
                Shortcuts
              </Button>
              {isOwner && (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={handleRetry} disabled={retrying || !canRetry}>
                    <RefreshCcw className="size-4" />
                    {retrying ? 'Retrying…' : 'Retry extraction'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="sm">
                        <X className="size-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the document. Claims and audit context may restrict deletion.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {deleteError && <Alert role="alert" variant="destructive">{deleteError}</Alert>}
                      <AlertDialogFooter>
                        <AlertDialogCancel className={alertDialogCancelClassName}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className={alertDialogActionClassName}
                          onClick={handleDelete}
                          disabled={deleting}
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
            <div className="self-start xl:sticky xl:top-6">
              <DocumentPreview documentId={doc.id} filename={doc.originalFilename} contentType={doc.contentType} />
            </div>
            <div className="grid content-start gap-5">
              <Card>
                <CardHeader><CardTitle>Evidence summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Merchant</p><p>{doc.merchantName ?? 'Not captured'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-mono tabular-nums">{formatMoney(doc.amountMinor, doc.currency ?? 'MYR')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Date</p><p className="font-mono text-xs tabular-nums">{doc.documentDate ?? 'Not captured'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Claim</p><StatusBadge status={doc.claim?.status ?? '—'} /></div>
                </CardContent>
              </Card>

              <Card variant="surface">
                <CardHeader>
                  <CardTitle>Extraction</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.extractionJob?.status ?? doc.status} />
                      {doc.extractionJob?.provider && (
                        <span className="text-xs text-muted-foreground">Provider: <span className="capitalize text-foreground">{doc.extractionJob.provider}</span></span>
                      )}
                    </div>
                    {isOwner && (
                      <Button type="button" variant="secondary" size="sm" onClick={handleRetry} disabled={retrying || !canRetry}>
                        <RefreshCcw className="size-4" />
                        {retrying ? 'Retrying…' : 'Retry extraction'}
                      </Button>
                    )}
                  </div>

                  {isPolling && (
                    <>
                      <style>{`
                        @keyframes indeterminate-bar {
                          0% { transform: translateX(-100%); }
                          50% { transform: translateX(200%); }
                          100% { transform: translateX(-100%); }
                        }
                      `}</style>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full w-1/2 rounded-full bg-primary"
                          style={{ animation: 'indeterminate-bar 1.5s ease-in-out infinite' }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Processing — extracted fields will appear automatically.</p>
                    </>
                  )}

                  {showExtractionFailure && (
                    <Alert variant="destructive">
                      <div className="grid gap-1">
                        <p className="font-medium">Extraction failed</p>
                        {extractionError && <p className="text-sm text-destructive">{extractionError}</p>}
                        {user && ['staff', 'admin', 'system_admin'].includes(user.role) && (
                          <p className="text-xs text-muted-foreground">
                            {looksLikeExpiredAwsToken
                              ? (
                                <>
                                  AWS runtime credentials likely expired. Ask an operator to refresh the EC2 instance role credential path, then retry extraction.
                                </>
                              )
                              : (
                                <>
                                  Ensure the worker can reach S3 and Textract with its runtime AWS credentials, then retry extraction.
                                </>
                              )}
                          </p>
                        )}
                      </div>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {doc.claim && (
                <Card variant="surface">
                  <CardHeader>
                    <CardTitle>Claim</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.claim.status} />
                        <span className="text-xs text-muted-foreground">Claim id: <span className="font-mono text-foreground">{doc.claim.id.slice(0, 8)}</span></span>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`${claimHrefBase}/${doc.claim.id}`}>View claim</Link>
                      </Button>
                    </div>
                    {doc.claim.status === 'submitted' && (
                      <p className="text-xs text-muted-foreground">
                        Next: your claim will move to <span className="font-medium text-foreground">Under review</span> once it is picked up.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {canClaim && <ClaimForm documentId={doc.id} onSubmitted={load} />}

              {canCorrect && (
                <Card variant="surface">
                  <CardHeader>
                    <CardTitle>Corrections</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <p className="mb-3 text-xs text-muted-foreground">
                      Correct extracted fields and save. For <strong className="text-foreground">Amount</strong>, enter minor units, such as <code className="font-mono text-foreground">444</code> for 4.44.
                    </p>
                    <form id="correction-form" onSubmit={handleSave} className="flex flex-col gap-4">
                      {doc.fields.map((field) => (
                        <div key={field.id}>
                          <Label className="mb-1 block text-xs">
                            {field.label ?? field.name}
                            {MINOR_UNIT_FIELDS.has(field.name) && (
                              <span className="ml-2 font-normal text-muted-foreground">(minor units)</span>
                            )}
                          </Label>
                          <Input
                            type="text"
                            value={corrections[field.id] ?? ''}
                            onChange={(e) => setCorrections((prev) => ({ ...prev, [field.id]: e.target.value }))}
                            disabled={saving}
                            placeholder={field.value}
                          />
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Original: {field.value}
                            {field.correctedValue && field.correctedValue !== field.value && ` · Previously corrected: ${field.correctedValue}`}
                          </p>
                        </div>
                      ))}
                      {error && <Alert role="alert" variant="destructive">{error}</Alert>}
                      {success && <Alert variant="success"><CheckCircle2 className="mr-2 inline size-4" />Corrections saved successfully.</Alert>}
                      <Button type="submit" disabled={saving} className="w-fit">
                        {saving ? 'Saving…' : 'Save corrections'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {doc.review && (
                <Card variant="surface">
                  <CardContent className="p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Review</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={doc.review.status} />
                      <span className="text-xs text-muted-foreground">Review id: {doc.review.id}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!canClaim && !canCorrect && !doc.claim && !doc.review && categories.length === 0 && (
                <Card variant="surface">
                  <CardHeader>
                    <CardTitle>Next steps</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-muted-foreground">
                    <p>If this document looks correct, wait for extraction to complete — then review the captured fields and submit a claim if needed.</p>
                    <p>If extraction fails, use <span className="font-medium text-foreground">Retry extraction</span> or upload a clearer photo/PDF.</p>
                  </CardContent>
                </Card>
              )}

              {showShortcuts && (
                <div ref={shortcutsRef}>
                  <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
                </div>
              )}
            </div>
          </div>

          {categories.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Extracted fields</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {categories.map((category) => (
                  <div key={category} className="grid gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{categoryLabels[category]}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {grouped[category].map((field) => (
                        <FieldCard key={field.id} field={field} />
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </PageTransition>
    </CitationProvider>
  );
}

function FieldCard({ field }: { field: DocumentField }) {
  const citation = useCitation();
  const isSelected = citation.selectedFieldId === field.id;
  const confidence = field.confidence ?? null;
  const value = displayValue(field);
  return (
    <button
      type="button"
      onClick={() => citation.selectField(isSelected ? null : field.id)}
      className="grid gap-1 rounded-md border border-border bg-background/60 p-3 text-left text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{field.label ?? field.name}</span>
        {confidence != null && <Badge variant={confidence >= 90 ? 'success' : confidence >= 70 ? 'warning' : 'danger'}>{confidence.toFixed(0)}%</Badge>}
      </div>
      <span className="font-medium">
        {value}
        {field.correctedValue && field.correctedValue !== field.value && (
          <span className="ml-2 text-xs text-muted-foreground line-through">{field.value}</span>
        )}
      </span>
      {isSelected && (
        <CitationMetadata pageNumber={field.pageNumber} geometry={field.geometry} label={field.label ?? field.name} />
      )}
    </button>
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
    <Card variant="surface">
      <CardContent className="p-5">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ClipboardCheck className="size-4" />
          Submit claim
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="purpose" className="mb-1 block text-xs">Purpose</Label>
            <Input
              id="purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Reimbursement claim"
            />
          </div>
          <div>
            <Label htmlFor="claim-note" className="mb-1 block text-xs">Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="claim-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              rows={2}
              placeholder="Additional context…"
            />
          </div>
          {error && <Alert role="alert" variant="destructive">{error}</Alert>}
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Submitting…' : 'Submit claim'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
  const mod = isMac ? '⌘' : 'Ctrl';
  const alt = isMac ? '⌥' : 'Alt';

  const shortcuts = [
    { keys: `${mod}+Enter`, label: 'Save corrections' },
    { keys: `${mod}+${alt}+R`, label: 'Retry extraction' },
    { keys: 'Escape', label: 'Back to document list' },
    { keys: '?', label: 'Toggle this help panel' },
  ];

  return (
    <div className="rounded-md border border-border bg-popover p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Keyboard shortcuts</p>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close shortcuts">
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-2">
        {shortcuts.map((item) => (
          <div key={item.keys} className="grid grid-cols-[6rem_1fr] items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2 text-xs">
            <code className="font-mono text-muted-foreground">{item.keys}</code>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4" />
        <span>
          Shortcuts are disabled while focus is inside a text input. Use <code className="font-mono text-foreground">{mod}+Enter</code> to save corrections.
        </span>
      </div>
    </div>
  );
}
