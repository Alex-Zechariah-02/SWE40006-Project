-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('filesystem', 's3');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "storageDriver" "StorageDriver" NOT NULL DEFAULT 'filesystem';

