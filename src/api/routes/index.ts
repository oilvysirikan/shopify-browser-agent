import { Router } from 'express';
import authRoutes from './auth.routes.js';
import shopifyRoutes from './shopify.routes.js';
import shopifyAIRoutes from './shopify-ai.routes.js';
import contentRoutes from './content.routes.js';
import tenantRoutes from './tenant.routes.js';

export const setupRoutes = () => {
  const router = Router();
  
  // Register all routes
  router.use('/auth', authRoutes);
  router.use('/shopify', shopifyRoutes);
  router.use('/shopify-ai', shopifyAIRoutes);
  router.use('/content', contentRoutes);
  router.use('/tenant', tenantRoutes);
  
  return router;
};
