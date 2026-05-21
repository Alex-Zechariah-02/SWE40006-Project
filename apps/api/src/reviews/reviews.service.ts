import { Inject, Injectable } from '@nestjs/common';
import type { ClaimStatus, Prisma, ReviewStatus } from '@balance/db';

import { AuditService } from '../audit/audit.service';
import {
  assertReviewAccessActor,
  assertReviewDecisionActor,
  assertReviewVisibleToActor,
  isOrgAdminRole,
  isReviewWorkerRole,
  isSystemAdminRole,
  type ActorContext
} from '../auth/access-policy';
import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { PrismaService } from '../prisma/prisma.service';

function isPrismaKnownErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}

function fieldLabel(name: string): string {
  switch (name) {
    case 'merchantName':
      return 'Merchant name';
    case 'documentDate':
      return 'Document date';
    case 'amountMinor':
      return 'Amount';
    case 'currency':
      return 'Currency';
    default:
      return 'Field';
  }
}

type ReviewActor = ActorContext;

function reviewTenantWhere(input: ReviewActor): Prisma.ReviewWhereInput {
  if (isSystemAdminRole(input.actorRole)) return {};
  if (input.actorRole === 'reviewer' && !input.organizationId) return {};
  if ((isOrgAdminRole(input.actorRole) || isReviewWorkerRole(input.actorRole)) && input.organizationId) {
    return { document: { organizationId: input.organizationId } };
  }
  throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
}

function visibleReviewWhere(input: ReviewActor & { status?: ReviewStatus }): Prisma.ReviewWhereInput {
  assertReviewAccessActor(input);
  const tenantWhere = reviewTenantWhere(input);

  if (isSystemAdminRole(input.actorRole) || isOrgAdminRole(input.actorRole)) {
    return {
      AND: [tenantWhere, input.status ? { status: input.status } : { status: { in: ['pending', 'in_review'] } }]
    };
  }

  const assignmentWhere: Prisma.ReviewWhereInput = input.status
    ? input.status === 'pending'
      ? { status: 'pending', reviewerId: null }
      : { status: input.status, reviewerId: input.actorId }
    : { OR: [{ status: 'pending', reviewerId: null }, { status: 'in_review', reviewerId: input.actorId }] };

  return { AND: [tenantWhere, assignmentWhere] };
}

