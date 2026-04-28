import { Request, Response, NextFunction } from 'express';
import {
  shopifyApi,
  LATEST_API_VERSION,
  Session,
  LogSeverity,
  Shopify,
  Shopify as ShopifyType
} from '@shopify/shopify-api';
import { logger } from '../utils/logger';

// Initialize Shopify context
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: process.env.SCOPES?.split(',') || ['write_products', 'read_products'],
  hostName: process.env.HOST?.replace(/https?:\/\//, '') || '',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  ...(process.env.NODE_ENV !== 'production' && {
    logger: {
      log: (severity: LogSeverity, msg: string) => {
        if (severity === LogSeverity.Error) {
          logger.error(msg);
        } else if (process.env.NODE_ENV !== 'test') {
          logger.info(msg);
        }
      },
    },
  }),
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      shopify?: {
        session: Session;
        api: typeof Shopify;
      };
      webhook?: {
        topic: string;
        shop: string;
        payload: any;
      };
    }
  }
}

export const shopifyAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shop = req.get('x-shopify-shop-domain');
    if (!shop) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing shop domain',
      });
    }

    // Create a session for the shop
    const session = new Session({
      id: `offline_${shop}`,
      shop,
      state: 'offline',
      isOnline: false,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN, // Optional: If you have a permanent access token
    });

    // Attach Shopify context to the request
    req.shopify = {
      session,
      api: Shopify, // Use the Shopify class directly
    };

    next();
  } catch (error) {
    logger.error('Shopify auth error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate with Shopify',
    });
  }
};

export const shopifyWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const shop = req.get('X-Shopify-Shop-Domain');

    if (!hmac || !topic || !shop) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required headers',
      });
    }

    // Verify webhook
    const valid = await shopify.webhooks.validate({
      rawBody: JSON.stringify(req.body),
      rawRequest: req,
      rawResponse: res,
    });

    if (!valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }

    // Attach webhook data to request
    req.webhook = {
      topic,
      shop,
      payload: req.body,
    };

    next();
  } catch (error) {
    logger.error('Webhook validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate webhook',
    });
  }
};

export const requireRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user roles from session or token
      const userRoles: string[] = []; // Replace with actual roles from your auth system
      
      // Check if user has any of the required roles
      const hasRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      
      next();
    } catch (error) {
      logger.error('Role check error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify user roles',
      });
    }
  };
};
