import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

const auditQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

type RequestUser = { id: string; role: string };

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'admin')
  async list(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: z.infer<typeof auditQuerySchema>,
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
        select: { id: true, ownerId: true, review: { select: { id: true } } }
      });
      if (!doc) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && doc.ownerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && !doc.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
    }

    if (query.claimId) {
      const claim = await this.prisma.claim.findUnique({
        where: { id: query.claimId },
        select: { id: true, consumerId: true, review: { select: { id: true } } }
      });
      if (!claim) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' && !claim.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
    }

    if (query.reviewId) {
      const review = await this.prisma.review.findUnique({
        where: { id: query.reviewId },
        select: { id: true, claim: { select: { consumerId: true } } }
      });
      if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && review.claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
    }

    const where = {
      OR: [
        ...(query.documentId ? [{ documentId: query.documentId }] : []),
        ...(query.claimId ? [{ claimId: query.claimId }] : []),
        ...(query.reviewId ? [{ reviewId: query.reviewId }] : [])
      ]
    };

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
