import { Request, Response, NextFunction } from 'express';

// Extend Express types
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
    }

    interface Request {
      user?: User;
      shop?: string;
      session: any;
    }
  }
}

/**
 * Mock Shopify authentication middleware for testing
 */
export const mockShopifyAuth = (req: Request, res: Response, next: NextFunction) => {
  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }

  // Mock authenticated shop
  const shopDomain = req.get('X-Shopify-Shop-Domain') || 'test-shop.myshopify.com';
  req.session.shop = shopDomain;
  req.shop = shopDomain;
  
  // Mock user session
  req.user = {
    id: 'gid://shopify/User/123',
    email: 'test@example.com',
    role: 'admin',
  };

  next();
};

export default mockShopifyAuth;
