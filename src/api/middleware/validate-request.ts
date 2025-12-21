import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../../utils/logger';

// Extend Express Request type to include our custom properties
declare global {
  namespace Express {
    interface Request {
      validatedData?: unknown;
    }
  }
}

/**
 * Middleware to validate request data against a Zod schema
 * @param schema Zod schema to validate against
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || 'unknown';
    
    try {
      // Validate request body against the schema
      const validatedData = await schema.parseAsync({
        ...req.body,
        ...req.params,
        ...req.query,
      });

      // Store validated data in the request object
      req.validatedData = validatedData;
      
      // Log successful validation
      logger.debug('Request validation successful', {
        requestId,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors
        const errors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        logger.warn('Request validation failed', {
          requestId,
          path: req.path,
          method: req.method,
          errors,
        });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      // Handle unexpected errors
      logger.error('Unexpected error during validation', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error during validation',
      });
    }
  };
}
