import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Define schema for environment variables
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  
  // Shopify
  SHOPIFY_SHOP: z.string(),
  SHOPIFY_ACCESS_TOKEN: z.string(),
  SHOPIFY_API_VERSION: z.string().default('2023-10'),
  
  // AI Providers
  MISTRAL_API_KEY: z.string(),
  MISTRAL_MODEL: z.string().default('mistral-medium'),
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  
  // Security
  INTERNAL_API_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
});

// Validate environment variables
try {
  envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:', error.errors);
    process.exit(1);
  }
}

// Export validated environment variables
export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL,
  },
  
  // Shopify
  shopify: {
    shop: process.env.SHOPIFY_SHOP!,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
    apiVersion: process.env.SHOPIFY_API_VERSION!,
  },
  
  // AI Providers
  ai: {
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY!,
      model: process.env.MISTRAL_MODEL!,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL!,
    },
  },
  
  // Security
  security: {
    internalApiKey: process.env.INTERNAL_API_KEY!,
    sessionSecret: process.env.SESSION_SECRET!,
  },
  
  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
  },
} as const;

export type Config = typeof config;
