import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { ReviewStatus } from '@balance/db';
import {
  reviewApprovePayloadSchema,
  reviewQueueQuerySchema,
  reviewRejectPayloadSchema,
  type ReviewApprovePayload,
  type ReviewQueueQuery,
  type ReviewRejectPayload
} from '@balance/schemas';

import { AuthGuard, type AuthenticatedRequestUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('queue')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  async queue(
    @Query(new ZodValidationPipe(reviewQueueQuerySchema)) query: ReviewQueueQuery,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status?.trim();

    const input: { limit: number; offset: number; status?: ReviewStatus; actorId: string; actorRole: string } = {
      limit,
      offset,
      actorId: user.id,
      actorRole: user.role
    };
    if (status) input.status = status as ReviewStatus;
    return this.reviews.listQueue(input);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.reviews.getById({ id, actorId: user.id, actorRole: user.role });
  }

  @Post(':id/claim')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  @HttpCode(200)
  async claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.reviews.claim({
      reviewId: id,
      actorId: user.id,
      actorRole: user.role
    });
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
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
      note: body.note ?? null
    });
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
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
      note: body.note
    });
  }
}
