import { Router } from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/webhookController';
import { webhookRateLimiter } from '../middleware/rateLimit';
import { errorHandler } from '../middleware/errorHandler';
import { requireWebhookTopic } from '../middleware/webhookVerification';
import { WEBHOOK_TOPICS } from '../config/webhooks';

const router = Router();

/**
 * Webhook routes with rate limiting and verification
 * 
 * All webhook endpoints are protected by:
 * 1. Rate limiting
 * 2. HMAC verification
 * 3. Required headers validation
 */

// Apply rate limiting to all webhook endpoints
router.use(webhookRateLimiter);

// Apply webhook verification to all routes
router.use(verifyWebhook);

/**
 * App webhooks
 */
router.post(
  '/app/uninstalled',
  requireWebhookTopic(WEBHOOK_TOPICS.APP_UNINSTALLED),
  handleWebhook
);

/**
 * Order webhooks
 */
router.post(
  '/orders/create',
  requireWebhookTopic(WEBHOOK_TOPICS.ORDERS_CREATE),
  handleWebhook
);

router.post(
  '/orders/updated',
  requireWebhookTopic(WEBHOOK_TOPICS.ORDERS_UPDATED),
  handleWebhook
);

/**
 * Product webhooks
 */
router.post(
  '/products/create',
  requireWebhookTopic(WEBHOOK_TOPICS.PRODUCTS_CREATE),
  handleWebhook
);

router.post(
  '/products/update',
  requireWebhookTopic(WEBHOOK_TOPICS.PRODUCTS_UPDATE),
  handleWebhook
);

/**
 * Customer webhooks
 */
router.post(
  '/customers/create',
  requireWebhookTopic(WEBHOOK_TOPICS.CUSTOMERS_CREATE),
  handleWebhook
);

router.post(
  '/customers/update',
  requireWebhookTopic(WEBHOOK_TOPICS.CUSTOMERS_UPDATE),
  handleWebhook
);

// Error handling middleware for webhook routes
router.use(errorHandler);

export default router;
