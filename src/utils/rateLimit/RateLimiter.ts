import { TokenBucket } from './TokenBucket';
import { logger } from '../logger';

type RateLimitConfig = {
  /** Maximum number of requests per time window */
  maxRequests: number;
  /** Time window in seconds */
  timeWindow: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
};

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private defaultConfig: Required<RateLimitConfig>;
  private retryConfig: {
    maxRetries: number;
    baseDelay: number;
  };

  constructor(
    defaultConfig: RateLimitConfig,
    retryConfig?: { maxRetries?: number; baseDelay?: number }
  ) {
    this.defaultConfig = {
      maxRequests: defaultConfig.maxRequests,
      timeWindow: defaultConfig.timeWindow,
      maxRetries: defaultConfig.maxRetries || 3,
      retryDelay: defaultConfig.retryDelay || 1000,
    };

    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries || this.defaultConfig.maxRetries,
      baseDelay: retryConfig?.baseDelay || this.defaultConfig.retryDelay,
    };
  }

  /**
   * Get or create a token bucket for a specific key
   */
  private getBucket(key: string, config?: Partial<RateLimitConfig>): TokenBucket {
    if (!this.buckets.has(key)) {
      const effectiveConfig = { ...this.defaultConfig, ...config };
      const tokensPerSecond = effectiveConfig.maxRequests / effectiveConfig.timeWindow;
      this.buckets.set(
        key,
        new TokenBucket(effectiveConfig.maxRequests, tokensPerSecond)
      );
    }
    return this.buckets.get(key)!;
  }

  /**
   * Execute a function with rate limiting and retry logic
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    config?: Partial<RateLimitConfig>
  ): Promise<T> {
    const bucket = this.getBucket(key, config);
    const maxRetries = config?.maxRetries ?? this.retryConfig.maxRetries;
    const baseDelay = config?.retryDelay ?? this.retryConfig.baseDelay;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        // Wait for a token to become available
        await bucket.waitForTokens(1, baseDelay * (attempt + 1) * 2);
        
        // Execute the function
        return await fn();
      } catch (error: any) {
        lastError = error;
        attempt++;
        
        if (attempt <= maxRetries) {
          // Exponential backoff with jitter
          const jitter = Math.random() * 0.5 + 0.75; // 0.75 to 1.25
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) * jitter, 30000);
          
          logger.warn(
            `Attempt ${attempt}/${maxRetries + 1} failed. Retrying in ${Math.round(delay)}ms`,
            { error: error.message, key }
          );
          
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Rate limit exceeded');
  }

  /**
   * Clear all rate limit buckets
   */
  clear(): void {
    this.buckets.clear();
  }

  /**
   * Get the current state of rate limit buckets
   */
  getState(): Record<string, { tokens: number; lastRefill: number }> {
    const state: Record<string, { tokens: number; lastRefill: number }> = {};
    for (const [key, bucket] of this.buckets.entries()) {
      state[key] = {
        tokens: (bucket as any).tokens,
        lastRefill: (bucket as any).lastRefillTime,
      };
    }
    return state;
  }
}
