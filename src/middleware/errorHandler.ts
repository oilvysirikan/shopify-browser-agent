import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default to 500 if status code not set
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const isOperational = 'isOperational' in err ? err.isOperational : false;

  // Log the error
  logger.error({
    message: err.message,
    name: err.name,
    stack: err.stack,
    statusCode,
    isOperational,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // In development, send detailed error information
  if (config.isDevelopment) {
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
      error: err,
      stack: config.isDevelopment ? err.stack : undefined,
    });
  }

  // In production, don't leak error details
  if (isOperational) {
    return res.status(statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // For unknown errors in production, send generic message
  logger.error('💥 UNHANDLED ERROR:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};
