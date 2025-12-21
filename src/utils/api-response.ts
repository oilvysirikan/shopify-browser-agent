import { Response } from 'express';
import { logger } from './logger';

/**
 * Standard API response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

/**
 * Success response handler
 */
export const successResponse = <T = any>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: any
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response handler
 */
export const errorResponse = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  error?: any
) => {
  // Log the error for server-side debugging
  if (error) {
    logger.error(message, {
      statusCode,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  const response: ApiResponse = {
    success: false,
    message,
  };

  // In development, include error details
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error instanceof Error ? error.message : String(error);
  }

  return res.status(statusCode).json(response);
};

/**
 * Not found response handler
 */
export const notFoundResponse = (res: Response, message: string = 'Resource not found') => {
  return errorResponse(res, message, 404);
};

/**
 * Bad request response handler
 */
export const badRequestResponse = (res: Response, message: string = 'Bad request', errors?: any) => {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.error = errors;
  }

  return res.status(400).json(response);
};

/**
 * Unauthorized response handler
 */
export const unauthorizedResponse = (res: Response, message: string = 'Unauthorized') => {
  return errorResponse(res, message, 401);
};

/**
 * Forbidden response handler
 */
export const forbiddenResponse = (res: Response, message: string = 'Forbidden') => {
  return errorResponse(res, message, 403);
};

/**
 * Validation error response handler
 */
export const validationErrorResponse = (res: Response, errors: any) => {
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors,
  });
};
