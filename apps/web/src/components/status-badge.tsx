import { Badge } from '@/components/ui/badge';

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  uploaded: 'neutral',
  queued: 'warning',
  processing: 'info',
  extracted: 'success',
  correction_required: 'warning',
  corrected: 'info',
  submitted: 'info',
  reviewed: 'success',
  rejected: 'danger',
  failed: 'danger',
  pending: 'warning',
  in_review: 'info',
  approved: 'success',
  under_review: 'info',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={statusVariants[status] ?? 'default'}
      className="min-w-24 justify-center whitespace-nowrap capitalize"
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
