/**
 * Token Bucket implementation for rate limiting
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  private refillRate: number; // tokens per second
  private maxTokens: number;

  /**
   * Create a new TokenBucket
   * @param maxTokens Maximum number of tokens the bucket can hold
   * @param refillRate Number of tokens added per second
   */
  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on time passed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000; // in seconds
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokens + tokensToAdd, this.maxTokens);
      this.lastRefillTime = now;
    }
  }

  /**
   * Try to consume tokens
   * @param tokens Number of tokens to consume
   * @returns True if tokens were consumed, false otherwise
   */
  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  /**
   * Wait until enough tokens are available
   * @param tokens Number of tokens to wait for
   * @param timeout Maximum time to wait in milliseconds
   * @returns Promise that resolves when tokens are available or rejects on timeout
   */
  async waitForTokens(tokens: number = 1, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const check = () => {
        this.refill();
        
        if (this.tokens >= tokens) {
          this.tokens -= tokens;
          resolve();
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('Rate limit timeout'));
          return;
        }
        
        // Check again after a delay
        setTimeout(check, 100);
      };
      
      check();
    });
  }

  /**
   * Get the current number of available tokens
   */
  get availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
