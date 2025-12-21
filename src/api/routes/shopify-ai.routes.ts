import { Router } from 'express';
import { z } from 'zod';
import { shopifyAIController } from '../controllers/shopify-ai.controller';
import { validateRequest } from '../middleware/validate-request';
import { verifyInternalApiKey } from '../middleware/auth';

const router = Router();

// Input validation schema
const GenerateDescriptionSchema = z.object({
  shop: z.string().regex(/\.myshopify\.com$/, 'Invalid shop domain'),
  type: z.enum(['product_description', 'seo', 'email']),
  productId: z.string().optional(),
  input: z.object({
    title: z.string().optional(),
    currentDescription: z.string().optional().nullable(),
    extraPrompt: z.string().optional(),
    style: z.string().optional(),
  }),
  config: z.object({
    providerPreference: z
      .enum(['mistral-primary-openai-fallback', 'mistral-only', 'openai-only'])
      .default('mistral-primary-openai-fallback'),
    qualityMode: z
      .enum(['cost-saving', 'balanced', 'quality-first'])
      .default('balanced'),
    qualityThreshold: z.number().min(0).max(1).default(0.8),
    maxTokens: z.number().optional(),
  }),
});

// Generate content endpoint
router.post(
  '/generate',
  verifyInternalApiKey,
  validateRequest(GenerateDescriptionSchema),
  shopifyAIController.generateContent
);

// Get usage metrics
router.get(
  '/usage',
  verifyInternalApiKey,
  shopifyAIController.getUsage
);

export { router as shopifyAIRouter };

// Update the main routes file to include these routes:
// In src/api/routes/index.ts:
// import { shopifyAIRouter } from './shopify-ai.routes';
// router.use('/shopify', shopifyAIRouter);
