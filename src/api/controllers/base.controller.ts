import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';

export abstract class BaseController {
  protected handleError = (error: unknown, next: NextFunction) => {
    if (error instanceof AppError) {
      return next(error);
    }
    
    logger.error('Unexpected error:', error);
    return next(new AppError('An unexpected error occurred', 500));
  };

  protected validateRequest = (req: Request, requiredFields: string[]) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(', ')}`,
        400
      );
    }
  };

  protected getShopDomain = (req: Request): string => {
    const shop = req.headers['x-shopify-shop-domain'];
    if (!shop || Array.isArray(shop)) {
      throw new AppError('Missing or invalid shop domain', 400);
    }
    return shop;
  };

  protected async getShopConfig(shopDomain: string) {
    const shopConfig = await prisma.shopConfig.findUnique({
      where: { shopId: shopDomain },
    });

    if (!shopConfig) {
      throw new AppError('Shop configuration not found', 404);
    }

    return shopConfig;
  }

  protected logUsage = async (
    shopDomain: string,
    endpoint: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      await prisma.usage.create({
        data: {
          tenantId: shopDomain,
          endpoint,
          model: metadata.model || 'unknown',
          tokensUsed: metadata.tokensUsed || 0,
          cost: metadata.cost || 0,
          success: metadata.success !== false,
          metadata: metadata.metadata || {},
        },
      });
    } catch (error) {
      logger.error('Failed to log usage:', error);
    }
  };

  protected logAudit = async (
    shopDomain: string,
    action: string,
    status: 'success' | 'failed' | 'partial',
    resourceId?: string,
    metadata: Record<string, any> = {}
  ) => {
    try {
      await prisma.auditLog.create({
        data: {
          tenantId: shopDomain,
          action,
          status,
          resourceId,
          metadata,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });
    } catch (error) {
      logger.error('Failed to log audit:', error);
    }
  };
}
