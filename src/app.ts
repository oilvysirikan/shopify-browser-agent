import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { logger, requestLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupRoutes } from './api/routes';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: config.isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
});

export const createApp = () => {
  const app = express();

  // Trust proxy
  app.set('trust proxy', true);

  // Security headers
  app.use(helmet());

  // Enable CORS
  app.use(
    cors({
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' },
  });
  app.use(limiter);

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Logging
  app.use(
    morgan('combined', {
      stream: { write: (message: string) => logger.http(message.trim()) },
    })
  );
  app.use(requestLogger);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // API Routes
  app.use('/api/v1', setupRoutes());

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Not Found',
      path: req.path,
      method: req.method,
    });
  });

  // Error handling
  app.use(errorHandler);

  return app;
};

export const startServer = async () => {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('✅ Connected to database');

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`🔗 Health check: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');
      
      server.close(async () => {
        logger.info('Server closed');
        await prisma.$disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export default createApp;
