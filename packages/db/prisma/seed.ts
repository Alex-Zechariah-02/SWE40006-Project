import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const LOCAL_PLACEHOLDER_VALUES = new Set([
  '',
  'replace-this-local-only',
  'change-me',
  'change-me-local-only',
  'change-me-for-local-only',
  'balance',
  'password'
]);

function appEnv(): string {
  return (process.env.APP_ENV || process.env.NODE_ENV || 'local').trim().toLowerCase();
}

function isNonLocal(): boolean {
  const env = appEnv();
  return env === 'staging' || env === 'production';
}

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value.trim();
  if (isNonLocal()) {
    throw new Error(`${name} is required in ${appEnv()}`);
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is required`);
}

function requiredSeedSecret(name: string): string {
  const value = requiredEnv(name, 'replace-this-local-only');
  if (isNonLocal() && LOCAL_PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) {
    throw new Error(`${name} must be a non-placeholder value in ${appEnv()}`);
  }
  return value;
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

  const consumerPassword = requiredSeedSecret('SEED_CONSUMER_PASSWORD');
  const reviewerPassword = requiredSeedSecret('SEED_REVIEWER_PASSWORD');
  const adminPassword = requiredSeedSecret('SEED_ADMIN_PASSWORD');
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
