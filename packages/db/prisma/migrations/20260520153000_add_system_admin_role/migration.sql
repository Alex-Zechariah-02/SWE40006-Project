-- AlterEnum: add 'system_admin' to Role for global Balance operators.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'system_admin';

-- Existing admin users without an organization were historical platform admins.
UPDATE "User"
SET role = 'system_admin'
WHERE role = 'admin' AND "organizationId" IS NULL;
