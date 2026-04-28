import { z } from 'zod';

// Environment variable validation schema
const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  
  // Database Configuration
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  
  // Redis Configuration
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // Shopify Configuration
  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY is required'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET is required'),
  SHOPIFY_API_VERSION: z.string().default('2023-10'),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).pipe(z.number().min(1)).default('2000'),
  
  // Mistral AI Configuration (Alternative AI Provider)
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_MODEL: z.string().default('mistral-medium'),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // CORS Configuration
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().min(1000)).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().min(1)).default('100'),
  
  // File Upload Configuration
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().min(1)).default('10485760'), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Email Configuration (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Monitoring Configuration
  SENTRY_DSN: z.string().url().optional(),
  ENABLE_METRICS: z.string().transform(Boolean).default('false'),
  
  // Cache Configuration
  CACHE_TTL: z.string().transform(Number).pipe(z.number().min(60)).default('3600'), // 1 hour
  
  // Webhook Configuration
  WEBHOOK_TIMEOUT: z.string().transform(Number).pipe(z.number().min(1000)).default('10000'), // 10 seconds
  
  // Feature Flags
  ENABLE_AI_FEATURES: z.string().transform(Boolean).default('true'),
  ENABLE_WEBHOOKS: z.string().transform(Boolean).default('true'),
  ENABLE_ANALYTICS: z.string().transform(Boolean).default('false'),
});

// Validate and export environment variables
export const validateEnv = () => {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err: any) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

// Export validated environment variables
export const env = validateEnv();

// Export types for TypeScript
export type Env = z.infer<typeof envSchema>;
