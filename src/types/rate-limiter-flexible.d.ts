declare module 'rate-limiter-flexible' {
  export class RateLimiterMemory {
    constructor(options: {
      points: number;
      duration: number;
    });
    consume(key: string, points?: number): Promise<void>;
  }

  export class RateLimiterRedis {
    constructor(options: {
      storeClient: any;
      points: number;
      duration: number;
    });
    consume(key: string, points?: number): Promise<void>;
  }
}
