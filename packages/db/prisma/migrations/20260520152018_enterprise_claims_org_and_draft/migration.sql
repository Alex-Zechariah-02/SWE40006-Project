-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'draft';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "organizationId" UUID,
ALTER COLUMN "submittedAt" DROP NOT NULL;

-- Backfill Claim.organizationId from the associated Document (enterprise claims).
UPDATE "Claim"
SET "organizationId" = "Document"."organizationId"
FROM "Document"
WHERE "Claim"."documentId" = "Document"."id"
  AND "Claim"."organizationId" IS NULL;

-- CreateIndex
CREATE INDEX "Claim_organizationId_idx" ON "Claim"("organizationId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
