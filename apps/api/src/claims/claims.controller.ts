import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { ClaimStatus } from '@balance/db';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { ClaimsService } from './claims.service';

const createClaimBodySchema = z.object({
  documentId: z.string().uuid(),
  purpose: z.string().min(1),
  note: z.string().optional()
});

const listClaimsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional()
});

type RequestUser = { id: string; role: string };

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  async create(
    @Body(new ZodValidationPipe(createClaimBodySchema)) body: z.infer<typeof createClaimBodySchema>,
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
    @Query(new ZodValidationPipe(listClaimsQuerySchema)) query: z.infer<typeof listClaimsQuerySchema>,
    @CurrentUser() user: RequestUser
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const status = query.status?.trim();

    if (status && !['submitted', 'under_review', 'approved', 'rejected'].includes(status)) {
      throwValidationError([{ path: 'status', message: 'Invalid status' }]);
    }

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
