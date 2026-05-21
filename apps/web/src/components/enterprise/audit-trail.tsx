'use client';

import { FileText, ClipboardCheck, Undo2, Circle } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  actorRole: string;
  message: string;
  createdAt: string;
}

interface AuditTrailProps {
  events: AuditEvent[];
}

const actionLabels: Record<string, string> = {
  'claim.submitted': 'submitted the claim',
  'claim.recalled': 'recalled the claim',
  'review.created': 'Review was created',
  'review.assigned': 'Review was assigned',
  'review.approved': 'approved the claim',
  'review.rejected': 'rejected the claim',
  'review.returned': 'Review was returned',
};

function getActionText(event: AuditEvent): string {
  const label = actionLabels[event.action];
  if (label) return label;
  if (event.message) return event.message;
  return event.action;
}

function getIcon(action: string) {
  if (action.startsWith('claim.recalled')) return Undo2;
  if (action.startsWith('claim.')) return FileText;
  if (action.startsWith('review.')) return ClipboardCheck;
  if (action.startsWith('document.')) return FileText;
  return Circle;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(iso);
}

export function AuditTrail({ events }: AuditTrailProps) {
  if (events.length === 0) return null;

  return (
    <div>
      {events.map((event, index) => {
        const Icon = getIcon(event.action);
        const actionText = getActionText(event);
        const isFirst = index === 0;
        const isLast = index === events.length - 1;

        return (
          <div
            key={event.id}
            className={`flex gap-3 py-2 ${isFirst ? 'pt-0' : ''} ${isLast ? 'pb-0' : ''}`}
          >
            <div className="flex-shrink-0 mt-1">
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{actionText}</p>
              <p className="text-xs text-muted-foreground">
                {relativeTime(event.createdAt)}
                {' · '}
                {event.actorRole.charAt(0).toUpperCase() + event.actorRole.slice(1)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
