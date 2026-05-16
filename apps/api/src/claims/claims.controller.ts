import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { ClaimStatus } from '@balance/db';
import {
  claimListQuerySchema,
  claimSubmissionPayloadSchema,
  type ClaimListQuery,
  type ClaimSubmissionPayload
} from '@balance/schemas';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ClaimsService } from './claims.service';

type RequestUser = { id: string; role: string };

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  async create(
    @Body(new ZodValidationPipe(claimSubmissionPayloadSchema)) body: ClaimSubmissionPayload,
    @CurrentUser() user: RequestUser
  ) {
    return this.claims.create({
      consumerId: user.id,
      documentId: body.documentId,
      purpose: body.purpose,
      note: body.note ?? null
    });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  async list(
    @Query(new ZodValidationPipe(claimListQuerySchema)) query: ClaimListQuery,
    @CurrentUser() user: RequestUser
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status?.trim();

    const input: { consumerId: string; limit: number; offset: number; status?: ClaimStatus } = {
      consumerId: user.id,
      limit,
      offset
    };

    if (status) {
      input.status = status as ClaimStatus;
    }

    return this.claims.list(input);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'admin')
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.claims.getById({ id, userId: user.id, role: user.role });
  }
}
