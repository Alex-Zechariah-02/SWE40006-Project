-- AlterEnum
ALTER TYPE "FieldName" ADD VALUE 'vendorAddress';
ALTER TYPE "FieldName" ADD VALUE 'vendorPhone';
ALTER TYPE "FieldName" ADD VALUE 'vendorTaxId';
ALTER TYPE "FieldName" ADD VALUE 'invoiceReceiptId';
ALTER TYPE "FieldName" ADD VALUE 'receiverName';
ALTER TYPE "FieldName" ADD VALUE 'receiverAddress';
ALTER TYPE "FieldName" ADD VALUE 'dueDate';
ALTER TYPE "FieldName" ADD VALUE 'orderDate';
ALTER TYPE "FieldName" ADD VALUE 'subtotal';
ALTER TYPE "FieldName" ADD VALUE 'tax';
ALTER TYPE "FieldName" ADD VALUE 'amountDue';
ALTER TYPE "FieldName" ADD VALUE 'discount';
ALTER TYPE "FieldName" ADD VALUE 'shippingCharge';
ALTER TYPE "FieldName" ADD VALUE 'serviceCharge';
ALTER TYPE "FieldName" ADD VALUE 'gratuity';
ALTER TYPE "FieldName" ADD VALUE 'paymentType';
ALTER TYPE "FieldName" ADD VALUE 'paymentTerms';
ALTER TYPE "FieldName" ADD VALUE 'poNumber';
ALTER TYPE "FieldName" ADD VALUE 'vendorStreet';
ALTER TYPE "FieldName" ADD VALUE 'vendorCity';
ALTER TYPE "FieldName" ADD VALUE 'vendorState';
ALTER TYPE "FieldName" ADD VALUE 'vendorCountry';
ALTER TYPE "FieldName" ADD VALUE 'vendorPostalCode';
ALTER TYPE "FieldName" ADD VALUE 'receiverStreet';
ALTER TYPE "FieldName" ADD VALUE 'receiverCity';
ALTER TYPE "FieldName" ADD VALUE 'receiverState';
ALTER TYPE "FieldName" ADD VALUE 'receiverCountry';
ALTER TYPE "FieldName" ADD VALUE 'receiverPostalCode';
ALTER TYPE "FieldName" ADD VALUE 'lineItemDescription';
ALTER TYPE "FieldName" ADD VALUE 'lineItemQuantity';
ALTER TYPE "FieldName" ADD VALUE 'lineItemUnitPrice';
ALTER TYPE "FieldName" ADD VALUE 'lineItemTotalPrice';
ALTER TYPE "FieldName" ADD VALUE 'lineItemProductCode';
ALTER TYPE "FieldName" ADD VALUE 'lineItemTax';

-- AlterTable
ALTER TABLE "DocumentField" ADD COLUMN "groupKey" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "DocumentField_documentId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "DocumentField_documentId_name_groupKey_key" ON "DocumentField"("documentId", "name", "groupKey");
