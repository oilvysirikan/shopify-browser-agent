import { Express } from 'express';

export const config: {
  port: number;
  env: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string[];
    host: string;
    apiVersion: string;
    isEmbeddedApp: boolean;
  };
  database: {
    url: string;
  };
  session: {
    secret: string;
    cookie: {
      secure: boolean;
      sameSite: 'none' | 'lax' | 'strict' | boolean;
      maxAge: number;
    };
  };
  webhooks: {
    path: string;
    topics: string[];
  };
  logging: {
    level: string;
    dir: string;
  };
  sentry: {
    dsn: string | undefined;
    environment: string;
  };
};

export function applySecurityMiddleware(app: Express): void;
