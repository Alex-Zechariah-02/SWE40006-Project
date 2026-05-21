import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { ClaimStatus } from '@balance/db';
import {
  claimListQuerySchema,
  claimSubmissionPayloadSchema,
  type ClaimListQuery,
  type ClaimSubmissionPayload
} from '@balance/schemas';

import { AuthGuard, type AuthenticatedRequestUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(@Inject(ClaimsService) private readonly claims: ClaimsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'staff', 'admin')
  async create(
    @Body(new ZodValidationPipe(claimSubmissionPayloadSchema)) body: ClaimSubmissionPayload,
    @CurrentUser() user: AuthenticatedRequestUser
  ) {
    return this.claims.create({
      consumerId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId,
      documentId: body.documentId,
      purpose: body.purpose,
      note: body.note ?? null
    });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'staff', 'admin')
  async list(
    @Query(new ZodValidationPipe(claimListQuerySchema)) query: ClaimListQuery,
    @CurrentUser() user: AuthenticatedRequestUser
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

  @Get('insights')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'staff', 'admin')
  async insights(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.claims.insights({ consumerId: user.id });
  }

  @Post(':id/recall')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('staff', 'admin', 'system_admin')
  @HttpCode(200)
  async recall(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.claims.recall({
      claimId: id,
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'staff', 'admin', 'system_admin')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.claims.getById({ id, userId: user.id, role: user.role, organizationId: user.organizationId });
  }
}
