import 'module-alias/register';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { setupRoutes } from './api/routes';
import { logger, requestIdMiddleware, requestLogger } from './utils/app-logger';
import { config } from './config';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request ID to all requests
app.use(requestIdMiddleware);

// Request logging
app.use(requestLogger);

// Enable CORS
app.use(cors({
  origin: config.cors.origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true
}));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Setup routes
setupRoutes(app);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// Start the server
const server = app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port} in ${config.env} mode`);
  logger.info(`Server listening on http://localhost:${config.port}`);
  logger.info(`API Documentation available at http://localhost:${config.port}/api-docs`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use. Please try a different port.`);
  } else {
    logger.error('Failed to start server:', err);
  }
  process.exit(1);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received: shutting down server...`);
  
  server.close(() => {
    logger.info('Server has been stopped');
    // Close database connections or other resources here if needed
    process.exit(0);
  });

  // Force close server after 10 seconds
  setTimeout(() => {
    logger.error('Forcing server shutdown');
    process.exit(1);
  }, 10000);
};

// Handle process signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', { 
    reason: reason.message, 
    stack: reason.stack 
  });
  shutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', { 
    error: err.message, 
    stack: err.stack 
  });
  shutdown('UNCAUGHT_EXCEPTION');
});

export default server;
