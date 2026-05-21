'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CircleAlert, FileClock, Files, ReceiptText, Search, TrendingUp, WalletCards } from 'lucide-react';
import { RouteGuard } from '../../components/route-guard';
import { ConsumerLayout } from '../../components/consumer-layout';
import { useAuth } from '../../context/auth-context';
import { getClaimInsights, type ClaimInsights } from '@/lib/api/claims';
import { getDocumentInsights, type DocumentInsights } from '@/lib/api/documents';
import { BalanceApiError } from '@/lib/api/client';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition } from '@/components/workspace/page-transition';

export default function AppDashboard() {
  return (
    <RouteGuard allowedRoles={['consumer', 'staff', 'admin']}>
      <ConsumerLayout>
        <DashboardContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [documentInsights, setDocumentInsights] = useState<DocumentInsights | null>(null);
  const [claimInsights, setClaimInsights] = useState<ClaimInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDocumentInsights(), getClaimInsights()])
      .then(([documents, claims]) => {
        setDocumentInsights(documents.insights);
        setClaimInsights(claims.insights);
      })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load workspace insights.');
      });
  }, []);

  const chartData = documentInsights?.monthlySpend.map((item) => ({
    month: item.month.slice(5),
    spend: Math.round(item.amountMinor / 100),
    count: item.count
  })) ?? [];

  return (
    <PageTransition>
      <div className="grid gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-muted-foreground">Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome, {user?.displayName}</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href="/app/documents">
                <Search className="size-4" />
                Search documents
              </Link>
            </Button>
            <Button asChild>
              <Link href="/app/documents/upload">
                <ReceiptText className="size-4" />
                Upload
              </Link>
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive">{error}</Alert>}

        {!documentInsights ? (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1.5fr_1fr_1fr]"
          >
            <MetricCard icon={WalletCards} label="This month" value={formatMoney(documentInsights.currentMonthSpendMinor)} detail={`${formatPercent(documentInsights.monthOverMonthChange)} vs previous month`} size="large" />
            <MetricCard icon={Files} label="Receipts this month" value={formatNumber(documentInsights.currentMonthDocumentCount)} detail={`${formatMoney(documentInsights.averageReceiptMinor)} average receipt`} size="large" />
            <MetricCard icon={TrendingUp} label="Tax and service" value={formatMoney(documentInsights.totalTaxMinor + documentInsights.totalServiceChargeMinor)} detail={`${formatMoney(documentInsights.totalDiscountMinor)} discounts detected`} />
            <MetricCard icon={FileClock} label="Pending claims" value={formatMoney(claimInsights?.pendingAmountMinor ?? 0)} detail={`${claimInsights?.statusCounts.submitted ?? 0} submitted, ${claimInsights?.statusCounts.under_review ?? 0} in review`} />
          </motion.div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <Card variant="panel">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Monthly spending</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Receipts grouped by transaction or upload month.</p>
              </div>
              <Badge variant="neutral">MYR</Badge>
            </CardHeader>
            <CardContent>
              {documentInsights && !error ? (
                <div className="min-w-0">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="month" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'color-mix(in oklch, var(--primary) 10%, transparent)' }}
                        contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
                      />
                      <Bar dataKey="spend" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Skeleton className="h-[260px] min-w-0" />
              )}
            </CardContent>
          </Card>

          <Card variant="surface">
            <CardHeader>
              <CardTitle>Attention queue</CardTitle>
              <p className="text-sm text-muted-foreground">Extraction and claim work that needs action.</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {documentInsights ? (
                <>
                  <QueueLine label="Needs review" value={documentInsights.statusCounts.correction_required ?? 0} href="/app/documents" />
                  <QueueLine label="Failed extraction" value={documentInsights.statusCounts.failed ?? 0} href="/app/documents" />
                  <QueueLine label="Approved claims" value={claimInsights?.statusCounts.approved ?? 0} href="/app/claims" />
                  <QueueLine label="Rejected claims" value={claimInsights?.statusCounts.rejected ?? 0} href="/app/claims" />
                </>
              ) : (
                <Skeleton className="h-32" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card variant="surface">
            <CardHeader>
              <CardTitle>Merchant leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(documentInsights?.merchantSpend.slice(0, 6) ?? []).map((merchant) => (
                <div key={merchant.merchantName} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
                  <span className="truncate text-sm">{merchant.merchantName}</span>
                  <span className="font-mono text-sm tabular-nums">{formatMoney(merchant.amountMinor)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="surface">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(documentInsights?.recentDocuments.slice(0, 6) ?? []).map((document) => (
                <Link key={document.id} href={`/app/documents/${document.id}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-background/60 px-3 py-2 text-sm hover:bg-muted">
                  <span className="truncate">{document.merchantName ?? document.originalFilename}</span>
                  <span className="font-mono text-muted-foreground">{formatMoney(document.amountMinor, document.currency ?? 'MYR')}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

function MetricCard({ icon: Icon, label, value, detail, size }: { icon: React.ElementType; label: string; value: string; detail: string; size?: 'large' }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card variant="surface">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Icon className="size-4 text-primary" />
          </div>
          <p className={`font-mono font-semibold tabular-nums ${size ? 'text-2xl' : 'text-xl'}`}>{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QueueLine({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2 hover:bg-muted">
      <CircleAlert className="size-4 text-warning" />
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2 font-mono text-sm tabular-nums">
        {value}
        <ArrowRight className="size-3 text-muted-foreground" />
      </span>
    </Link>
  );
}
