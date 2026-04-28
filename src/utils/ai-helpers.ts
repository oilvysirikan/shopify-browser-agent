import { logger } from './logger.js';
import { config } from '../config/index.js';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// In-memory rate limiter store for when Redis is not available
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const localRateLimitStore: RateLimitStore = {};

// Cache interface
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Simple in-memory cache for when Redis is not available
const memoryCache = new Map<string, CacheEntry<any>>();

// Generate a cache key from request parameters
function generateCacheKey(provider: string, params: any): string {
  const str = JSON.stringify({ provider, ...params });
  return `ai:${crypto.createHash('md5').update(str).digest('hex')}`;
}

// Retry with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: string = 'AI Service'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[${context}] All ${maxRetries} attempts failed`, { error: errorMessage, attempt });
        throw new Error(`${context} failed after ${maxRetries} attempts: ${errorMessage}`);
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`[${context}] Attempt ${attempt} failed, retrying in ${delay}ms`, { error });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Unknown error in withRetry');
}

// Rate limiting middleware
export function createRateLimiter(redisClient?: Redis) {
  return async function rateLimit(
    key: string,
    maxRequests: number = 100,
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const resetTime = now - (now % windowMs) + windowMs;
    const requestId = uuidv4();
    
    try {
      if (redisClient) {
        // Use Redis for distributed rate limiting
        const pipeline = redisClient.pipeline();
        const redisKey = `rate_limit:${key}`;
        
        pipeline.zadd(redisKey, now, `${now}-${requestId}`);
        pipeline.zremrangebyscore(redisKey, 0, now - windowMs);
        pipeline.zcard(redisKey);
        pipeline.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
        
        const results = await pipeline.exec();
        const count = results?.[2]?.[1] as number || 0;
        
        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
          resetTime
        };
      } else {
        // Fallback to in-memory rate limiting
        if (!localRateLimitStore[key] || localRateLimitStore[key].resetTime < now) {
          localRateLimitStore[key] = { count: 0, resetTime };
        }
        
        localRateLimitStore[key].count++;
        const count = localRateLimitStore[key].count;
        
        return {
          allowed: count <= maxRequests,
          remaining: Math.max(0, maxRequests - count),
          resetTime
        };
      }
    } catch (error) {
      logger.error('Rate limiting error', { error });
      // Fail open in case of errors
      return { allowed: true, remaining: maxRequests, resetTime };
    }
  };
}

// Cache middleware
export function createCache(redisClient?: Redis) {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        if (redisClient) {
          const cached = await redisClient.get(key);
          if (cached) {
            const entry: CacheEntry<T> = JSON.parse(cached);
            if (entry.expiresAt > Date.now()) {
              return entry.data;
            }
            // Clean up expired entry
            await redisClient.del(key);
          }
        } else {
          const entry = memoryCache.get(key);
          if (entry && entry.expiresAt > Date.now()) {
            return entry.data;
          }
          memoryCache.delete(key);
        }
        return null;
      } catch (error) {
        logger.error('Cache get error', { error });
        return null;
      }
    },
    
    async set<T>(key: string, data: T, ttlMs: number = config.ai.cacheTtlMs): Promise<void> {
      try {
        const entry: CacheEntry<T> = {
          data,
          expiresAt: Date.now() + ttlMs
        };
        
        if (redisClient) {
          await redisClient.setex(
            key,
            Math.ceil(ttlMs / 1000),
            JSON.stringify(entry)
          );
        } else {
          memoryCache.set(key, entry);
          // Clean up expired entries periodically
          if (memoryCache.size > 1000) {
            for (const [k, v] of memoryCache.entries()) {
              if (v.expiresAt <= Date.now()) {
                memoryCache.delete(k);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Cache set error', { error });
      }
    }
  };
}

// Input validation
export function validateAIParams(params: any): { valid: boolean; error?: string } {
  if (!params || typeof params !== 'object') {
    return { valid: false, error: 'Invalid parameters: must be an object' };
  }
  
  const { prompt, maxTokens, temperature, stopSequences } = params;
  
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt must be a non-empty string' };
  }
  
  if (maxTokens !== undefined && (typeof maxTokens !== 'number' || maxTokens <= 0 || maxTokens > 4000)) {
    return { valid: false, error: 'maxTokens must be a positive number up to 4000' };
  }
  
  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return { valid: false, error: 'temperature must be between 0 and 2' };
  }
  
  if (stopSequences !== undefined) {
    if (!Array.isArray(stopSequences) || !stopSequences.every(s => typeof s === 'string')) {
      return { valid: false, error: 'stopSequences must be an array of strings' };
    }
  }
  
  return { valid: true };
}

// Logging helper for AI service
export function logAICall(
  provider: string,
  model: string,
  params: any,
  response: any,
  error?: Error
) {
  const logData = {
    provider,
    model,
    params: {
      ...params,
      prompt: params.prompt ? `${params.prompt.substring(0, 100)}...` : undefined,
    },
    response: response ? {
      ...response,
      text: response.text ? `${response.text.substring(0, 100)}...` : undefined,
    } : undefined,
    error: error ? {
      message: error.message,
      stack: error.stack,
    } : undefined,
    timestamp: new Date().toISOString(),
  };
  
  if (error) {
    logger.error('AI Service Error', logData);
  } else {
    logger.info('AI Service Call', logData);
  }
}
