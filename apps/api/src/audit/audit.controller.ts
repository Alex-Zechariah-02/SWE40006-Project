import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Prisma, ReviewStatus } from '@balance/db';
import { auditQuerySchema, type AuditQuery } from '@balance/schemas';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

type RequestUser = { id: string; role: string };

function assertReviewerCanSeeReview(review: { status: ReviewStatus; reviewerId: string | null }, reviewerId: string) {
  if (review.status === 'pending' && !review.reviewerId) return;
  if (review.reviewerId === reviewerId) return;
  throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
}

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'admin')
  async list(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
    @CurrentUser() user: RequestUser
  ) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const hasFilter = Boolean(query.documentId || query.claimId || query.reviewId);
    if (!hasFilter && user.role !== 'admin') {
      throwValidationError([{ path: 'query', message: 'At least one filter is required' }]);
    }

    // Visibility checks for non-admin users.
    if (query.documentId) {
      const doc = await this.prisma.document.findUnique({
        where: { id: query.documentId },
        select: { id: true, ownerId: true, review: { select: { id: true, status: true, reviewerId: true } } }
      });
      if (!doc) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && doc.ownerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && !doc.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && doc.review) {
        assertReviewerCanSeeReview(doc.review, user.id);
      }
    }

    if (query.claimId) {
      const claim = await this.prisma.claim.findUnique({
        where: { id: query.claimId },
        select: { id: true, consumerId: true, review: { select: { id: true, status: true, reviewerId: true } } }
      });
      if (!claim) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && !claim.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && claim.review) {
        assertReviewerCanSeeReview(claim.review, user.id);
      }
    }

    if (query.reviewId) {
      const review = await this.prisma.review.findUnique({
        where: { id: query.reviewId },
        select: { id: true, status: true, reviewerId: true, claim: { select: { consumerId: true } } }
      });
      if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && review.claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer') {
        assertReviewerCanSeeReview(review, user.id);
      }
    }

    const filters: Prisma.AuditEventWhereInput[] = [
      ...(query.documentId ? [{ documentId: query.documentId }] : []),
      ...(query.claimId ? [{ claimId: query.claimId }] : []),
      ...(query.reviewId ? [{ reviewId: query.reviewId }] : [])
    ];

    const where: Prisma.AuditEventWhereInput = filters.length > 0 ? { OR: filters } : {};

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.auditEvent.count({ where })
    ]);

    return {
      auditEvents: items.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actorId: e.actorId,
        actorRole: e.actorRole,
        message: e.message,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString()
      })),
      page: { limit, offset, total }
    };
  }
}
