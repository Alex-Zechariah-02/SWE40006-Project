import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { EntityType, Prisma } from '@balance/db';
import { auditQuerySchema, type AuditQuery } from '@balance/schemas';

import { AuthGuard, type AuthenticatedRequestUser } from '../auth/auth.guard';
import {
  assertReviewVisibleToActor,
  isOrgAdminRole,
  isSystemAdminRole,
  sameOrganization
} from '../auth/access-policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Controller('audit')
export class AuditController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('summary')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'system_admin')
  async summary(@CurrentUser() user: AuthenticatedRequestUser) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const orgFilter: Prisma.AuditEventWhereInput = {};
    if (user.role === 'admin' && user.organizationId) {
      orgFilter.organizationId = user.organizationId;
    }

    const [total, byAction, byEntityType, byActorRole, recentFailures] = await Promise.all([
      this.prisma.auditEvent.count({ where: orgFilter }),
      this.prisma.auditEvent.groupBy({
        by: ['action'],
        _count: { _all: true },
        where: orgFilter,
        orderBy: { _count: { action: 'desc' } },
        take: 20
      }),
      this.prisma.auditEvent.groupBy({
        by: ['entityType'],
        _count: { _all: true },
        where: orgFilter,
        orderBy: { _count: { entityType: 'desc' } }
      }),
      this.prisma.auditEvent.groupBy({
        by: ['actorRole'],
        _count: { _all: true },
        where: orgFilter,
        orderBy: { _count: { actorRole: 'desc' } }
      }),
      this.prisma.auditEvent.findMany({
        where: {
          ...orgFilter,
          createdAt: { gte: since },
          action: { in: ['extraction.failed', 'review.rejected'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    return {
      summary: {
        total,
        byAction: byAction.map((item) => ({ action: item.action, count: item._count._all })),
        byEntityType: byEntityType.map((item) => ({ entityType: item.entityType, count: item._count._all })),
        byActorRole: byActorRole.map((item) => ({ actorRole: item.actorRole, count: item._count._all })),
        recentFailures: recentFailures.map((event) => ({
          id: event.id,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          message: event.message,
          metadata: event.metadata,
          createdAt: event.createdAt.toISOString()
        }))
      }
    };
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'staff', 'admin', 'system_admin')
  async list(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const hasFilter = Boolean(query.documentId || query.claimId || query.reviewId);
    if (!hasFilter && !isSystemAdminRole(user.role) && !isOrgAdminRole(user.role)) {
      throwValidationError([{ path: 'query', message: 'At least one filter is required' }]);
    }

    // Visibility checks for non-admin users.
    if (query.documentId) {
      const doc = await this.prisma.document.findUnique({
        where: { id: query.documentId },
        select: { id: true, ownerId: true, organizationId: true, review: { select: { id: true, status: true, reviewerId: true } } }
      });
      if (!doc) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && doc.ownerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (isOrgAdminRole(user.role) && !sameOrganization({ actorId: user.id, actorRole: user.role, organizationId: user.organizationId }, doc.organizationId)) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if ((user.role === 'reviewer' || user.role === 'staff') && !doc.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if ((user.role === 'reviewer' || user.role === 'staff') && doc.review) {
        assertReviewVisibleToActor({ ...doc.review, document: { organizationId: doc.organizationId } }, { actorId: user.id, actorRole: user.role, organizationId: user.organizationId });
      }
    }

    if (query.claimId) {
      const claim = await this.prisma.claim.findUnique({
        where: { id: query.claimId },
        select: {
          id: true,
          consumerId: true,
          document: { select: { organizationId: true } },
          review: { select: { id: true, status: true, reviewerId: true } }
        }
      });
      if (!claim) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (isOrgAdminRole(user.role) && !sameOrganization({ actorId: user.id, actorRole: user.role, organizationId: user.organizationId }, claim.document.organizationId)) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if ((user.role === 'reviewer' || user.role === 'staff') && !claim.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if ((user.role === 'reviewer' || user.role === 'staff') && claim.review) {
        assertReviewVisibleToActor({ ...claim.review, document: { organizationId: claim.document.organizationId } }, { actorId: user.id, actorRole: user.role, organizationId: user.organizationId });
      }
    }

    if (query.reviewId) {
      const review = await this.prisma.review.findUnique({
        where: { id: query.reviewId },
        select: {
          id: true,
          status: true,
          reviewerId: true,
          claim: { select: { consumerId: true } },
          document: { select: { organizationId: true } }
        }
      });
      if (!review) throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);

      if (user.role === 'consumer' && review.claim.consumerId !== user.id) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (isOrgAdminRole(user.role) && !sameOrganization({ actorId: user.id, actorRole: user.role, organizationId: user.organizationId }, review.document.organizationId)) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
      if (user.role === 'reviewer' || user.role === 'staff') {
        assertReviewVisibleToActor({ ...review, document: { organizationId: review.document.organizationId } }, { actorId: user.id, actorRole: user.role, organizationId: user.organizationId });
      }
    }

    const filters: Prisma.AuditEventWhereInput[] = [
      ...(query.documentId ? [{ documentId: query.documentId }] : []),
      ...(query.claimId ? [{ claimId: query.claimId }] : []),
      ...(query.reviewId ? [{ reviewId: query.reviewId }] : [])
    ];

    const where: Prisma.AuditEventWhereInput = filters.length > 0 ? { OR: filters } : {};
    const andFilters: Prisma.AuditEventWhereInput[] = [];

    if (query.action) andFilters.push({ action: { contains: query.action, mode: 'insensitive' } });
    if (query.entityType) andFilters.push({ entityType: query.entityType as EntityType });
    if (query.actorRole) andFilters.push({ actorRole: { contains: query.actorRole, mode: 'insensitive' } });
    if (query.from || query.to) {
      andFilters.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {})
        }
      });
    }
    if (query.search) {
      andFilters.push({
        OR: [
          { action: { contains: query.search, mode: 'insensitive' } },
          { message: { contains: query.search, mode: 'insensitive' } },
          { entityId: { contains: query.search, mode: 'insensitive' } }
        ]
      });
    }
    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

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
