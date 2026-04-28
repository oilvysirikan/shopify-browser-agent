import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { ShopifyTokenService } from '../services/shopify-token.service';

export async function requireShopifyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // In a real implementation, you would validate the token against your auth system
    // For now, we'll just check if it's a valid tenant ID
    const tenant = await prisma.tenant.findUnique({
      where: { id: token },
      select: { id: true, shop: true },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: 'Invalid tenant ID',
      });
    }

    // Add tenant to request for use in route handlers
    (req as any).tenant = tenant;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        ...req.body,
        ...req.params,
        ...req.query,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.issues,
        });
      }

      // Replace request body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
    }
  };
}

export async function requireShopifyToken(tenantId: string) {
  try {
    const token = await ShopifyTokenService.getActiveToken(tenantId);
    return token;
  } catch (error) {
    throw new Error('No valid Shopify token found. Please connect your Shopify store first.');
  }
}
