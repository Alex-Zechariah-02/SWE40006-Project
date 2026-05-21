import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { ReviewStatus } from '@balance/db';
import {
  reviewApprovePayloadSchema,
  reviewQueueQuerySchema,
  reviewRejectPayloadSchema,
  type ReviewApprovePayload,
  type ReviewQueueQuery,
  type ReviewRejectPayload
} from '@balance/schemas';

import { AuditService } from '../audit/audit.service';
import { AuthGuard, type AuthenticatedRequestUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get('queue')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin', 'system_admin')
  async queue(
    @Query(new ZodValidationPipe(reviewQueueQuerySchema)) query: ReviewQueueQuery,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status?.trim();

    const input: { limit: number; offset: number; status?: ReviewStatus; actorId: string; actorRole: string; organizationId: string | null } = {
      limit,
      offset,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId
    };
    if (status) input.status = status as ReviewStatus;
    return this.reviews.listQueue(input);
  }

  @Get('metrics')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin', 'system_admin')
  async metrics(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.reviews.metrics({ actorId: user.id, actorRole: user.role, organizationId: user.organizationId });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin', 'system_admin')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.reviews.getById({ id, actorId: user.id, actorRole: user.role, organizationId: user.organizationId });
  }

  @Post(':id/claim')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin', 'system_admin')
  @HttpCode(200)
  async claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.reviews.claim({
      reviewId: id,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId
    });
  }

  @Post(':id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'system_admin')
  @HttpCode(200)
  async assign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ reviewerId: z.string().uuid() }))) body: { reviewerId: string },
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    const result = await this.reviews.assign({
      reviewId: id,
      reviewerId: body.reviewerId,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId
    });

    await this.audit.writeEvent({
      action: 'review.assigned',
      entityType: 'review',
      entityId: id,
      actor: { actorId: user.id, actorRole: user.role },
      message: 'Review assigned to reviewer',
      reviewId: id
    });

    return result;
  }

  @Delete(':id/assign')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'system_admin')
  @HttpCode(200)
  async unassign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    const result = await this.reviews.unassign({
      reviewId: id,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId
    });

    await this.audit.writeEvent({
      action: 'review.unassigned',
      entityType: 'review',
      entityId: id,
      actor: { actorId: user.id, actorRole: user.role },
      message: 'Review unassigned',
      reviewId: id
    });

    return result;
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'system_admin')
  @HttpCode(200)
  async approve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewApprovePayloadSchema)) body: ReviewApprovePayload,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    return this.reviews.approve({
      reviewId: id,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId,
      note: body.note ?? null
    });
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'system_admin')
  @HttpCode(200)
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reviewRejectPayloadSchema)) body: ReviewRejectPayload,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    return this.reviews.reject({
      reviewId: id,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId,
      note: body.note
    });
  }
}