function metricReviewWhere(input: ReviewActor): Prisma.ReviewWhereInput {
  assertReviewAccessActor(input);
  const tenantWhere = reviewTenantWhere(input);
  if (isSystemAdminRole(input.actorRole) || isOrgAdminRole(input.actorRole)) return tenantWhere;
  return { AND: [tenantWhere, { OR: [{ status: 'pending', reviewerId: null }, { reviewerId: input.actorId }] }] };
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  async listQueue(input: { limit: number; offset: number; status?: ReviewStatus } & ReviewActor) {
    const where = visibleReviewWhere(input);

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: input.limit,
        skip: input.offset,
        include: {
          claim: {
            include: {
              consumer: { select: { displayName: true } }
            }
          },
          document: {
            select: {
              id: true,
              originalFilename: true,
              merchantName: true,
              amountMinor: true,
              currency: true
            }
          }
        }
      }),
      this.prisma.review.count({ where })
    ]);

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        claimId: r.claimId,
        documentId: r.documentId,
        status: r.status,
        consumerName: r.claim.consumer.displayName,
        originalFilename: r.document.originalFilename,
        merchantName: r.document.merchantName,
        amountMinor: r.document.amountMinor,
        currency: r.document.currency,
        claimPurpose: r.claim.purpose,
        submittedAt: (r.claim.submittedAt ?? r.createdAt).toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      page: { limit: input.limit, offset: input.offset, total }
    };
  }

  async metrics(input: ReviewActor) {
    const visibleWhere = metricReviewWhere(input);

    const [reviews, pending, highRisk] = await Promise.all([
      this.prisma.review.findMany({
        where: visibleWhere,
        include: {
          claim: { select: { submittedAt: true } },
          document: {
            select: {
              id: true,
              amountMinor: true,
              merchantName: true,
              qualityScore: true,
              qualityWarnings: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.review.findMany({
        where: { AND: [visibleWhere, { status: 'pending' }] },
        include: { claim: { select: { submittedAt: true } }, document: { select: { amountMinor: true, merchantName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 1
      }),
      this.prisma.review.count({
        where: {
          AND: [
            visibleWhere,
            {
              OR: [{ document: { qualityScore: { lt: 70 } } }, { document: { amountMinor: { gte: 50000 } } }]
            }
          ]
        }
      })
    ]);

    const statusCounts = reviews.reduce<Record<ReviewStatus, number>>(
      (acc, review) => {
        acc[review.status] += 1;
        return acc;
      },
      { pending: 0, in_review: 0, approved: 0, rejected: 0 }
    );

    const decided = reviews.filter((review) => review.decidedAt);
    const averageReviewMs =
      decided.length === 0
        ? null
        : Math.round(
            decided.reduce((sum, review) => sum + ((review.decidedAt?.getTime() ?? 0) - review.createdAt.getTime()), 0) /
              decided.length
          );

    const approved = statusCounts.approved;
    const rejected = statusCounts.rejected;
    const decidedTotal = approved + rejected;

    return {
      metrics: {
        statusCounts,
        pendingQueueSize: statusCounts.pending,
        inReviewCount: statusCounts.in_review,
        approvedCount: approved,
        rejectedCount: rejected,
        approvalRate: decidedTotal === 0 ? null : approved / decidedTotal,
        averageReviewMs,
        highRiskCount: highRisk,
        oldestPending: pending[0]
          ? {
              id: pending[0].id,
              claimId: pending[0].claimId,
              documentId: pending[0].documentId,
              merchantName: pending[0].document.merchantName,
              amountMinor: pending[0].document.amountMinor,
              submittedAt: (pending[0].claim.submittedAt ?? pending[0].createdAt).toISOString(),
              createdAt: pending[0].createdAt.toISOString()
            }
          : null
      }
    };
  }

  async getById(input: { id: string } & ReviewActor) {
    const review = await this.prisma.review.findUnique({
      where: { id: input.id },
      include: {
        claim: true,
        document: { include: { fields: true } }
      }
    });

    if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    assertReviewVisibleToActor(review, input);

    const auditEvents = await this.prisma.auditEvent.findMany({
      where: {
        OR: [{ documentId: review.documentId }, { claimId: review.claimId }, { reviewId: review.id }]
      },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    return {
      review: {
        id: review.id,
        claimId: review.claimId,
        documentId: review.documentId,
        status: review.status,
        reviewerId: review.reviewerId,
        decisionNote: review.decisionNote,
        document: {
          id: review.document.id,
          originalFilename: review.document.originalFilename,
          status: review.document.status,
          merchantName: review.document.merchantName,
          documentDate: review.document.documentDate,
          amountMinor: review.document.amountMinor,
          currency: review.document.currency,
          fields: review.document.fields.map((f) => ({
            id: f.id,
            name: f.name,
            label: fieldLabel(f.name),
            value: f.value,
            correctedValue: f.correctedValue,
            confidence: f.confidence,
            source: f.source
          }))
        },
        claim: {
          id: review.claim.id,
          status: review.claim.status,
          purpose: review.claim.purpose,
          note: review.claim.note,
          submittedAt: (review.claim.submittedAt ?? review.createdAt).toISOString()
        },
        auditEvents: auditEvents.map((e) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actorRole: e.actorRole,
          message: e.message,
          metadata: e.metadata,
          createdAt: e.createdAt.toISOString()
        }))
      }
    };
  }

  async claim(input: { reviewId: string } & ReviewActor) {
    const review = await this.prisma.review.findUnique({
      where: { id: input.reviewId },
      include: { claim: true, document: { select: { organizationId: true } } }
    });
    if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    assertReviewVisibleToActor(review, input);

    if (review.status !== 'pending' || review.claim.status !== 'submitted') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: review.id, status: 'pending' },
        data: {
          status: 'in_review',
          reviewerId: input.actorId
        }
      });

      const updatedClaim = await tx.claim.update({
        where: { id: review.claimId },
        data: {
          status: 'under_review' satisfies ClaimStatus
        }
      });

      return { updatedReview, updatedClaim };
    }).catch((error) => {
      if (isPrismaKnownErrorCode(error, 'P2025')) {
        throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
      }
      throw error;
    });

    await this.audit.writeEvent({
      action: 'review.started',
      entityType: 'review',
      entityId: review.id,
      actor: { actorId: input.actorId, actorRole: input.actorRole },
      message: 'Review started',
      metadata: {},
      reviewId: review.id,
      claimId: review.claimId,
      documentId: review.documentId
    });

    return {
      review: {
        id: result.updatedReview.id,
        claimId: result.updatedReview.claimId,
        documentId: result.updatedReview.documentId,
        status: result.updatedReview.status,
        reviewerId: result.updatedReview.reviewerId,
        updatedAt: result.updatedReview.updatedAt.toISOString()
      },
      claim: {
        id: result.updatedClaim.id,
        status: result.updatedClaim.status,
        updatedAt: result.updatedClaim.updatedAt.toISOString()
      }
    };
  }

  async assign(input: {
    reviewId: string;
    reviewerId: string;
    actorId: string;
    actorRole: string;
    organizationId: string | null;
  }) {
    if (input.actorRole !== 'admin' && input.actorRole !== 'system_admin') {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    return await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: input.reviewId, status: 'pending' },
        data: { status: 'in_review', reviewerId: input.reviewerId },
        include: {
          document: { select: { organizationId: true } },
          claim: { select: { id: true } }
        }
      });

      const reviewer = await tx.user.findFirst({
        where: {
          id: input.reviewerId,
          role: 'reviewer',
          organizationId: review.document.organizationId
        }
      });
      if (!reviewer) {
        throwContractHttpError(422, 'VALIDATION_ERROR', 'Reviewer not found or invalid', []);
      }

      await tx.claim.update({
        where: { id: review.claim.id },
        data: { status: 'under_review' }
      });

      return { review: { id: review.id, status: review.status, reviewerId: review.reviewerId }, reviewer };
    });
  }

  async unassign(input: {
    reviewId: string;
    actorId: string;
    actorRole: string;
    organizationId: string | null;
  }) {
    if (input.actorRole !== 'admin' && input.actorRole !== 'system_admin') {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    return await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: input.reviewId, status: 'in_review' },
        data: { status: 'pending', reviewerId: null },
        include: { claim: { select: { id: true } } }
      });

      await tx.claim.update({
        where: { id: review.claim.id },
        data: { status: 'submitted' }
      });

      return { review: { id: review.id, status: review.status, reviewerId: null } };
    });
  }

  async approve(input: { reviewId: string; note?: string | null } & ReviewActor) {
    assertReviewDecisionActor(input);
    const review = await this.prisma.review.findUnique({
      where: { id: input.reviewId },
      include: { claim: true, document: true }
    });
    if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    assertReviewVisibleToActor(review, input);

    if (review.status !== 'in_review') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    const decidedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: review.id },
        data: {
          status: 'approved',
          decisionNote: input.note ?? null,
          decidedAt
        }
      });

      const updatedClaim = await tx.claim.update({
        where: { id: review.claimId },
        data: {
          status: 'approved',
          decidedAt
        }
      });

      const updatedDocument = await tx.document.update({
        where: { id: review.documentId },
        data: { status: 'reviewed' }
      });

      return { updatedReview, updatedClaim, updatedDocument };
    });

    await this.audit.writeEvent({
      action: 'review.approved',
      entityType: 'review',
      entityId: review.id,
      actor: { actorId: input.actorId, actorRole: input.actorRole },
      message: 'Review approved',
      metadata: { note: input.note ?? null },
      reviewId: review.id,
      claimId: review.claimId,
      documentId: review.documentId
    });

    return {
      review: {
        id: result.updatedReview.id,
        claimId: result.updatedReview.claimId,
        documentId: result.updatedReview.documentId,
        status: result.updatedReview.status,
        reviewerId: result.updatedReview.reviewerId,
        decisionNote: result.updatedReview.decisionNote,
        decidedAt: result.updatedReview.decidedAt?.toISOString() ?? null,
        updatedAt: result.updatedReview.updatedAt.toISOString()
      },
      claim: {
        id: result.updatedClaim.id,
        status: result.updatedClaim.status,
        decidedAt: result.updatedClaim.decidedAt?.toISOString() ?? null
      },
      document: {
        id: result.updatedDocument.id,
        status: result.updatedDocument.status
      }
    };
  }

  async reject(input: { reviewId: string; note: string } & ReviewActor) {
    assertReviewDecisionActor(input);
    if (!input.note || input.note.trim().length === 0) {
      throwValidationError([{ path: 'note', message: 'note is required' }]);
    }

    const review = await this.prisma.review.findUnique({
      where: { id: input.reviewId },
      include: { claim: true, document: true }
    });
    if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    assertReviewVisibleToActor(review, input);

    if (review.status !== 'in_review') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    const decidedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: review.id },
        data: {
          status: 'rejected',
          decisionNote: input.note,
          decidedAt
        }
      });

      const updatedClaim = await tx.claim.update({
        where: { id: review.claimId },
        data: {
          status: 'rejected',
          decidedAt
        }
      });

      const updatedDocument = await tx.document.update({
        where: { id: review.documentId },
        data: { status: 'rejected' }
      });

      return { updatedReview, updatedClaim, updatedDocument };
    });

    await this.audit.writeEvent({
      action: 'review.rejected',
      entityType: 'review',
      entityId: review.id,
      actor: { actorId: input.actorId, actorRole: input.actorRole },
      message: 'Review rejected',
      metadata: { note: input.note },
      reviewId: review.id,
      claimId: review.claimId,
      documentId: review.documentId
    });

    return {
      review: {
        id: result.updatedReview.id,
        claimId: result.updatedReview.claimId,
        documentId: result.updatedReview.documentId,
        status: result.updatedReview.status,
        reviewerId: result.updatedReview.reviewerId,
        decisionNote: result.updatedReview.decisionNote,
        decidedAt: result.updatedReview.decidedAt?.toISOString() ?? null,
        updatedAt: result.updatedReview.updatedAt.toISOString()
      },
      claim: {
        id: result.updatedClaim.id,
        status: result.updatedClaim.status,
        decidedAt: result.updatedClaim.decidedAt?.toISOString() ?? null
      },
      document: {
        id: result.updatedDocument.id,
        status: result.updatedDocument.status
      }
    };
  }
}
