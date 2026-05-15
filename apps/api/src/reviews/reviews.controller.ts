import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { ReviewStatus } from '@balance/db';

import { AuthGuard, type AuthenticatedRequestUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ReviewsService } from './reviews.service';

const queueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional()
});

const decisionBodySchema = z.object({
  note: z.string().optional()
});

const rejectBodySchema = z.object({
  note: z.string().min(1)
});

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('queue')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  async queue(@Query(new ZodValidationPipe(queueQuerySchema)) query: z.infer<typeof queueQuerySchema>) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status?.trim();

    if (status && !['pending', 'in_review', 'approved', 'rejected'].includes(status)) {
      throwValidationError([{ path: 'status', message: 'Invalid status' }]);
    }

    const input: { limit: number; offset: number; status?: ReviewStatus } = { limit, offset };
    if (status) input.status = status as ReviewStatus;
    return this.reviews.listQueue(input);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  async detail(@Param('id') id: string) {
    return this.reviews.getById({ id });
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('reviewer', 'admin')
  @HttpCode(200)
  async approve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decisionBodySchema)) body: z.infer<typeof decisionBodySchema>,
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
    @Body(new ZodValidationPipe(rejectBodySchema)) body: z.infer<typeof rejectBodySchema>,
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
