import { Injectable } from '@nestjs/common';
import type { DocumentField, DocumentStatus, ExtractionProvider, ExtractionJobStatus, FieldName, FieldSource, Prisma } from '@balance/db';

import { throwContractHttpError, throwValidationError } from '../common/contract-errors';
import { PrismaService } from '../prisma/prisma.service';
import { ExtractionQueueService } from '../queue/extraction-queue.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';

const ACCEPTED_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function fieldLabel(name: FieldName): string {
  switch (name) {
    case 'merchantName':
      return 'Merchant name';
    case 'documentDate':
      return 'Document date';
    case 'amountMinor':
      return 'Amount';
    case 'currency':
      return 'Currency';
    default:
      return 'Field';
  }
}

type PublicField = {
  id: string;
  name: FieldName;
  label: string;
  value: string;
  correctedValue: string | null;
  confidence: number | null;
  source: FieldSource;
};

function mapField(field: DocumentField): PublicField {
  return {
    id: field.id,
    name: field.name,
    label: fieldLabel(field.name),
    value: field.value,
    correctedValue: field.correctedValue ?? null,
    confidence: field.confidence ?? null,
    source: field.source
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queue: ExtractionQueueService,
    private readonly audit: AuditService
  ) {}

  async upload(input: {
    ownerId: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    body: Buffer;
  }) {
    if (!ACCEPTED_CONTENT_TYPES.has(input.contentType)) {
      throwContractHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type', []);
    }

    const document = await this.prisma.document.create({
      data: {
        ownerId: input.ownerId,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageKey: '',
        status: 'uploaded'
      }
    });

    const { storageKey } = await this.storage.saveUploadedDocumentFile({
      documentId: document.id,
      contentType: input.contentType,
      body: input.body
    });

    const updated = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        storageKey,
        status: 'queued' satisfies DocumentStatus
      }
    });

    const extractionJob = await this.prisma.extractionJob.create({
      data: {
        documentId: updated.id,
        status: 'queued' satisfies ExtractionJobStatus,
        provider: 'tesseract' satisfies ExtractionProvider
      }
    });

    await this.audit.writeEvent({
      action: 'document.uploaded',
      entityType: 'document',
      entityId: updated.id,
      actor: { actorId: input.ownerId, actorRole: 'consumer' },
      message: 'Document uploaded',
      metadata: {},
      documentId: updated.id
    });

    await this.audit.writeEvent({
      action: 'extraction.queued',
      entityType: 'extraction_job',
      entityId: extractionJob.id,
      actor: { actorId: null, actorRole: 'system' },
      message: 'Extraction queued',
      metadata: {},
      documentId: updated.id,
      extractionJobId: extractionJob.id
    });

    await this.queue.enqueue({
      documentId: updated.id,
      extractionJobId: extractionJob.id,
      storageKey: updated.storageKey,
      contentType: updated.contentType,
      originalFilename: updated.originalFilename
    });

    return {
      document: {
        id: updated.id,
        ownerId: updated.ownerId,
        originalFilename: updated.originalFilename,
        contentType: updated.contentType,
        sizeBytes: updated.sizeBytes,
        status: updated.status,
        merchantName: updated.merchantName,
        documentDate: updated.documentDate,
        amountMinor: updated.amountMinor,
        currency: updated.currency,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      },
      extractionJob: {
        id: extractionJob.id,
        documentId: extractionJob.documentId,
        status: extractionJob.status,
        provider: extractionJob.provider,
        errorMessage: extractionJob.errorMessage,
        createdAt: extractionJob.createdAt.toISOString(),
        startedAt: extractionJob.startedAt?.toISOString() ?? null,
        completedAt: extractionJob.completedAt?.toISOString() ?? null
      }
    };
  }

  async list(input: { ownerId: string; limit: number; offset: number; status?: DocumentStatus }) {
    const where: Prisma.DocumentWhereInput = { ownerId: input.ownerId };
    if (input.status) where.status = input.status;

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset
      }),
      this.prisma.document.count({ where })
    ]);

    return {
      documents: documents.map((d) => ({
        id: d.id,
        ownerId: d.ownerId,
        originalFilename: d.originalFilename,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        status: d.status,
        merchantName: d.merchantName,
        documentDate: d.documentDate,
        amountMinor: d.amountMinor,
        currency: d.currency,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      })),
      page: { limit: input.limit, offset: input.offset, total }
    };
  }

  async getById(input: { userId: string; role: string; id: string }) {
    const document = await this.prisma.document.findUnique({
      where: { id: input.id },
      include: {
        fields: true,
        extractionJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        claim: true,
        review: true
      }
    });

    if (!document) {
      throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    }

    const isConsumer = input.role === 'consumer';
    const isReviewer = input.role === 'reviewer';
    const isAdmin = input.role === 'admin';

    if (isConsumer) {
      if (document.ownerId !== input.userId) {
        throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
      }
    } else if (isReviewer) {
      if (!document.review) {
        throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
      }
    } else if (!isAdmin) {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    const latestJob = document.extractionJobs[0] ?? null;

    return {
      document: {
        id: document.id,
        ownerId: document.ownerId,
        originalFilename: document.originalFilename,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
        status: document.status,
        merchantName: document.merchantName,
        documentDate: document.documentDate,
        amountMinor: document.amountMinor,
        currency: document.currency,
        fields: document.fields.map(mapField),
        extractionJob: latestJob
          ? {
              id: latestJob.id,
              status: latestJob.status,
              provider: latestJob.provider,
              errorMessage: latestJob.errorMessage,
              createdAt: latestJob.createdAt.toISOString(),
              startedAt: latestJob.startedAt?.toISOString() ?? null,
              completedAt: latestJob.completedAt?.toISOString() ?? null
            }
          : null,
        claim: document.claim
          ? {
              id: document.claim.id,
              status: document.claim.status
            }
          : null,
        review: document.review
          ? {
              id: document.review.id,
              status: document.review.status
            }
          : null,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString()
      }
    };
  }

  async applyCorrections(input: {
    documentId: string;
    ownerId: string;
    fields: Array<{ name: FieldName; correctedValue: string | null }>;
  }) {
    if (!input.fields || input.fields.length === 0) {
      throwValidationError([{ path: 'fields', message: 'fields is required' }]);
    }

    const document = await this.prisma.document.findUnique({
      where: { id: input.documentId },
      include: { claim: true }
    });

    if (!document) {
      throwContractHttpError(404, 'NOT_FOUND', 'Not found', []);
    }

    if (document.ownerId !== input.ownerId) {
      throwContractHttpError(403, 'FORBIDDEN', 'Forbidden', []);
    }

    if (document.status === 'submitted' || document.status === 'reviewed' || document.status === 'rejected') {
      throwContractHttpError(409, 'CONFLICT', 'Conflict', []);
    }

    // Upsert corrected fields. If the field does not exist yet, create it with empty `value` and source manual.
    for (const f of input.fields) {
      await this.prisma.documentField.upsert({
        where: { documentId_name: { documentId: document.id, name: f.name } },
        update: {
          correctedValue: f.correctedValue,
          source: 'manual'
        },
        create: {
          documentId: document.id,
          name: f.name,
          value: '',
          correctedValue: f.correctedValue,
          source: 'manual'
        }
      });
    }

    const updated = await this.prisma.document.update({
      where: { id: document.id },
      data: { status: 'corrected' },
      include: { fields: true }
    });

    await this.audit.writeEvent({
      action: 'document.corrected',
      entityType: 'document',
      entityId: updated.id,
      actor: { actorId: input.ownerId, actorRole: 'consumer' },
      message: 'Document corrected',
      metadata: {},
      documentId: updated.id
    });

    return {
      document: {
        id: updated.id,
        status: updated.status,
        fields: updated.fields.map(mapField),
        updatedAt: updated.updatedAt.toISOString()
      }
    };
  }
}
