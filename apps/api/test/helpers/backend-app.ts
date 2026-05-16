import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role, type DocumentStatus } from '@balance/db';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { ContractHttpExceptionFilter } from '../../src/common/contract-http-exception.filter';

export const seedUsers = {
  consumer: {
    email: 'consumer@balance.local',
    password: process.env.SEED_CONSUMER_PASSWORD || 'ci-consumer-password',
    displayName: 'Demo Consumer',
    role: Role.consumer
  },
  reviewer: {
    email: 'reviewer@balance.local',
    password: process.env.SEED_REVIEWER_PASSWORD || 'ci-reviewer-password',
    displayName: 'Demo Reviewer',
    role: Role.reviewer
  },
  reviewer2: {
    email: 'reviewer2@balance.local',
    password: process.env.SEED_REVIEWER_PASSWORD || 'ci-reviewer-password',
    displayName: 'Demo Reviewer 2',
    role: Role.reviewer
  },
  admin: {
    email: 'admin@balance.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'ci-admin-password',
    displayName: 'Demo Admin',
    role: Role.admin
  }
} as const;

export type TestContext = {
  app: INestApplication;
  prisma: PrismaClient;
};

function ensureTestEnv() {
  process.env.APP_ENV ??= 'local';
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://ci:ci@127.0.0.1:5432/ci?schema=public';
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
  process.env.JWT_SECRET ??= 'ci-placeholder-only';
  process.env.JWT_EXPIRES_IN ??= '1h';
  process.env.PASSWORD_PEPPER ??= 'ci-placeholder-only';
  process.env.STORAGE_DRIVER ??= 'filesystem';
  process.env.STORAGE_FILESYSTEM_ROOT ??= '/tmp/balance-api-test-storage';
  process.env.QUEUE_PROOF_NAME ??= 'queue_proof';
  process.env.EXTRACTION_QUEUE_NAME ??= 'document_extract';
  process.env.OCR_PROVIDER ??= 'tesseract';
  process.env.TESSERACT_LANG ??= 'eng';
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

function peppered(password: string): string {
  return `${password}${process.env.PASSWORD_PEPPER || ''}`;
}

export async function createTestContext(): Promise<TestContext> {
  ensureTestEnv();

  const prisma = createPrismaClient();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new ContractHttpExceptionFilter());
  await app.init();

  return { app, prisma };
}

export async function closeTestContext(ctx: TestContext) {
  await ctx.app.close();
  await ctx.prisma.$disconnect();
}

export async function ensureSeedUsers(prisma: PrismaClient) {
  await prisma.organization.upsert({
    where: { name: 'Demo Organization' },
    update: {},
    create: { name: 'Demo Organization' }
  });

  for (const user of Object.values(seedUsers)) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        displayName: user.displayName,
        role: user.role,
        passwordHash: await bcrypt.hash(peppered(user.password), 10)
      },
      create: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash: await bcrypt.hash(peppered(user.password), 10)
      }
    });
  }
}

export async function resetWorkflowData(prisma: PrismaClient) {
  await prisma.auditEvent.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.extractionJob.deleteMany({});
  await prisma.documentField.deleteMany({});
  await prisma.document.deleteMany({});
}

export async function login(app: INestApplication, key: keyof typeof seedUsers) {
  const user = seedUsers[key];
  const response = await request(app.getHttpServer()).post('/auth/login').send({
    email: user.email,
    password: user.password
  });

  return {
    response,
    token: response.body.accessToken as string,
    user: response.body.user as { id: string; email: string; role: string; displayName: string }
  };
}

export function auth(token: string) {
  return `Bearer ${token}`;
}

export async function createDocument(
  prisma: PrismaClient,
  input: {
    ownerId: string;
    status: DocumentStatus;
    label?: string | null;
    notes?: string | null;
  }
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return prisma.document.create({
    data: {
      ownerId: input.ownerId,
      originalFilename: `receipt-${suffix}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: 12,
      storageKey: `documents/test-${suffix}/original.pdf`,
      status: input.status,
      label: input.label ?? null,
      notes: input.notes ?? null,
      merchantName: 'Demo Merchant',
      documentDate: '2026-05-16',
      amountMinor: 1299,
      currency: 'AUD'
    }
  });
}
