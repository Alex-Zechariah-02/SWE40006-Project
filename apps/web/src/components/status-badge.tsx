const statusColors: Record<string, string> = {
  // Document statuses
  uploaded: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  queued: 'border-yellow-400/20 bg-yellow-400/10 text-yellow-300',
  processing: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  extracted: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  correction_required: 'border-orange-400/20 bg-orange-400/10 text-orange-300',
  corrected: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  submitted: 'border-purple-400/20 bg-purple-400/10 text-purple-300',
  reviewed: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rejected: 'border-red-400/20 bg-red-400/10 text-red-300',
  failed: 'border-red-400/20 bg-red-400/10 text-red-300',
  // Review statuses
  pending: 'border-yellow-400/20 bg-yellow-400/10 text-yellow-300',
  in_review: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  approved: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  // Claim statuses
  under_review: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
};

export function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? 'border-slate-400/20 bg-slate-400/10 text-slate-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
