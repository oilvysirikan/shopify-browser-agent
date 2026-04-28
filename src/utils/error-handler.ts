import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  public service: string;
  public originalError: any;

  constructor(service: string, message: string, originalError?: any) {
    super(`External service error: ${service} - ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.originalError = originalError;
  }
}

// Error response formatter
const formatErrorResponse = (error: AppError, req: Request) => {
  const response: any = {
    success: false,
    error: error.message,
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  // Include validation details if available
  if (error instanceof ValidationError && error.details) {
    response.details = error.details;
  }

  // Include request ID if available
  if (req.headers['x-request-id']) {
    response.requestId = req.headers['x-request-id'];
  }

  return response;
};

// Global error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Convert known errors to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error.name === 'ValidationError') {
    appError = new ValidationError(error.message, error);
  } else if (error.name === 'CastError') {
    appError = new ValidationError('Invalid data format');
  } else if (error.name === 'JsonWebTokenError') {
    appError = new AuthenticationError('Invalid token');
  } else if (error.name === 'TokenExpiredError') {
    appError = new AuthenticationError('Token expired');
  } else {
    // Unknown error - don't leak details in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message;
    
    appError = new AppError(message, 500, 'INTERNAL_ERROR');
  }

  // Log the error
  const logData = {
    error: {
      message: error.message,
      stack: error.stack,
      code: appError.code,
      statusCode: appError.statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  };

  if (appError.statusCode >= 500) {
    logger.error('Server error:', logData);
  } else if (appError.statusCode >= 400) {
    logger.warn('Client error:', logData);
  } else {
    logger.info('Error:', logData);
  }

  // Send error response
  const errorResponse = formatErrorResponse(appError, req);
  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  const errorResponse = formatErrorResponse(error, req);
  res.status(404).json(errorResponse);
};

// Error monitoring and alerting
export const monitorErrors = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack
    });
    
    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason,
      promise
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

// Error metrics collection
export const errorMetrics = {
  errors: new Map<string, number>(),
  
  increment(errorCode: string): void {
    const current = this.errors.get(errorCode) || 0;
    this.errors.set(errorCode, current + 1);
  },
  
  getStats(): Record<string, number> {
    return Object.fromEntries(this.errors);
  },
  
  reset(): void {
    this.errors.clear();
  }
};

// Integration with external monitoring services
export const reportError = async (error: AppError, context: any) => {
  // Send to Sentry, DataDog, etc.
  if (process.env.SENTRY_DSN) {
    try {
      // Sentry integration would go here
      logger.info('Error reported to monitoring service');
    } catch (reportError) {
      logger.error('Failed to report error to monitoring service:', reportError);
    }
  }
};
