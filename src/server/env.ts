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
});

export const env = envSchema.parse(process.env);
