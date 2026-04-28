// Add global type declarations here
declare type HeadersInit = Headers | string[][] | Record<string, string>;

// Add other global type declarations as needed
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    DATABASE_URL: string;
    REDIS_URL?: string;
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    RATE_LIMIT_MAX: string;
    RATE_LIMIT_WINDOW_MS: string;
    CORS_ORIGIN: string;
    SHOPIFY_API_KEY?: string;
    SHOPIFY_API_SECRET?: string;
    SHOPIFY_ACCESS_TOKEN?: string;
    SHOPIFY_SHOP?: string;
    SHOPIFY_API_VERSION: string;
    JWT_SECRET: string;
    INTERNAL_API_KEY?: string;
    SHOPIFY_PLANS: string;
    OPENAI_API_KEY?: string;
    DEEPL_API_KEY?: string;
  }
}

// Add module declarations for any missing modules
declare module '*.json' {
  const value: any;
  export default value;
}
