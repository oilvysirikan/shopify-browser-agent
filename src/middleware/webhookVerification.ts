import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { errorMonitor } from '../utils/errorMonitor';

declare global {
  namespace Express {
    interface Request {
      shopifyWebhook?: {
        topic: string;
        shop: string;
        webhookId: string;
      };
    }
  }
}

export const verifyWebhook = (req: Request, res: Response, next: NextFunction) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');
  const webhookId = req.get('X-Shopify-Webhook-Id');
  
  // Validate required headers
  if (!hmacHeader || !topic || !shop || !webhookId) {
    errorMonitor.warn('Missing required Shopify webhook headers', {
      hasHmac: !!hmacHeader,
      hasTopic: !!topic,
      hasShop: !!shop,
      hasWebhookId: !!webhookId,
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
    });
    return res.status(401).json({ error: 'Missing required headers' });
  }
  
  // Verify HMAC signature
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const calculatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(rawBody, 'utf8')
    .digest('base64');
  
  if (!crypto.timingSafeEqual(
    Buffer.from(hmacHeader),
    Buffer.from(calculatedHmac)
  )) {
    errorMonitor.warn('Webhook HMAC verification failed', {
      shop,
      topic,
      webhookId,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Add webhook metadata to request
  req.shopifyWebhook = {
    topic,
    shop: shop.toLowerCase(),
    webhookId,
  };
  
  // Log successful verification
  errorMonitor.info('Webhook verified', {
    topic,
    shop,
    webhookId,
  });
  
  next();
};

// Middleware to verify webhook topic
export const requireWebhookTopic = (requiredTopic: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const topic = req.get('X-Shopify-Topic');
    
    if (topic !== requiredTopic) {
      errorMonitor.warn('Webhook topic mismatch', {
        expected: requiredTopic,
        received: topic,
        shop: req.get('X-Shopify-Shop-Domain'),
        webhookId: req.get('X-Shopify-Webhook-Id'),
      });
      return res.status(400).json({ error: `Expected webhook topic: ${requiredTopic}` });
    }
    
    next();
  };
};
