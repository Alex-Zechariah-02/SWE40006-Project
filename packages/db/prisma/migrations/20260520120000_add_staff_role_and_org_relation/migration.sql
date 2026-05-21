-- AlterEnum: add 'staff' to Role
ALTER TYPE "Role" ADD VALUE 'staff';

-- AlterTable: add organizationId column to User
ALTER TABLE "User" ADD COLUMN "organizationId" UUID;

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE SET NULL ON UPDATE CASCADE;
