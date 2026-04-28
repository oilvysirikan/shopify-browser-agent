import { Express } from 'express';
import { Server } from 'http';
import { applySecurityMiddleware } from '../config/security';
import shopifyRoutes from '../api/shopify/routes';

declare global {
  namespace NodeJS {
    interface Global {
      server: Server;
    }
  }
}

export async function setupTestServer(): Promise<{ app: Express; server: Server }> {
  const app = require('express')();
  
  // Apply security middleware
  applySecurityMiddleware(app);
  
  // Apply routes
  app.use('/api', shopifyRoutes);
  
  // Start server on random port
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => {
      console.log(`Test server running on port ${s.address().port}`);
      resolve(s);
    });
  });
  
  // Store server instance globally for teardown
  global.server = server;
  
  return { app, server };
}

export async function teardownTestServer(): Promise<void> {
  if (global.server) {
    await new Promise<void>((resolve) => {
      global.server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  }
}
