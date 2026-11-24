import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  AUTH_SECRET: z.string().min(32).default('development-secret-change-before-production'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/auth/google/callback'),
  EMPTY_ROOM_TTL_HOURS: z.coerce.number().positive().default(24),
  STALE_ROOM_TTL_DAYS: z.coerce.number().positive().default(30),
  ROOM_CLEANUP_INTERVAL_MINUTES: z.coerce.number().positive().default(60),
  // A player who leaves a running online game and stays away this long gives up.
  ABANDON_GRACE_SECONDS: z.coerce.number().positive().default(120),
  // The one account allowed to use /admin. Without it, administration is switched off.
  ADMIN_EMAIL: z.string().email().optional(),
  ROOM_CREATE_LIMIT_PER_10_MIN: z.coerce.number().int().positive().default(30),
  APP_REVISION: z.string().default('unknown'),
});

export const env = envSchema.parse(process.env);
