import { Router } from 'express';
import { z } from 'zod';
import { shopifyAIController } from '../controllers/shopify-ai.controller.js';
import { validateRequest } from '../middleware/validate-request';

const router = Router();

// Input validation schema for product description generation
const GenerateDescriptionSchema = z.object({
  type: z.literal('product_description'),
  productId: z.string().min(1, 'productId is required'),
  input: z.object({
    title: z.string().min(1, 'input.title is required'),
    currentDescription: z.string().nullable().optional(),
    style: z.enum(['professional', 'casual', 'persuasive', 'informative']).optional(),
    extraPrompt: z.string().optional(),
  }),
});

/**
 * @swagger
 * /api/v1/shopify/generate:
 *   post:
 *     summary: Generate product description
 *     description: Generates a product description using AI
 *     tags: [Shopify AI]
 *     security:
 *       - apiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, productId, input]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [product_description]
 *                 example: product_description
 *               productId:
 *                 type: string
 *                 example: "123456789"
 *               input:
 *                 type: object
 *                 required: [title]
 *                 properties:
 *                   title:
 *                     type: string
 *                     example: "Premium Wireless Headphones"
 *                   currentDescription:
 *                     type: string
 *                     nullable: true
 *                     example: "Current description here"
 *                   style:
 *                     type: string
 *                     enum: [professional, casual, persuasive, informative]
 *                     example: "professional"
 *     responses:
 *       200:
 *         description: Successfully generated description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "This is a professional product description..."
 *                     usage:
 *                       type: object
 *                       properties:
 *                         tokens:
 *                           type: number
 *                           example: 42
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized - Invalid API key
 *       500:
 *         description: Internal server error
 */
router.post(
  '/v1/shopify/generate',
  validateRequest(GenerateDescriptionSchema),
  shopifyAIController.generateDescription
);

/**
 * @swagger
 * /api/v1/shopify/health:
 *   get:
 *     summary: Health check
 *     description: Check if the service is running
 *     tags: [Shopify AI]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/v1/shopify/health', shopifyAIController.healthCheck);

export { router as shopifyAIRouter };
// import { shopifyAIRouter } from './shopify-ai.routes';
// router.use('/shopify', shopifyAIRouter);
