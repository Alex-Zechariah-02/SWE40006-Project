'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ClipboardCheck, Files, ReceiptText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/context/auth-context';
import { homeForRole } from '@/lib/auth-routing';
import { PageTransition } from '@/components/workspace/page-transition';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    router.replace(homeForRole(user.role));
  }, [loading, router, user]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 lg:px-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <ReceiptText className="size-4" />
            </span>
            Balance
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="secondary">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </header>

        <PageTransition>
          <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="max-w-xl">
              <Badge variant="success" className="mb-4">Textract-first document intelligence</Badge>
              <h1 className="max-w-[12ch] text-4xl font-semibold tracking-tight sm:text-5xl">
                Balance workspace
              </h1>
              <p className="mt-5 max-w-[58ch] text-base leading-7 text-muted-foreground">
                Organize receipts and invoices, verify extracted values, submit claims, review evidence, and keep the audit trail intact.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">
                    Enter workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/login">Reviewer access</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
              {[
                { icon: Files, label: 'Inbox', value: 'Searchable receipts, invoices, PDFs', tone: 'text-info' },
                { icon: ReceiptText, label: 'Extract', value: 'Merchant, totals, dates, tax, line items', tone: 'text-success' },
                { icon: ClipboardCheck, label: 'Review', value: 'Confidence, corrections, duplicate signals', tone: 'text-warning' },
                { icon: ShieldCheck, label: 'Audit', value: 'Deletion-safe history and decision evidence', tone: 'text-destructive' }
              ].map((item) => (
                <div key={item.label} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-md border border-border bg-background/60 p-4">
                  <div className={`flex size-10 items-center justify-center rounded-md border border-current/20 bg-current/10 ${item.tone}`}>
                    <item.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </PageTransition>
      </div>
    </main>
  );
}
