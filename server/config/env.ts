import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().trim().optional().default(''),
  MONGODB_DB_NAME: z.string().trim().min(1).default('jointogether'),
  JWT_ACCESS_SECRET: z.string().trim().optional().default(''),
  JWT_REFRESH_SECRET: z.string().trim().optional().default(''),
  CLIENT_URL: z.string().trim().optional().default(''),
  APP_URL: z.string().trim().optional().default(''),
  ADMIN_BOOTSTRAP_PASSCODE: z.string().trim().optional().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed');
}

const initialEnv = parsed.data;

// Ephemeral in-memory secrets used only when env overrides are not supplied.
const runtimeAccessSecret = crypto.randomBytes(32).toString('hex');
const runtimeRefreshSecret = crypto.randomBytes(32).toString('hex');

export function getEnv() {
  return {
    nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || initialEnv.NODE_ENV,
    port: Number(process.env.PORT || initialEnv.PORT || 3000),
    mongodbUri: (process.env.MONGODB_URI ?? initialEnv.MONGODB_URI).trim(),
    mongodbDbName: (process.env.MONGODB_DB_NAME ?? initialEnv.MONGODB_DB_NAME).trim(),
    jwtAccessSecret: (process.env.JWT_ACCESS_SECRET || initialEnv.JWT_ACCESS_SECRET || runtimeAccessSecret).trim(),
    jwtRefreshSecret: (process.env.JWT_REFRESH_SECRET || initialEnv.JWT_REFRESH_SECRET || runtimeRefreshSecret).trim(),
    clientUrl: (process.env.CLIENT_URL ?? initialEnv.CLIENT_URL).trim(),
    appUrl: (process.env.APP_URL ?? initialEnv.APP_URL).trim(),
    adminBootstrapPasscode: (process.env.ADMIN_BOOTSTRAP_PASSCODE ?? initialEnv.ADMIN_BOOTSTRAP_PASSCODE).trim(),
  };
}

export function getAllowedOrigins(): string[] {
  const { clientUrl, appUrl } = getEnv();
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  for (const raw of [clientUrl, appUrl]) {
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const cleaned = part.trim().replace(/\/+$/, '');
      if (cleaned && cleaned !== 'MY_APP_URL') {
        origins.add(cleaned);
      }
    }
  }
  return Array.from(origins);
}
