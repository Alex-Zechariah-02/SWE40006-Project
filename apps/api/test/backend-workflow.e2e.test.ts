import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  auth,
  closeTestContext,
  createDocument,
  createTestContext,
  ensureSeedUsers,
  login,
  resetWorkflowData,
  type TestContext
} from './helpers/backend-app';

describe.sequential('Balance API backend workflow', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ensureSeedUsers(ctx.prisma);
  });

  beforeEach(async () => {
    await resetWorkflowData(ctx.prisma);
  });

  afterAll(async () => {
    await closeTestContext(ctx);
  });

  it('proves login, me, missing auth, and role checks', async () => {
    await request(ctx.app.getHttpServer())
      .get('/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ready');
      });

    const consumer = await login(ctx.app, 'consumer');
    expect(consumer.response.status).toBe(200);
    expect(consumer.response.body.user.role).toBe('consumer');
    expect(consumer.token).toEqual(expect.any(String));

    await request(ctx.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', auth(consumer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.user.email).toBe('consumer@balance.local');
      });

    await request(ctx.app.getHttpServer()).get('/auth/me').expect(401);

    await request(ctx.app.getHttpServer())
      .get('/reviews/queue')
      .set('Authorization', auth(consumer.token))
      .expect(403);

    const reviewer = await login(ctx.app, 'reviewer');
    await request(ctx.app.getHttpServer())
      .post('/documents')
      .set('Authorization', auth(reviewer.token))
      .expect(403);

    const otherDocument = await createDocument(ctx.prisma, {
      ownerId: reviewer.user.id,
      status: 'extracted'
    });

    await request(ctx.app.getHttpServer())
      .get(`/documents/${otherDocument.id}`)
      .set('Authorization', auth(consumer.token))
      .expect(404);
  });

  it('proves document upload, metadata, list, detail, queue job, and correction state rules', async () => {
    const consumer = await login(ctx.app, 'consumer');

    const upload = await request(ctx.app.getHttpServer())
      .post('/documents')
      .set('Authorization', auth(consumer.token))
      .field('label', 'Travel receipt')
      .field('notes', 'Taxi from airport')
      .attach('file', Buffer.from('%PDF-1.4\n% Balance test file\n'), {
        filename: 'receipt.pdf',
        contentType: 'application/pdf'
      })
      .expect(201);

    expect(upload.body.document).toMatchObject({
      ownerId: consumer.user.id,
      originalFilename: 'receipt.pdf',
      contentType: 'application/pdf',
      status: 'queued',
      label: 'Travel receipt',
      notes: 'Taxi from airport'
    });
    expect(upload.body.extractionJob).toMatchObject({
      documentId: upload.body.document.id,
      status: 'queued',
      provider: 'tesseract'
    });

    const queuedJob = await ctx.prisma.extractionJob.findFirst({
      where: { documentId: upload.body.document.id }
    });
    expect(queuedJob?.status).toBe('queued');

    await request(ctx.app.getHttpServer())
      .get('/documents')
      .set('Authorization', auth(consumer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.documents[0]).toMatchObject({
          id: upload.body.document.id,
          label: 'Travel receipt',
          notes: 'Taxi from airport'
        });
      });

    await request(ctx.app.getHttpServer())
      .get(`/documents/${upload.body.document.id}`)
      .set('Authorization', auth(consumer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.document).toMatchObject({
          id: upload.body.document.id,
          label: 'Travel receipt',
          notes: 'Taxi from airport'
        });
      });

    for (const status of ['extracted', 'correction_required'] as const) {
      const document = await createDocument(ctx.prisma, {
        ownerId: consumer.user.id,
        status
      });

      await request(ctx.app.getHttpServer())
        .patch(`/documents/${document.id}/corrections`)
        .set('Authorization', auth(consumer.token))
        .send({
          fields: [{ name: 'merchantName', correctedValue: 'Corrected Merchant' }]
        })
        .expect(200)
        .expect((response) => {
          expect(response.body.document.status).toBe('corrected');
        });
    }

    for (const status of ['uploaded', 'queued', 'processing', 'submitted', 'reviewed', 'rejected', 'failed'] as const) {
      const document = await createDocument(ctx.prisma, {
        ownerId: consumer.user.id,
        status
      });

      await request(ctx.app.getHttpServer())
        .patch(`/documents/${document.id}/corrections`)
        .set('Authorization', auth(consumer.token))
        .send({
          fields: [{ name: 'merchantName', correctedValue: 'Blocked Merchant' }]
        })
        .expect(409);
    }
  });

  it('proves claim, review, explicit claim transition, decision, and audit behavior', async () => {
    const consumer = await login(ctx.app, 'consumer');
    const reviewer = await login(ctx.app, 'reviewer');
    const reviewer2 = await login(ctx.app, 'reviewer2');
    const admin = await login(ctx.app, 'admin');

    const document = await createDocument(ctx.prisma, {
      ownerId: consumer.user.id,
      status: 'extracted'
    });

    const claimResponse = await request(ctx.app.getHttpServer())
      .post('/claims')
      .set('Authorization', auth(consumer.token))
      .send({
        documentId: document.id,
        purpose: 'Reimbursement',
        note: 'Please review'
      })
      .expect(201);

    const claimId = claimResponse.body.claim.id as string;
    const reviewId = claimResponse.body.review.id as string;
    expect(claimResponse.body.claim.status).toBe('submitted');
    expect(claimResponse.body.review.status).toBe('pending');

    await request(ctx.app.getHttpServer())
      .get('/claims')
      .set('Authorization', auth(consumer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.claims.some((claim: { id: string }) => claim.id === claimId)).toBe(true);
      });

    await request(ctx.app.getHttpServer())
      .get(`/claims/${claimId}`)
      .set('Authorization', auth(consumer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.claim.review.id).toBe(reviewId);
      });

    await request(ctx.app.getHttpServer())
      .get('/reviews/queue')
      .set('Authorization', auth(reviewer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.reviews.some((review: { id: string }) => review.id === reviewId)).toBe(true);
      });

    await request(ctx.app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set('Authorization', auth(reviewer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.review.status).toBe('pending');
      });

    const afterRead = await ctx.prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: { claim: true }
    });
    expect(afterRead.status).toBe('pending');
    expect(afterRead.claim.status).toBe('submitted');

    await request(ctx.app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set('Authorization', auth(reviewer2.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.review.status).toBe('pending');
      });

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/approve`)
      .set('Authorization', auth(reviewer.token))
      .send({ note: 'Skipping claim should fail' })
      .expect(409);

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/reject`)
      .set('Authorization', auth(reviewer.token))
      .send({ note: 'Skipping claim should fail' })
      .expect(409);

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/claim`)
      .set('Authorization', auth(reviewer.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.review.status).toBe('in_review');
        expect(response.body.review.reviewerId).toBe(reviewer.user.id);
        expect(response.body.claim.status).toBe('under_review');
      });

    const startedAudit = await ctx.prisma.auditEvent.findFirst({
      where: { action: 'review.started', reviewId }
    });
    expect(startedAudit?.actorId).toBe(reviewer.user.id);
    expect(startedAudit?.actorRole).toBe('reviewer');

    await request(ctx.app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set('Authorization', auth(reviewer2.token))
      .expect(403);

    await request(ctx.app.getHttpServer())
      .get(`/documents/${document.id}`)
      .set('Authorization', auth(reviewer2.token))
      .expect(403);

    await request(ctx.app.getHttpServer())
      .get(`/claims/${claimId}`)
      .set('Authorization', auth(reviewer2.token))
      .expect(403);

    await request(ctx.app.getHttpServer())
      .get(`/audit?reviewId=${reviewId}`)
      .set('Authorization', auth(reviewer2.token))
      .expect(403);

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/approve`)
      .set('Authorization', auth(reviewer2.token))
      .send({ note: 'Wrong reviewer should fail' })
      .expect(403);

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/approve`)
      .set('Authorization', auth(reviewer.token))
      .send({ note: 'Looks correct' })
      .expect(200)
      .expect((response) => {
        expect(response.body.review.status).toBe('approved');
        expect(response.body.claim.status).toBe('approved');
        expect(response.body.document.status).toBe('reviewed');
      });

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${reviewId}/claim`)
      .set('Authorization', auth(reviewer.token))
      .expect(409);

    const rejectDocument = await createDocument(ctx.prisma, {
      ownerId: consumer.user.id,
      status: 'extracted'
    });

    const rejectClaim = await request(ctx.app.getHttpServer())
      .post('/claims')
      .set('Authorization', auth(consumer.token))
      .send({ documentId: rejectDocument.id, purpose: 'Warranty' })
      .expect(201);

    const rejectReviewId = rejectClaim.body.review.id as string;
    await request(ctx.app.getHttpServer())
      .post(`/reviews/${rejectReviewId}/claim`)
      .set('Authorization', auth(reviewer.token))
      .expect(200);

    await request(ctx.app.getHttpServer())
      .get(`/reviews/${rejectReviewId}`)
      .set('Authorization', auth(admin.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.review.reviewerId).toBe(reviewer.user.id);
      });

    await request(ctx.app.getHttpServer())
      .post(`/reviews/${rejectReviewId}/reject`)
      .set('Authorization', auth(admin.token))
      .send({ note: 'Missing merchant details' })
      .expect(200)
      .expect((response) => {
        expect(response.body.review.status).toBe('rejected');
        expect(response.body.review.reviewerId).toBe(reviewer.user.id);
        expect(response.body.claim.status).toBe('rejected');
        expect(response.body.document.status).toBe('rejected');
      });

    await request(ctx.app.getHttpServer())
      .get('/audit')
      .set('Authorization', auth(admin.token))
      .expect(200)
      .expect((response) => {
        expect(response.body.auditEvents.length).toBeGreaterThan(0);
      });

    await request(ctx.app.getHttpServer())
      .get('/audit')
      .set('Authorization', auth(consumer.token))
      .expect(422);
  });
});
