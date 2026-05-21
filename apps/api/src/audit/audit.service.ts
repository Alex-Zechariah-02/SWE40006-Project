import { Inject, Injectable } from '@nestjs/common';
import type { EntityType, Prisma } from '@balance/db';

import { PrismaService } from '../prisma/prisma.service';

export type AuditActor = {
  actorId: string | null;
  actorRole: string;
};

export type AuditCreateInput = {
  action: string;
  entityType: EntityType;
  entityId: string;
  actor: AuditActor;
  message: string;
  metadata?: Prisma.InputJsonValue;

  documentId?: string | null;
  extractionJobId?: string | null;
  claimId?: string | null;
  reviewId?: string | null;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async writeEvent(input: AuditCreateInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actor.actorId,
        actorRole: input.actor.actorRole,
        message: input.message,
        metadata: input.metadata ?? {},
        documentId: input.documentId ?? null,
        extractionJobId: input.extractionJobId ?? null,
        claimId: input.claimId ?? null,
        reviewId: input.reviewId ?? null
      }
    });
  }
}
