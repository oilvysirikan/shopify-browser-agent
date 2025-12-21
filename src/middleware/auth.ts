import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../prisma';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      shop?: string;
      userId?: string;
      isInternal?: boolean;
    }
  }
}

export const verifyInternalApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      throw new AppError('API key is required', 401);
    }

    if (apiKey !== config.internalApiKey) {
      throw new AppError('Invalid API key', 403);
    }

    req.isInternal = true;
    next();
  } catch (error) {
    next(error);
  }
};

export const verifyShopifyRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header or query string
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.query.token as string;

    if (!token) {
      throw new AppError('Authentication token is required', 401);
    }

    // Verify JWT token
    const decoded = verify(token, config.jwtSecret) as { 
      shop: string; 
      userId: string;
    };

    // Check if shop exists and is active
    const shop = await prisma.shopConfig.findUnique({
      where: { 
        shopId: decoded.shop,
        status: 'active'
      },
      select: { id: true, plan: true, settings: true }
    });

    if (!shop) {
      throw new AppError('Shop not found or inactive', 404);
    }

    // Attach shop and user to request
    req.shop = decoded.shop;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    logger.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
    });
    
    if (error.name === 'TokenExpiredError') {
      next(new AppError('Token has expired', 401));
    } else if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const checkPlanLimits = (feature: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.shop) {
        throw new AppError('Shop not authenticated', 401);
      }

      const shop = await prisma.shopConfig.findUnique({
        where: { shopId: req.shop },
        select: { plan: true, settings: true }
      });

      if (!shop) {
        throw new AppError('Shop configuration not found', 404);
      }

      // Check if feature is allowed in the current plan
      const planLimits = config.plans[shop.plan];
      if (!planLimits || !planLimits.features.includes(feature)) {
        throw new AppError(
          `Feature '${feature}' is not available in your current plan`,
          403
        );
      }

      // Check usage limits if applicable
      if (planLimits.monthlyLimit) {
        const usage = await getMonthlyUsage(req.shop);
        if (usage >= planLimits.monthlyLimit) {
          throw new AppError(
            'Monthly usage limit exceeded. Please upgrade your plan.',
            429
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

async function getMonthlyUsage(shopId: string): Promise<number> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const usage = await prisma.usage.aggregate({
    where: {
      shopId,
      type: 'api_request',
      createdAt: { gte: firstDay }
    },
    _count: true
  });

  return usage._count;
}

// Rate limiting middleware
export const rateLimit = (windowMs = 60000, max = 100) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up old entries
    requests.forEach((value, key) => {
      if (value.resetTime <= now) {
        requests.delete(key);
      }
    });

    // Get or create request counter
    let requestData = requests.get(ip);
    if (!requestData) {
      requestData = { count: 0, resetTime: now + windowMs };
      requests.set(ip, requestData);
    }

    // Check rate limit
    if (requestData.count >= max) {
      res.set('Retry-After', Math.ceil((requestData.resetTime - now) / 1000).toString());
      return next(new AppError('Too many requests, please try again later', 429));
    }

    // Increment counter
    requestData.count++;
    next();
  };
};
