import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against the schema
      const result = schema.safeParse({
        ...req.body,
        ...req.params,
        ...req.query,
      });

      if (!result.success) {
        const formattedErrors = formatZodErrors(result.error);
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: formattedErrors,
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: formattedErrors,
        });
      }

      // Replace request body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      logger.error('Error in validateRequest middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      next(error);
    }
  };
}

function formatZodErrors(error: ZodError) {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// Common validation schemas
export const validationSchemas = {
  pagination: z.object({
    page: z.preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().positive().default(1)
    ),
    limit: z.preprocess(
      (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
      z.number().int().positive().max(100).default(10)
    ),
  }),
  
  idParam: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
  
  shopifyProduct: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    body_html: z.string().optional(),
    vendor: z.string().optional(),
    product_type: z.string().optional(),
    tags: z.string().optional(),
    status: z.enum(['active', 'archived', 'draft']).default('draft'),
    variants: z.array(z.any()).optional(),
    images: z.array(z.any()).optional(),
  }),
  
  aiGeneration: z.object({
    shop: z.string().regex(/\.myshopify\.com$/, 'Invalid shop domain'),
    type: z.enum(['product_description', 'seo', 'email']),
    productId: z.string().optional(),
    input: z.object({
      title: z.string().optional(),
      currentDescription: z.string().optional().nullable(),
      extraPrompt: z.string().optional(),
      style: z.string().optional(),
    }),
    config: z.object({
      providerPreference: z
        .enum(['mistral-primary-openai-fallback', 'mistral-only', 'openai-only'])
        .default('mistral-primary-openai-fallback'),
      qualityMode: z
        .enum(['cost-saving', 'balanced', 'quality-first'])
        .default('balanced'),
      qualityThreshold: z.number().min(0).max(1).default(0.8),
      maxTokens: z.number().int().positive().max(2048).optional(),
    }),
  }),
};

// Type utilities for request validation
export type InferRequestType<T extends z.ZodType> = z.infer<T>;

export type ShopifyProductInput = InferRequestType<typeof validationSchemas.shopifyProduct>;
