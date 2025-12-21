import { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import { aiService } from '../../services/ai.service';
import { makeShopifyRequest } from '../../services/shopify';

export const shopifyAIController = {
  generateContent: async (req: Request, res: Response) => {
    const { shop, type, productId, input, config } = req.body;
    
    try {
      // 1. Get or create shop config
      let shopConfig = await prisma.shopConfig.upsert({
        where: { shopId: shop },
        update: {},
        create: { 
          shopId: shop,
          plan: 'free', // Default plan
          providerPreference: config.providerPreference,
          qualityMode: config.qualityMode,
        },
      });

      // 2. Check usage limits
      const usage = await checkUsage(shop, shopConfig.plan);
      if (usage.exceeded) {
        throw new AppError(
          `Plan limit exceeded. Current usage: ${usage.current}/${usage.limit}`, 
          429
        );
      }

      // 3. Generate content using AI
      const prompt = buildPrompt(type, input);
      const aiResponse = await aiService.generateText({
        prompt,
        maxTokens: config.maxTokens,
        temperature: getTemperature(config.qualityMode),
      });

      // 4. Update product in Shopify if productId is provided
      let updatedProduct = null;
      if (productId) {
        updatedProduct = await makeShopifyRequest({
          method: 'PUT',
          path: `products/${productId}`,
          data: {
            product: {
              id: productId,
              body_html: aiResponse,
            },
          },
        });
      }

      // 5. Log usage
      await prisma.aiGeneration.create({
        data: {
          shopId: shop,
          type,
          input: input as any,
          output: aiResponse,
          model: aiService.getModelName(),
          tokensUsed: Math.ceil(aiResponse.length / 4), // Rough estimate
          success: true,
        },
      });

      // 6. Return response
      res.json({
        success: true,
        data: {
          content: aiResponse,
          product: updatedProduct,
          usage: {
            current: usage.current + 1,
            limit: usage.limit,
            resetAt: usage.resetAt,
          },
          provider: aiService.getModelName(),
        },
      });

    } catch (error) {
      // Log error
      await prisma.aiGeneration.create({
        data: {
          shopId: shop,
          type,
          input: input as any,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        },
      });

      throw error; // Let error handler take care of it
    }
  },

  getUsage: async (req: Request, res: Response) => {
    const { shop } = req.query;
    
    if (typeof shop !== 'string') {
      throw new AppError('Shop parameter is required', 400);
    }

    const shopConfig = await prisma.shopConfig.findUnique({
      where: { shopId: shop },
    });

    if (!shopConfig) {
      return res.json({
        plan: 'free',
        current: 0,
        limit: getPlanLimits('free').monthlyRequests,
        resetAt: getResetDate(),
      });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await prisma.aiGeneration.count({
      where: {
        shopId: shop,
        createdAt: { gte: startOfMonth },
        success: true,
      },
    });

    const limits = getPlanLimits(shopConfig.plan);

    res.json({
      plan: shopConfig.plan,
      current: usage,
      limit: limits.monthlyRequests,
      resetAt: getResetDate(),
    });
  },
};

// Helper functions
async function checkUsage(shop: string, plan: string) {
  const limits = getPlanLimits(plan);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usage = await prisma.aiGeneration.count({
    where: {
      shopId: shop,
      createdAt: { gte: startOfMonth },
      success: true,
    },
  });

  return {
    current: usage,
    limit: limits.monthlyRequests,
    exceeded: usage >= limits.monthlyRequests,
    resetAt: getResetDate(),
  };
}

function getPlanLimits(plan: string) {
  const plans: Record<string, { monthlyRequests: number }> = {
    free: { monthlyRequests: 50 },
    basic: { monthlyRequests: 1000 },
    premium: { monthlyRequests: 10000 },
    enterprise: { monthlyRequests: 100000 },
  };

  return plans[plan] || plans.free;
}

function getResetDate() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.toISOString();
}

function buildPrompt(type: string, input: any): string {
  const { title, currentDescription, extraPrompt, style } = input;
  
  switch (type) {
    case 'product_description':
      return `Write a compelling product description for "${title}". 
              Style: ${style || 'professional'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              ${currentDescription ? `\nCurrent description: ${currentDescription}` : ''}
              `;
    
    case 'seo':
      return `Generate SEO-optimized meta description for product: "${title}".
              Focus on: ${style || 'SEO best practices'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              `;
              
    case 'email':
      return `Write a marketing email about the product: "${title}".
              Tone: ${style || 'engaging'}
              ${extraPrompt ? `Additional instructions: ${extraPrompt}` : ''}
              `;
              
    default:
      throw new AppError(`Unsupported content type: ${type}`, 400);
  }
}

function getTemperature(qualityMode: string): number {
  switch (qualityMode) {
    case 'cost-saving': return 0.3;
    case 'balanced': return 0.7;
    case 'quality-first': return 0.9;
    default: return 0.7;
  }
}
