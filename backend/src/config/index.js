import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  APP_BASE_URL: z.string().default('http://localhost:5000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173,http://localhost:5174'),
  
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().default('school_db'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.enum(['true', 'false']).default('false'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TTL_MIN: z.coerce.number().default(1440), // 24 hours (1440 minutes) for seamless LMS usage
  REFRESH_IDLE_DAYS: z.coerce.number().default(30),
  REFRESH_ABS_DAYS: z.coerce.number().default(90),

  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  REDIS_CACHE_URL: z.string().default('redis://127.0.0.1:6379/0'),
  REDIS_QUEUE_URL: z.string().default('redis://127.0.0.1:6379/1'),

  SCHOOL_TIMEZONE: z.string().default('Asia/Karachi'),

  // Fee lifecycle: monthly invoice generation + overdue portal restriction
  FEE_SCHEDULER_ENABLED: z.enum(['true', 'false']).default('true'),
  // Official Principal WhatsApp number shown to restricted students (international format, optional)
  PRINCIPAL_WHATSAPP_NUMBER: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .regex(/^\+?\d{8,15}$/, 'PRINCIPAL_WHATSAPP_NUMBER must be digits in international format, e.g. 923001234567')
      .optional()
  ),
  // IP geolocation lookup; {ip} is replaced with the client IP. The JSON response must contain `timezone`.
  GEO_LOOKUP_URL: z.string().default('http://ip-api.com/json/{ip}?fields=status,timezone')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  cookieSecure: parsed.data.COOKIE_SECURE === 'true',
  feeSchedulerEnabled: parsed.data.FEE_SCHEDULER_ENABLED === 'true'
};
