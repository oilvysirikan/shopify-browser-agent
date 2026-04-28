import { logger } from '../logger';

type CacheOptions = {
  /** Time to live in seconds */
  ttl?: number;
  /** Whether to use memory cache (default: true) */
  useMemory?: boolean;
  /** Whether to use persistent storage (e.g., Redis) */
  usePersistence?: boolean;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  metadata?: Record<string, any>;
};

export class CacheService {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private defaultTtl: number;
  private useMemory: boolean;
  private usePersistence: boolean;

  constructor(options: CacheOptions = {}) {
    this.defaultTtl = options.ttl || 300; // 5 minutes default
    this.useMemory = options.useMemory ?? true;
    this.usePersistence = options.usePersistence ?? false;
  }

  /**
   * Generate a cache key from a string or object
   */
  private generateKey(key: string | Record<string, any>): string {
    if (typeof key === 'string') return key;
    return JSON.stringify(key);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string | Record<string, any>): Promise<T | null> {
    const cacheKey = this.generateKey(key);
    
    // Try memory cache first
    if (this.useMemory) {
      const entry = this.memoryCache.get(cacheKey);
      if (entry) {
        if (entry.expiresAt > Date.now()) {
          return entry.value as T;
        }
        // Remove expired entry
        this.memoryCache.delete(cacheKey);
      }
    }

    // Try persistent storage if enabled
    if (this.usePersistence) {
      try {
        // TODO: Implement persistent storage (e.g., Redis)
        // const value = await redisClient.get(cacheKey);
        // if (value) {
        //   const entry = JSON.parse(value) as CacheEntry<T>;
        //   if (entry.expiresAt > Date.now()) {
        //     // Update memory cache
        //     if (this.useMemory) {
        //       this.memoryCache.set(cacheKey, entry);
        //     }
        //     return entry.value;
        // }
      } catch (error) {
        logger.error('Error reading from persistent cache:', error);
      }
    }

    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string | Record<string, any>,
    value: T,
    options: Omit<CacheOptions, 'useMemory' | 'usePersistence'> = {}
  ): Promise<void> {
    const cacheKey = this.generateKey(key);
    const ttl = options.ttl ?? this.defaultTtl;
    const expiresAt = Date.now() + ttl * 1000;
    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      metadata: {
        cachedAt: new Date().toISOString(),
        ttl,
      },
    };

    // Update memory cache
    if (this.useMemory) {
      this.memoryCache.set(cacheKey, entry);
    }

    // Update persistent storage if enabled
    if (this.usePersistence) {
      try {
        // TODO: Implement persistent storage (e.g., Redis)
        // await redisClient.set(cacheKey, JSON.stringify(entry), 'PX', ttl * 1000);
      } catch (error) {
        logger.error('Error writing to persistent cache:', error);
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string | Record<string, any>): Promise<boolean> {
    const cacheKey = this.generateKey(key);
    let deleted = false;

    if (this.useMemory) {
      deleted = this.memoryCache.delete(cacheKey) || deleted;
    }

    if (this.usePersistence) {
      try {
        // TODO: Implement persistent storage deletion
        // await redisClient.del(cacheKey);
        deleted = true;
      } catch (error) {
        logger.error('Error deleting from persistent cache:', error);
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    if (this.useMemory) {
      this.memoryCache.clear();
    }

    if (this.usePersistence) {
      try {
        // TODO: Implement persistent storage clear
        // await redisClient.flushdb();
      } catch (error) {
        logger.error('Error clearing persistent cache:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryEntries: number;
    persistentSize?: number;
    persistentEntries?: number;
  } {
    const stats = {
      memorySize: 0,
      memoryEntries: this.memoryCache.size,
    };

    // Calculate memory size
    if (this.useMemory) {
      stats.memorySize = Array.from(this.memoryCache.entries()).reduce(
        (size, [key, entry]) => size + key.length + JSON.stringify(entry).length,
        0
      );
    }

    // TODO: Add persistent storage stats if enabled
    // if (this.usePersistence) {
    //   stats.persistentEntries = await redisClient.dbsize();
    //   // Note: Getting total size is more complex and might require Redis 4+ with MEMORY USAGE
    // }

    return stats;
  }
}
