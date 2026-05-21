-- Extend Balance from a document archive into a receipt/invoice intelligence workspace.

ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'merchantLegalName';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'merchantUrl';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'receiptId';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'invoiceId';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'orderId';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'customerName';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'customerAddress';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'customerEmail';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'customerPhone';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'customerTaxId';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'invoiceDate';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'deliveryDate';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'transactionTime';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'total';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'taxRate';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'taxableAmount';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'amountPaid';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'voucher';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'roundingAdjustment';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'paymentCardLast4';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'paymentReference';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'cashierName';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'serverName';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'tableNumber';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'coverCount';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierName';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierEmail';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierPhone';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierWebsite';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierTaxId';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'supplierRegistration';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'remittanceAddress';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'bankAccount';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'lineItemUnit';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'lineItemTaxRate';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'lineItemDiscount';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'lineItemCategory';
ALTER TYPE "FieldName" ADD VALUE IF NOT EXISTS 'lineItemTransactionDate';

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "documentType" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "claimIntent" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "qualityScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "qualityWarnings" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "duplicateFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "duplicateOfId" UUID,
  ADD COLUMN IF NOT EXISTS "transactionDate" TEXT,
  ADD COLUMN IF NOT EXISTS "transactionTime" TEXT,
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "previewAvailable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "extractionSummary" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "DocumentField"
  ADD COLUMN IF NOT EXISTS "rawType" TEXT,
  ADD COLUMN IF NOT EXISTS "rawLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "normalizedValue" TEXT,
  ADD COLUMN IF NOT EXISTS "valueType" TEXT,
  ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "geometry" JSONB,
  ADD COLUMN IF NOT EXISTS "validationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewState" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "ExtractionArtifact" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "extractionJobId" UUID NOT NULL,
  "provider" "ExtractionProvider" NOT NULL,
  "rawResponse" JSONB NOT NULL DEFAULT '{}',
  "normalized" JSONB NOT NULL DEFAULT '{}',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtractionArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExtractionArtifact_extractionJobId_key" ON "ExtractionArtifact"("extractionJobId");
CREATE INDEX IF NOT EXISTS "Document_category_idx" ON "Document"("category");
CREATE INDEX IF NOT EXISTS "Document_claimIntent_idx" ON "Document"("claimIntent");
CREATE INDEX IF NOT EXISTS "Document_documentType_idx" ON "Document"("documentType");
CREATE INDEX IF NOT EXISTS "Document_duplicateFingerprint_idx" ON "Document"("duplicateFingerprint");
CREATE INDEX IF NOT EXISTS "Document_duplicateOfId_idx" ON "Document"("duplicateOfId");
CREATE INDEX IF NOT EXISTS "Document_transactionDate_idx" ON "Document"("transactionDate");
CREATE INDEX IF NOT EXISTS "DocumentField_name_idx" ON "DocumentField"("name");
CREATE INDEX IF NOT EXISTS "DocumentField_validationStatus_idx" ON "DocumentField"("validationStatus");
CREATE INDEX IF NOT EXISTS "DocumentField_reviewState_idx" ON "DocumentField"("reviewState");

ALTER TABLE "ExtractionArtifact"
  DROP CONSTRAINT IF EXISTS "ExtractionArtifact_extractionJobId_fkey",
  ADD CONSTRAINT "ExtractionArtifact_extractionJobId_fkey"
  FOREIGN KEY ("extractionJobId") REFERENCES "ExtractionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_documentId_fkey";
ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_extractionJobId_fkey";
ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_claimId_fkey";
ALTER TABLE "AuditEvent" DROP CONSTRAINT IF EXISTS "AuditEvent_reviewId_fkey";

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_extractionJobId_fkey"
  FOREIGN KEY ("extractionJobId") REFERENCES "ExtractionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
