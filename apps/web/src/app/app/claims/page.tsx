'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { RouteGuard } from '../../../components/route-guard';
import { ConsumerLayout } from '../../../components/consumer-layout';
import { StatusBadge } from '../../../components/status-badge';
import { listClaims } from '../../../lib/api/claims';
import type { Claim } from '../../../lib/api/claims';
import { BalanceApiError } from '../../../lib/api/client';
import { formatDate, formatMoney } from '@/lib/format';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/components/workspace/page-transition';

export default function ClaimsPage() {
  return (
    <RouteGuard allowedRoles={['consumer', 'staff', 'admin']}>
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
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const filters: Parameters<typeof listClaims>[0] = {};
    if (status !== 'all') filters.status = status as Claim['status'];

    listClaims(filters)
      .then((res) => { setClaims(res.claims); setLoading(false); })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load claims.');
        setLoading(false);
      });
  }, [status]);

  const filtered = claims.filter((claim) => {
    const haystack = `${claim.purpose} ${claim.note ?? ''} ${claim.document?.originalFilename ?? ''} ${claim.document?.merchantName ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <PageTransition>
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Claim tracking</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Claims</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/documents">
            <FileText className="size-4" />
            Find claimable documents
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purpose, merchant, document, notes" />
        </div>
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="under_review">In review</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading claims…</p>}

      {error && <Alert role="alert" variant="destructive">{error}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No claims match this view.</p>
          <Link
            href="/app/documents"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Upload or open a document to submit a claim
          </Link>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <Link href={`/app/claims/${claim.id}`} className="font-medium hover:text-primary">{claim.purpose}</Link>
                    {claim.note && <p className="mt-1 text-xs text-muted-foreground">{claim.note}</p>}
                  </TableCell>
                  <TableCell>
                    <p className="truncate text-sm">{claim.document?.originalFilename ?? claim.documentId}</p>
                    <p className="text-xs text-muted-foreground">{claim.document?.merchantName ?? 'Merchant not captured'}</p>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{formatMoney(claim.document?.amountMinor, claim.document?.currency ?? 'MYR')}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">{formatDate(claim.submittedAt)}</TableCell>
                  <TableCell><StatusBadge status={claim.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-border px-3 py-2">
            <Badge variant="neutral">{filtered.length} claims</Badge>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
