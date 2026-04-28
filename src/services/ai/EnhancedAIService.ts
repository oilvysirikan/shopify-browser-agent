import { AIGenerationOptions, AIGenerationResult, IAIService } from '../../types/ai';
import { RateLimiter } from '../../utils/rateLimit/RateLimiter';
import { CacheService } from '../../utils/cache/CacheService';
import { MetricsCollector, aiRequestsCounter, aiRequestDuration, aiErrorsCounter } from '../../utils/monitoring/MetricsCollector';
import { logger } from '../../utils/logger';

type EnhancedAIServiceOptions = {
  /** The underlying AI service to enhance */
  service: IAIService;
  
  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum requests per time window */
    maxRequests: number;
    /** Time window in seconds */
    timeWindow: number;
  };
  
  /** Caching configuration */
  cache?: {
    /** Whether to enable caching */
    enabled: boolean;
    /** Time to live in seconds */
    ttl?: number;
  };
  
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Base delay between retries in milliseconds */
    baseDelay: number;
  };
};

export class EnhancedAIService implements IAIService {
  private service: IAIService;
  private rateLimiter: RateLimiter;
  private cache: CacheService;
  private metrics: typeof MetricsCollector;
  private cacheEnabled: boolean;
  private retryConfig: { maxRetries: number; baseDelay: number };

  constructor(options: EnhancedAIServiceOptions) {
    this.service = options.service;
    this.cacheEnabled = options.cache?.enabled ?? true;
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      {
        maxRequests: options.rateLimit?.maxRequests ?? 60,
        timeWindow: options.rateLimit?.timeWindow ?? 60,
      },
      {
        maxRetries: options.retry?.maxRetries ?? 3,
        baseDelay: options.retry?.baseDelay ?? 1000,
      }
    );

    // Initialize cache
    this.cache = new CacheService({
      ttl: options.cache?.ttl ?? 300, // 5 minutes default
      useMemory: true,
      usePersistence: false, // Enable if you have Redis or similar
    });

    // Initialize metrics
    this.metrics = MetricsCollector;
    this.retryConfig = {
      maxRetries: options.retry?.maxRetries ?? 3,
      baseDelay: options.retry?.baseDelay ?? 1000,
    };
  }

  getProvider(): string {
    return this.service.getProvider();
  }

  async generateText(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(prompt, options);
    const provider = this.getProvider();
    
    try {
      // Try to get from cache if enabled
      if (this.cacheEnabled && !options.forceRefresh) {
        const cached = await this.cache.get<AIGenerationResult>(cacheKey);
        if (cached) {
          logger.debug('Cache hit', { provider, cacheKey });
          return cached;
        }
      }

      // Execute with rate limiting and retry
      const result = await this.rateLimiter.execute<AIGenerationResult>(
        provider,
        async () => {
          const result = await this.service.generateText(prompt, options);
          
          // Cache the result if successful
          if (this.cacheEnabled) {
            await this.cache.set(cacheKey, result, {
              ttl: options.cacheTtl,
            }).catch(error => {
              logger.error('Failed to cache result:', error);
            });
          }
          
          return result;
        },
        {
          // Override retry config if provided in options
          maxRetries: options.maxRetries ?? this.retryConfig.maxRetries,
          retryDelay: options.retryDelay ?? this.retryConfig.baseDelay,
        }
      );

      // Track successful request
      const duration = Date.now() - startTime;
      this.trackMetrics(provider, duration, true);
      
      return result;
    } catch (error) {
      // Track failed request
      const duration = Date.now() - startTime;
      this.trackMetrics(provider, duration, false);
      
      logger.error('AI service error:', {
        provider,
        error: error instanceof Error ? error.message : String(error),
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      });
      
      throw error;
    }
  }

  /**
   * Generate a cache key based on prompt and options
   */
  private generateCacheKey(prompt: string, options: AIGenerationOptions): string {
    const { model, temperature, maxTokens, ...rest } = options;
    const keyParts = [
      this.getProvider(),
      model || 'default',
      temperature?.toString() || '0.7',
      maxTokens?.toString() || '1000',
      prompt,
      JSON.stringify(rest),
    ];
    
    return keyParts.join('|');
  }

  /**
   * Track metrics for monitoring
   */
  private trackMetrics(provider: string, duration: number, success: boolean): void {
    try {
      // Track request count
      aiRequestsCounter.observe(1, { provider, status: success ? 'success' : 'error' });
      
      // Track duration
      aiRequestDuration.observe(duration / 1000, { provider });
      
      // Track errors
      if (!success) {
        aiErrorsCounter.observe(1, { provider });
      }
      
      // Log performance
      if (duration > 5000) { // Log slow requests
        logger.warn('Slow AI request', { provider, duration });
      }
    } catch (error) {
      logger.error('Error tracking metrics:', error);
    }
  }
  
  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getState();
  }
}
