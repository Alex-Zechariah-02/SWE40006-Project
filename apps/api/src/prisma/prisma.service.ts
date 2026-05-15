import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@balance/db';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://balance:balance@postgres:5432/balance?schema=public';

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      // Do not fail the entire API process on startup:
      // - status endpoints must remain available
      // - readiness is handled separately
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
