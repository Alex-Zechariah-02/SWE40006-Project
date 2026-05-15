import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { DocumentStatus } from '@balance/db';

import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { throwValidationError } from '../common/contract-errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

import { DocumentsService } from './documents.service';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional()
});

const correctionsBodySchema = z.object({
  fields: z
    .array(
      z.object({
        name: z.enum(['merchantName', 'documentDate', 'amountMinor', 'currency']),
        correctedValue: z.string().nullable()
      })
    )
    .min(1)
});

type RequestUser = { id: string; role: string };
type MulterFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async upload(
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: RequestUser
  ) {
    if (!file) {
      throwValidationError([{ path: 'file', message: 'file is required' }], 422);
    }

    return this.documents.upload({
      ownerId: user.id,
      originalFilename: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      body: file.buffer
    });
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  async list(
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
    @CurrentUser() user: RequestUser
  ) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const status = query.status?.trim();
    if (status && !['uploaded', 'queued', 'processing', 'extracted', 'correction_required', 'corrected', 'submitted', 'reviewed', 'rejected', 'failed'].includes(status)) {
      throwValidationError([{ path: 'status', message: 'Invalid status' }]);
    }

    const input: { ownerId: string; limit: number; offset: number; status?: DocumentStatus } = {
      ownerId: user.id,
      limit,
      offset
    };

    if (status) {
      input.status = status as DocumentStatus;
    }

    return this.documents.list(input);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer', 'reviewer', 'admin')
  async detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getById({ id, userId: user.id, role: user.role });
  }

  @Patch(':id/corrections')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('consumer')
  async corrections(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(correctionsBodySchema)) body: z.infer<typeof correctionsBodySchema>,
    @CurrentUser() user: RequestUser
  ) {
    return this.documents.applyCorrections({
      documentId: id,
      ownerId: user.id,
      fields: body.fields
    });
  }
}
