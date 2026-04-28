import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma.js';
import { shopifyAuth } from '../../middleware/shopify.middleware.js';
import ShopifyAdminService from '../../services/shopify-admin.service.js';
import ShopifyTokenService from '../../services/shopify-token.service.js';

const router = Router();

// Extend Express Request type with Shopify properties
import { Request } from 'express';

declare module 'express' {
  interface Request {
    shopify?: {
      session: {
        shop: string;
        accessToken?: string;
      };
      api: any;
    };
    body: any;
    params: any;
    query: any;
  }
}

type ShopifyRequest = Request;

// Schema for request validation
const RegisterShopSchema = z.object({
  shop: z.string().refine(
    (val) => val.endsWith('.myshopify.com'),
    { message: 'Invalid Shopify shop domain' }
  ),
  sessionToken: z.string().min(1, 'Session token is required'),
});

/**
 * @openapi
 * /api/shopify/register:
 *   post:
 *     tags: [Shopify]
 *     summary: Register a Shopify store with the browser agent
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shop, sessionToken]
 *             properties:
 *               shop:
 *                 type: string
 *                 example: your-store.myshopify.com
 *               sessionToken:
 *                 type: string
 *                 description: Session token from Shopify App Bridge
 *     responses:
 *       200:
 *         description: Successfully registered shop
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 shop:
 *                   type: string
 *                 scopes:
 *                   type: array
 *                 expiresIn:
 *                   type: number
 */
router.post('/register', shopifyAuth, async (req: ShopifyRequest, res) => {
  try {
    const { shop, sessionToken } = req.body;
    
    // Exchange session token for offline access token
    const tokenData = await ShopifyTokenService.exchangeToken(shop, sessionToken);
    
    // Find or create tenant
    const tenant = await prisma.tenant.upsert({
      where: { shop },
      update: {
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        shop,
        plan: 'free',
        isActive: true,
      },
    });

    // Store the token
    await ShopifyTokenService.storeToken(tenant.id, tokenData);

    return res.json({
      success: true,
      shop,
      scopes: tokenData.scope.split(','),
      expiresIn: tokenData.expires_in,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

// Get shop info
router.get('/shop', shopifyAuth, async (req, res) => {
  try {
    const shop = req.shopify?.session.shop;
    if (!shop) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Shop not authenticated',
      });
    }

    // First get the tenant data
    const tenant = await prisma.tenant.findUnique({
      where: { shop },
      select: {
        id: true,
        shop: true,
        plan: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop not found',
      });
    }

    // Then get the auth data
    const shopifyAuth = await prisma.shopifyAuth.findUnique({
      where: { tenantId: tenant.id },
      select: {
        accessToken: true,
        scope: true,
        expiresAt: true,
        isActive: true
      }
    });

    const shopData = {
      ...tenant,
      shopifyAuth
    };

    if (!shopData) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop not found',
      });
    }

    return res.json({
      success: true,
      data: {
        id: shopData.id,
        shop: shopData.shop,
        plan: shopData.plan,
        isActive: shopData.isActive,
        scope: shopData.shopifyAuth?.scope,
        accessToken: shopData.shopifyAuth?.accessToken,
        expiresAt: shopData.shopifyAuth?.expiresAt,
        createdAt: shopData.createdAt,
        updatedAt: shopData.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get shop error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get shop info',
    });
  }
});

// Initialize the service
const shopifyAdminService = new ShopifyAdminService();

// List products
// Handle OPTIONS for CORS preflight
router.options('/products', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Products route with CORS headers
router.get('/products', shopifyAuth, async (req: ShopifyRequest, res) => {
  try {
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const shop = req.shopify?.session.shop;
    if (!shop) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Shop not authenticated',
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const products = await shopifyAdminService.listProducts(
      shop,
      Number(limit),
      skip > 0 ? String(skip) : undefined
    );

    return res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('List products error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    });
  }
});

// Get product by ID
router.get('/products/:id', shopifyAuth, async (req: ShopifyRequest, res) => {
  try {
    const shop = req.shopify?.session.shop;
    if (!shop) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const product = await shopifyAdminService.getProduct(shop, req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get product',
    });
  }
});

export default router;
