import 'reflect-metadata';

import { loadAppConfig } from '@balance/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ContractHttpExceptionFilter } from './common/contract-http-exception.filter';

async function bootstrap() {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ContractHttpExceptionFilter());
  await app.listen(config.apiPort, '0.0.0.0');
}

void bootstrap();
