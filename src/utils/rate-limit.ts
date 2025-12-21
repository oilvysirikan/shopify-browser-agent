import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';
import { config } from '../config';
import { logger } from './logger';

// In-memory store for rate limiting (fallback)
const memoryRateLimiter = new RateLimiterMemory({
  points: config.rateLimit.max, // Number of points
  duration: config.rateLimit.windowMs / 1000, // Per second
});

// Redis client for distributed rate limiting
let redisRateLimiter: RateLimiterRedis | null = null;

// Initialize Redis rate limiter if Redis is configured
if (config.redis.enabled) {
  const redisClient = createClient({
    url: `redis://${config.redis.host}:${config.redis.port}`,
    ...(config.redis.password && { password: config.redis.password }),
  });

  redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  redisRateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rate_limit',
    points: config.rateLimit.max,
    duration: config.rateLimit.windowMs / 1000,
    inmemoryBlockOnConsumed: config.rateLimit.max + 1,
    inmemoryBlockDuration: 60, // Block for 60 seconds if Redis is down
    insuranceLimiter: memoryRateLimiter, // Fallback to in-memory
  });
}

/**
 * Rate limiter middleware
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use client IP as the rate limit key
    const key = req.ip || 'unknown';
    const limiter = redisRateLimiter || memoryRateLimiter;

    await limiter.consume(key);
    
    // Add rate limit headers to the response
    const rateLimit = await limiter.get(key);
    if (rateLimit) {
      res.set({
        'X-RateLimit-Limit': config.rateLimit.max.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.rateLimit.max - rateLimit.consumedPoints).toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimit.msBeforeNext / 1000).toString(),
      });
    }

    next();
  } catch (error: any) {
    // Rate limit exceeded
    const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 1;
    
    res.set({
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': config.rateLimit.max.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': retryAfter.toString(),
    });

    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      retryAfter,
    });
  }
};

/**
 * Rate limiter for specific routes with custom limits
 * @param options Rate limit options
 * @returns Rate limiter middleware
 */
export const createRateLimiter = (options: {
  keyGenerator?: (req: Request) => string;
  points?: number;
  duration?: number;
  message?: string;
}) => {
  const {
    keyGenerator = (req) => req.ip || 'unknown',
    points = config.rateLimit.max,
    duration = config.rateLimit.windowMs / 1000,
    message = 'Too many requests, please try again later',
  } = options;

  const limiter = new RateLimiterMemory({
    points,
    duration,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      await limiter.consume(key);
      
      const rateLimit = await limiter.get(key);
      if (rateLimit) {
        res.set({
          'X-RateLimit-Limit': points.toString(),
          'X-RateLimit-Remaining': Math.max(0, points - rateLimit.consumedPoints).toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimit.msBeforeNext / 1000).toString(),
        });
      }

      next();
    } catch (error: any) {
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 1;
      
      res.set({
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': points.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': retryAfter.toString(),
      });

      return res.status(429).json({
        success: false,
        message,
        retryAfter,
      });
    }
  };
};

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter({
  points: 5, // 5 login attempts
  duration: 15 * 60, // Per 15 minutes
  message: 'Too many login attempts, please try again later',
});

/**
 * Rate limiter for API endpoints
 */
export const apiRateLimiter = createRateLimiter({
  points: 100, // 100 requests
  duration: 60, // Per minute
  message: 'Too many API requests, please try again later',
});

/**
 * Rate limiter for public endpoints
 */
export const publicRateLimiter = createRateLimiter({
  points: 20, // 20 requests
  duration: 60, // Per minute
  message: 'Too many requests, please try again later',
});
