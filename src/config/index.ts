interface RedisConfig {
  url?: string;
  enabled: boolean;
  host?: string;
  port?: number;
  password?: string;
}

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    enabled: !!env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT ? parseInt(env.REDIS_PORT, 10) : 6379,
    password: env.REDIS_PASSWORD,
  },
  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};