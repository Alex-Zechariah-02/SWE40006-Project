import { Injectable } from '@nestjs/common';
import type { ClaimStatus, DocumentStatus, Prisma, ReviewStatus } from '@balance/db';

import { AuditService } from '../audit/audit.service';
import { throwContractHttpError } from '../common/contract-errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async create(input: { consumerId: string; documentId: string; purpose: string; note?: string | null }) {
    const doc = await this.prisma.document.findUnique({
      where: { id: input.documentId },
      include: { claim: true }
    });

    if (!doc) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    if (doc.ownerId !== input.consumerId) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

    if (doc.claim) {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    if (doc.status !== 'extracted' && doc.status !== 'corrected') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    const submittedAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.claim.create({
        data: {
          documentId: doc.id,
          consumerId: input.consumerId,
          status: 'submitted' satisfies ClaimStatus,
          purpose: input.purpose,
          note: input.note ?? null,
          submittedAt
        }
      });

      const review = await tx.review.create({
        data: {
          claimId: claim.id,
          documentId: doc.id,
          status: 'pending' satisfies ReviewStatus,
          reviewerId: null,
          decisionNote: null
        }
      });

      await tx.document.update({
        where: { id: doc.id },
        data: { status: 'submitted' satisfies DocumentStatus }
      });

      return { claim, review };
    });

    await this.audit.writeEvent({
      action: 'claim.submitted',
      entityType: 'claim',
      entityId: result.claim.id,
      actor: { actorId: input.consumerId, actorRole: 'consumer' },
      message: 'Claim submitted',
      metadata: {},
      documentId: doc.id,
      claimId: result.claim.id,
      reviewId: result.review.id
    });

    return {
      claim: {
        id: result.claim.id,
        documentId: result.claim.documentId,
        consumerId: result.claim.consumerId,
        status: result.claim.status,
        purpose: result.claim.purpose,
        note: result.claim.note,
        submittedAt: result.claim.submittedAt.toISOString(),
        decidedAt: result.claim.decidedAt?.toISOString() ?? null,
        createdAt: result.claim.createdAt.toISOString(),
        updatedAt: result.claim.updatedAt.toISOString()
      },
      review: {
        id: result.review.id,
        claimId: result.review.claimId,
        documentId: result.review.documentId,
        status: result.review.status,
        reviewerId: result.review.reviewerId,
        decisionNote: result.review.decisionNote,
        createdAt: result.review.createdAt.toISOString(),
        updatedAt: result.review.updatedAt.toISOString()
      }
    };
  }

  async list(input: { consumerId: string; limit: number; offset: number; status?: ClaimStatus }) {
    const where: Prisma.ClaimWhereInput = { consumerId: input.consumerId };
    if (input.status) where.status = input.status;

    const [claims, total] = await Promise.all([
      this.prisma.claim.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: input.limit,
        skip: input.offset,
        include: {
          document: {
            select: {
              id: true,
              originalFilename: true,
              merchantName: true,
              amountMinor: true,
              currency: true,
              status: true
            }
          }
        }
      }),
      this.prisma.claim.count({ where })
    ]);

    return {
      claims: claims.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        status: c.status,
        purpose: c.purpose,
        note: c.note,
        submittedAt: c.submittedAt.toISOString(),
        decidedAt: c.decidedAt?.toISOString() ?? null,
        document: {
          id: c.document.id,
          originalFilename: c.document.originalFilename,
          merchantName: c.document.merchantName,
          amountMinor: c.document.amountMinor,
          currency: c.document.currency,
          status: c.document.status
        }
      })),
      page: { limit: input.limit, offset: input.offset, total }
    };
  }

  async getById(input: { userId: string; role: string; id: string }) {
    const claim = await this.prisma.claim.findUnique({
      where: { id: input.id },
      include: {
        document: {
          select: {
            id: true,
            originalFilename: true,
            status: true,
            merchantName: true,
            amountMinor: true,
            currency: true
          }
        },
        review: {
          select: {
            id: true,
            status: true,
            decisionNote: true
          }
        }
      }
    });

    if (!claim) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

    if (input.role === 'consumer') {
      if (claim.consumerId !== input.userId) {
        throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
      }
    } else if (input.role === 'reviewer') {
      if (!claim.review) throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    } else if (input.role !== 'admin') {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    return {
      claim: {
        id: claim.id,
        documentId: claim.documentId,
        consumerId: claim.consumerId,
        status: claim.status,
        purpose: claim.purpose,
        note: claim.note,
        submittedAt: claim.submittedAt.toISOString(),
        decidedAt: claim.decidedAt?.toISOString() ?? null,
        document: {
          id: claim.document.id,
          originalFilename: claim.document.originalFilename,
          status: claim.document.status,
          merchantName: claim.document.merchantName,
          amountMinor: claim.document.amountMinor,
          currency: claim.document.currency
        },
        review: claim.review
          ? {
              id: claim.review.id,
              status: claim.review.status,
              decisionNote: claim.review.decisionNote
            }
          : null
      }
    };
  }
}
