import { Router } from 'express';
import authRoutes from './auth.routes.js';
import shopifyRoutes from './shopify.routes.js';
import { shopifyAIRouter } from './shopify-ai.routes.js';
import contentRoutes from './content.routes.js';
import tenantRoutes from './tenant.routes.js';
import { voiceRouter } from './voice.routes.js';

export const setupRoutes = () => {
  const router = Router();
  
  // Register all routes
  router.use('/auth', authRoutes);
  router.use('/shopify', shopifyRoutes);
  router.use('/shopify-ai', shopifyAIRouter);
  router.use('/content', contentRoutes);
  router.use('/tenant', tenantRoutes);
  router.use('/v1/voice', voiceRouter);
  
  return router;
};
