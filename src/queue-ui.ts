import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { contentGenerationQueue, localizationQueue, autoTagQueue } from './queue/queue.config';
import { logger } from './utils/logger';

// Create Express server for the queue UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board instance
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [
    new BullAdapter(contentGenerationQueue),
    new BullAdapter(localizationQueue),
    new BullAdapter(autoTagQueue),
  ],
  serverAdapter: serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Shopify AI Assistant - Queue Dashboard',
      boardLogo: { path: 'https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-primary-logo-456baa801ee66a0a435671082365958316831c9960c480480dd8830b0f57f855.svg' },
      boardFavicon: { path: 'https://www.shopify.com/favicon.ico' },
      miscLinks: [
        { text: 'Shopify Admin', url: '/admin' },
        { text: 'API Docs', url: '/api-docs' },
      ],
    },
  },
});

// Create router for the queue UI
const router = express.Router();

// Add authentication middleware (optional but recommended)
router.use((req, res, next) => {
  // Add your authentication logic here
  // For example, check for admin privileges
  const isAdmin = true; // Replace with actual auth check
  
  if (!isAdmin) {
    return res.status(403).send('Access denied');
  }
  next();
});

// Add the UI to the router
router.use('/', serverAdapter.getRouter());

// Log queue access
router.use((req, res, next) => {
  logger.info(`Queue UI accessed: ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

export default router;
