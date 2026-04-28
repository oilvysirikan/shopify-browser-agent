import 'reflect-metadata';
import 'module-alias/register';
import dotenv from 'dotenv';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import { createServer as createHttpServer, type Server as HttpServer, type ServerOptions } from 'http';
import { createServer as createHttpsServer, type Server as HttpsServer, type ServerOptions as HttpsServerOptions } from 'https';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { applySecurityMiddleware } from './config/security.js';
import type { Express } from 'express';
import { logger } from './utils/logger.js';
import { PrismaClient } from '@prisma/client';
import apiRouter from './api/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { corsMiddleware } from './middleware/cors.js';
import { app as monitoringApp } from './monitoring/dashboard.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Prisma Client
export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'info', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Prisma event listeners
prisma.$on('warn', (e) => logger.warn('Prisma Warning:', e));
prisma.$on('info', (e) => logger.info('Prisma Info:', e));
prisma.$on('error', (e) => logger.error('Prisma Error:', e));

class App {
  public app: Application;
  public port: string | number;
  public env: string;
  public server: HttpServer | HttpsServer;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.env = process.env.NODE_ENV || 'development';

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSwagger();
    this.initializeServer();
  }

  private initializeMiddlewares(): void {
    // Use CORS middleware for all routes
    this.app.use(corsMiddleware);
    
    // Handle preflight requests for all routes
    this.app.options('*', (req, res) => {
      res.sendStatus(200);
    });

    // Parse JSON request body
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Security middleware
    applySecurityMiddleware(this.app as unknown as Express);

    // Logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      const requestId = req.headers['x-request-id'] || uuidv4();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          duration: `${duration}ms`,
          requestId,
        });
      });

      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Mount monitoring dashboard
    this.app.use('/monitoring', monitoringApp);

    // API routes
    this.app.use('/api', apiRouter);

    // Frontend hosting:
    // - production: serve the Vite build from dist/frontend
    // - development: redirect non-API routes to the Vite dev server
    if (this.env === 'production') {
      const frontendPath = join(__dirname, '..', 'dist', 'frontend');

      this.app.use(express.static(frontendPath, {
        index: 'index.html',
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res: Response, path: string) => {
          // Don't cache HTML files
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
        },
      }));

      // SPA fallback - return index.html for non-API routes
      this.app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path === '/health' || req.path.startsWith('/api/') || req.path.startsWith('/monitoring')) {
          return next();
        }
        res.sendFile(join(frontendPath, 'index.html'));
      });
    } else {
      this.app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path === '/health' || req.path.startsWith('/api/') || req.path.startsWith('/monitoring')) {
          return next();
        }
        res.redirect(`http://localhost:5173${req.originalUrl}`);
      });
    }

    // 404 handler for API routes
    this.app.use('/api', notFoundHandler);
  }

  private initializeErrorHandling(): void {
    // Centralized error handling (keeps responses consistent across the app)
    this.app.use(errorHandler);
  }

  private initializeSwagger(): void {
    if (this.env === 'development') {
      try {
        const swaggerUi = require('swagger-ui-express');
        const YAML = require('yamljs');
        const swaggerDocument = YAML.load(join(__dirname, 'docs', 'swagger.yaml'));
        
        this.app.use('/api-docs', 
          swaggerUi.serve, 
          swaggerUi.setup(swaggerDocument, {
            explorer: true,
            customSiteTitle: 'Shopify Browser Agent API',
            customCss: '.swagger-ui .topbar { display: none }',
          })
        );
        
        logger.info(`Swagger docs available at http://localhost:${this.port}/api-docs`);
      } catch (error) {
        logger.warn('Swagger setup failed:', error);
      }
    }
  }

  private initializeServer(): void {
    if (process.env.HTTPS_ENABLED === 'true') {
      const privateKey = readFileSync(process.env.SSL_PRIVATE_KEY_PATH || '', 'utf8');
      const certificate = readFileSync(process.env.SSL_CERTIFICATE_PATH || '', 'utf8');
      const ca = readFileSync(process.env.SSL_CA_BUNDLE_PATH || '', 'utf8');

      const credentials: HttpsServerOptions = {
        key: privateKey,
        cert: certificate,
        ca: ca,
      };

      this.server = createHttpsServer(credentials, this.app as any);
    } else {
      this.server = createHttpServer(this.app as any);
    }
  }

  public async listen(): Promise<void> {
    try {
      // Test database connection
      await prisma.$connect();
      logger.info('Database connected successfully');

      this.server.listen(this.port, () => {
        logger.info(`=================================`);
        logger.info(`======= ENV: ${this.env} =======`);
        logger.info(`🚀 App listening on port ${this.port}`);
        logger.info(`=================================`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      await this.gracefulShutdown();
      process.exit(1);
    }
  }

  public async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down server...');
    
    try {
      // Close HTTP/HTTPS server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((err) => {
            if (err) {
              logger.error('Error closing server:', err);
              return reject(err);
            }
            logger.info('Server closed');
            resolve();
          });
        });
      }

      // Close database connection
      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      // Exit the process
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start the server
const app = new App();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider restarting the server or handling the error appropriately
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Consider restarting the server or handling the error appropriately
});

// Handle termination signals
const signals = ['SIGTERM', 'SIGINT'] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    await app.gracefulShutdown();
  });
});

// Start the server
app.listen().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
