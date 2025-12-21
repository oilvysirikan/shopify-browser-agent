import { Application, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Health check endpoint
const healthCheck = (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    message: 'Service is running',
    timestamp: new Date().toISOString()
  });
};

// 404 handler
const notFoundHandler = (req: Request, res: Response) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  return res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
};

// Error handler
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(`Error: ${err.message}`, { error: err });
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Setup all routes
export const setupRoutes = (app: Application) => {
  // Health check
  app.get('/health', healthCheck);

  // API routes will be added here
  // Example: app.use('/api/shopify', shopifyRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);
};
