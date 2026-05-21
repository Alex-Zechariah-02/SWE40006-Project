import type { ReviewStatus } from '@balance/db';

import { throwContractHttpError } from '../common/contract-errors';

export type ActorContext = {
  actorId: string;
  actorRole: string;
  organizationId?: string | null;
};

export type ReviewVisibilityRecord = {
  status: ReviewStatus;
  reviewerId: string | null;
  document?: { organizationId: string | null } | null;
};

export function isSystemAdminRole(role: string): boolean {
  return role === 'system_admin';
}

export function isOrgAdminRole(role: string): boolean {
  return role === 'admin';
}

export function isReviewWorkerRole(role: string): boolean {
  return role === 'reviewer';
}

export function isReviewAccessRole(role: string): boolean {
  return isReviewWorkerRole(role) || isOrgAdminRole(role) || isSystemAdminRole(role);
}

export function isReviewDecisionRole(role: string): boolean {
  return isOrgAdminRole(role) || isSystemAdminRole(role);
}

export function assertReviewAccessActor(actor: ActorContext) {
  if (!isReviewAccessRole(actor.actorRole)) {
    throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
  }
}

export function assertReviewDecisionActor(actor: ActorContext) {
  if (!isReviewDecisionRole(actor.actorRole)) {
    throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
  }
}

export function reviewOrganizationId(review: ReviewVisibilityRecord): string | null {
  return review.document?.organizationId ?? null;
}

export function sameOrganization(actor: ActorContext, organizationId: string | null | undefined): boolean {
  return Boolean(actor.organizationId && organizationId && actor.organizationId === organizationId);
}

function assertTenantVisibleToActor(review: ReviewVisibilityRecord, actor: ActorContext) {
  if (isSystemAdminRole(actor.actorRole)) return;

  const orgId = reviewOrganizationId(review);
  if (sameOrganization(actor, orgId)) return;

  // Legacy seeded reviewers may not belong to an organization yet. They keep
  // the original global pending/assigned review visibility, but public
  // registration and member creation do not create this role.
  if (actor.actorRole === 'reviewer' && !actor.organizationId) return;

  throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
}

export function assertReviewVisibleToActor(review: ReviewVisibilityRecord, actor: ActorContext) {
  assertReviewAccessActor(actor);
  assertTenantVisibleToActor(review, actor);

  if (isSystemAdminRole(actor.actorRole) || isOrgAdminRole(actor.actorRole)) return;

  if (review.status === 'pending' && !review.reviewerId) return;
  if (review.reviewerId === actor.actorId) return;

  throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
}
