import { Controller, Get } from '@nestjs/common';
import { loadAppConfig } from '@balance/config';
import type { ApiStatusPayload, ApiVersionPayload } from '@balance/types';

@Controller()
export class AppController {
  private readonly config = loadAppConfig();
  private readonly service = 'balance-api' as const;

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
  getReady(): ApiStatusPayload {
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
