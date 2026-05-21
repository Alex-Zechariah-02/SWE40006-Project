import { Controller, Get, Inject } from '@nestjs/common';
import { loadAppConfig } from '@balance/config';
import type { ApiStatusPayload, ApiVersionPayload } from '@balance/types';

import { throwContractHttpError } from './common/contract-errors';
import { PrismaService } from './prisma/prisma.service';
import { ExtractionQueueService } from './queue/extraction-queue.service';

@Controller()
export class AppController {
  private readonly config = loadAppConfig();
  private readonly service = 'balance-api' as const;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExtractionQueueService) private readonly extractionQueue: ExtractionQueueService
  ) {}

  @Get('health')
  getHealth(): ApiStatusPayload {
    return {
      status: 'ok',
      service: this.service,
      app: this.config.appName,
      environment: this.config.appEnv,
      version: this.config.appVersion
    };
  }

  @Get('ready')
  async getReady(): Promise<ApiStatusPayload> {
    try {
      await this.prisma.checkReady();
      await this.extractionQueue.checkReady();
    } catch (err) {
      const runtime = (process.env.APP_ENV || process.env.NODE_ENV || 'local').trim().toLowerCase();
      if (runtime !== 'production') {
        // Keep the HTTP response stable while still surfacing the root cause during local dev.
        console.error('[ready] dependency check failed', err);
      }
      throwContractHttpError(503, 'SERVICE_UNAVAILABLE', 'Service unavailable', []);
    }

    return {
      status: 'ready',
      service: this.service,
      app: this.config.appName,
      environment: this.config.appEnv,
      version: this.config.appVersion
    };
  }

  @Get('version')
  getVersion(): ApiVersionPayload {
    return {
      service: this.service,
      app: this.config.appName,
      environment: this.config.appEnv,
      version: this.config.appVersion,
      commit: this.config.gitCommit,
      build: this.config.buildId
    };
  }
}
