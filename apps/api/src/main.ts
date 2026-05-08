import 'reflect-metadata';

import { loadAppConfig } from '@balance/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(config.apiPort, '0.0.0.0');
}

void bootstrap();
