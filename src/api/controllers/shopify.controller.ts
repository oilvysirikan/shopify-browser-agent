import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import { BaseController } from './base.controller';
import { shopify, makeShopifyRequest } from '../../services/shopify';

export class ShopifyController extends BaseController {
  // Get all products
  public getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = this.getShopDomain(req);
      const { limit = '10', page = '1' } = req.query;
      
      // Get products from Shopify
      const products = await makeShopifyRequest({
        path: 'products',
        query: {
          limit,
          page,
          fields: 'id,title,handle,status,variants,images',
        },
      });

      // Log the successful request
      await this.logAudit(shopDomain, 'GET_PRODUCTS', 'success');
      
      res.json({
        status: 'success',
        data: products,
      });
    } catch (error) {
      this.handleError(error, next);
    }
  };

  // Get product by ID
  public getProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = this.getShopDomain(req);
      const { id } = req.params;

      if (!id) {
        throw new AppError('Product ID is required', 400);
      }

      // Get product from Shopify
      const product = await makeShopifyRequest({
        path: `products/${id}`,
        query: {
          fields: 'id,title,body_html,variants,images,options',
        },
      });

      // Log the successful request
      await this.logAudit(shopDomain, 'GET_PRODUCT', 'success', id);
      
      res.json({
        status: 'success',
        data: product,
      });
    } catch (error) {
      this.handleError(error, next);
    }
  };

  // Generate product description using AI
  public generateDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopDomain = this.getShopDomain(req);
      const { productId, productInfo } = req.body;
      
      // Validate request
      this.validateRequest(req, ['productId', 'productInfo']);

      // Get shop configuration
      const shopConfig = await this.getShopConfig(shopDomain);
      
      // Check quota/limits
      const usage = await this.checkUsage(shopDomain, shopConfig.plan);
      
      // Generate description using AI
      const aiService = this.getAIService(shopConfig.providerPreference);
      const description = await aiService.generateDescription({
        productInfo,
        tone: shopConfig.tone || 'professional',
        language: shopConfig.language || 'en',
      });

      // Update product in Shopify
      const updatedProduct = await makeShopifyRequest({
        method: 'PUT',
        path: `products/${productId}`,
        data: {
          product: {
            id: productId,
            body_html: description,
          },
        },
      });

      // Log usage and audit
      await Promise.all([
        this.logUsage(shopDomain, 'GENERATE_DESCRIPTION', {
          model: aiService.getModelName(),
          tokensUsed: description.length / 4, // Rough estimate
          success: true,
        }),
        this.logAudit(shopDomain, 'GENERATE_DESCRIPTION', 'success', productId, {
          model: aiService.getModelName(),
          tokensUsed: description.length / 4,
        }),
      ]);
      
      res.json({
        status: 'success',
        data: {
          product: updatedProduct,
          usage,
        },
      });
    } catch (error) {
      await this.logAudit(
        this.getShopDomain(req),
        'GENERATE_DESCRIPTION',
        'failed',
        req.body.productId,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      this.handleError(error, next);
    }
  };

  private async checkUsage(shopDomain: string, plan: string) {
    // Get current usage for the period
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const usage = await prisma.usage.aggregate({
      where: {
        tenantId: shopDomain,
        createdAt: { gte: startOfMonth },
      },
      _sum: {
        tokensUsed: true,
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    // Get plan limits
    const planLimits = this.getPlanLimits(plan);
    
    return {
      current: {
        tokens: usage._sum.tokensUsed || 0,
        requests: usage._count.id || 0,
        cost: usage._sum.cost || 0,
      },
      limits: planLimits,
      remaining: {
        tokens: Math.max(0, planLimits.monthlyTokens - (usage._sum.tokensUsed || 0)),
        requests: Math.max(0, planLimits.monthlyRequests - (usage._count.id || 0)),
      },
    };
  }

  private getPlanLimits(plan: string) {
    const limits = {
      free: {
        monthlyTokens: 10000,
        monthlyRequests: 100,
        features: ['basic-generation'],
      },
      basic: {
        monthlyTokens: 100000,
        monthlyRequests: 1000,
        features: ['basic-generation', 'custom-tone', 'multi-language'],
      },
      premium: {
        monthlyTokens: 1000000,
        monthlyRequests: 10000,
        features: ['basic-generation', 'custom-tone', 'multi-language', 'priority-support'],
      },
      enterprise: {
        monthlyTokens: 10000000,
        monthlyRequests: 100000,
        features: ['unlimited', 'custom-models', 'dedicated-support', 'sla'],
      },
    };

    return limits[plan as keyof typeof limits] || limits.free;
  }

  private getAIService(preference: string) {
    // This would be implemented based on your AI service selection
    // For now, we'll use a mock implementation
    return {
      generateDescription: async (params: any) => {
        // In a real implementation, this would call your AI service
        return `Generated description for product: ${JSON.stringify(params)}`;
      },
      getModelName: () => 'mock-ai-model',
    };
  }
}

export const shopifyController = new ShopifyController();
