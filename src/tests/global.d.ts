import { Express } from 'express';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';

declare global {
  var app: Express;
  var server: Server;
  var prisma: PrismaClient;
  var testShop: string;
  
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'test' | 'development' | 'production';
      PORT: string;
      SHOPIFY_API_KEY: string;
      SHOPIFY_API_SECRET: string;
      SCOPES: string;
      HOST: string;
      SHOPIFY_APP_URL: string;
      FRONTEND_URL: string;
      ADMIN_URL: string;
      DATABASE_URL: string;
      [key: string]: string | undefined;
    }
  }
}

export {};
