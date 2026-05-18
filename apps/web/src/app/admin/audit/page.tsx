'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '../../../components/route-guard';
import { EnterpriseLayout } from '../../../components/enterprise-layout';
import { listAuditEvents } from '../../../lib/api/audit';
import type { AuditEvent } from '../../../lib/api/audit';
import { BalanceApiError } from '../../../lib/api/client';

export default function AdminAuditPage() {
  return (
    <RouteGuard allowedRoles={['admin']}>
      <EnterpriseLayout>
        <AuditContent />
      </EnterpriseLayout>
    </RouteGuard>
  );
}

function AuditContent() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  function load(off: number) {
    setLoading(true);
    listAuditEvents({ limit: LIMIT, offset: off })
      .then((res) => {
        setEvents(res.auditEvents);
        setTotal(res.page.total);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof BalanceApiError ? err.error.message : 'Failed to load audit log.');
        setLoading(false);
      });
  }

  useEffect(() => { load(0); }, []);

  const actionColors: Record<string, string> = {
    'document.uploaded': 'text-emerald-400',
    'extraction.queued': 'text-yellow-400',
    'extraction.started': 'text-blue-400',
    'extraction.completed': 'text-emerald-400',
    'extraction.failed': 'text-red-400',
    'document.corrected': 'text-cyan-400',
    'claim.submitted': 'text-purple-400',
    'review.started': 'text-blue-400',
    'review.approved': 'text-emerald-400',
    'review.rejected': 'text-red-400',
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-400">Full system activity history. {total > 0 && `${total} total events.`}</p>
        </div>
        <button
          onClick={() => { setOffset(0); load(0); }}
          disabled={loading}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-white/20 transition disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-slate-400">Loading audit log…</p>}

      {!loading && events.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-slate-400">No audit events yet.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Message</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Entity</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr key={event.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono font-medium ${actionColors[event.action] ?? 'text-slate-400'}`}>
                      {event.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{event.message}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {event.actorRole}
                    {event.actorId && <span className="ml-1 text-slate-600 font-mono">{event.actorId.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                    {event.entityType} · {event.entityId.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <p className="text-xs text-slate-500">
                Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); load(o); }}
                  disabled={offset === 0 || loading}
                  className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => { const o = offset + LIMIT; setOffset(o); load(o); }}
                  disabled={offset + LIMIT >= total || loading}
                  className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
