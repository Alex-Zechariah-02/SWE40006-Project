import { Injectable } from '@nestjs/common';
import type { ClaimStatus, Prisma, ReviewStatus } from '@balance/db';

import { AuditService } from '../audit/audit.service';
import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { PrismaService } from '../prisma/prisma.service';

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

type ReviewActor = { actorId: string; actorRole: string };
type ReviewVisibilityRecord = { status: ReviewStatus; reviewerId: string | null };

function assertReviewVisibleToActor(review: ReviewVisibilityRecord, actor: ReviewActor) {
  if (actor.actorRole === 'admin') return;

  if (actor.actorRole !== 'reviewer') {
    throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
  }

  if (review.status === 'pending' && !review.reviewerId) return;
  if (review.reviewerId === actor.actorId) return;

  throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listQueue(input: { limit: number; offset: number; status?: ReviewStatus } & ReviewActor) {
    let where: Prisma.ReviewWhereInput = {};

    if (input.actorRole === 'admin') {
      where = input.status ? { status: input.status } : { status: { in: ['pending', 'in_review'] } };
    } else if (input.actorRole === 'reviewer') {
      if (input.status === 'pending') {
        where = { status: 'pending' };
      } else if (input.status) {
        where = { status: input.status, reviewerId: input.actorId };
      } else {
        where = {
          OR: [{ status: 'pending' }, { status: 'in_review', reviewerId: input.actorId }]
        };
      }
    } else {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

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
        submittedAt: r.claim.submittedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      page: { limit: input.limit, offset: input.offset, total }
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
          submittedAt: review.claim.submittedAt.toISOString()
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

  async claim(input: { reviewId: string; actorId: string; actorRole: string }) {
    const review = await this.prisma.review.findUnique({
      where: { id: input.reviewId },
      include: { claim: true }
    });
    if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

    if (review.status !== 'pending' || review.claim.status !== 'submitted') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: review.id },
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

  async approve(input: { reviewId: string; actorId: string; actorRole: string; note?: string | null }) {
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

  async reject(input: { reviewId: string; actorId: string; actorRole: string; note: string }) {
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
