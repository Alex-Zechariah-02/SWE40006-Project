import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

function requiredEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for seed');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const consumerEmail = 'consumer@balance.local';
  const reviewerEmail = 'reviewer@balance.local';
  const adminEmail = 'admin@balance.local';

  const consumerPassword = requiredEnv('SEED_CONSUMER_PASSWORD', 'replace-this-local-only');
  const reviewerPassword = requiredEnv('SEED_REVIEWER_PASSWORD', 'replace-this-local-only');
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD', 'replace-this-local-only');
  const pepper = requiredEnv('PASSWORD_PEPPER', '').trim();

  const saltRounds = 10;

  const organization = await prisma.organization.upsert({
    where: { name: 'Demo Organization' },
    update: {},
    create: { name: 'Demo Organization' }
  });

  const consumerHash = await bcrypt.hash(`${consumerPassword}${pepper}`, saltRounds);
  const reviewerHash = await bcrypt.hash(`${reviewerPassword}${pepper}`, saltRounds);
  const adminHash = await bcrypt.hash(`${adminPassword}${pepper}`, saltRounds);

  const consumer = await prisma.user.upsert({
    where: { email: consumerEmail },
    update: {
      displayName: 'Demo Consumer',
      role: Role.consumer,
      passwordHash: consumerHash
    },
    create: {
      email: consumerEmail,
      displayName: 'Demo Consumer',
      role: Role.consumer,
      passwordHash: consumerHash
    }
  });

  await prisma.user.upsert({
    where: { email: reviewerEmail },
    update: {
      displayName: 'Demo Reviewer',
      role: Role.reviewer,
      passwordHash: reviewerHash
    },
    create: {
      email: reviewerEmail,
      displayName: 'Demo Reviewer',
      role: Role.reviewer,
      passwordHash: reviewerHash
    }
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: 'Demo Admin',
      role: Role.admin,
      passwordHash: adminHash
    },
    create: {
      email: adminEmail,
      displayName: 'Demo Admin',
      role: Role.admin,
      passwordHash: adminHash
    }
  });

  // Keep seed minimal and deterministic: do not create demo documents by default.
  // Organization exists so reviewer-side flows can reference an org if required later.
  void organization;
  void consumer;

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
