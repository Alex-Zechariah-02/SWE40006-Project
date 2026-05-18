'use client';

import Link from 'next/link';
import { RouteGuard } from '../../components/route-guard';
import { ConsumerLayout } from '../../components/consumer-layout';
import { useAuth } from '../../context/auth-context';

export default function AppDashboard() {
  return (
    <RouteGuard allowedRoles={['consumer']}>
      <ConsumerLayout>
        <DashboardContent />
      </ConsumerLayout>
    </RouteGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.displayName}</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your documents and track your claims.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/documents"
          className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 transition group"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 group-hover:text-slate-400">Documents</p>
          <p className="mt-2 text-lg font-medium text-slate-100">Document Archive</p>
          <p className="mt-1 text-sm text-slate-400">View and manage your uploaded transaction documents.</p>
          <p className="mt-4 text-xs text-emerald-400">Upload new document →</p>
        </Link>

        <Link
          href="/app/claims"
          className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 transition group"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 group-hover:text-slate-400">Claims</p>
          <p className="mt-2 text-lg font-medium text-slate-100">Claim Status</p>
          <p className="mt-1 text-sm text-slate-400">Track the status of your submitted claims.</p>
          <p className="mt-4 text-xs text-purple-400">View claims →</p>
        </Link>
      </div>
    </div>
  );
}
