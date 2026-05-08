import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

describe('Balance API status endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('serves /health', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'balance-api',
      app: 'Balance',
      environment: 'local',
      version: '0.1.0'
    });
  });

  it('serves /ready', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      service: 'balance-api',
      app: 'Balance',
      environment: 'local',
      version: '0.1.0'
    });
  });

  it('serves /version', async () => {
    const response = await request(app.getHttpServer()).get('/version').expect(200);

    expect(response.body).toMatchObject({
      service: 'balance-api',
      app: 'Balance',
      environment: 'local',
      version: '0.1.0',
      commit: 'local',
      build: 'local-build'
    });
  });
});
