// Import the necessary types
import { Express } from 'express';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';

// Import global type declarations
import './global';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests
process.env.SHOPIFY_API_KEY = 'test_api_key';
process.env.SHOPIFY_API_SECRET = 'test_api_secret';
process.env.SCOPES = 'read_products,write_products';
process.env.HOST = 'http://localhost:3000';
process.env.SHOPIFY_APP_URL = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ADMIN_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'file:./test.db';

// Mock the Shopify API
jest.mock('@shopify/shopify-api', () => ({
  shopifyApi: jest.fn().mockImplementation(() => ({
    rest: {
      Product: {
        all: jest.fn().mockResolvedValue([
          {
            id: 'gid://shopify/Product/123',
            title: 'Test Product',
            vendor: 'Test Vendor',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    },
    session: {
      Session: jest.fn().mockImplementation((params) => ({
        ...params,
        isActive: jest.fn().mockReturnValue(true),
      })),
    },
  })),
  ApiVersion: {
    October22: '2022-10',
  },
  shopifyAuth: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
  verifyRequest: jest.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
}));

// Mock Prisma client
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    analyticsEvent: {
      create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

// Mock the logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  requestIdMiddleware: jest.fn((req, res, next) => next()),
  requestLogger: jest.fn((req, res, next) => next()),
}));

// Mock the analytics service
jest.mock('../../services/analyticsService', () => ({
  analyticsService: {
    trackEvent: jest.fn().mockResolvedValue({}),
    getShopUsage: jest.fn().mockResolvedValue({}),
    getEventTypes: jest.fn().mockResolvedValue([]),
  },
}));

// Clean up after all tests
afterAll(async () => {
  if (global.server) {
    await new Promise<void>((resolve) => {
      global.server.close(() => {
        resolve();
      });
    });
  }
  
  if (global.prisma) {
    await global.prisma.$disconnect();
  }
  
  // Clean up environment variables
  const envVars = [
    'NODE_ENV',
    'PORT',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SCOPES',
    'HOST',
    'SHOPIFY_APP_URL',
    'FRONTEND_URL',
    'ADMIN_URL',
    'DATABASE_URL'
  ];
  
  envVars.forEach(envVar => {
    if (process.env[envVar] !== undefined) {
      process.env[envVar] = '';
    }
  });
  
  jest.clearAllMocks();
});
