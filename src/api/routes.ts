import { Application, Request, Response, NextFunction, Router } from 'express';
import { logger } from '../utils/logger';
import { getProducts, getProductById, createProduct } from './controllers';

// Create a router for API v1
const apiRouter = Router();

// Health check endpoint
const healthCheck = (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    message: 'Service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
};

// 404 handler
const notFoundHandler = (req: Request, res: Response) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  return res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

// Error handler
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errorId = Math.random().toString(36).substring(2, 9);
  logger.error(`[${errorId}] Error: ${err.message}`, { 
    error: err,
    path: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    errorId,
    timestamp: new Date().toISOString()
  });
};

// Setup all routes
export const setupRoutes = (app: Application) => {
  // Health check
  app.get('/health', healthCheck);

  // API v1 Routes
  apiRouter.get('/products', getProducts);
  apiRouter.get('/products/:id', getProductById);
  apiRouter.post('/products', createProduct);
  
  // Mount the API router
  app.use('/api/v1', apiRouter);

  // 404 handler (must be after all other routes)
  app.use(notFoundHandler);

  // Error handler (must be after all other middleware)
  app.use(errorHandler);
};
